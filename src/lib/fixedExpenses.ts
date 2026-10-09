// src/lib/fixedExpenses.ts
// Gastos fixos que podem variar (ex.: medicamentos): o valor padrão (`amount`)
// conta como pré-determinado em todos os meses, e cada mês pode ter um ajuste
// em `amountByMonth` com o valor real daquele mês.
import type { FixedExpense } from '@/lib/types';

/** O mês tem um valor ajustado? */
export function isFixedAdjusted(f: FixedExpense, month: string): boolean {
  const v = f.amountByMonth?.[month];
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/** Valor do gasto fixo naquele mês: o ajuste do mês, ou o valor padrão. */
export function fixedAmountForMonth(f: FixedExpense, month: string): number {
  return isFixedAdjusted(f, month) ? (f.amountByMonth as Record<string, number>)[month] : f.amount;
}

/** Cópia da lista com `amount` já trocado pelo valor do mês (só onde há ajuste). */
export function resolveFixedForMonth(list: FixedExpense[], month: string): FixedExpense[] {
  return list.map(f => (isFixedAdjusted(f, month) ? { ...f, amount: fixedAmountForMonth(f, month) } : f));
}

/** Novo mapa de ajustes com `value` aplicado em `month` (ou removido se `value` for null). */
export function withFixedAmountForMonth(
  f: FixedExpense, month: string, value: number | null,
): Record<string, number> {
  const next = { ...(f.amountByMonth ?? {}) };
  if (value === null) delete next[month]; else next[month] = value;
  return next;
}
