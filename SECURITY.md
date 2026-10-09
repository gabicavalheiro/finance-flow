# Segurança

O FinanceFlow guarda dados financeiros pessoais. Esta página resume o que já é feito e o que ainda recomendamos.

## Reportar um problema
Não abra issue pública. Envie um e-mail ao mantenedor do repositório descrevendo o problema e como reproduzi-lo.

## Como os dados são protegidos hoje
| Área | Proteção | Onde |
|---|---|---|
| Isolamento entre usuários | Firestore Rules: só o dono acessa `users/{uid}/…`, só coleções conhecidas, limites de tamanho | `firestore.rules`, ADR 0003 |
| Sessão | Firebase Auth; telas só carregam com sessão ativa; cache limpo no logout | `App.tsx`, `lib/store.ts` |
| Senha | Mínimo de 8 caracteres; redefinição por e-mail | `lib/auth.ts` |
| Erros | Mensagens traduzidas; nada do SDK é exibido | `lib/auth.ts` |
| XSS | CSP restritiva, links validados (`http(s)` apenas), sem HTML dinâmico com dados do usuário | `vercel.json`, `lib/safeUrl.ts` |
| Transporte | HTTPS forçado (HSTS) | `vercel.json` |
| App Android | Sem backup automático, sem tráfego em texto claro, depuração de WebView desligada | `AndroidManifest.xml`, `capacitor.config.ts` |
| API de ML | Token do Firebase obrigatório, CORS restrito, limites de entrada, container sem root | `ml-api/` |
| Segredos | `.env` e chaves de conta de serviço ignorados pelo Git | `.gitignore` |

A `VITE_FIREBASE_API_KEY` **não é segredo** (vai no bundle por desenho). O que protege os dados são as regras do Firestore e a lista de domínios autorizados no console do Firebase.

## Ações manuais necessárias (não dá para fazer só pelo código)
1. Publicar as regras: `firebase deploy --only firestore:rules`.
2. Console do Firebase → Authentication → Settings → **Authorized domains**: deixe só os domínios reais.
3. Console do Google Cloud → Credenciais: restrinja a API key por **HTTP referrer** (domínios do app).
4. Authentication → **Password policy**: exija 8+ caracteres, para valer também fora do app.
5. Ative **Firebase App Check** (reCAPTCHA Enterprise) para o Firestore e o Auth.
6. Se a chave `finance-flow-dbc29-*.json` (conta de serviço da migração) já existiu em algum computador ou commit, **revogue-a** no Google Cloud (IAM → Contas de serviço → Chaves).
7. Se usar a API de ML, adicione a origem dela em `connect-src` no `vercel.json` e defina `FIREBASE_PROJECT_ID` e `ALLOWED_ORIGINS`.

## Auditoria de dependências (`npm audit --omit=dev`)
Última análise: 14 alertas (9 altos, 5 moderados). Triagem:

| Pacote | Tipo | Avaliação |
|---|---|---|
| `tailwindcss`, `braces`, `micromatch`, `chokidar`, `fast-glob`, `postcss-*` | ferramentas de **build** | Não vão para o navegador do usuário; risco só na máquina de desenvolvimento. Atualizar quando o Tailwind 4 for adotado. |
| `@grpc/grpc-js`, `@firebase/firestore*` | transitivos do `firebase` | O "conserto" sugerido pelo npm é **rebaixar** o Firebase para a v9; não aplicar. O `grpc-js` é usado no Node, não no navegador. Acompanhar novas versões do `firebase`. |
| `react-router(-dom)` 6.x | runtime | Redirecionamento aberto via `\` em `<Link>`/`navigate` com destino vindo de fora. O app só navega para rotas internas fixas. Migrar para a v7 em uma tarefa própria (mudança grande). |

Rodar `npm audit` a cada atualização de dependências.

## Próximos passos recomendados
- Testes das regras do Firestore com o emulador (`@firebase/rules-unit-testing`) e validação de campos por coleção.
- Autenticação em dois fatores (Firebase Auth com MFA).
- Bloqueio por inatividade (sair após X minutos sem uso).
- Exportar e excluir a conta e todos os dados do usuário (LGPD).
- `npm audit` no pipeline e Dependabot.
