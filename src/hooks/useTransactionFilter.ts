import { useState, useMemo } from 'react';
import { MonthlyInstallment, VariableTransaction, FixedExpense, CreditCard } from '@/lib/types';
import { resolveCategoryInfo } from '@/lib/customCategories';

export interface TransactionFilters {
  search:    string;
  category:  string;   // '' = todos
  cardId:    string;   // '' = todos
  dateFrom:  string;   // YYYY-MM-DD ou ''
  dateTo:    string;
}

const EMPTY: TransactionFilters = {
  search: '', category: '', cardId: '', dateFrom: '', dateTo: '',
};

function matchSearch(text: string, q: string) {
  return text.toLowerCase().includes(q.toLowerCase());
}
function inDateRange(date: string, from: string, to: string) {
  if (from && date < from) return false;
  if (to   && date > to)   return false;
  return true;
}

export function useTransactionFilter(
  allInstallments: MonthlyInstallment[],
  varTxs:          VariableTransaction[],
  fixedExpenses:   FixedExpense[],
  expenses:        import('@/lib/types').Expense[],
  cards:           CreditCard[],
) {
  const [filters, setFilters] = useState<TransactionFilters>(EMPTY);

  const activeCount = [
    filters.search, filters.category, filters.cardId,
    filters.dateFrom, filters.dateTo,
  ].filter(Boolean).length;

  const clearFilters = () => setFilters(EMPTY);

  const expenseMap = useMemo(
    () => new Map(expenses.map(e => [e.id, e])),
    [expenses],
  );

  // ── installments filtradas ────────────────────────────────────────────────
  const filteredInstallments = useMemo(() => {
    let list = allInstallments;

    if (filters.cardId)   list = list.filter(i => i.cardId === filters.cardId);
    if (filters.category) list = list.filter(i => i.category === filters.category);
    if (filters.search)   list = list.filter(i => matchSearch(i.expenseName, filters.search));

    if (filters.dateFrom || filters.dateTo) {
      list = list.filter(i => {
        const orig = expenseMap.get(i.expenseId);
        if (!orig) return true;
        return inDateRange(orig.date, filters.dateFrom, filters.dateTo);
      });
    }

    return list;
  }, [allInstallments, filters, expenseMap]);

  // ── varTxs filtradas ──────────────────────────────────────────────────────
  const filteredVarTxs = useMemo(() => {
    let list = varTxs;

    // cartão não se aplica a varTxs; se filtro de cartão estiver ativo, oculta varTxs
    if (filters.cardId) return [];

    if (filters.category) list = list.filter(t => t.category === filters.category);
    if (filters.search)   list = list.filter(t => matchSearch(t.name, filters.search));
    if (filters.dateFrom || filters.dateTo)
      list = list.filter(t => inDateRange(t.date, filters.dateFrom, filters.dateTo));

    return list;
  }, [varTxs, filters]);

  // ── fixedExpenses filtrados ───────────────────────────────────────────────
  const filteredFixed = useMemo(() => {
    if (filters.cardId || filters.dateFrom || filters.dateTo) return [];
    let list = fixedExpenses;
    if (filters.category) list = list.filter(f => f.category === filters.category);
    if (filters.search)   list = list.filter(f => matchSearch(f.name, filters.search));
    return list;
  }, [fixedExpenses, filters]);

  // ── categorias presentes (para o dropdown) ────────────────────────────────
  const availableCategories = useMemo(() => {
    const keys = new Set<string>();
    allInstallments.forEach(i => keys.add(i.category));
    varTxs.forEach(t => keys.add(t.category));
    fixedExpenses.forEach(f => keys.add(f.category));
    return Array.from(keys).map(k => ({
      key: k,
      label: resolveCategoryInfo(k).label,
      color: resolveCategoryInfo(k).color,
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [allInstallments, varTxs, fixedExpenses]);

  return {
    filters,
    setFilters,
    activeCount,
    clearFilters,
    filteredInstallments,
    filteredVarTxs,
    filteredFixed,
    availableCategories,
  };
}
