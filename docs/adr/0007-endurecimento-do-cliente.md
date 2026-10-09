# 0007 — Endurecimento do cliente

**Status:** Aceito

## Contexto
Revisão de segurança do front-end e da distribuição, dado o caráter sensível dos dados.

## Decisão
1. **CSP e cabeçalhos** em `vercel.json`: `script-src 'self'`, `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
2. **URLs digitadas pelo usuário** passam por `lib/safeUrl.ts` (só `http(s)`), evitando XSS por `javascript:` em links.
3. **Erros de autenticação** são traduzidos; mensagens cruas do SDK nunca vão para a tela.
4. **Senha** com mínimo de 8 caracteres (constante `MIN_PASSWORD_LENGTH`).
5. **Android:** `allowBackup=false` e tráfego em texto claro proibido, para que dados do app não vão para o backup do Google.
6. **API de ML** roda sem root no container.
7. Sem `dangerouslySetInnerHTML` com dados do usuário (o único uso restante injeta só variáveis CSS de tema).

## Consequências
- Nova origem externa (API, fonte, imagem) exige ajuste de `vercel.json`, senão a CSP bloqueia.
- `style-src 'unsafe-inline'` permanece porque bibliotecas de gráfico/animação geram estilos inline; scripts continuam restritos.
