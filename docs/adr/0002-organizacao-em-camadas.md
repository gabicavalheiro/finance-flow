# 0002 — Organização do código em camadas

**Status:** Aceito

## Contexto
O projeto cresceu com telas grandes misturando regra de negócio, acesso a dados e interface.

## Decisão
```
src/
  pages/      Rotas. Compõem features e componentes; sem regra de negócio.
  features/   Módulos por assunto (dashboard, forecast, intelligence, goals, reports, subscriptions).
  components/ Componentes de interface reutilizáveis; components/ui = shadcn.
  contexts/   Estado compartilhado (FinanceDataContext, CustomCategoryContext).
  hooks/      Hooks genéricos.
  lib/        Regras de negócio puras + acesso a dados (store*.ts, Firestore).
  lib/ml/     Modelos locais de previsão e classificação.
```
Regras de dependência (de cima para baixo, nunca o contrário):
`pages → features → components → contexts/hooks → lib`.
`lib/` **não importa** de `components`, `pages` ou `features`.

Regras de negócio novas entram em `lib/` como funções puras, com teste em `lib/__tests__/`.

## Consequências
- Cálculos (faturas, previsão, preferências) são testáveis sem renderizar tela.
- Telas com mais de ~400 linhas são candidatas a divisão em `features/<assunto>/components`.
