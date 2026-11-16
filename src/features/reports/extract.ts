// Extrato: lista plana de todos os lançamentos do mês (cartão, fixo, assinatura, renda e
// variáveis), usada pela aba "Extrato" em Relatórios — com busca por nome e impressão/PDF.
// Fica em arquivo próprio (e não em calculations.ts) por juntar fontes de dados diferentes
// das abas de gráfico (inclui também as rendas, que os gráficos tratam agregadas).

import { resolveCategoryInfo } from '@/lib/customCategories';
import { monthlyAmount, type Subscription } from '@/lib/subscriptions';
import type {
  CreditCard, FixedExpense, FixedIncome, MonthlyInstallment, VariableTransaction,
} from '@/lib/types';
import { daysInMonth } from './format';

export type ExtractSource = 'Cartão' | 'Fixo' | 'Assinatura' | 'Renda' | 'Variável';

export interface ExtractItem {
  id: string;
  name: string;
  amount: number;
  type: 'income' | 'expense';
  source: ExtractSource;
  categoryLabel: string;
  categoryColor: string;
  categoryKey: string;
  detail?: string;
  /** Sempre 'YYYY-MM-DD' — para fixos/parcelas/assinaturas/renda é um dia estimado do mês,
   *  usado só para ordenar e exibir (não existe "dia exato" nesses registros). */
  date: string;
}

/** Junta todas as fontes de lançamento do mês numa lista plana, ordenada por data. */
export function buildExtractItems({ month, installments, fixed, incomes, varTxs, subscriptions, cardMap }: {
  month: string;
  installments: MonthlyInstallment[];
  fixed: FixedExpense[];
  incomes: FixedIncome[];
  varTxs: VariableTransaction[];
  subscriptions: Subscription[];
  cardMap: Map<string, CreditCard>;
}): ExtractItem[] {
  const days = daysInMonth(month);
  const dateOf = (day: number) => `${month}-${String(Math.min(Math.max(day, 1), days)).padStart(2, '0')}`;

  const items: ExtractItem[] = [];

  for (const inst of installments) {
    const info = resolveCategoryInfo(inst.category);
    const card = cardMap.get(inst.cardId);
    items.push({
      id: `card-${inst.expenseId}-${inst.installmentNumber}`,
      name: inst.expenseName,
      amount: inst.amount,
      type: 'expense',
      source: 'Cartão',
      categoryKey: inst.category,
      categoryLabel: info.label,
      categoryColor: info.color,
      detail: inst.totalInstallments > 1
        ? `${inst.installmentNumber}/${inst.totalInstallments} · ${card?.name ?? 'Cartão'}`
        : card?.name ?? 'Cartão',
      date: dateOf(card?.dueDay ?? 1),
    });
  }

  for (const fx of fixed) {
    const info = resolveCategoryInfo(fx.category);
    items.push({
      id: `fixed-${fx.id}`,
      name: fx.name,
      amount: fx.amount,
      type: 'expense',
      source: 'Fixo',
      categoryKey: fx.category,
      categoryLabel: info.label,
      categoryColor: info.color,
      date: dateOf(1),
    });
  }

  for (const sub of subscriptions) {
    if (!sub.active) continue;
    const info = resolveCategoryInfo('subscription');
    items.push({
      id: `sub-${sub.id}`,
      name: sub.name,
      amount: monthlyAmount(sub),
      type: 'expense',
      source: 'Assinatura',
      categoryKey: 'subscription',
      categoryLabel: info.label,
      categoryColor: info.color,
      detail: sub.billingCycle === 'annual' ? 'Anual, valor rateado' : undefined,
      date: dateOf(sub.billingDay ?? 1),
    });
  }

  for (const inc of incomes) {
    const info = resolveCategoryInfo(inc.category);
    items.push({
      id: `income-${inc.id}`,
      name: inc.name,
      amount: inc.amount,
      type: 'income',
      source: 'Renda',
      categoryKey: inc.category,
      categoryLabel: info.label,
      categoryColor: info.color,
      date: dateOf(inc.receiveDay ?? 1),
    });
  }

  for (const tx of varTxs) {
    const info = resolveCategoryInfo(tx.category);
    items.push({
      id: `var-${tx.id}`,
      name: tx.name,
      amount: tx.amount,
      type: tx.type,
      source: 'Variável',
      categoryKey: tx.category,
      categoryLabel: info.label,
      categoryColor: info.color,
      date: tx.date,
    });
  }

  return items.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'pt-BR'));
}

/** Remove acentos e caixa para comparar nomes de forma tolerante ("ifood" acha "iFood"). */
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Filtra pelo nome do lançamento (e, de brinde, pela categoria — ajuda a achar o que procura). */
export function filterExtractItems(items: ExtractItem[], query: string): ExtractItem[] {
  const q = normalize(query.trim());
  if (!q) return items;
  return items.filter(i => normalize(i.name).includes(q) || normalize(i.categoryLabel).includes(q));
}

export interface ExtractSummary {
  income: number;
  expense: number;
  balance: number;
  count: number;
}

export function summarizeExtract(items: ExtractItem[]): ExtractSummary {
  let income = 0, expense = 0;
  for (const i of items) { if (i.type === 'income') income += i.amount; else expense += i.amount; }
  return { income, expense, balance: income - expense, count: items.length };
}
