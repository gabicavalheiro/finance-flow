// src/pages/Index.tsx
import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, TrendingDown, TrendingUp, Scale, Pencil, Trash2,
  ArrowDownCircle, ArrowUpCircle, Zap, Banknote, ArrowLeftRight,
  CreditCard as CreditCardIcon, FileText, ChartNoAxesCombined, ChevronRight,
} from 'lucide-react';
import MonthSelector from '@/components/MonthSelector';
import EditExpenseDialog from '@/components/EditExpenseDialog';
import EditVariableDialog from '@/components/EditVariableDialog';
import CategoryIcon from '@/components/CategoryIcon';
import ShowMoreButton from '@/components/ShowMoreButton';
import BulkEditCategoryDialog from '@/components/BulkEditCategoryDialog';
import TransactionFilterBar from '@/components/TransactionFilterBar';
import DashboardPatrimonioTab from '@/components/DashboardPatrimonioTab';
import DashboardGoalsWidget from '@/components/DashboardGoalsWidget';
import DashboardSidebar from '@/components/DashboardSidebar';
import BillsChecklist from '@/components/BillsChecklist';
import { useCollapse } from '@/hooks/useCollapse';
import { useTransactionFilter } from '@/hooks/useTransactionFilter';
import { getCurrentMonth, formatCurrency } from '@/lib/helpers';
import {
  getVariableForMonth, getInvoicesForMonth, CardInvoice,
  deleteExpense, deleteVariableTransaction,
  computeInstallmentsForMonth, computeCategoryTotals,
} from '@/lib/store';
import {
  Expense, CreditCard, FixedExpense,
  FixedIncome, VariableTransaction, PAYMENT_METHOD_CONFIG,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { resolveCategoryInfo } from '@/lib/customCategories';
import { getActiveModuleIds } from '@/lib/modules';
import { useFinanceData } from '@/contexts/FinanceDataContext';
import BalanceBreakdownSheet from '@/components/BalanceBreakdownSheet';

// ─── Constantes ───────────────────────────────────────────────────────────────
const PIE_COLORS = [
  'hsl(263 70% 58%)', 'hsl(220 70% 55%)', 'hsl(30 90% 55%)', 'hsl(152 69% 45%)',
  'hsl(0 72% 51%)',   'hsl(280 70% 58%)', 'hsl(320 70% 55%)', 'hsl(45 90% 50%)',
  'hsl(200 80% 50%)', 'hsl(210 70% 55%)',
];
const METHOD_ICONS: Record<string, React.ReactNode> = {
  pix:      <Zap size={11} />,
  cash:     <Banknote size={11} />,
  transfer: <ArrowLeftRight size={11} />,
  debit:    <CreditCardIcon size={11} />,
  boleto:   <FileText size={11} />,
};

// ─── Separador de seção ───────────────────────────────────────────────────────
const SectionDivider = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 py-2">
    <div className="flex-1 h-px bg-border" />
    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
    <div className="flex-1 h-px bg-border" />
  </div>
);

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [month, setMonth]                         = useState(getCurrentMonth());
  const [selectedCardId, setSelectedCardId]       = useState<string | null>(null);
  const [editingExpense, setEditingExpense]        = useState<Expense | null>(null);
  const [editingVar, setEditingVar]               = useState<VariableTransaction | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [deletingVarId, setDeletingVarId]         = useState<string | null>(null);
  const [bulkEditOpen, setBulkEditOpen]           = useState(false);
  const [filterOpen, setFilterOpen]               = useState(false);
  const [userName, setUserName]                   = useState('');
  const [dashTab, setDashTab]                     = useState<'geral' | 'patrimonio'>('geral');
  const [hasPatrimonioModules, setHasPatrimonioModules] = useState(false);
  const [hasGoalsModule, setHasGoalsModule]             = useState(false);
  const [breakdownOpen, setBreakdownOpen]               = useState(false);

  // varTxs e invoices são locais pois dependem do mês selecionado
  const [varTxs,   setVarTxs]   = useState<VariableTransaction[]>([]);
  const [invoices, setInvoices] = useState<CardInvoice[]>([]);

  // Dados globais compartilhados com FixedPage e FaturaPage
  const {
    cards,
    expenses,
    fixedExpenses,
    incomes,
    loading: loadingData,
    version,
    refresh,
  } = useFinanceData();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) =>
      setUserName(user?.user_metadata?.name ?? ''));
  }, []);

  useEffect(() => {
    getActiveModuleIds().then(ids => {
      setHasPatrimonioModules(ids.includes('loans') || ids.includes('investments'));
      setHasGoalsModule(ids.includes('goals'));
    });
  }, []);

  // varTxs e invoices dependem do mês — buscados localmente.
  // Re-executa quando o mês muda OU quando refresh() é chamado (version sobe).
  const loadVarTxs = useCallback(async () => {
    const [v, inv] = await Promise.all([
      getVariableForMonth(month),
      getInvoicesForMonth(month),
    ]);
    setVarTxs(v);
    setInvoices(inv);
  }, [month]);

  useEffect(() => { loadVarTxs(); }, [loadVarTxs, version]);

  // loadAll = refresh global + reload dados do mês
  const loadAll = useCallback(async () => {
    await Promise.all([refresh(), loadVarTxs()]);
  }, [refresh, loadVarTxs]);

  // ── Cálculos base ─────────────────────────────────────────────────────────
  const allInstallments = useMemo(
    () => computeInstallmentsForMonth(expenses, cards, month),
    [expenses, cards, month],
  );
  const cardMap        = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards]);
  const getExpenseById = (id: string) => expenses.find(e => e.id === id);

  // Mapa de invoices confirmadas pelo usuário em FaturaPage
  const invoiceMap = useMemo(
    () => new Map(invoices.map(inv => [inv.cardId, inv])),
    [invoices],
  );

  // Se o usuário confirmou o valor real do banco, usa esse; caso contrário usa calculado.
  // Garante que Dashboard e FaturaPage mostrem valores consistentes.
  const totalCardSpent = useMemo(() => {
    return cards.reduce((sum, card) => {
      const confirmed = invoiceMap.get(card.id);
      if (confirmed && confirmed.actualAmount > 0) {
        return sum + confirmed.actualAmount;
      }
      return sum + allInstallments
        .filter(i => i.cardId === card.id)
        .reduce((s, i) => s + i.amount, 0);
    }, 0);
  }, [cards, invoiceMap, allInstallments]);

  // Valor calculado puro — usado na barra de limite (não distorcido por faturas reais)
  const totalCardCalculated = useMemo(
    () => allInstallments.reduce((s, i) => s + i.amount, 0),
    [allInstallments],
  );

  // true se pelo menos uma fatura foi confirmada este mês
  const hasConfirmedInvoices = useMemo(
    () => invoices.some(inv => inv.actualAmount > 0),
    [invoices],
  );

  const totalLimit = useMemo(() => cards.reduce((s, c) => s + c.limit, 0), [cards]);
  const available  = totalLimit - totalCardCalculated;

  const totalVarInc  = useMemo(() => varTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [varTxs]);
  const totalVarExp  = useMemo(() => varTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [varTxs]);
  const totalIncome  = useMemo(() => incomes.reduce((s, i) => s + i.amount, 0) + totalVarInc, [incomes, totalVarInc]);
  const totalExpense = useMemo(() => totalCardSpent + fixedExpenses.reduce((s, f) => s + f.amount, 0) + totalVarExp, [totalCardSpent, fixedExpenses, totalVarExp]);
  const balance      = totalIncome - totalExpense;

  // ── Estatísticas ──────────────────────────────────────────────────────────
  const txCount = useMemo(() => allInstallments.length + varTxs.length, [allInstallments, varTxs]);

  const expenseRatio = totalIncome > 0
    ? Math.min(100, Math.round((totalExpense / totalIncome) * 100)) : 0;

  const daysInMonth = new Date(
    parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0,
  ).getDate();
  const daysElapsed = month === getCurrentMonth()
    ? Math.max(1, new Date().getDate()) : daysInMonth;
  const avgDaily    = totalExpense > 0 ? totalExpense / daysElapsed : 0;

  // Pie chart
  const pieData = useMemo(() => {
    const totals = { ...computeCategoryTotals(allInstallments, fixedExpenses) };
    varTxs.filter(t => t.type === 'expense').forEach(t => {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({ name: resolveCategoryInfo(key).label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [allInstallments, fixedExpenses, varTxs]);

  // ── Filtros ───────────────────────────────────────────────────────────────
  const {
    filters, setFilters, activeCount, clearFilters,
    filteredInstallments, filteredVarTxs, filteredFixed,
    availableCategories,
  } = useTransactionFilter(allInstallments, varTxs, fixedExpenses, expenses, cards);

  const visibleInstallments = useMemo(() =>
    selectedCardId ? filteredInstallments.filter(i => i.cardId === selectedCardId) : filteredInstallments,
  [selectedCardId, filteredInstallments]);

  const visibleVarTxs  = selectedCardId ? [] : filteredVarTxs;
  const visibleFixed   = selectedCardId ? [] : filteredFixed;
  const isEmpty        = visibleInstallments.length === 0 && visibleVarTxs.length === 0 && visibleFixed.length === 0;

  const collapseInst  = useCollapse(visibleInstallments.length);
  const collapseVar   = useCollapse(visibleVarTxs.length);
  const collapseFixed = useCollapse(visibleFixed.length);

  // ── Ações ─────────────────────────────────────────────────────────────────
  const confirmDeleteExpense = async () => {
    if (!deletingExpenseId) return;
    try { await deleteExpense(deletingExpenseId); toast.success('Gasto removido'); loadAll(); }
    catch { toast.error('Erro ao remover gasto'); }
    finally { setDeletingExpenseId(null); }
  };
  const confirmDeleteVar = async () => {
    if (!deletingVarId) return;
    try { await deleteVariableTransaction(deletingVarId); toast.success('Lançamento removido'); loadAll(); }
    catch { toast.error('Erro ao remover lançamento'); }
    finally { setDeletingVarId(null); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pb-24 md:pb-10 max-w-7xl mx-auto">

      {/* Cabeçalho */}
      <header className="px-4 md:px-8 pt-5 md:pt-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">
            {userName ? `Olá, ${userName.split(' ')[0]} 👋` : 'Dashboard'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Controle pessoal de finanças</p>
        </div>

        {/* Botão de alertas/saldo — visível em telas menores que xl */}
        <div className="xl:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-xl border border-primary/30 bg-primary/8 hover:bg-primary/15"
              >
                <ChartNoAxesCombined size={18} className="text-primary" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[90vw] sm:w-[420px] p-0 overflow-y-auto">
              <div className="p-6 pt-12">
                <DashboardSidebar
                  cards={cards}
                  incomes={incomes}
                  expenses={expenses}
                  fixedExpenses={fixedExpenses}
                  varTxs={varTxs}
                  invoices={invoices}
                  month={month}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Layout principal: conteúdo + sidebar */}
      <div className="px-4 md:px-8 flex gap-6">

        {/* Coluna principal */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Seletor de mês + tabs Geral / Patrimônio */}
          <div className="space-y-3">
            <MonthSelector month={month} onChange={setMonth} />

            {hasPatrimonioModules && (
              <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
                {(['geral', 'patrimonio'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setDashTab(tab)}
                    className={cn(
                      'px-4 py-1.5 rounded-lg text-xs font-medium transition-all',
                      dashTab === tab
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab === 'geral' ? 'Geral' : 'Patrimônio'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Aba Patrimônio */}
          {dashTab === 'patrimonio' ? (
            <DashboardPatrimonioTab />
          ) : (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                {/* Saldo do mês — clicável → abre breakdown */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  onClick={() => setBreakdownOpen(true)}
                  className="bg-card rounded-2xl p-4 border border-border col-span-2 text-left hover:bg-card/80 hover:border-primary/40 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Scale size={16} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Saldo do mês</span>
                    <ChevronRight size={12} className="ml-auto text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: balance >= 0 ? 'hsl(152 69% 45%)' : 'hsl(0 72% 51%)' }}>
                    {formatCurrency(balance)}
                  </p>
                  {totalIncome > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {expenseRatio}% da renda comprometida · toque para ver detalhes
                    </p>
                  )}
                </motion.button>

                {/* Total gastos */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                  className="bg-card rounded-2xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown size={16} className="text-destructive" />
                    <span className="text-xs text-muted-foreground">Total gastos</span>
                    {hasConfirmedInvoices && (
                      <span className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                        fatura confirmada
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-bold text-destructive">{formatCurrency(totalExpense)}</p>
                  {avgDaily > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      ~{formatCurrency(avgDaily)}/dia
                    </p>
                  )}
                </motion.div>

                {/* Total receitas */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                  className="bg-card rounded-2xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={16} className="text-success" />
                    <span className="text-xs text-muted-foreground">Total receitas</span>
                  </div>
                  <p className="text-lg font-bold" style={{ color: 'hsl(152 69% 45%)' }}>
                    {formatCurrency(totalIncome)}
                  </p>
                  {txCount > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {txCount} lançamento{txCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </motion.div>
              </div>

              {/* Limite de cartões */}
              {totalLimit > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="bg-card rounded-2xl p-4 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className="text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Limite disponível</span>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(available)}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: totalLimit > 0 ? `${Math.min((totalCardCalculated / totalLimit) * 100, 100)}%` : '0%',
                        background: (totalCardCalculated / totalLimit) > 0.9
                          ? 'hsl(0 72% 51%)'
                          : (totalCardCalculated / totalLimit) > 0.7
                            ? 'hsl(25 95% 53%)'
                            : 'hsl(152 69% 45%)',
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatCurrency(totalCardCalculated)} de {formatCurrency(totalLimit)}
                  </p>
                </motion.div>
              )}

              {/* ── Checklist de contas ── */}
              <BillsChecklist
                month={month}
                fixedExpenses={fixedExpenses}
                incomes={incomes}
                cards={cards}
                expenses={expenses}
                invoices={invoices}
                onUpdated={loadAll}
              />

              {/* Widget de metas */}
              {hasGoalsModule && (
                <DashboardGoalsWidget monthlyBalance={balance} />
              )}

              {/* Grid principal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Pie chart */}
                {pieData.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="bg-card rounded-2xl p-4 border border-border">
                    <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
                      Gastos por categoria
                    </p>
                    <div className="flex gap-4 items-center">
                      <div className="h-36 w-36 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={52} paddingAngle={2} dataKey="value">
                              {pieData.map((_, idx) => (
                                <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} strokeWidth={0} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => formatCurrency(v as number)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 space-y-1.5 min-w-0">
                        {pieData.map((entry, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                            <span className="truncate text-muted-foreground flex-1">{entry.name}</span>
                            <span className="font-medium shrink-0">{formatCurrency(entry.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Lançamentos */}
                <div className={cn(
                  'bg-card rounded-2xl border border-border overflow-hidden',
                  pieData.length === 0 ? 'md:col-span-2' : '',
                )}>
                  {/* Cabeçalho da lista */}
                  <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Lançamentos
                    </p>
                    <div className="flex items-center gap-1">
                      {/* TransactionFilterBar gerencia seu próprio botão trigger */}
                      <TransactionFilterBar
                        open={filterOpen}
                        onToggle={() => setFilterOpen(v => !v)}
                        filters={filters}
                        setFilters={setFilters}
                        activeCount={activeCount}
                        clearFilters={clearFilters}
                        availableCategories={availableCategories}
                        cards={cards}
                      />
                      {/* Edição em massa */}
                      <button
                        onClick={() => setBulkEditOpen(true)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border border-border text-muted-foreground hover:border-muted-foreground/50 transition-all"
                      >
                        <Pencil size={10} />
                        Editar
                      </button>
                    </div>
                  </div>

                  {/* Filtro por cartão */}
                  {cards.length > 1 && (
                    <div className="px-4 pb-2">
                      <ScrollArea>
                        <div className="flex gap-1.5 pb-1">
                          <button
                            onClick={() => setSelectedCardId(null)}
                            className={cn(
                              'shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border',
                              !selectedCardId
                                ? 'border-primary text-primary bg-primary/10'
                                : 'border-border text-muted-foreground hover:border-muted-foreground/50',
                            )}
                          >
                            Todos
                          </button>
                          {cards.map(card => {
                            const isActive   = selectedCardId === card.id;
                            const cardSpent  = allInstallments.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
                            return (
                              <button
                                key={card.id}
                                onClick={() => setSelectedCardId(isActive ? null : card.id)}
                                className={cn(
                                  'shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border',
                                  isActive
                                    ? 'border-primary text-primary bg-primary/10'
                                    : 'border-border text-muted-foreground hover:border-muted-foreground/50',
                                )}
                              >
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: card.customGradient ?? 'hsl(263 70% 58%)' }} />
                                {card.name}
                                {cardSpent > 0 && <span className="opacity-60">{formatCurrency(cardSpent)}</span>}
                              </button>
                            );
                          })}
                        </div>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                    </div>
                  )}

                  {/* Lista */}
                  <div className="px-4 pb-4 space-y-1 max-h-[480px] overflow-y-auto">
                    {loadingData ? (
                      <p className="text-xs text-muted-foreground text-center py-6">Carregando...</p>
                    ) : isEmpty ? (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        {activeCount > 0
                          ? 'Nenhum lançamento com esses filtros'
                          : selectedCardId
                            ? 'Nenhum lançamento neste cartão'
                            : 'Nenhum lançamento registrado'}
                      </p>
                    ) : (
                      <>
                        <AnimatePresence mode="popLayout">
                          {/* Parcelas de cartão */}
                          {visibleInstallments.slice(0, collapseInst.visible).map((inst, i) => {
                            const orig = getExpenseById(inst.expenseId);
                            return (
                              <motion.div key={`${inst.expenseId}-${i}`}
                                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                                className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-secondary/50 transition-colors group"
                              >
                                <CategoryIcon category={inst.category} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{inst.expenseName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {inst.totalInstallments > 1
                                      ? `${inst.installmentNumber}/${inst.totalInstallments} · ${cardMap.get(inst.cardId)?.name ?? ''}`
                                      : `À vista · ${cardMap.get(inst.cardId)?.name ?? ''}`}
                                  </p>
                                </div>
                                <span className="text-sm font-semibold text-destructive">{formatCurrency(inst.amount)}</span>
                                {/* Ações */}
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => orig && setEditingExpense(orig)}
                                    className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    onClick={() => setDeletingExpenseId(inst.expenseId)}
                                    className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                        <ShowMoreButton expanded={collapseInst.expanded} hidden={collapseInst.hidden} onToggle={collapseInst.toggle} />

                        {/* Variáveis */}
                        {visibleVarTxs.length > 0 && (
                          <>
                            {visibleInstallments.length > 0 && <SectionDivider label="Variáveis" />}
                            <AnimatePresence mode="popLayout">
                              {visibleVarTxs.slice(0, collapseVar.visible).map((tx) => (
                                <motion.div key={tx.id}
                                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                                  className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-secondary/50 transition-colors group"
                                >
                                  <CategoryIcon category={tx.category} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{tx.name}</p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      {METHOD_ICONS[tx.paymentMethod] ?? null}
                                      {PAYMENT_METHOD_CONFIG[tx.paymentMethod]?.label ?? tx.paymentMethod}
                                      {' · '}
                                      {tx.date.split('-').reverse().join('/')}
                                    </p>
                                  </div>
                                  <span className={cn(
                                    'text-sm font-semibold',
                                    tx.type === 'income' ? 'text-emerald-400' : 'text-destructive',
                                  )}>
                                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                  </span>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => setEditingVar(tx)}
                                      className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button
                                      onClick={() => setDeletingVarId(tx.id)}
                                      className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                            <ShowMoreButton expanded={collapseVar.expanded} hidden={collapseVar.hidden} onToggle={collapseVar.toggle} />
                          </>
                        )}

                        {/* Fixos */}
                        {visibleFixed.length > 0 && (
                          <>
                            {(visibleInstallments.length > 0 || visibleVarTxs.length > 0) && <SectionDivider label="Fixos" />}
                            {visibleFixed.slice(0, collapseFixed.visible).map(f => (
                              <div key={f.id} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-secondary/50 transition-colors">
                                <CategoryIcon category={f.category} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{f.name}</p>
                                  <p className="text-xs text-muted-foreground">Fixo mensal</p>
                                </div>
                                <span className="text-sm font-semibold text-destructive">{formatCurrency(f.amount)}</span>
                              </div>
                            ))}
                            <ShowMoreButton expanded={collapseFixed.expanded} hidden={collapseFixed.hidden} onToggle={collapseFixed.toggle} />
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
        {/* Fim coluna principal */}

        {/* Sidebar direita (só em xl+) */}
        {dashTab === 'geral' && (
          <aside className="hidden xl:block w-72 shrink-0">
            <div className="sticky top-6">
              <DashboardSidebar
                cards={cards}
                incomes={incomes}
                expenses={expenses}
                fixedExpenses={fixedExpenses}
                varTxs={varTxs}
                invoices={invoices}
                month={month}
              />
            </div>
          </aside>
        )}

      </div>
      {/* Fim layout */}

      {/* Breakdown de saldo */}
      <BalanceBreakdownSheet
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        month={month}
        cards={cards}
        expenses={expenses}
        fixedExpenses={fixedExpenses}
        incomes={incomes}
        varTxs={varTxs}
        invoices={invoices}
      />

      {/* Dialogs */}
      <BulkEditCategoryDialog
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        month={month}
        installments={allInstallments}
        expenses={expenses}
        varTxs={varTxs}
        cards={cards}
        onSaved={loadAll}
      />

      {editingExpense && (
        <EditExpenseDialog
          expense={editingExpense}
          cards={cards}
          open={!!editingExpense}
          onClose={() => setEditingExpense(null)}
          onSaved={() => { setEditingExpense(null); loadAll(); }}
        />
      )}

      {editingVar && (
        <EditVariableDialog
          transaction={editingVar}
          open={!!editingVar}
          onClose={() => setEditingVar(null)}
          onSaved={() => { setEditingVar(null); loadAll(); }}
        />
      )}

      {/* Alert: deletar gasto de cartão */}
      <AlertDialog open={!!deletingExpenseId} onOpenChange={open => { if (!open) setDeletingExpenseId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o lançamento e todas as suas parcelas. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteExpense} className="bg-destructive hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert: deletar variável */}
      <AlertDialog open={!!deletingVarId} onOpenChange={open => { if (!open) setDeletingVarId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Este lançamento será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteVar} className="bg-destructive hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}