// migrate-data-from-backup.mjs
//
// Migração ÚNICA: lê os dados financeiros (cartões, gastos, faturas, metas,
// assinaturas, etc.) do dump do Postgres do Supabase e grava no Firestore,
// em users/{uid}/<coleção>/{id} — o mesmo formato que src/lib/store.ts,
// store_modules.ts, budgets.ts, customCategories.ts, modules.ts e
// subscriptions.ts esperam.
//
// Pré-requisito: rodar antes o migrate-from-backup.mjs (esse aqui migra só
// os USUÁRIOS/senhas). Sem isso, os UIDs abaixo não existem no Firebase
// Auth ainda — mas os documentos são gravados de qualquer forma, então a
// ordem não quebra nada, só não faz sentido sem os usuários existirem.
//
// Tabelas com dado real no backup: cards, expenses, fixed_expenses,
// fixed_incomes, variable_transactions, card_invoices, custom_categories,
// budgets, subscriptions, loans, user_module_settings (+ goals/investments,
// mesmo com 0 linhas agora, ficam prontas pro futuro).
// user_plans e pluggy_items NÃO são migradas — não existe nada no app atual
// que leia essas coleções no Firestore (features que não vieram pro Firebase).
//
// Uso:
//   node migrate-data-from-backup.mjs <backup> <serviceAccount.json> [--dry-run]

import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const [, , backupPathArg, serviceAccountPathArg] = process.argv;
const DRY_RUN = process.argv.includes('--dry-run');
const NULL = '\\N';

if (!backupPathArg || !serviceAccountPathArg) {
  console.error('Uso: node migrate-data-from-backup.mjs <backup> <serviceAccountKey.json> [--dry-run]');
  process.exit(1);
}
if (!existsSync(backupPathArg)) {
  console.error(`❌ Não encontrei o backup em: ${backupPathArg}`);
  process.exit(1);
}
if (!existsSync(serviceAccountPathArg)) {
  console.error(`❌ Não encontrei o service account em: ${serviceAccountPathArg}`);
  process.exit(1);
}

function readBackupText(p) {
  const buf = readFileSync(p);
  if (buf[0] === 0x1f && buf[1] === 0x8b) return gunzipSync(buf).toString('utf8');
  return buf.toString('utf8');
}

// ── parser genérico de bloco COPY (lê a ordem das colunas do próprio dump) ──
function parseCopyBlock(lines, schema, table) {
  const prefix = `COPY ${schema}.${table} (`;
  const startIdx = lines.findIndex((l) => l.startsWith(prefix));
  if (startIdx === -1) return [];

  const header = lines[startIdx];
  const colsPart = header.slice(prefix.length, header.indexOf(') FROM stdin;'));
  const columns = colsPart.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));

  const rows = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '\\.') break;
    const values = line.split('\t');
    const row = {};
    columns.forEach((col, idx) => { row[col] = values[idx]; });
    rows.push(row);
  }
  return rows;
}

// ── casters ──────────────────────────────────────────────────────────────
const unescape = (v) => v.replace(/\\t/g, '\t').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\\\/g, '\\');
const str = (v) => (v === NULL || v === undefined ? undefined : unescape(v));
const num = (v) => (v === NULL || v === undefined ? 0 : parseFloat(v));
const int = (v) => (v === NULL || v === undefined ? 0 : parseInt(v, 10));
const boolv = (v) => v === 't';
function ts(v) {
  if (v === NULL || v === undefined) return null;
  let s = v.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function pgArray(v) {
  if (v === NULL || v === undefined) return [];
  let s = v;
  if (s.startsWith('{') && s.endsWith('}')) s = s.slice(1, -1);
  if (s === '') return [];
  const parts = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === ',' && !inQuotes) { parts.push(cur); cur = ''; continue; }
    if (c === '\\' && s[i + 1] !== undefined) { cur += s[i + 1]; i++; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts;
}
function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}

// ── config por tabela: como virar doc do Firestore ──────────────────────────
// createdAt: 'timestamp' (Admin Timestamp, igual serverTimestamp()),
//            'iso' (string ISO, só goals — é assim que o app grava),
//            null (não grava createdAt — budgets e moduleSettings)
const TABLES = [
  {
    table: 'cards', collection: 'cards', createdAt: 'timestamp',
    docId: (r) => r.id,
    map: (r) => compact({
      id: r.id, name: str(r.name), brand: str(r.brand),
      lastDigits: str(r.last_digits), limit: num(r.limit),
      closingDay: int(r.closing_day), dueDay: int(r.due_day),
      customGradient: str(r.custom_gradient), active: boolv(r.active),
    }),
  },
  {
    table: 'expenses', collection: 'expenses', createdAt: 'timestamp',
    docId: (r) => r.id,
    map: (r) => compact({
      id: r.id, cardId: str(r.card_id), name: str(r.name),
      totalAmount: num(r.total_amount), category: str(r.category),
      date: str(r.date), installments: int(r.installments),
    }),
  },
  {
    table: 'fixed_expenses', collection: 'fixedExpenses', createdAt: 'timestamp',
    docId: (r) => r.id,
    map: (r) => compact({
      id: r.id, name: str(r.name), amount: num(r.amount),
      category: str(r.category), paidMonths: pgArray(r.paid_months),
      paymentMethod: str(r.payment_method),
    }),
  },
  {
    table: 'fixed_incomes', collection: 'fixedIncomes', createdAt: 'timestamp',
    docId: (r) => r.id,
    map: (r) => compact({
      id: r.id, name: str(r.name), amount: num(r.amount),
      category: str(r.category), receiveDay: r.receive_day === NULL ? undefined : int(r.receive_day),
      receivedMonths: pgArray(r.received_months),
    }),
  },
  {
    table: 'variable_transactions', collection: 'variableTransactions', createdAt: 'timestamp',
    docId: (r) => r.id,
    map: (r) => compact({
      id: r.id, name: str(r.name), amount: num(r.amount), type: str(r.type),
      paymentMethod: str(r.payment_method), category: str(r.category), date: str(r.date),
    }),
  },
  {
    table: 'card_invoices', collection: 'cardInvoices', createdAt: null,
    docId: (r) => `${r.card_id}_${r.month}`,
    map: (r) => compact({
      cardId: str(r.card_id), month: str(r.month),
      actualAmount: num(r.actual_amount), notes: str(r.notes),
    }),
  },
  {
    table: 'custom_categories', collection: 'customCategories', createdAt: 'timestamp',
    docId: (r) => r.id,
    map: (r) => compact({
      id: r.id, label: str(r.label), icon: str(r.icon),
      color: str(r.color), categoryType: str(r.category_type),
    }),
  },
  {
    table: 'budgets', collection: 'budgets', createdAt: null,
    docId: (r) => r.category,
    map: (r) => compact({ category: str(r.category), amount: num(r.amount) }),
  },
  {
    table: 'goals', collection: 'goals', createdAt: 'iso',
    docId: (r) => r.id,
    map: (r) => compact({
      id: r.id, name: str(r.name), emoji: str(r.emoji),
      targetAmount: num(r.target_amount), currentSaved: num(r.current_saved),
      monthsDeadline: int(r.months_deadline), startDate: str(r.start_date),
      color: str(r.color), priority: int(r.priority),
      completedAt: (() => { const d = ts(r.completed_at); return d ? d.toISOString() : undefined; })(),
    }),
  },
  {
    table: 'investments', collection: 'investments', createdAt: 'timestamp',
    docId: (r) => r.id,
    map: (r) => compact({
      id: r.id, name: str(r.name), institution: str(r.institution),
      type: str(r.type), amountInvested: num(r.amount_invested),
      currentValue: num(r.current_value), startDate: str(r.start_date),
    }),
  },
  {
    table: 'loans', collection: 'loans', createdAt: 'timestamp',
    docId: (r) => r.id,
    map: (r) => compact({
      id: r.id, name: str(r.name), institution: str(r.institution),
      totalAmount: num(r.total_amount), remainingAmount: num(r.remaining_amount),
      interestRate: num(r.interest_rate), installments: int(r.installments),
      paidInstallments: int(r.paid_installments), monthlyPayment: num(r.monthly_payment),
      startDate: str(r.start_date),
    }),
  },
  {
    table: 'subscriptions', collection: 'subscriptions', createdAt: 'timestamp',
    docId: (r) => r.id,
    map: (r) => compact({
      id: r.id, name: str(r.name), amount: num(r.amount),
      billingCycle: str(r.billing_cycle),
      billingDay: r.billing_day === NULL ? undefined : int(r.billing_day),
      cardId: str(r.card_id), category: str(r.category), active: boolv(r.active),
      paidMonths: pgArray(r.paid_months), color: str(r.color), icon: str(r.icon),
      notes: str(r.notes), url: str(r.url),
    }),
  },
  {
    table: 'user_module_settings', collection: 'moduleSettings', createdAt: null,
    docId: (r) => r.module_id,
    map: (r) => compact({ active: boolv(r.active) }),
  },
];

async function main() {
  console.log('🔎 Lendo o backup...');
  const lines = readBackupText(backupPathArg).split('\n');

  // ── monta users[uid][collection] = [{docId, data, createdAtDate}] ────────
  const users = new Map(); // uid -> { [collection]: [{docId, data, createdAt}] }
  let totalDocs = 0;

  for (const cfg of TABLES) {
    const rows = parseCopyBlock(lines, 'public', cfg.table);
    for (const row of rows) {
      const userId = row.user_id;
      if (!userId || userId === NULL) continue;
      const docId = cfg.docId(row);
      if (!docId) continue;
      const data = cfg.map(row);

      let createdAtValue;
      if (cfg.createdAt === 'timestamp') {
        const d = ts(row.created_at);
        createdAtValue = { kind: 'timestamp', date: d };
      } else if (cfg.createdAt === 'iso') {
        const d = ts(row.created_at);
        createdAtValue = { kind: 'iso', date: d };
      }

      if (!users.has(userId)) users.set(userId, {});
      const bucket = users.get(userId);
      if (!bucket[cfg.collection]) bucket[cfg.collection] = [];
      bucket[cfg.collection].push({ docId, data, createdAtValue });
      totalDocs++;
    }
  }

  console.log(`   Encontrei ${totalDocs} documento(s) em ${users.size} usuário(s).\n`);

  for (const [userId, collections] of users) {
    const summary = Object.entries(collections).map(([c, arr]) => `${c}: ${arr.length}`).join(', ');
    console.log(`   uid ${userId} → ${summary}`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('🧪 --dry-run: nada foi gravado. Rode sem essa flag pra migrar de verdade.');
    return;
  }

  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore, Timestamp, FieldValue } = await import('firebase-admin/firestore');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPathArg, 'utf8'));
  const app = initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore(app);

  let written = 0;
  let failed = 0;
  const failures = [];

  for (const [userId, collections] of users) {
    for (const [collectionName, docs] of Object.entries(collections)) {
      // grava em lotes de 400 (limite do Firestore é 500 por batch)
      for (let i = 0; i < docs.length; i += 400) {
        const slice = docs.slice(i, i + 400);
        const batch = db.batch();
        for (const { docId, data, createdAtValue } of slice) {
          const ref = db.collection('users').doc(userId).collection(collectionName).doc(String(docId));
          const payload = { ...data };
          if (createdAtValue) {
            if (createdAtValue.kind === 'timestamp') {
              payload.createdAt = createdAtValue.date ? Timestamp.fromDate(createdAtValue.date) : FieldValue.serverTimestamp();
            } else if (createdAtValue.kind === 'iso') {
              payload.createdAt = createdAtValue.date ? createdAtValue.date.toISOString() : new Date().toISOString();
            }
          }
          batch.set(ref, payload, { merge: true });
        }
        try {
          await batch.commit();
          written += slice.length;
          console.log(`✅ ${collectionName} (uid ${userId}): +${slice.length}`);
        } catch (err) {
          failed += slice.length;
          failures.push({ userId, collectionName, message: err.message });
          console.log(`❌ ${collectionName} (uid ${userId}): falhou — ${err.message}`);
        }
      }
    }
  }

  console.log('\n── Resultado ──────────────────────────────');
  console.log(`✅ Documentos gravados: ${written}`);
  console.log(`❌ Falharam: ${failed}`);
  if (failures.length) {
    console.log('\nDetalhe das falhas:');
    for (const f of failures) console.log(`   - ${f.collectionName} (uid ${f.userId}): ${f.message}`);
  }
  console.log('\nPronto. Os dados antigos já devem aparecer pra cada usuário logado.');
}

main().catch((err) => {
  console.error('💥 Erro inesperado:', err);
  process.exit(1);
});
