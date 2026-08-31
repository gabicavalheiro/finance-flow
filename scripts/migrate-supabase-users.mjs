// scripts/migrate-supabase-users.mjs
//
// Migração ÚNICA: importa os usuários do Supabase Auth (auth.users) para o
// Firebase Auth, preservando:
//   - o mesmo UID  → essencial, porque os dados no Firestore ficam em
//                     users/{uid}/... e foram gravados usando o UID antigo
//                     do Supabase. Se o novo usuário no Firebase tivesse um
//                     UID diferente, ele logaria normalmente mas veria o
//                     app vazio (sem cartões, gastos, etc).
//   - a senha       → via hash bcrypt, o mesmo algoritmo que o Supabase usa
//                     pra guardar senhas. O Firebase Auth suporta importar
//                     hashes bcrypt diretamente (sem pedir reset pra ninguém).
//
// Depois de rodar isso, "Esqueci minha senha" volta a funcionar pra essas
// contas, e o login com a senha antiga também continua funcionando.
//
// ── Como usar ──────────────────────────────────────────────────────────────
// 1. npm install --save-dev pg firebase-admin
// 2. Crie um arquivo .env.migration (NUNCA comitar) na raiz do projeto com:
//
//      SUPABASE_DB_URL=postgresql://postgres:SENHA@db.SEUPROJETO.supabase.co:5432/postgres
//      FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
//
//    - SUPABASE_DB_URL: Supabase Dashboard → Project Settings → Database →
//      Connection string → URI (troque [YOUR-PASSWORD] pela senha do banco).
//    - FIREBASE_SERVICE_ACCOUNT_PATH: Firebase Console → Configurações do
//      projeto → Contas de serviço → "Gerar nova chave privada" (baixa um
//      .json — salve na raiz do projeto, ele já está no .gitignore).
//
// 3. Primeiro rode em modo simulação (não grava nada, só mostra o que faria):
//      node scripts/migrate-supabase-users.mjs --dry-run
//
// 4. Confira a lista de e-mails/contagem impressa. Se estiver tudo certo:
//      node scripts/migrate-supabase-users.mjs
//
// 5. Apague o serviceAccountKey.json e o .env.migration (ou pelo menos troque
//    a senha do banco) depois de terminar — são credenciais sensíveis.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// ── carrega .env.migration manualmente (sem depender de dotenv) ────────────
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const fileEnv = loadEnvFile(path.join(projectRoot, '.env.migration'));
const env = { ...fileEnv, ...process.env };

const SUPABASE_DB_URL = env.SUPABASE_DB_URL;
const FIREBASE_SERVICE_ACCOUNT_PATH = env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_DB_URL) {
  console.error('❌ Faltou SUPABASE_DB_URL no .env.migration (veja o cabeçalho deste arquivo).');
  process.exit(1);
}

const serviceAccountAbsPath = path.resolve(projectRoot, FIREBASE_SERVICE_ACCOUNT_PATH);
if (!existsSync(serviceAccountAbsPath)) {
  console.error(`❌ Não encontrei o service account do Firebase em: ${serviceAccountAbsPath}`);
  console.error('   Baixe em: Firebase Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada.');
  process.exit(1);
}

const { Client } = await import('pg');
const admin = (await import('firebase-admin')).default;

const serviceAccount = JSON.parse(readFileSync(serviceAccountAbsPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function fetchSupabaseUsers() {
  const client = new Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { rows } = await client.query(`
      select id, email, encrypted_password, email_confirmed_at, created_at, raw_user_meta_data
      from auth.users
      where deleted_at is null
        and email is not null
        and encrypted_password is not null
        and encrypted_password <> ''
      order by created_at asc
    `);
    return rows;
  } finally {
    await client.end();
  }
}

function toImportRecord(row) {
  const meta = row.raw_user_meta_data || {};
  const displayName = meta.name || meta.full_name || undefined;
  return {
    uid: row.id, // preserva o mesmo UID do Supabase — crítico pros dados no Firestore
    email: row.email,
    emailVerified: !!row.email_confirmed_at,
    passwordHash: Buffer.from(row.encrypted_password, 'utf8'),
    displayName,
    metadata: {
      creationTime: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    },
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  console.log('🔎 Lendo usuários do Supabase...');
  const rows = await fetchSupabaseUsers();
  console.log(`   Encontrei ${rows.length} usuário(s) com senha definida.\n`);

  if (rows.length === 0) {
    console.log('Nada para migrar.');
    return;
  }

  console.log('E-mails encontrados:');
  for (const r of rows) console.log(`   - ${r.email}  (uid ${r.id})`);
  console.log('');

  if (DRY_RUN) {
    console.log('🧪 --dry-run: nada foi importado. Rode sem essa flag pra migrar de verdade.');
    return;
  }

  const records = rows.map(toImportRecord);
  const batches = chunk(records, 1000); // limite da API do Firebase por chamada

  let totalSuccess = 0;
  let totalFailure = 0;
  const errors = [];

  for (const [i, batch] of batches.entries()) {
    console.log(`⬆️  Importando lote ${i + 1}/${batches.length} (${batch.length} usuário(s))...`);
    const result = await admin.auth().importUsers(batch, {
      hash: { algorithm: 'BCRYPT' },
    });
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
  console.log('Lembre-se de apagar o serviceAccountKey.json e o .env.migration (ou trocar a senha do banco) agora que terminou.');
}

main().catch((err) => {
  console.error('💥 Erro inesperado:', err);
  process.exit(1);
});
