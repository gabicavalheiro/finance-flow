// migrate-from-backup.mjs
//
// Migração ÚNICA: lê os usuários direto de um dump do Postgres do Supabase
// (formato texto do pg_dumpall, ex: db_cluster...backup ou .backup.gz) e
// importa pro Firebase Auth, preservando:
//   - o mesmo UID  → os dados no Firestore ficam em users/{uid}/..., gravados
//                     com o UID antigo do Supabase. Preservar o UID é o que
//                     mantém cada pessoa vendo os dados dela.
//   - a senha       → hash bcrypt, mesmo algoritmo do Supabase. O Firebase
//                     Auth importa esse hash direto, sem precisar resetar
//                     senha de ninguém.
//
// Uso:
//   node migrate-from-backup.mjs <caminho-do-backup> <caminho-do-serviceAccount.json> [--dry-run]
//
// Ex.:
//   node migrate-from-backup.mjs ./db_cluster.backup.gz ./serviceAccountKey.json --dry-run
//   node migrate-from-backup.mjs ./db_cluster.backup.gz ./serviceAccountKey.json

import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const [, , backupPathArg, serviceAccountPathArg] = process.argv;
const DRY_RUN = process.argv.includes('--dry-run');

if (!backupPathArg || !serviceAccountPathArg) {
  console.error('Uso: node migrate-from-backup.mjs <backup.backup|.backup.gz> <serviceAccountKey.json> [--dry-run]');
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
  // gzip magic bytes: 1f 8b
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    return gunzipSync(buf).toString('utf8');
  }
  return buf.toString('utf8');
}

function parseAuthUsers(text) {
  const lines = text.split('\n');
  let inBlock = false;
  const rows = [];
  for (const line of lines) {
    if (line.startsWith('COPY auth.users (')) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (line.trim() === '\\.') break;
      rows.push(line.split('\t'));
    }
  }
  // ordem das colunas conforme o COPY do auth.users do Supabase:
  // 0 instance_id, 1 id, 2 aud, 3 role, 4 email, 5 encrypted_password,
  // 6 email_confirmed_at, ..., 17 raw_user_meta_data, ..., 19 created_at,
  // ..., 32 deleted_at
  const NULL = '\\N';
  const unescape = (v) => v.replace(/\\t/g, '\t').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\\\/g, '\\');

  return rows
    .map((cols) => ({
      id: cols[1],
      email: cols[4],
      encryptedPassword: cols[5],
      emailConfirmedAt: cols[6],
      rawUserMetaData: cols[17],
      createdAt: cols[19],
      deletedAt: cols[32],
    }))
    .filter((r) => r.id && r.email && r.deletedAt === NULL && r.encryptedPassword && r.encryptedPassword !== NULL)
    .map((r) => {
      let meta = {};
      try {
        meta = r.rawUserMetaData && r.rawUserMetaData !== NULL ? JSON.parse(unescape(r.rawUserMetaData)) : {};
      } catch {
        meta = {};
      }
      return {
        uid: r.id,
        email: r.email,
        emailVerified: r.emailConfirmedAt !== NULL,
        passwordHash: Buffer.from(r.encryptedPassword, 'utf8'),
        displayName: meta.name || meta.full_name || undefined,
        metadata: {
          creationTime: r.createdAt && r.createdAt !== NULL ? new Date(r.createdAt).toISOString() : undefined,
        },
      };
    });
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  console.log('🔎 Lendo o backup...');
  const text = readBackupText(backupPathArg);
  const records = parseAuthUsers(text);
  console.log(`   Encontrei ${records.length} usuário(s) com senha definida.\n`);

  if (records.length === 0) {
    console.log('Nada para migrar.');
    return;
  }

  console.log('E-mails encontrados:');
  for (const r of records) console.log(`   - ${r.email}  (uid ${r.uid})${r.emailVerified ? '' : '  [e-mail não confirmado no Supabase]'}`);
  console.log('');

  if (DRY_RUN) {
    console.log('🧪 --dry-run: nada foi importado. Rode sem essa flag pra migrar de verdade.');
    return;
  }

  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPathArg, 'utf8'));
  const app = initializeApp({ credential: cert(serviceAccount) });
  const auth = getAuth(app);

  const batches = chunk(records, 1000);
  let totalSuccess = 0;
  let totalFailure = 0;
  const errors = [];

  for (const [i, batch] of batches.entries()) {
    console.log(`⬆️  Importando lote ${i + 1}/${batches.length} (${batch.length} usuário(s))...`);
    const result = await auth.importUsers(batch, { hash: { algorithm: 'BCRYPT' } });
    totalSuccess += result.successCount;
    totalFailure += result.failureCount;
    for (const err of result.errors) {
      const rec = batch[err.index];
      errors.push({ email: rec.email, uid: rec.uid, message: err.error.message });
    }
  }

  console.log('\n── Resultado ──────────────────────────────');
  console.log(`✅ Importados com sucesso: ${totalSuccess}`);
  console.log(`❌ Falharam: ${totalFailure}`);
  if (errors.length) {
    console.log('\nDetalhe das falhas:');
    for (const e of errors) console.log(`   - ${e.email} (uid ${e.uid}): ${e.message}`);
  }
  console.log('\nPronto. As contas migradas já podem usar "Esqueci minha senha" e logar com a senha antiga.');
}

main().catch((err) => {
  console.error('💥 Erro inesperado:', err);
  process.exit(1);
});
