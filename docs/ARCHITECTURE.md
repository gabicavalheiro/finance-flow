# Arquitetura do FinanceFlow

Visão geral. As decisões e seus motivos estão em [`docs/adr/`](adr/README.md).

## Mapa

```
Navegador / app Android (Capacitor)
 └─ React (Vite)
     ├─ pages/        rotas (Index, Faturas, Cartões, Metas, Inteligência, Configurações…)
     ├─ features/     dashboard · forecast · intelligence · goals · reports · subscriptions
     ├─ components/   diálogos, navegação, widgets; components/ui = shadcn
     ├─ contexts/     FinanceDataContext (dados + refresh), CustomCategoryContext
     └─ lib/          regras puras + acesso a dados
         ├─ store.ts, store_modules.ts, goals.ts, subscriptions.ts, customCategories.ts → Firestore
         ├─ invoiceStatus.ts, invoiceAdjust.ts, budgets.ts, fixedExpenses.ts, loanPayments.ts → regras
         ├─ preferences.ts → preferências de interface
         ├─ firestorePaths.ts → único lugar que monta users/{uid}/… (uid sempre da sessão)
         ├─ safeUrl.ts → validação de links
         └─ ml/ → previsão e classificação locais
Firebase Auth ── identifica o usuário
Firestore ────── users/{uid}/<coleção>/{id}  (protegido por firestore.rules)
ml-api (opcional) FastAPI: /classify e /forecast, exige token do Firebase
```

## Fluxo de dados
1. `App.tsx` aguarda `onAuthStateChanged`; só renderiza as telas com sessão ativa.
2. `FinanceDataContext` carrega os dados via `lib/store*.ts` (cache em memória com TTL, limpo no logout).
3. Telas calculam resumos com funções puras de `lib/` e `features/*/calculations`.
4. Escritas passam por `store.ts` (que remove campos `undefined`), invalidam o cache e chamam `refresh()`.

## Coleções do Firestore
`cards`, `expenses`, `fixedExpenses`, `fixedIncomes`, `variableTransactions`, `cardInvoices`, `budgets`, `goals`, `investments`, `loans`, `subscriptions`, `customCategories`, `mlTransactions`, `mlExamples`, `settings`.
Ao criar uma nova, inclua-a em `firestore.rules`.

## Conceitos de domínio
- **Fatura:** valor calculado (soma das parcelas) × valor final informado (`actualAmount`) × valor pago (`paidAmount`). Ver ADR 0004.
- **Gasto discricionário:** compras à vista e variáveis; é o que a previsão estima. Compromissos conhecidos ficam fora.
- **Mês da fatura:** a compra conta no mês em que a fatura fecha, não no da compra.

## Como rodar
```
npm install
cp .env.example .env     # preencha as chaves do Firebase
npm run dev              # http://localhost:8080
npm test                 # Vitest
```
