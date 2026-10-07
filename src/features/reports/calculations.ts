// Cálculos puros de Relatórios (sem React): recebem dados, devolvem estruturas prontas para a tela.
// Ficam aqui para poderem ser testados isoladamente — veja __tests__/calculations.test.ts.

import { computeInstallmentsForMonth } from '@/lib/store';
import { addMonths } from '@/lib/helpers';
import { resolveCategoryInfo } from '@/lib/customCategories';
import { SUBSCRIPTION_CATEGORIES, monthlyAmount, type Subscription } from '@/lib/subscriptions';
import { formatCurrency } from '@/lib/helpers';
import type {
  CreditCard, Expense, FixedExpense, FixedIncome, MonthlyInstallment, VariableTransaction,
} from '@/lib/types';
import { daysInMonth, monthLabel, monthLabelFull } from './format';
import type { CategoryLineItem, Insight, MonthForecast } from './types';

export interface CategoryDetail {
  label: string; color: string; sampleKey: string; items: CategoryLineItem[];
}
export interface CategoryRow {
  label: string; color: string; sampleKey: string; value: number;
}
export interface DailyFlowPoint {
  dia: number; entradas: number; saidas: number; saldo: number; dEntrada: number; dSaida: number;
}

/** Agrupa gastos do mês por LABEL resolvido (categorias diferentes que viram "Outros" não duplicam linha). */
export function buildCategoryDetails({ installments, fixed, subscriptions, cardMap, expenseMap }: {
  installments: MonthlyInstallment[]; fixed: FixedExpense[]; subscriptions: Subscription[];
  cardMap: Map<string, CreditCard>; expenseMap: Map<string, Expense>;
}): Map<string, CategoryDetail> {
  const map = new Map<string, { label: string; color: string; sampleKey: string; items: CategoryLineItem[] }>();
  const addItem = (key: string, item: CategoryLineItem) => {
    const info = resolveCategoryInfo(key);
    let entry = map.get(info.label);
    if (!entry) { entry = { label: info.label, color: info.color, sampleKey: key, items: [] }; map.set(info.label, entry); }
    entry.items.push(item);
  };

  installments.forEach(inst => addItem(inst.category, {
    id:     `card-${inst.expenseId}-${inst.installmentNumber}`,
    name:   inst.expenseName,
    amount: inst.amount,
    source: 'Cartão',
    detail: inst.totalInstallments > 1
      ? `${inst.installmentNumber}/${inst.totalInstallments} · ${cardMap.get(inst.cardId)?.name ?? 'Cartão'}`
      : cardMap.get(inst.cardId)?.name ?? 'Cartão',
    expense: expenseMap.get(inst.expenseId),
  }));

  fixed.forEach(fx => addItem(fx.category, {
    id: `fixed-${fx.id}`, name: fx.name, amount: fx.amount, source: 'Fixo',
    fixedExpense: fx,
  }));

  // Assinaturas (módulo Assinaturas — tabela separada de expenses/fixed).
  // Sempre bucketadas em "Assinatura" (categoria padrão do app), já que a
  // categoria interna da assinatura (streaming, música...) não é uma
  // ExpenseCategory reconhecida pelo resto do app.
  subscriptions.filter(s => s.active).forEach(sub => {
    const subType  = SUBSCRIPTION_CATEGORIES.find(c => c.value === sub.category)?.label;
    const cardName = sub.cardId ? cardMap.get(sub.cardId)?.name : undefined;
    const detail = [
      subType,
      cardName ? `Cartão ${cardName}` : 'Sem cartão vinculado',
      sub.billingCycle === 'annual' ? 'anual, valor rateado' : undefined,
    ].filter(Boolean).join(' · ');
    addItem('subscription', {
      id: `sub-${sub.id}`,
      name: sub.name,
      amount: monthlyAmount(sub),
      source: 'Assinatura',
      detail,
    });
  });

  return map;
}

export function buildCategoryList(details: Map<string, CategoryDetail>): CategoryRow[] {
  return Array.from(details.entries())
    .map(([label, d]) => ({ label, color: d.color, sampleKey: d.sampleKey, value: d.items.reduce((s, i) => s + i.amount, 0) }))
    .sort((a, b) => b.value - a.value);
}

/** Totais por categoria do mês anterior (cartão + fixo), base dos insights de comparação. */
export function buildPrevCategoryTotals({ expenses, cards, fixed, prevMonth }: {
  expenses: Expense[]; cards: CreditCard[]; fixed: FixedExpense[]; prevMonth: string;
}): Map<string, number> {
  const prevInst = computeInstallmentsForMonth(expenses, cards, prevMonth);
  const totals = new Map<string, number>();
  const add = (key: string, amount: number) => {
    const label = resolveCategoryInfo(key).label;
    totals.set(label, (totals.get(label) ?? 0) + amount);
  };
  prevInst.forEach(i => add(i.category, i.amount));
  fixed.forEach(f => add(f.category, f.amount));
  return totals;
}

export function buildInsights({ categoryList, totalHist, prevCategoryTotals }: {
  categoryList: CategoryRow[]; totalHist: number; prevCategoryTotals: Map<string, number>;
}): Insight[] {
  if (categoryList.length === 0 || totalHist === 0) return [];
  const msgs: Insight[] = [];

  const top = categoryList[0];
  const topPct = Math.round((top.value / totalHist) * 100);
  msgs.push(topPct >= 30
    ? { icon: 'flame', text: `Boa, esse mês você se passou com ${top.label.toLowerCase()}: ${formatCurrency(top.value)} (${topPct}% do total).` }
    : { icon: 'sparkle', text: `Seu maior gasto foi com ${top.label.toLowerCase()}: ${formatCurrency(top.value)}.` });

  let biggestIncrease: { label: string; pct: number } | null = null;
  let biggestDecrease: { label: string; pct: number } | null = null;
  categoryList.forEach(cat => {
    const prev = prevCategoryTotals.get(cat.label) ?? 0;
    if (prev < 20) return; // base pequena/inexistente demais pra comparar
    const pct = ((cat.value - prev) / prev) * 100;
    if (pct >= 25 && (!biggestIncrease || pct > biggestIncrease.pct)) biggestIncrease = { label: cat.label, pct };
    if (pct <= -25 && (!biggestDecrease || pct < biggestDecrease.pct)) biggestDecrease = { label: cat.label, pct };
  });

  if (biggestIncrease) msgs.push({
    icon: 'flame',
    text: `${biggestIncrease.label} subiu ${Math.round(biggestIncrease.pct)}% em relação ao mês passado.`,
  });
  if (biggestDecrease) msgs.push({
    icon: 'party',
    text: `Mandou bem! ${biggestDecrease.label} caiu ${Math.round(Math.abs(biggestDecrease.pct))}% em relação ao mês passado.`,
  });

  return msgs.slice(0, 3);
}

/** Gastos dos últimos 6 meses (cartão + fixos) contra a receita fixa. */
export function buildBarDataHist({ month, expenses, cards, fixed, totalFixedIncome }: {
  month: string; expenses: Expense[]; cards: CreditCard[]; fixed: FixedExpense[]; totalFixedIncome: number;
}) {
  return Array.from({ length: 6 }, (_, i) => {
    const m      = addMonths(month, -(5 - i));
    const inst   = computeInstallmentsForMonth(expenses, cards, m);
    const gastos = inst.reduce((s, x) => s + x.amount, 0) + fixed.reduce((s, f) => s + f.amount, 0);
    return { name: monthLabel(m), gastos, receitas: totalFixedIncome };
  });
}

/** Fluxo de caixa dia a dia (acumulado) do mês. */
export function buildDailyFlow({ month, incomes, cards, installments, fixed, varTxs }: {
  month: string; incomes: FixedIncome[]; cards: CreditCard[]; installments: MonthlyInstallment[];
  fixed: FixedExpense[]; varTxs: VariableTransaction[];
}): DailyFlowPoint[] {
  const days = daysInMonth(month);
  const map: Record<number, { entrada: number; saida: number }> = {};
  for (let d = 1; d <= days; d++) map[d] = { entrada: 0, saida: 0 };

  for (const inc of incomes) {
    const day = inc.receiveDay ?? 1;
    if (day >= 1 && day <= days) map[day].entrada += inc.amount;
  }
  for (const card of cards) {
    const amt = installments.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
    if (amt === 0) continue;
    const day = Math.min(card.dueDay, days);
    map[day].saida += amt;
  }
  for (const f of fixed) map[1].saida += f.amount;
  for (const tx of varTxs) {
    const day = parseInt(tx.date.split('-')[2], 10);
    if (day >= 1 && day <= days) {
      if (tx.type === 'income')  map[day].entrada += tx.amount;
      else                       map[day].saida   += tx.amount;
    }
  }

  let cumEntrada = 0;
  let cumSaida   = 0;
  return Array.from({ length: days }, (_, i) => {
    const d = i + 1;
    cumEntrada += map[d].entrada;
    cumSaida   += map[d].saida;
    return {
      dia:      d,
      entradas: cumEntrada,
      saidas:   cumSaida,
      saldo:    cumEntrada - cumSaida,
      dEntrada: map[d].entrada,
      dSaida:   map[d].saida,
    };
  });
}

/** Mês anterior + mês atual + 5 meses futuros, só com o que já é conhecido (parcelas e fixos). */
export function buildForecasts({ expenses, cards, totalFixedExpense, totalFixedIncome, cardMap, current }: {
  expenses: Expense[]; cards: CreditCard[]; totalFixedExpense: number; totalFixedIncome: number;
  cardMap: Map<string, CreditCard>; current: string;
}): MonthForecast[] {
  return Array.from({ length: 7 }, (_, i) => {
    const m    = addMonths(current, i - 1);
    const inst = computeInstallmentsForMonth(expenses, cards, m);
    const cardBreakdown = cards.map(card => ({
      cardId:   card.id,
      cardName: card.name,
      amount:   inst.filter(x => x.cardId === card.id).reduce((s, x) => s + x.amount, 0),
    }));
    const cardExpenses = inst.reduce((s, x) => s + x.amount, 0);
    const totalExpense = cardExpenses + totalFixedExpense;
    const totalIncome  = totalFixedIncome;
    const balance      = totalIncome - totalExpense;
    return {
      month: m, label: monthLabelFull(m),
      cardExpenses, fixedExpenses: totalFixedExpense,
      totalExpense, totalIncome, balance,
      isPast:    m < current,
      isCurrent: m === current,
      isFuture:  m > current,
      cardBreakdown,
      installmentDetail: inst.map(x => ({
        name:              x.expenseName,
        amount:            x.amount,
        installmentNumber: x.installmentNumber,
        totalInstallments: x.totalInstallments,
        cardName:          cardMap.get(x.cardId)?.name ?? 'Cartão',
      })),
    };
  });
}

/** Compromissos CONHECIDOS por mês: só parcelamentos (>1x) + gastos fixos. Compras à vista no
 *  cartão ficam de fora — elas entram na previsão de ML (senão contariam em dobro). */
export function buildCommittedByMonth({ expenses, cards, forecasts, totalFixedExpense }: {
  expenses: Expense[]; cards: CreditCard[]; forecasts: MonthForecast[]; totalFixedExpense: number;
}): Record<string, number> {
  const multi = expenses.filter(e => (e.installments ?? 1) > 1);
  return Object.fromEntries(forecasts.map(fc => [
    fc.month,
    computeInstallmentsForMonth(multi, cards, fc.month).reduce((s, x) => s + x.amount, 0) + totalFixedExpense,
  ]));
}
