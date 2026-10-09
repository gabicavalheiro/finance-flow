# 0005 — Previsão e classificação: modelo local primeiro, API opcional

**Status:** Aceito

## Contexto
O app prevê gastos e sugere categorias. Mandar o histórico financeiro a um servidor aumenta a exposição de dados.

## Decisão
- `lib/ml/` calcula **no navegador**: classificador (TF-IDF + regressão logística) e previsão (5 métodos candidatos escolhidos por backtest, faixa de 80%).
- A API Python (`ml-api/`) é **opcional** (`VITE_ML_API_URL`). Se configurada e disponível, substitui o resultado local; se falhar, o local continua valendo.
- A API exige token do Firebase (`Authorization: Bearer`), valida tamanho das listas e restringe CORS (`ALLOWED_ORIGINS`). Não guarda dados: é sem estado.
- A previsão só considera o gasto discricionário de meses completos; compromissos conhecidos (parcelas, fixos, assinaturas) são somados por cima.

## Consequências
- Funciona offline e sem enviar dados por padrão.
- Ao ligar a API, **descrições e valores das transações trafegam** para ela: usar só HTTPS, com `REQUIRE_AUTH` ligado e a origem liberada na CSP (`vercel.json`, `connect-src`).
