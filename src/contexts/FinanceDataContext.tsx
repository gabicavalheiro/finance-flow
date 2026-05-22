// src/contexts/FinanceDataContext.tsx
import {
  createContext, useContext, useState,
  useCallback, useEffect, ReactNode,
} from 'react';
import { CreditCard, Expense, FixedExpense, FixedIncome } from '@/lib/types';
import { getCards, getExpenses, getFixedExpenses, getIncomes } from '@/lib/store';
import { Subscription, getSubscriptions } from '@/lib/subscriptions';

interface FinanceDataContextValue {
  cards:         CreditCard[];
  expenses:      Expense[];
  fixedExpenses: FixedExpense[];
  incomes:       FixedIncome[];
  subscriptions: Subscription[];
  loading:       boolean;
  version:       number;
  refresh:       () => Promise<void>;
}

const FinanceDataContext = createContext<FinanceDataContextValue>({
  cards: [], expenses: [], fixedExpenses: [], incomes: [],
  subscriptions: [],
  loading: true, version: 0,
  refresh: async () => {},
});

export function FinanceDataProvider({ children }: { children: ReactNode }) {
  const [cards,         setCards]   = useState<CreditCard[]>([]);
  const [expenses,      setExp]    = useState<Expense[]>([]);
  const [fixedExpenses, setFixed]   = useState<FixedExpense[]>([]);
  const [incomes,       setIncomes] = useState<FixedIncome[]>([]);
  const [subscriptions, setSubs]    = useState<Subscription[]>([]);
  const [loading,       setLoading] = useState(true);
  const [version,       setVersion] = useState(0);

  const refresh = useCallback(async () => {
    const [c, e, f, i, s] = await Promise.all([
      getCards(),
      getExpenses(),
      getFixedExpenses(),
      getIncomes(),
      getSubscriptions(),
    ]);
    setCards(c);
    setExp(e);
    setFixed(f);
    setIncomes(i);
    setSubs(s);
    setLoading(false);
    setVersion(v => v + 1);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <FinanceDataContext.Provider
      value={{ cards, expenses, fixedExpenses, incomes, subscriptions, loading, version, refresh }}
    >
      {children}
    </FinanceDataContext.Provider>
  );
}

export function useFinanceData() {
  return useContext(FinanceDataContext);
}