# FinanceFlow 💜

> **Controle financeiro pessoal inteligente** — organize receitas, gastos e metas em um só lugar.

![FinanceFlow](https://img.shields.io/badge/FinanceFlow-v1.0-6a21d9?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0xIDE0LjVoLTJ2LTJoMnYyem0wLTRoLTJWN2gydjUuNXoiLz48L3N2Zz4=)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase)
![Vite](https://img.shields.io/badge/Vite-Build-646CFF?style=flat-square&logo=vite)
![PWA](https://img.shields.io/badge/PWA-Instalável-5A0FC8?style=flat-square&logo=pwa)

---

## Visão Geral

O **FinanceFlow** é uma aplicação web progressiva (PWA) de controle financeiro pessoal, com suporte a instalação no mobile e desktop. Oferece um dashboard centralizado com visão completa do mês, gestão de cartões de crédito, gastos fixos, receitas, transações variáveis e módulos opcionais como assinaturas, metas, empréstimos e investimentos.

---

## Funcionalidades Principais

### Dashboard
- Visão geral do mês com saldo, total de receitas e gastos
- Sidebar inteligente com alertas automáticos (faturas próximas, déficit previsto, balanço positivo)
- Progresso de orçamentos por categoria
- Linha do tempo de próximos eventos financeiros (recebimentos e vencimentos)
- Aba de **Patrimônio** com resumo de investimentos e dívidas

### Ganhos
- Cadastro de **receitas fixas** com dia de recebimento
- Controle de quais meses já foram recebidos (marcação por mês)
- **Receitas variáveis** — lançamentos avulsos por data
- Saldo líquido calculado em tempo real

### Gastos
- **Gastos fixos** mensais com categorias e controle de pagamento por mês
- **Cartões de crédito** — lançamentos parcelados com cálculo automático por mês
- **Faturas de cartão** — confirmação de valor real da fatura
- **Transações variáveis** — gastos e receitas pontuais por data
- **Assinaturas recorrentes** — vinculáveis a cartão ou como gasto fixo (módulo adicional)

### Relatórios
- Gráfico de fluxo de caixa acumulado ao longo do mês
- Previsão financeira para os próximos 6 meses
- Detalhamento de parcelas futuras por cartão

### Módulos Adicionais (ativáveis)
| Módulo | Descrição |
|---|---|
| 🔁 **Assinaturas** | Netflix, Spotify, iCloud e outras — aparecem automaticamente nos gastos mensais |
| 🎯 **Metas** | Objetivos financeiros com meta mensal de economia integrada ao dashboard |
| 🏛️ **Empréstimos** | Controle de parcelas, juros e saldo devedor |
| 📈 **Investimentos** | Acompanhamento de rentabilidade e patrimônio |

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Build | [Vite](https://vitejs.dev/) |
| Roteamento | [React Router DOM v6](https://reactrouter.com/) |
| Backend / Auth / DB | [Supabase](https://supabase.com/) (PostgreSQL + Auth + RLS) |
| Estilização | [Tailwind CSS](https://tailwindcss.com/) + CSS Variables |
| Componentes UI | [shadcn/ui](https://ui.shadcn.com/) |
| Animações | [Framer Motion](https://www.framer.com/motion/) |
| Gráficos | [Recharts](https://recharts.org/) |
| Temas | [next-themes](https://github.com/pacocoursey/next-themes) (dark/light) |
| Data fetching | [TanStack Query](https://tanstack.com/query) |
| Notificações | [Sonner](https://sonner.emilkowal.ski/) |
| PWA | Web App Manifest + iOS/Android meta tags |

---

## Estrutura do Projeto

```
financeflow/
├── public/
│   ├── manifest.webmanifest       # Config PWA
│   ├── financeflow-icon-purple-bg.svg
│   └── financeflow-icon-dark-bg.svg
├── src/
│   ├── App.tsx                    # Roteamento principal + auth + lazy loading
│   ├── main.tsx
│   ├── contexts/
│   │   └── FinanceDataContext.tsx # Context global de dados financeiros
│   ├── components/
│   │   ├── AppNav.tsx             # Navegação (sidebar desktop + bottom nav mobile)
│   │   ├── DashboardSidebar.tsx   # Painel lateral do dashboard (alertas, orçamentos, eventos)
│   │   ├── DashboardPatrimonioTab.tsx
│   │   ├── BalanceBreakdownSheet.tsx
│   │   ├── SmartAlertsPopup.tsx
│   │   ├── QuickAddFAB.tsx        # Botão flutuante de adição rápida
│   │   └── ui/                   # Componentes shadcn/ui
│   ├── pages/
│   │   ├── Index.tsx              # Dashboard principal
│   │   ├── FixedPage.tsx          # Gastos e ganhos fixos
│   │   ├── CardsPage.tsx          # Cartões de crédito
│   │   ├── FaturaPage.tsx         # Faturas de cartão
│   │   ├── ReportsPage.tsx        # Relatórios e previsões
│   │   ├── GoalsPage.tsx          # Metas financeiras
│   │   ├── LoansPage.tsx          # Empréstimos
│   │   ├── InvestmentsPage.tsx    # Investimentos
│   │   ├── SubscriptionsPage.tsx  # Assinaturas
│   │   ├── ModulesPage.tsx        # Gerenciamento de módulos
│   │   ├── AuthPage.tsx           # Login / Cadastro
│   │   └── PasswordResetPage.tsx
│   ├── lib/
│   │   ├── supabase.ts            # Client Supabase
│   │   ├── store.ts               # CRUD cartões, despesas, receitas, transações variáveis
│   │   ├── store_modules.ts       # CRUD empréstimos e investimentos
│   │   ├── subscriptions.ts       # CRUD e helpers de assinaturas
│   │   ├── modules.ts             # Controle de módulos ativos (com cache)
│   │   ├── auth.ts                # Autenticação (register, login, logout, reset)
│   │   ├── queryCache.ts          # Cache em memória com TTL
│   │   └── types.ts               # Interfaces TypeScript globais
│   └── hooks/
│       ├── useDeepLink.ts
│       └── usePlatform.ts
├── android/                       # Wrapper Android (Capacitor/WebView)
├── index.html
├── vite.config.ts
└── tailwind.config.ts
```

---

## Rotas da Aplicação

| Rota | Página | Descrição |
|---|---|---|
| `/` | Dashboard | Visão geral do mês |
| `/fixed` | Gastos/Ganhos Fixos | Receitas e despesas recorrentes |
| `/cards` | Cartões | Gerenciamento de cartões e lançamentos parcelados |
| `/faturas` | Faturas | Confirmação de faturas mensais |
| `/reports` | Relatórios | Fluxo de caixa e previsões |
| `/subscriptions` | Assinaturas | Módulo de assinaturas recorrentes |
| `/goals` | Metas | Objetivos financeiros |
| `/loans` | Empréstimos | Controle de dívidas |
| `/investments` | Investimentos | Patrimônio e rentabilidade |
| `/modules` | Módulos | Ativar/desativar módulos extras |

---

## Como Rodar Localmente

### Pré-requisitos

- Node.js 18+
- npm ou yarn
- Conta no [Supabase](https://supabase.com/)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/financeflow.git
cd financeflow

# Instale as dependências
npm install
```

### Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

### Rodando o Projeto

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview
```

---

## Banco de Dados (Supabase)

O projeto usa as seguintes tabelas no PostgreSQL via Supabase:

| Tabela | Descrição |
|---|---|
| `credit_cards` | Cartões de crédito (nome, bandeira, limite, dia de vencimento) |
| `expenses` | Lançamentos parcelados vinculados a cartões |
| `fixed_expenses` | Gastos fixos mensais |
| `fixed_incomes` | Receitas fixas com dia de recebimento |
| `variable_transactions` | Transações variáveis (gastos ou receitas avulsas) |
| `invoices` | Faturas confirmadas por cartão e mês |
| `subscriptions` | Assinaturas recorrentes |
| `loans` | Empréstimos com juros e parcelas |
| `investments` | Investimentos com rendimento |
| `goals` | Metas financeiras |
| `budgets` | Orçamentos por categoria |
| `user_module_settings` | Módulos ativos por usuário |

Todas as tabelas utilizam **Row Level Security (RLS)** — cada usuário acessa apenas seus próprios dados.

---

## PWA — Instalação no Mobile / Desktop

O FinanceFlow é uma PWA completa e pode ser instalada diretamente do navegador:

- **Android/Chrome:** Menu ⋮ → "Adicionar à tela inicial"
- **iOS/Safari:** Compartilhar → "Adicionar à Tela de Início"
- **Desktop/Chrome:** Ícone de instalação na barra de endereços

Configurações do manifest:
- **Cor do tema:** `#6a21d9` (roxo)
- **Fundo:** `#0f0e13` (dark)
- **Orientação:** Portrait
- **Display:** Standalone (sem barra do navegador)
- **Deep link nativo:** `financeflow://` (para reset de senha no app)

---

## Design System

- **Tema padrão:** Dark, com suporte a Light via `next-themes`
- **Cor primária:** Roxo `hsl(262 83% 58%)`
- **Sucesso:** Verde esmeralda `hsl(152 69% 45%)`
- **Destrutivo:** Vermelho `hsl(0 72% 51%)`
- **Aviso:** Âmbar `hsl(38 92% 50%)`
- **Tipografia:** Sistema nativo
- **Border radius:** `rounded-xl` / `rounded-2xl` / `rounded-3xl`
- **Animações:** Framer Motion com `initial/animate` e delays escalonados

---

## Performance

- **Code splitting** com `React.lazy` + `Suspense` — cada página carrega como chunk separado
- **Cache em memória** com TTL configurável (5 min para dados estáticos, 1 min para dinâmicos)
- **Cache de userId** para evitar round-trips extras ao Supabase por mutação
- **Cache de módulos ativos** com invalidação automática após ativar/desativar
- Invalidação seletiva de cache por chave (não invalida tudo a cada mutação)

---

## Alertas Inteligentes

O sistema gera alertas automáticos baseados nos dados do mês:

- 🔴 **Déficit previsto** — fatura vence antes do próximo recebimento e o saldo não cobre
- 🟡 **Fatura próxima** — cartão vence em até 7 dias
- 🟢 **Mês positivo** — saldo livre após todos os compromissos
- 🔴 **Gastos maiores que a renda** — deficit no mês
- 🟡 **Orçamento apertado** — menos de 10% da renda livre
- 🔵 **Recebimento chegando** — receita em até 3 dias

---

## Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.

---

<p align="center">
  Feito com 💜 para quem quer ter controle financeiro de verdade
</p>
