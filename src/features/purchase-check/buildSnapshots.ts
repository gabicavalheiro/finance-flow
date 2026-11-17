// src/features/purchase-check/buildSnapshots.ts — monta os meses que o "Posso comprar?" avalia
//
// A sobra de cada mês é calculada EXATAMENTE como no Início (computeMonthSummary com os
// lançamentos variáveis e as faturas confirmadas daquele mês), para os números baterem.
//
// A previsão de ML NÃO entra na sobra: ela vira um valor à parte (`extraByMonth`) — quanto
// a pessoa costuma gastar a mais em compras do dia a dia que ainda não foram lançadas. A tela
// usa isso só como aviso ("se você gastar como de costume…"), porque com pouco histórico a
// previsão pode ser bem diferente da realidade.

import { computeMonthSummary } from '@/features/dashboard/calculations';
import { computeCategoryTotals, type CardInvoice } from '@/lib/store';
import type { Subscription } from '@/lib/subscriptions';
import type { CreditCard, Expense, FixedExpense, FixedIncome, VariableTransaction } from '@/lib/types';
import { resolveFixedForMonth } from '@/lib/fixedExpenses';
import { addMonths } from '@/lib/helpers';
import type { ForecastPoint } from '@/lib/ml/forecast';
import type { MonthSnapshot } from './evaluate';

/** Mesmas categorias que a série de ML trata como compromisso (não discricionário). */
const COMMITTED = new Set(['subscription', 'loan']);

export interface SnapshotInput {
  currentMonth: string;
  horizon: number;
  cards: CreditCard[];
  expenses: Expense[];
  fixedExpenses: FixedExpense[];
  incomes: FixedIncome[];
  subscriptions: Subscription[];
  /** Lançamentos variáveis por mês (YYYY-MM) */
  varTxsByMonth: Record<string, VariableTransaction[]>;
  /** Faturas informadas por mês (YYYY-MM) */
  invoicesByMonth: Record<string, CardInvoice[]>;
  /** Previsão de gasto do dia a dia por mês (modelo de ML); vazio = sem previsão */
  forecast: ForecastPoint[];
  today?: Date;
}

export interface SnapshotResult {
  /** Sobra de cada mês igual à do Início */
  months: MonthSnapshot[];
  /** Gasto do dia a dia que o modelo espera ALÉM do que já está lançado, por mês */
  extraByMonth: number[];
  /** Gasto por categoria já lançado no mês atual */
  spentByCategory: Record<string, number>;
}

function forecastFor(month: string, points: ForecastPoint[]): number | null {
  if (points.length === 0) return null;
  const hit = points.find(p => p.month === month);
  if (hit) return Math.max(0, hit.mean);
  // Além do horizonte do modelo: repete o último mês previsto
  const last = points[points.length - 1];
  return month > last.month ? Math.max(0, last.mean) : null;
}

export function buildPurchaseSnapshots(inp: SnapshotInput): SnapshotResult {
  const months: MonthSnapshot[] = [];
  const extraByMonth: number[] = [];
  let spentByCategory: Record<string, number> = {};

  for (let i = 0; i < inp.horizon; i++) {
    const month = addMonths(inp.currentMonth, i);
    const fixed = resolveFixedForMonth(inp.fixedExpenses, month);
    const varTxs = inp.varTxsByMonth[month] ?? [];

    const s = computeMonthSummary({
      month,
      cards: inp.cards,
      expenses: inp.expenses,
      fixedExpenses: fixed,
      incomes: inp.incomes,
      subscriptions: inp.subscriptions,
      varTxs,
      invoices: inp.invoicesByMonth[month] ?? [],
      currentMonth: inp.currentMonth,
      today: inp.today,
    });

    months.push({ month, income: s.totalIncome, expense: s.totalExpense });

    // Quanto do gasto do dia a dia previsto ainda não está lançado neste mês
    const predicted = forecastFor(month, inp.forecast);
    if (predicted === null) {
      extraByMonth.push(0);
    } else {
      const alreadyCard = s.allInstallments
        .filter(x => (x.totalInstallments ?? 1) === 1 && !COMMITTED.has(x.category))
        .reduce((sum, x) => sum + x.amount, 0);
      extraByMonth.push(Math.max(0, predicted - (s.totalVarExp + alreadyCard)));
    }

    if (i === 0) {
      spentByCategory = { ...computeCategoryTotals(s.allInstallments, fixed) };
      for (const t of varTxs) {
        if (t.type !== 'expense') continue;
        spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amount;
      }
    }
  }

  return { months, extraByMonth, spentByCategory };
}
