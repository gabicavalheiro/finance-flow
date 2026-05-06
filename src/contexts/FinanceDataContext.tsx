// src/contexts/FinanceDataContext.tsx
//
// Contexto global que centraliza os dados financeiros compartilhados entre páginas.
// Resolve dois problemas:
//   1. Lentidão: dados são buscados uma vez e compartilhados — sem re-fetch por página.
//   2. Desconexão: quando qualquer página chama refresh(), todas as outras atualizam.
//
// Dados globais (não dependem do mês):
//   cards, expenses, fixedExpenses, incomes
//
// Dados por mês (cada página busca o próprio):
//   varTxs, invoices — pois dependem do mês selecionado localmente.

import {
  createContext, useContext, useState,
  useCallback, useEffect, ReactNode,
} from 'react';
import { CreditCard, Expense, FixedExpense, FixedIncome } from '@/lib/types';
import { getCards, getExpenses, getFixedExpenses, getIncomes } from '@/lib/store';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface FinanceDataContextValue {
  cards:         CreditCard[];
  expenses:      Expense[];
  fixedExpenses: FixedExpense[];
  incomes:       FixedIncome[];
  loading:       boolean;
  /**
   * Incrementado a cada refresh() concluído.
   * Páginas com dados dependentes de mês (varTxs, invoices) observam
   * este valor para re-buscar quando os dados globais mudam.
   */
  version:       number;
  /** Re-busca todos os dados globais e incrementa `version`. */
  refresh:       () => Promise<void>;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

const FinanceDataContext = createContext<FinanceDataContextValue>({
  cards: [], expenses: [], fixedExpenses: [], incomes: [],
  loading: true, version: 0,
  refresh: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FinanceDataProvider({ children }: { children: ReactNode }) {
  const [cards,         setCards]   = useState<CreditCard[]>([]);
  const [expenses,      setExp]     = useState<Expense[]>([]);
  const [fixedExpenses, setFixed]   = useState<FixedExpense[]>([]);
  const [incomes,       setIncomes] = useState<FixedIncome[]>([]);
  const [loading,       setLoading] = useState(true);
  const [version,       setVersion] = useState(0);

  const refresh = useCallback(async () => {
    const [c, e, f, i] = await Promise.all([
      getCards(), getExpenses(), getFixedExpenses(), getIncomes(),
    ]);
    setCards(c);
    setExp(e);
    setFixed(f);
    setIncomes(i);
    setLoading(false);
    setVersion(v => v + 1);
  }, []);

  // Carrega na montagem
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <FinanceDataContext.Provider
      value={{ cards, expenses, fixedExpenses, incomes, loading, version, refresh }}
    >
      {children}
    </FinanceDataContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFinanceData() {
  return useContext(FinanceDataContext);
}
