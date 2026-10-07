// src/pages/ReportsPage.tsx
//
// Orquestra a tela de Relatórios: busca os dados, escolhe a aba e delega.
// Cálculos puros: features/reports/calculations.ts · abas: features/reports/tabs/* ·
// popup de categoria: features/reports/CategoryDrilldown.tsx · previsão com ML: features/forecast/*

import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { BarChart3, Sparkles, Activity, PieChart } from 'lucide-react';
import { getCurrentMonth, addMonths } from '@/lib/helpers';
import { computeInstallmentsForMonth, getVariableForMonth } from '@/lib/store';
import { VariableTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useFinanceData } from '@/contexts/FinanceDataContext';
import {
  buildBarDataHist, buildCategoryDetails, buildCategoryList, buildDailyFlow,
  buildForecasts, buildInsights, buildPrevCategoryTotals,
} from '@/features/reports/calculations';
import CategoryDrilldown from '@/features/reports/CategoryDrilldown';
import ForecastTab from '@/features/reports/tabs/ForecastTab';
import HistoryTab from '@/features/reports/tabs/HistoryTab';
import CategoriesTab from '@/features/reports/tabs/CategoriesTab';
import FlowTab from '@/features/reports/tabs/FlowTab';

export default function ReportsPage() {
  const [tab,    setTab]    = useState<'previsao' | 'historico' | 'categorias' | 'fluxo'>('previsao');
  const [month,  setMonth]  = useState(getCurrentMonth());
  const [varTxs, setVarTxs] = useState<VariableTransaction[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Dados do contexto global (sem query duplicada)
  const {
    cards, expenses,
    fixedExpenses: fixed,
    incomes,
    subscriptions,
    loading,
    refresh,
  } = useFinanceData();

  // Transações variáveis são por mês (não estão no contexto)
  useEffect(() => {
    getVariableForMonth(month).then(setVarTxs);
  }, [month]);

  // ── Dados derivados ───────────────────────────────────────────────────────
  const installments     = useMemo(() => computeInstallmentsForMonth(expenses, cards, month), [expenses, cards, month]);
  const totalFixedIncome = useMemo(() => incomes.reduce((s, i) => s + i.amount, 0), [incomes]);
  const totalFixedExpense = useMemo(() => fixed.reduce((s, f) => s + f.amount, 0), [fixed]);
  const cardMap          = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards]);
  const expenseMap       = useMemo(() => new Map(expenses.map(e => [e.id, e])), [expenses]);
  const current          = getCurrentMonth();

  const categoryDetails = useMemo(
    () => buildCategoryDetails({ installments, fixed, subscriptions, cardMap, expenseMap }),
    [installments, fixed, cardMap, expenseMap, subscriptions],
  );
  const categoryList = useMemo(() => buildCategoryList(categoryDetails), [categoryDetails]);
  const totalHist    = categoryList.reduce((s, c) => s + c.value, 0);

  const prevMonth = useMemo(() => addMonths(month, -1), [month]);
  const prevCategoryTotals = useMemo(
    () => buildPrevCategoryTotals({ expenses, cards, fixed, prevMonth }),
    [expenses, cards, prevMonth, fixed],
  );
  const insights = useMemo(
    () => buildInsights({ categoryList, totalHist, prevCategoryTotals }),
    [categoryList, totalHist, prevCategoryTotals],
  );

  const barDataHist = useMemo(
    () => buildBarDataHist({ month, expenses, cards, fixed, totalFixedIncome }),
    [month, expenses, cards, fixed, totalFixedIncome],
  );
  const dailyFlowData = useMemo(
    () => buildDailyFlow({ month, incomes, cards, installments, fixed, varTxs }),
    [month, incomes, cards, installments, fixed, varTxs],
  );
  const forecasts = useMemo(
    () => buildForecasts({ expenses, cards, totalFixedExpense, totalFixedIncome, cardMap, current }),
    [expenses, cards, totalFixedExpense, totalFixedIncome, cardMap, current],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pb-24 md:pb-10 max-w-5xl mx-auto">

      <header className="px-4 md:px-8 pt-5 md:pt-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 size={16} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Relatórios</h1>
            <p className="text-xs text-muted-foreground">Histórico, fluxo e previsões financeiras</p>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 mb-5">
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
          {([
            { key: 'previsao',   label: 'Previsão',   icon: <Sparkles  size={12} /> },
            { key: 'historico',  label: 'Histórico',  icon: <BarChart3 size={12} /> },
            { key: 'categorias', label: 'Categorias', icon: <PieChart  size={12} /> },
            { key: 'fluxo',      label: 'Fluxo',       icon: <Activity  size={12} /> },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <AnimatePresence mode="wait">

          {tab === 'previsao' && (
            <ForecastTab
              key="previsao"
              forecasts={forecasts} expenses={expenses} cards={cards} current={current}
              totalFixedIncome={totalFixedIncome} totalFixedExpense={totalFixedExpense}
            />
          )}

          {tab === 'historico' && (
            <HistoryTab
              key="historico"
              month={month} setMonth={setMonth} barDataHist={barDataHist}
              totalFixedIncome={totalFixedIncome} totalHist={totalHist}
            />
          )}

          {tab === 'categorias' && (
            <CategoriesTab
              key="categorias"
              month={month} setMonth={setMonth} categoryList={categoryList}
              insights={insights} totalHist={totalHist} onOpenCategory={setSelectedCategory}
            />
          )}

          {tab === 'fluxo' && (
            <FlowTab key="fluxo" month={month} setMonth={setMonth} dailyFlowData={dailyFlowData} />
          )}

        </AnimatePresence>
      )}

      <CategoryDrilldown
        category={selectedCategory}
        details={categoryDetails}
        month={month}
        cards={cards}
        onClose={() => setSelectedCategory(null)}
        onChanged={refresh}
      />
    </div>
  );
}
