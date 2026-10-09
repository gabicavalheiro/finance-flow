import {
  computeInstallmentsForMonth,
  computeCategoryTotals,
  CardInvoice,
} from '@/lib/store';
import { subscriptionsAsInstallments, monthlyAmount, Subscription } from '@/lib/subscriptions';
import type {
  CreditCard, Expense, FixedExpense, FixedIncome, VariableTransaction,
} from '@/lib/types';
import { resolveCategoryInfo } from '@/lib/customCategories';
import { alignInstallmentsToInvoices } from '@/lib/invoiceAdjust';
import { invoicePaidAmount } from '@/lib/invoiceStatus';

export interface MonthSummaryInput {
  month:         string;
  cards:         CreditCard[];
  expenses:      Expense[];
  fixedExpenses: FixedExpense[];
  incomes:       FixedIncome[];
  subscriptions: Subscription[];
  varTxs:        VariableTransaction[];
  invoices:      CardInvoice[];
  /** Mês corrente (YYYY-MM) e dia de hoje — injetáveis para testes. */
  currentMonth:  string;
  today?:        Date;
}

export interface PieSlice { name: string; value: number }

/** Soma de parcelas por cartão, preferindo o valor real confirmado em Faturas. */
export function buildInstallmentsByCard(
  cards: CreditCard[],
  allInstallments: { cardId?: string; amount: number }[],
  invoiceMap: Map<string, CardInvoice>,
): Map<string, number> {
  return new Map(
    cards.map(c => {
      const confirmed  = invoiceMap.get(c.id);
      const calculated = allInstallments.filter(i => i.cardId === c.id).reduce((s, i) => s + i.amount, 0);
      return [c.id, confirmed && confirmed.actualAmount > 0 ? confirmed.actualAmount : calculated] as [string, number];
    }),
  );
}

/** Despesas por categoria (top 8), agrupadas pelo rótulo resolvido. */
export function buildPieData(
  allInstallments: ReturnType<typeof computeInstallmentsForMonth>,
  fixedExpenses: FixedExpense[],
  varTxs: VariableTransaction[],
): PieSlice[] {
  const totals = { ...computeCategoryTotals(allInstallments, fixedExpenses) };
  varTxs.filter(t => t.type === 'expense').forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });
  // Agrupa por label resolvido — categorias diferentes (ex: custom deletada
  // e a categoria padrão "other") podem cair ambas em "Outros" e não devem
  // aparecer como linhas duplicadas.
  const byLabel: Record<string, number> = {};
  Object.entries(totals).filter(([, v]) => v > 0).forEach(([key, value]) => {
    const label = resolveCategoryInfo(key).label;
    byLabel[label] = (byLabel[label] || 0) + value;
  });
  return Object.entries(byLabel)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value).slice(0, 8);
}

/** Todos os totais do mês exibidos no dashboard (função pura). */
export function computeMonthSummary(inp: MonthSummaryInput) {
  const { month, cards, expenses, fixedExpenses, incomes, subscriptions, varTxs, invoices } = inp;

  // Assinaturas com cardId → aparecem como lançamentos de cartão
  const subInstallments = subscriptionsAsInstallments(subscriptions, month);
  const allInstallments = [...computeInstallmentsForMonth(expenses, cards, month), ...subInstallments];

  const cardMap    = new Map(cards.map(c => [c.id, c]));
  const invoiceMap = new Map(invoices.map(inv => [inv.cardId, inv]));

  const installmentsByCard = buildInstallmentsByCard(cards, allInstallments, invoiceMap);
  const totalCardSpent = cards.reduce((sum, card) => sum + (installmentsByCard.get(card.id) ?? 0), 0);
  const totalCardCalculated = allInstallments.reduce((s, i) => s + i.amount, 0);
  const totalLimit = cards.reduce((s, c) => s + c.limit, 0);

  const totalVarInc = varTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalVarExp = varTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0) + totalVarInc;
  // Assinaturas sem cartão (cobradas direto, não via fatura)
  const totalSubsNoCard = subscriptions
    .filter(s => s.active && !s.cardId)
    .reduce((s, sub) => s + monthlyAmount(sub), 0);

  const totalExpense = totalCardSpent + fixedExpenses.reduce((s, f) => s + f.amount, 0) + totalVarExp + totalSubsNoCard;
  const balance = totalIncome - totalExpense;

  // Pendente = gastos ainda não pagos; A receber = receitas que ainda não entraram
  const paidFixed = fixedExpenses.filter(f => f.paidMonths?.includes(month)).reduce((s, f) => s + f.amount, 0);
  const paidCards = invoices.reduce((s, inv) => s + invoicePaidAmount(inv), 0);
  const paidExpense = paidFixed + paidCards;
  const receivedIncome = incomes.filter(i => i.receivedMonths?.includes(month)).reduce((s, i) => s + i.amount, 0);

  const pendingExpense = Math.max(0, totalExpense - paidExpense);
  const toReceive      = Math.max(0, totalIncome - receivedIncome);

  const txCount = allInstallments.length + varTxs.length;

  const [yy, mm] = month.split('-').map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const today = inp.today ?? new Date();
  const daysElapsed = month === inp.currentMonth ? Math.max(1, today.getDate()) : daysInMonth;
  const avgDaily = totalExpense > 0 ? totalExpense / daysElapsed : 0;
  const expenseRatio = totalIncome > 0 ? Math.min(100, (totalExpense / totalIncome) * 100) : 0;

  // Categorias respeitam o valor final informado em Faturas
  const pieData = buildPieData(alignInstallmentsToInvoices(allInstallments, invoices, month), fixedExpenses, varTxs);

  return {
    allInstallments, cardMap, invoiceMap, installmentsByCard,
    totalCardSpent, totalCardCalculated, totalLimit,
    totalVarInc, totalVarExp, totalIncome, totalSubsNoCard, totalExpense, balance,
    paidExpense, receivedIncome, pendingExpense, toReceive,
    txCount, daysInMonth, daysElapsed, avgDaily, expenseRatio, pieData,
  };
}
