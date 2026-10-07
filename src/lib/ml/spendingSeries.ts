// src/lib/ml/spendingSeries.ts — transforma o histórico do app em séries mensais para previsão
//
// Separa o que é COMPROMISSO (parcelas já lançadas, gastos fixos, assinaturas: valor conhecido)
// do que é GASTO DISCRICIONÁRIO (compras à vista no cartão + gastos variáveis: incerto).
// Só o discricionário precisa de ML — o resto já é conhecido e é somado por cima.
//
// Regras que evitam erros clássicos:
//  • o mês corrente fica de fora (está incompleto e puxaria a previsão para baixo);
//  • compras no cartão contam no mês da FATURA, que é quando o dinheiro sai;
//  • parcelas (>1x) ficam fora: são compromisso, não decisão nova;
//  • categorias esparsas (< 3 meses com gasto) são agrupadas em "other".

import { getInvoiceMonth } from '@/lib/helpers';
import type { CreditCard, Expense, VariableTransaction } from '@/lib/types';
import { addMonthsStr } from './forecast';

/** Categorias modeladas em outro lugar (assinaturas/empréstimos têm valor conhecido). */
const COMMITTED_CATEGORIES = new Set(['subscription', 'loan']);
const MIN_ACTIVE_MONTHS = 3;

export interface SpendingSeries {
  /** meses completos, em ordem (YYYY-MM) */
  months: string[];
  byCategory: Record<string, number[]>;
  /** último mês completo (null se não há histórico) */
  lastMonth: string | null;
}

export interface SeriesInput {
  expenses: Expense[];
  cards: CreditCard[];
  variable: VariableTransaction[];
  /** mês corrente (YYYY-MM); fica de fora da série */
  currentMonth: string;
  maxMonths?: number;
}

export function buildDiscretionarySeries(input: SeriesInput): SpendingSeries {
  const { expenses, cards, variable, currentMonth, maxMonths = 24 } = input;
  const endMonth = addMonthsStr(currentMonth, -1);
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const acc = new Map<string, Map<string, number>>(); // categoria → mês → valor

  const add = (month: string, category: string, amount: number) => {
    if (month > endMonth || !(amount > 0) || COMMITTED_CATEGORIES.has(category)) return;
    let byMonth = acc.get(category);
    if (!byMonth) acc.set(category, (byMonth = new Map()));
    byMonth.set(month, (byMonth.get(month) ?? 0) + amount);
  };

  for (const e of expenses) {
    if ((e.installments ?? 1) > 1) continue;
    const card = cardById.get(e.cardId);
    if (!card) continue;
    add(getInvoiceMonth(e.date, card), e.category, e.totalAmount);
  }
  for (const v of variable) {
    if (v.type !== 'expense') continue;
    add(v.date.slice(0, 7), v.category as string, v.amount);
  }

  const seen: string[] = [];
  acc.forEach((byMonth) => byMonth.forEach((_, m) => seen.push(m)));
  if (seen.length === 0) return { months: [], byCategory: {}, lastMonth: null };
  const first = seen.reduce((a, b) => (a < b ? a : b));

  const earliestAllowed = addMonthsStr(endMonth, -(maxMonths - 1));
  const start = first < earliestAllowed ? earliestAllowed : first;
  const months: string[] = [];
  for (let m = start; m <= endMonth; m = addMonthsStr(m, 1)) months.push(m);
  if (months.length === 0) return { months: [], byCategory: {}, lastMonth: null };

  const byCategory: Record<string, number[]> = {};
  acc.forEach((byMonth, category) => {
    const values = months.map((m) => byMonth.get(m) ?? 0);
    const active = values.filter((v) => v > 0).length;
    if (active === 0) return;
    const key = active < MIN_ACTIVE_MONTHS ? 'other' : category;
    if (!byCategory[key]) byCategory[key] = new Array(months.length).fill(0);
    values.forEach((v, i) => { byCategory[key][i] += v; });
  });

  return { months, byCategory, lastMonth: months[months.length - 1] };
}
