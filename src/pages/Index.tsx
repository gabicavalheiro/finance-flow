// src/pages/Index.tsx
import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Wallet, Scale, CreditCard as CreditCardIcon, ChartNoAxesCombined, Eye, EyeOff, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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
import { getVariableForMonth, getInvoicesForMonth, CardInvoice, deleteExpense, deleteVariableTransaction } from '@/lib/store';
import { Expense, VariableTransaction, PAYMENT_METHOD_CONFIG } from '@/lib/types';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { getUser } from '@/lib/auth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getActiveModuleIds } from '@/lib/modules';
import { useFinanceData } from '@/contexts/FinanceDataContext';
import BalanceBreakdownSheet from '@/components/BalanceBreakdownSheet';
import { LoadingState, EmptyState } from '@/components/states/StateViews';
import { TransactionRow } from '@/features/dashboard/components/TransactionRow';
import { CategoryBreakdown } from '@/features/dashboard/components/CategoryBreakdown';
import { computeMonthSummary } from '@/features/dashboard/calculations';
import { METHOD_ICONS } from '@/features/dashboard/constants';
import { SectionDivider } from '@/features/dashboard/components/SectionDivider';
import { SummaryCard } from '@/features/dashboard/components/SummaryCard';
import { CardCarousel } from '@/features/dashboard/components/CardCarousel';

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [month, setMonth]                                = useState(getCurrentMonth());
  const [selectedCardId, setSelectedCardId]              = useState<string | null>(null);
  const [editingExpense, setEditingExpense]               = useState<Expense | null>(null);
  const [editingVar, setEditingVar]                      = useState<VariableTransaction | null>(null);
  const [deletingExpenseId, setDeletingExpenseId]        = useState<string | null>(null);
  const [deletingVarId, setDeletingVarId]                = useState<string | null>(null);
  const [bulkEditOpen, setBulkEditOpen]                  = useState(false);
  const [filterOpen, setFilterOpen]                      = useState(false);
  const [userName, setUserName]                          = useState('');
  const [dashTab, setDashTab]                            = useState<'geral' | 'patrimonio'>('geral');
  const [hasPatrimonioModules, setHasPatrimonioModules]  = useState(false);
  const [hasGoalsModule, setHasGoalsModule]              = useState(false);
  const [breakdownOpen, setBreakdownOpen]                = useState(false);
  const [hidden, setHidden]                              = useState(false);

  const [varTxs,   setVarTxs]   = useState<VariableTransaction[]>([]);
  const [invoices, setInvoices] = useState<CardInvoice[]>([]);

  const {
    cards:         rawCards,
    expenses:      rawExpenses,
    fixedExpenses: rawFixed,
    incomes:       rawIncomes,
    subscriptions: rawSubs,
    loading:       loadingData,
    version,
    refresh,
  } = useFinanceData();

  const cards         = rawCards    ?? [];
  const expenses      = rawExpenses ?? [];
  const fixedExpenses = rawFixed    ?? [];
  const incomes       = rawIncomes  ?? [];
  const subscriptions = rawSubs     ?? [];

  useEffect(() => {
    getUser().then(user => setUserName(user?.name ?? ''));
  }, []);

  useEffect(() => {
    getActiveModuleIds().then(ids => {
      setHasPatrimonioModules(ids.includes('loans') || ids.includes('investments'));
      setHasGoalsModule(ids.includes('goals'));
    });
  }, []);

  const loadVarTxs = useCallback(async () => {
    const [v, inv] = await Promise.all([
      getVariableForMonth(month),
      getInvoicesForMonth(month),
    ]);
    setVarTxs(v);
    setInvoices(inv);
  }, [month]);

  useEffect(() => { loadVarTxs(); }, [loadVarTxs, version]);
  const loadAll = useCallback(async () => { await Promise.all([refresh(), loadVarTxs()]); }, [refresh, loadVarTxs]);

  // ── Cálculos (função pura em features/dashboard/calculations.ts) ──────────
  const {
    allInstallments, cardMap, invoiceMap, installmentsByCard,
    totalCardSpent, totalCardCalculated, totalLimit,
    totalVarInc, totalVarExp, totalIncome, totalSubsNoCard, totalExpense, balance,
    paidExpense, receivedIncome, pendingExpense, toReceive,
    txCount, daysInMonth, daysElapsed, avgDaily, expenseRatio, pieData,
  } = useMemo(() => computeMonthSummary({
    month, cards, expenses, fixedExpenses, incomes, subscriptions, varTxs, invoices,
    currentMonth: getCurrentMonth(),
  }), [month, cards, expenses, fixedExpenses, incomes, subscriptions, varTxs, invoices]);
  const getExpenseById = (id: string) => expenses.find(e => e.id === id);

  const [y, m] = month.split('-');
  const monthLabel = new Date(parseInt(y), parseInt(m) - 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

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
    catch { toast.error('Erro ao remover'); } finally { setDeletingExpenseId(null); }
  };
  const confirmDeleteVar = async () => {
    if (!deletingVarId) return;
    try { await deleteVariableTransaction(deletingVarId); toast.success('Lançamento removido'); loadAll(); }
    catch { toast.error('Erro ao remover'); } finally { setDeletingVarId(null); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pb-24 md:pb-10 max-w-7xl mx-auto">

      {/* ── HEADER ── */}
      <header className="px-4 md:px-8 pt-5 pb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <MonthSelector month={month} onChange={setMonth} />
          {hasPatrimonioModules && (
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}>
              {(['geral', 'patrimonio'] as const).map(tab => (
                <button key={tab} onClick={() => setDashTab(tab)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={dashTab === tab
                    ? { background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.3)' }
                    : { background: 'transparent', color: 'hsl(var(--muted-foreground))', border: '1px solid transparent' }
                  }>
                  {tab === 'geral' ? 'Geral' : 'Patrimônio'}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setHidden(v => !v)}
            aria-label={hidden ? 'Mostrar valores' : 'Ocultar valores'} aria-pressed={hidden}
            className="p-2 rounded-xl transition-colors"
            style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--muted))')}
            onMouseLeave={e => (e.currentTarget.style.background = 'hsl(var(--secondary))')}>
            {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <div className="xl:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <button type="button" aria-label="Abrir resumo e alertas" className="p-2 rounded-xl transition-colors"
                  style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)', color: 'rgb(196,181,253)' }}>
                  <ChartNoAxesCombined size={16} />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[90vw] sm:w-[420px] p-0 overflow-y-auto border-0"
                style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                <div className="p-6 pt-12">
                  <DashboardSidebar cards={cards} incomes={incomes} expenses={expenses}
                    fixedExpenses={fixedExpenses} subscriptions={subscriptions}
                    varTxs={varTxs} invoices={invoices} month={month} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* ── LAYOUT ── */}
      <div className="px-4 md:px-8 flex gap-6">
        <div className="flex-1 min-w-0 space-y-5">

          {dashTab === 'patrimonio' ? <DashboardPatrimonioTab /> : (
            <>

              {/* ════════════════════════════════════════════
                  3 SUMMARY CARDS (Saldo / Pendente / A receber)
              ════════════════════════════════════════════ */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Saldo */}
                <SummaryCard
                  label="Saldo do Mês"
                  value={balance}
                  sub={`${Math.round(expenseRatio)}% da renda comprometida`}
                  icon={<Scale size={17} className="text-white" />}
                  gradient="linear-gradient(135deg, #3b0764 0%, #4c1d95 35%, #1e3a8a 75%, #1e40af 100%)"
                  accentColor="rgba(167,139,250,0.6)"
                  delay={0}
                  onClick={() => setBreakdownOpen(true)}
                  hidden={hidden}
                />

                {/* Pendente a pagar */}
                <SummaryCard
                  label="Pendente a Pagar"
                  value={pendingExpense}
                  sub={`de ${formatCurrency(totalExpense)} em gastos`}
                  icon={<ArrowDownRight size={17} className="text-white" />}
                  gradient="linear-gradient(135deg, #450a0a 0%, #7f1d1d 35%, #9f1239 75%, #be123c 100%)"
                  accentColor="rgba(251,113,133,0.6)"
                  delay={0.07}
                  hidden={hidden}
                />

                {/* A receber */}
                <SummaryCard
                  label="A Receber"
                  value={toReceive}
                  sub={`de ${formatCurrency(totalIncome)} previsto`}
                  icon={<ArrowUpRight size={17} className="text-white" />}
                  gradient="linear-gradient(135deg, #052e16 0%, #14532d 35%, #166534 75%, #15803d 100%)"
                  accentColor="rgba(74,222,128,0.6)"
                  delay={0.14}
                  hidden={hidden}
                />
              </div>

              {/* ════════════════════════════════════════
                  CARROSSEL DE CARTÕES
              ════════════════════════════════════════ */}
              {cards.length > 0 && (
                <CardCarousel cards={cards} installmentsByCard={installmentsByCard} />
              )}

              {/* ═══════════════════════
                  METAS
              ═══════════════════════ */}
              {hasGoalsModule && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                  <DashboardGoalsWidget monthlyBalance={balance} />
                </motion.div>
              )}

              {/* ═══════════════════════════════
                  CHECKLIST DO MÊS
              ═══════════════════════════════ */}
              {!loadingData && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
                  <BillsChecklist
                    month={month} cards={cards} incomes={incomes}
                    fixedExpenses={fixedExpenses} expenses={expenses}
                    invoices={invoices} onUpdated={loadAll}
                  />
                </motion.div>
              )}

              {/* ═══════════════════════════════════════
                  GRID INFERIOR (Pie + Lançamentos)
              ═══════════════════════════════════════ */}
              <div className={cn('grid gap-4', pieData.length > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1')}>

                {/* Pie chart */}
                {pieData.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
                    className="rounded-3xl overflow-hidden p-5 bg-card border border-border"
                  >
                    <CategoryBreakdown data={pieData} hidden={hidden} />
                  </motion.div>
                )}

                {/* Lançamentos */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                  className="relative rounded-3xl overflow-hidden"
                  style={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                  }}
                >

                  {/* Header */}
                  <div className="relative z-10 px-5 pt-5 pb-3 flex items-center justify-between gap-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                        style={{ background: 'hsl(var(--primary) / 0.12)' }}>
                        <Wallet size={13} className="text-primary" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">Lançamentos</p>
                      {txCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-muted-foreground bg-secondary">
                          {txCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TransactionFilterBar
                        open={filterOpen} onToggle={() => setFilterOpen(v => !v)}
                        filters={filters} setFilters={setFilters}
                        activeCount={activeCount} clearFilters={clearFilters}
                        availableCategories={availableCategories} cards={cards}
                      />
                      <button onClick={() => setBulkEditOpen(true)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border border-border text-muted-foreground hover:text-foreground transition-all">
                        <Pencil size={10} /> Editar
                      </button>
                    </div>
                  </div>

                  {/* Filtro cartão */}
                  {cards.length > 1 && (
                    <div className="relative z-10 px-5 py-2.5 border-b border-border/40">
                      <ScrollArea>
                        <div className="flex gap-1.5 pb-1">
                          <button onClick={() => setSelectedCardId(null)}
                            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                            style={{
                              background: !selectedCardId ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--secondary))',
                              border: !selectedCardId ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid transparent',
                              color: !selectedCardId ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                            }}>
                            Todos
                          </button>
                          {cards.map(card => {
                            const isActive = selectedCardId === card.id;
                            const s = installmentsByCard.get(card.id) ?? 0;
                            return (
                              <button key={card.id} onClick={() => setSelectedCardId(isActive ? null : card.id)}
                                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                                style={{
                                  background: isActive ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--secondary))',
                                  border: isActive ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid transparent',
                                  color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                                }}>
                                <CreditCardIcon size={11} /> {card.name}
                                {s > 0 && <span className="opacity-60 tabular-nums">{formatCurrency(s)}</span>}
                              </button>
                            );
                          })}
                        </div>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                    </div>
                  )}

                  {/* Lista */}
                  <div className="relative z-10 px-3 py-3">
                    {loadingData && <LoadingState rows={4} label="Carregando lançamentos…" />}
                    {!loadingData && isEmpty && (
                      <EmptyState
                        icon={<Wallet size={20} />}
                        title="Nenhum lançamento"
                        description={activeCount > 0 ? 'Limpe os filtros para ver todos' : 'Adicione um gasto ou receita'}
                      />
                    )}
                    {!loadingData && !isEmpty && (
                      <>
                        <AnimatePresence mode="popLayout">
                          {visibleInstallments.slice(0, collapseInst.visible).map((inst) => {
                            const orig = getExpenseById(inst.expenseId);
                            const cardName = cardMap.get(inst.cardId)?.name ?? '';
                            return (
                              <TransactionRow key={inst.expenseId + inst.installmentNumber}
                                icon={<CategoryIcon category={inst.category} />}
                                title={inst.expenseName}
                                subtitle={inst.totalInstallments > 1
                                  ? `${inst.installmentNumber}/${inst.totalInstallments} · ${cardName}`
                                  : `À vista · ${cardName}`}
                                amount={inst.amount} tone="expense"
                                onEdit={orig ? () => setEditingExpense(orig) : undefined}
                                onDelete={() => setDeletingExpenseId(inst.expenseId)}
                              />
                            );
                          })}
                        </AnimatePresence>
                        <ShowMoreButton expanded={collapseInst.expanded} hidden={collapseInst.hidden} onToggle={collapseInst.toggle} />

                        {visibleVarTxs.length > 0 && (
                          <>
                            {visibleInstallments.length > 0 && <SectionDivider label="Variáveis" />}
                            <AnimatePresence mode="popLayout">
                              {visibleVarTxs.slice(0, collapseVar.visible).map((tx) => (
                                <TransactionRow key={tx.id}
                                  icon={<CategoryIcon category={tx.category} />}
                                  title={tx.name}
                                  subtitle={<>
                                    {METHOD_ICONS[tx.paymentMethod] ?? null}
                                    {PAYMENT_METHOD_CONFIG[tx.paymentMethod]?.label ?? tx.paymentMethod}
                                    {tx.date && ` · ${tx.date.split('-').reverse().slice(0, 2).join('/')}`}
                                  </>}
                                  amount={tx.amount} tone={tx.type === 'income' ? 'income' : 'expense'}
                                  onEdit={() => setEditingVar(tx)}
                                  onDelete={() => setDeletingVarId(tx.id)}
                                />
                              ))}
                            </AnimatePresence>
                            <ShowMoreButton expanded={collapseVar.expanded} hidden={collapseVar.hidden} onToggle={collapseVar.toggle} />
                          </>
                        )}

                        {visibleFixed.length > 0 && (
                          <>
                            {(visibleInstallments.length > 0 || visibleVarTxs.length > 0) && <SectionDivider label="Fixos" />}
                            {visibleFixed.slice(0, collapseFixed.visible).map(f => (
                              <TransactionRow key={f.id}
                                icon={<CategoryIcon category={f.category} />}
                                title={f.name} subtitle="Fixo mensal"
                                amount={f.amount} tone="expense"
                              />
                            ))}
                            <ShowMoreButton expanded={collapseFixed.expanded} hidden={collapseFixed.hidden} onToggle={collapseFixed.toggle} />
                          </>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </div>

        {/* ── SIDEBAR ── */}
        {dashTab === 'geral' && (
          <aside className="hidden xl:block w-72 shrink-0">
            <div className="sticky top-6">
              <DashboardSidebar cards={cards} incomes={incomes} expenses={expenses}
                fixedExpenses={fixedExpenses} subscriptions={subscriptions}
                varTxs={varTxs} invoices={invoices} month={month} />
            </div>
          </aside>
        )}
      </div>

      {/* ── MODAIS ── */}
      <BalanceBreakdownSheet open={breakdownOpen} onClose={() => setBreakdownOpen(false)}
        month={month} cards={cards} expenses={expenses} fixedExpenses={fixedExpenses}
        incomes={incomes} varTxs={varTxs} invoices={invoices} />

      <BulkEditCategoryDialog open={bulkEditOpen} onClose={() => setBulkEditOpen(false)}
        month={month} installments={allInstallments} expenses={expenses}
        varTxs={varTxs} cards={cards} onSaved={loadAll} />

      {editingExpense && (
        <EditExpenseDialog expense={editingExpense} cards={cards} open={!!editingExpense}
          onClose={() => setEditingExpense(null)}
          onSaved={() => { setEditingExpense(null); loadAll(); }} />
      )}

      {editingVar && (
        <EditVariableDialog transaction={editingVar} open={!!editingVar}
          onClose={() => setEditingVar(null)}
          onSaved={() => { setEditingVar(null); loadAll(); }} />
      )}

      <AlertDialog open={!!deletingExpenseId} onOpenChange={v => { if (!v) setDeletingExpenseId(null); }}>
        <AlertDialogContent className="bg-card border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover gasto?</AlertDialogTitle>
            <AlertDialogDescription>Todas as parcelas serão removidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteExpense} className="bg-destructive hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingVarId} onOpenChange={v => { if (!v) setDeletingVarId(null); }}>
        <AlertDialogContent className="bg-card border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lançamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteVar} className="bg-destructive hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}