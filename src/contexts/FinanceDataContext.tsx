/**
 * FinanceDataContext.tsx — OTIMIZADO
 *
 * 1. Stale-while-revalidate: UI nunca trava em `loading=true` após o primeiro fetch
 * 2. `isRefreshing` separado de `loading` — componentes exibem indicador sutil
 * 3. `activeModuleIds` incluído no contexto — elimina getActiveModuleIds() duplicado no Index
 * 4. `hardRefresh` invalida todo o cache antes de re-buscar
 * 5. mountedRef evita setState após desmontagem
 */

import {
  createContext, useContext, useState,
  useCallback, useEffect, useRef, ReactNode,
} from 'react';
import { CreditCard, Expense, FixedExpense, FixedIncome } from '@/lib/types';
import { getCards, getExpenses, getFixedExpenses, getIncomes } from '@/lib/store';
import { Subscription, getSubscriptions } from '@/lib/subscriptions';
import { getActiveModuleIds } from '@/lib/modules';
import { queryCache } from '@/lib/queryCache';

interface FinanceDataContextValue {
  cards:               CreditCard[];
  expenses:            Expense[];
  fixedExpenses:       FixedExpense[];
  incomes:             FixedIncome[];
  subscriptions:       Subscription[];
  activeModuleIds:     string[];
  /** true apenas no carregamento inicial (primeira vez, tela em branco) */
  loading:             boolean;
  /** true durante refreshes silenciosos após o primeiro load */
  isRefreshing:        boolean;
  /** Incrementado a cada refresh — use como dep de useEffect para reagir a mudanças */
  version:             number;
  /** Refresh silencioso — mantém dados antigos visíveis na UI durante o fetch */
  refresh:             () => Promise<void>;
  /** Invalida todo o cache e re-busca todos os dados */
  hardRefresh:         () => Promise<void>;
}

const FinanceDataContext = createContext<FinanceDataContextValue>({
  cards: [], expenses: [], fixedExpenses: [], incomes: [],
  subscriptions: [], activeModuleIds: [],
  loading: true, isRefreshing: false, version: 0,
  refresh: async () => {},
  hardRefresh: async () => {},
});

export function FinanceDataProvider({ children }: { children: ReactNode }) {
  const [cards,           setCards]     = useState<CreditCard[]>([]);
  const [expenses,        setExp]       = useState<Expense[]>([]);
  const [fixedExpenses,   setFixed]     = useState<FixedExpense[]>([]);
  const [incomes,         setIncomes]   = useState<FixedIncome[]>([]);
  const [subscriptions,   setSubs]      = useState<Subscription[]>([]);
  const [activeModuleIds, setModules]   = useState<string[]>([]);
  const [loading,         setLoading]   = useState(true);
  const [isRefreshing,    setRefreshing] = useState(false);
  const [version,         setVersion]   = useState(0);

  const mountedRef  = useRef(true);
  const firstLoad   = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const applyData = useCallback((
    c: CreditCard[], e: Expense[], f: FixedExpense[],
    i: FixedIncome[], s: Subscription[], mods: string[],
  ) => {
    if (!mountedRef.current) return;
    setCards(c);
    setExp(e);
    setFixed(f);
    setIncomes(i);
    setSubs(s);
    setModules(mods);
    setLoading(false);
    setRefreshing(false);
    setVersion(v => v + 1);
  }, []);

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return;
    // Só mostra spinner completo no primeiro carregamento
    if (firstLoad.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const [c, e, f, i, s, mods] = await Promise.all([
        getCards(),
        getExpenses(),
        getFixedExpenses(),
        getIncomes(),
        getSubscriptions(),
        getActiveModuleIds(),
      ]);
      firstLoad.current = false;
      applyData(c, e, f, i, s, mods);
    } catch (err) {
      console.error('FinanceDataContext refresh error:', err);
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [applyData]);

  const hardRefresh = useCallback(async () => {
    queryCache.invalidateAll();
    await refresh();
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <FinanceDataContext.Provider
      value={{
        cards, expenses, fixedExpenses, incomes,
        subscriptions, activeModuleIds,
        loading, isRefreshing, version,
        refresh, hardRefresh,
      }}
    >
      {children}
    </FinanceDataContext.Provider>
  );
}

export function useFinanceData() {
  return useContext(FinanceDataContext);
}