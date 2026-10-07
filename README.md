# FinanceFlow 💜

> **Controle financeiro pessoal** — receitas, gastos, cartões e metas em um só lugar, com **previsão de gastos por Machine Learning** validada por backtest.

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?style=flat-square&logo=firebase)
![Vite](https://img.shields.io/badge/Vite-Build-646CFF?style=flat-square&logo=vite)
![Python](https://img.shields.io/badge/ML%20API-FastAPI%20%2B%20scikit--learn-009688?style=flat-square&logo=fastapi)
![License](https://img.shields.io/badge/licença-MIT-green?style=flat-square)
![Tests](https://img.shields.io/badge/testes-Vitest%20%2B%20pytest-6E9F18?style=flat-square&logo=vitest)

---

## Visão Geral

O **FinanceFlow** é um app web de controle financeiro pessoal (instalável via manifest e empacotável como app Android com Capacitor). Oferece um dashboard com a visão completa do mês, cartões de crédito, gastos fixos, receitas, transações variáveis e assinaturas, metas, empréstimos e investimentos.

---

## Funcionalidades Principais

### Dashboard
- Saldo, receitas, gastos, pendente e a receber do mês
- Carrossel de cartões com uso do limite e fatura (valor confirmado ou calculado)
- Sidebar com alertas automáticos (fatura próxima, déficit previsto, mês positivo)
- Progresso de orçamentos por categoria e linha do tempo de vencimentos/recebimentos
- Aba de **Patrimônio** (investimentos e dívidas) e widget de metas

### Ganhos e Gastos
- **Receitas fixas** (dia de recebimento, marcação por mês) e **variáveis**
- **Gastos fixos** com controle de pagamento por mês
- **Cartões** com compras parceladas calculadas por mês de fatura; **faturas** com valor real confirmado
- **Transações variáveis**, filtros, edição em lote de categoria e importação de planilhas/extratos (CSV)

### Relatórios
- **Previsão** dos próximos 6 meses com ML (ver abaixo)
- Histórico, fluxo de caixa diário, categorias com detalhamento por lançamento e insights automáticos

### Mais recursos (todos no menu principal)
| Recurso | Descrição |
|---|---|
| 🔁 **Assinaturas** | Cobranças recorrentes, vinculáveis a cartão; entram nos gastos do mês |
| 🎯 **Metas** | Objetivos com prazo, aporte e análise de viabilidade |
| 🏛️ **Empréstimos** | Parcelas, juros e saldo devedor |
| 📈 **Investimentos** | Rentabilidade e patrimônio |

---

## Machine Learning

O FinanceFlow tem duas funcionalidades de ML, ambas com **validação explícita** (o app mostra o quanto cada modelo erra, em vez de só exibir um número).

### 1. Classificador de gastos (`/classifier`)
TF-IDF (palavras + n-gramas de caracteres) + Regressão Logística. Aprende com as correções da usuária (peso maior que a base inicial). Roda no navegador (`src/lib/ml/classifier.ts`, implementação própria com Adam) e, opcionalmente, na API Python (`ml-api/app/model.py`, scikit-learn).

### 2. Previsão de gastos (aba **Relatórios → Previsão**)
Prevê o **gasto variável** dos próximos 6 meses, com faixa de 80% de confiança.

- **O que é previsto:** só decisões novas — gastos variáveis e compras à vista no cartão (pelo mês da fatura). Parcelas, gastos fixos e assinaturas já são conhecidos e somados por cima; assim não há dupla contagem.
- **Série limpa:** o mês corrente fica fora do treino (incompleto) e categorias esparsas (< 3 meses com gasto) viram "Outros".
- **Modelos candidatos:** ingênuo, média móvel, mediana robusta, suavização exponencial e tendência amortecida (Holt). Na API Python entram também **Ridge global** (treinado com todas as categorias, cada série na própria escala) e um **ensemble** de composição fixa.
- **Seleção por backtest:** origem móvel, 1 passo à frente; vence o menor MAE (empate → modelo mais simples). Sempre comparado ao ingênuo ("repetir o mês passado"): se o modelo não superar, a tela avisa.
- **Incerteza:** intervalo de 80% calculado a partir do erro de backtest e alargado com o horizonte (heurística: `σ·√(1 + 0,25·h)`). A cobertura real da faixa nos testes é exibida.
- **Camadas:** o navegador calcula sempre um modelo local (instantâneo/offline). Se `VITE_ML_API_URL` estiver configurada e a API responder (`POST /forecast`), o resultado completo dela substitui o local; se falhar, o local continua valendo.

**Demonstração:** `/inteligencia` roda os dois modelos sem login. Na previsão, o app gera uma série sintética, **esconde os últimos meses do modelo** e compara previsão x realidade (erro do modelo vs. “repetir o último mês”, cobertura da faixa de 80%), com controles de padrão de gasto, histórico e ruído.

**Limitações assumidas:** séries de finanças pessoais são curtas (poucos meses), então sazonalidade anual não é aprendida; com menos de 5 meses completos a previsão é marcada como *não confiável*; o total é previsto direto da soma das categorias, mas os intervalos por categoria assumem independência.

**Testes:** `npm test` (motor de previsão, construção das séries, painel e estados de tela) e `cd ml-api && pytest` (inclui um teste que garante que o Ridge nunca usa dados do futuro no backtest).

```
src/lib/ml/forecast.ts          # motor local (funções puras)
src/lib/ml/spendingSeries.ts    # histórico do app → séries mensais
src/lib/ml/forecastApi.ts       # cliente da API com fallback
src/features/forecast/          # hook + painel (gráfico, métricas, tabelas)
src/features/intelligence/      # página pública (/inteligencia): simulador com dados sintéticos
src/lib/ml/classifier.ts        # classificador de gastos (TF-IDF + regressão logística)
ml-api/app/forecast.py          # motor completo (Ridge global, ensemble)
```

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Build | [Vite](https://vitejs.dev/) |
| Roteamento | [React Router v6](https://reactrouter.com/) |
| Auth e banco | [Firebase Authentication](https://firebase.google.com/docs/auth) + [Cloud Firestore](https://firebase.google.com/docs/firestore) |
| Estilização / UI | [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| Animações | [Framer Motion](https://www.framer.com/motion/) |
| Gráficos | [Recharts](https://recharts.org/) |
| ML (navegador) | TypeScript puro (sem bibliotecas de ML) |
| ML (API) | [FastAPI](https://fastapi.tiangolo.com/) + scikit-learn + NumPy |
| Mobile | [Capacitor](https://capacitorjs.com/) (Android) |
| Testes | [Vitest](https://vitest.dev/) + Testing Library, [pytest](https://pytest.org/) |

---

## Estrutura do Projeto

```
├── src/
│   ├── App.tsx                  # Rotas (lazy) + auth + ErrorBoundary
│   ├── pages/                   # Orquestradores finos: carregam dados e compõem features
│   │   ├── Index.tsx            # Dashboard
│   │   ├── ReportsPage.tsx      # Relatórios
│   │   ├── GoalsPage.tsx · SubscriptionsPage.tsx · CardsPage.tsx · FixedPage.tsx · ...
│   ├── features/                # Código por funcionalidade
│   │   ├── dashboard/           # calculations.ts (resumo do mês, função pura) + components/
│   │   ├── reports/             # calculations.ts + tabs/ + components/ + CategoryDrilldown
│   │   ├── forecast/            # hook + painel de previsão (gráfico, métricas, tabelas)
│   │   ├── goals/               # GoalCard, GoalDialog, AddSavingsDialog, constantes
│   │   └── subscriptions/       # FormDialog, SubCard, constantes e tipos
│   ├── components/
│   │   ├── states/              # Loading / Empty / Error reutilizáveis
│   │   ├── ErrorBoundary.tsx    # Erro de uma página não derruba o app
│   │   ├── classifier/          # Gráficos e importação do classificador
│   │   └── ui/                  # shadcn/ui
│   ├── lib/
│   │   ├── firebase.ts          # Inicialização do Firebase
│   │   ├── store.ts · store_modules.ts · subscriptions.ts · goals.ts · budgets.ts  # CRUD (Firestore)
│   │   ├── queryCache.ts        # Cache em memória com TTL
│   │   ├── ml/                  # forecast.ts, spendingSeries.ts, forecastApi.ts, classifier.ts, ...
│   │   └── classifier/          # Cliente da API, CSV e exemplos
│   ├── contexts/FinanceDataContext.tsx
│   └── hooks/
├── ml-api/                      # API Python (FastAPI): /health, /classify, /forecast
│   ├── app/                     # main.py, forecast.py, model.py, auth.py
│   └── tests/                   # pytest
├── firestore.rules              # Regras de segurança do Firestore
├── android/                     # Wrapper Android (Capacitor)
└── public/manifest.webmanifest
```

**Convenção:** páginas só orquestram (dados + estado + composição); a lógica de cálculo fica em funções puras em `features/<área>/calculations.ts`, o que permite testá-las sem renderizar nada.

---

## Rotas

| Rota | Descrição |
|---|---|
| `/` | Dashboard |
| `/fixed` | Gastos e ganhos fixos |
| `/cards` | Cartões e lançamentos parcelados |
| `/faturas` | Faturas mensais |
| `/reports` | Relatórios e previsão (ML) |
| `/classifier` | Classificador de gastos (ML) |
| `/inteligencia` | **Inteligência financeira** (pública, sem login): simulador de previsão e classificador ao vivo |
| `/subscriptions` · `/goals` · `/loans` · `/investments` | Assinaturas, metas, empréstimos e investimentos |

---

## Como Rodar Localmente

### Pré-requisitos
- Node.js 18+
- Um projeto no [Firebase](https://console.firebase.google.com/) com **Authentication** (e-mail/senha) e **Firestore** habilitados
- (Opcional) Python 3.11+ para a API de ML

### Instalação

```bash
git clone https://github.com/gabicavalheiro/finance-flow.git
cd finance-flow
npm install
cp .env.example .env.local   # preencha com os valores do seu projeto Firebase
```

### Variáveis de ambiente

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# Opcional: ativa os modelos completos em Python (sem isso, o app usa os modelos locais)
# VITE_ML_API_URL=http://localhost:8000
```

Publique as regras do Firestore com `firebase deploy --only firestore:rules` (arquivo `firestore.rules`).

### Comandos

```bash
npm run dev            # desenvolvimento
npm run build          # build de produção
npm run preview        # preview do build
npm test               # testes do front-end (Vitest)
npm run sync:android   # build mobile + cap sync
```

### API de ML (opcional)

```bash
cd ml-api
pip install -r requirements.txt -r requirements-dev.txt
REQUIRE_AUTH=false uvicorn app.main:app --reload   # só para desenvolvimento local
pytest                                              # testes da API
```

Em produção, defina `FIREBASE_PROJECT_ID` (a API valida o ID token do Firebase enviado pelo app) e `ALLOWED_ORIGINS`. Há um `Dockerfile` pronto.

---

## Dados (Firestore)

Todos os dados ficam em subcoleções de `users/{uid}/...`, e as regras (`firestore.rules`) permitem que cada usuário leia e escreva **somente** o próprio documento-raiz:

`cards` · `expenses` · `fixedExpenses` · `fixedIncomes` · `variableTransactions` · `cardInvoices` · `subscriptions` · `loans` · `investments` · `goals` · `budgets` · `customCategories`

---

## Instalação no celular

- **Manifest (PWA básico):** o app pode ser adicionado à tela inicial (Android/Chrome, iOS/Safari, desktop/Chrome). **Ainda não há service worker**, então não funciona offline.
- **Android nativo:** `npm run sync:android` + `npm run open:android` (Capacitor). Deep link `financeflow://` usado na redefinição de senha.

---

## Performance e robustez

- **Code splitting** por página (`React.lazy` + `Suspense`)
- **Cache em memória** com TTL e invalidação seletiva por chave (`queryCache.ts`)
- **Estados de tela** padronizados (carregando, vazio, erro com "tentar de novo") e `ErrorBoundary` por rota

---

## Testes

| Escopo | Comando |
|---|---|
| Front-end (cálculos, previsão, painel, páginas, estados) | `npm test` |
| E2E (Playwright: laboratório de ML, login, dashboard, relatórios) | `npx playwright install chromium && npx playwright test` — os fluxos autenticados exigem `E2E_EMAIL` e `E2E_PASSWORD` de um usuário de teste do Firebase; sem eles, são pulados |
| API de ML (classificador, previsão, sem vazamento de dados futuros) | `cd ml-api && pytest` |

---

## Licença

Distribuído sob a licença MIT. Veja [`LICENSE`](LICENSE).

---

<p align="center">
  Feito com 💜 para quem quer ter controle financeiro de verdade
</p>
