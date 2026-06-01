// src/pages/Index.tsx
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingDown, TrendingUp, Pencil, Trash2, Wallet,
  Zap, Banknote, ArrowLeftRight, Scale,
  CreditCard as CreditCardIcon, FileText, ChartNoAxesCombined,
  ChevronLeft, ChevronRight, Eye, EyeOff, ArrowUpRight, ArrowDownRight,
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
import { subscriptionsAsInstallments, monthlyAmount } from '@/lib/subscriptions';
import {
  Expense, CreditCard, FixedExpense,
  FixedIncome, VariableTransaction, PAYMENT_METHOD_CONFIG, BRAND_GRADIENTS,
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
];

const METHOD_ICONS: Record<string, React.ReactNode> = {
  pix:      <Zap size={11} />,
  cash:     <Banknote size={11} />,
  transfer: <ArrowLeftRight size={11} />,
  debit:    <CreditCardIcon size={11} />,
  boleto:   <FileText size={11} />,
};

const SectionDivider = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 py-1.5">
    <div className="flex-1 h-px bg-border" />
    <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">{label}</span>
    <div className="flex-1 h-px bg-border" />
  </div>
);

// ─── SUMMARY CARD (Saldo / Pendente / A Receber) ──────────────────────────────
function SummaryCard({
  label, value, sub, icon, gradient, accentColor, delay = 0, onClick, hidden,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
  gradient: string;
  accentColor?: string;
  delay?: number;
  onClick?: () => void;
  hidden?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.45, ease: 'easeOut' }}
      onClick={onClick}
      className={cn('relative rounded-3xl overflow-hidden text-white group', onClick && 'cursor-pointer')}
      style={{ background: gradient }}
      whileHover={onClick ? { scale: 1.015 } : undefined}
      whileTap={onClick ? { scale: 0.985 } : undefined}
    >

      {/* Linha de brilho diagonal */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 55%)' }} />
      {/* Borda glass sutil */}
      <div className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{ border: '1px solid rgba(255,255,255,0.15)' }} />

      <div className="relative z-10 p-4 md:p-5">
        {/* Ícone em pill glass */}
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-2xl mb-4"
          style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
          {icon}
        </div>

        {/* Label */}
        <p className="text-white/55 text-[11px] font-medium uppercase tracking-wide mb-1">{label}</p>

        {/* Valor */}
        <p className={cn(
          'font-bold tracking-tight tabular-nums leading-none',
          hidden ? 'text-white/30 tracking-[0.4em] text-sm mt-2' : 'text-white text-2xl',
        )}>
          {hidden ? '• • • • •' : formatCurrency(value)}
        </p>

        {/* Sub */}
        {sub && !hidden && (
          <p className="text-white/40 text-[10px] mt-2 leading-tight">{sub}</p>
        )}

        {/* Linha decorativa no fundo */}
        {accentColor && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
            style={{ background: accentColor }} />
        )}
      </div>
    </motion.div>
  );
}

// ─── CARROSSEL DE CARTÕES ─────────────────────────────────────────────────────
const CARD_BRAND_GRADIENTS: Record<string, string> = {
  visa:       'linear-gradient(135deg, #1e40af 0%, #0369a1 60%, #06b6d4 100%)',
  mastercard: 'linear-gradient(135deg, #9f1239 0%, #c2410c 60%, #ea580c 100%)',
  elo:        'linear-gradient(135deg, #92400e 0%, #b45309 60%, #d97706 100%)',
  amex:       'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  other:      'linear-gradient(135deg, #4c1d95 0%, #6d28d9 60%, #7c3aed 100%)',
};

// Símbolo da bandeira
function BrandSymbol({ brand }: { brand: string }) {
  if (brand === 'visa') return (
    <span className="font-bold italic text-white text-lg tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>VISA</span>
  );
  if (brand === 'mastercard') return (
    <div className="flex items-center">
      <div className="w-6 h-6 rounded-full bg-red-500/90" />
      <div className="w-6 h-6 rounded-full bg-yellow-400/90 -ml-3" />
    </div>
  );
  if (brand === 'amex') return (
    <span className="font-bold text-white text-xs tracking-widest">AMEX</span>
  );
  if (brand === 'elo') return (
    <span className="font-bold text-white text-lg" style={{ fontFamily: 'Georgia, serif' }}>elo</span>
  );
  return <CreditCardIcon size={20} className="text-white/80" />;
}

function CardCarousel({
  cards,
  installmentsByCard,
}: {
  cards: CreditCard[];
  installmentsByCard: Map<string, number>;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolling  = useRef(false);
  const total = cards.length;

  if (total === 0) return null;

  // Scroll programático ao mudar activeIdx pelas setas
  const scrollToIdx = (idx: number) => {
    const el = containerRef.current;
    if (!el) return;
    isScrolling.current = true;
    const cardWidth = el.offsetWidth * 0.88 + 12; // largura do card + gap
    el.scrollTo({ left: idx * cardWidth, behavior: 'smooth' });
    setTimeout(() => { isScrolling.current = false; }, 400);
  };

  const prev = () => {
    const newIdx = (activeIdx - 1 + total) % total;
    setActiveIdx(newIdx);
    scrollToIdx(newIdx);
  };

  const next = () => {
    const newIdx = (activeIdx + 1) % total;
    setActiveIdx(newIdx);
    scrollToIdx(newIdx);
  };

  const goTo = (idx: number) => {
    setActiveIdx(idx);
    scrollToIdx(idx);
  };

  // Atualizar índice ativo ao rolar manualmente
  const handleScroll = () => {
    if (isScrolling.current) return;
    const el = containerRef.current;
    if (!el) return;
    const cardWidth = el.offsetWidth * 0.88 + 12;
    const newIdx = Math.round(el.scrollLeft / cardWidth);
    if (newIdx !== activeIdx && newIdx >= 0 && newIdx < total) {
      setActiveIdx(newIdx);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28, duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-primary/15 flex items-center justify-center">
            <CreditCardIcon size={13} className="text-primary" />
          </div>
          <p className="text-sm font-semibold">Meus Cartões</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">{total}</span>
        </div>
        {total > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={prev}
              className="w-8 h-8 rounded-xl bg-secondary/80 hover:bg-secondary flex items-center justify-center transition-colors border border-border/50"
            >
              <ChevronLeft size={15} className="text-muted-foreground" />
            </button>
            <button
              onClick={next}
              className="w-8 h-8 rounded-xl bg-secondary/80 hover:bg-secondary flex items-center justify-center transition-colors border border-border/50"
            >
              <ChevronRight size={15} className="text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* Track com peek dos cartões adjacentes */}
      <div className="relative rounded-2xl overflow-hidden">


        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto scrollbar-hide px-3"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
        >
          {cards.map((card, i) => {
            const spent     = installmentsByCard.get(card.id) ?? 0;
            const available = Math.max(0, card.limit - spent);
            const usedPct   = card.limit > 0 ? Math.min(100, (spent / card.limit) * 100) : 0;
            const gradient  = card.customGradient ?? CARD_BRAND_GRADIENTS[card.brand] ?? CARD_BRAND_GRADIENTS.other;
            const isActive  = i === activeIdx;

            return (
              <div
                key={card.id}
                onClick={() => goTo(i)}
                className="relative rounded-3xl overflow-hidden text-white cursor-pointer select-none"
                style={{
                  background: gradient,
                  minWidth: '88%',
                  height: 186,
                  scrollSnapAlign: 'center',
                  flexShrink: 0,
                  opacity: isActive ? 1 : 0.65,
                  transform: isActive ? 'scale(1)' : 'scale(0.94)',
                  transition: 'opacity 0.3s ease, transform 0.3s ease',
                }}
              >

                {/* Brilho diagonal */}
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 50%)' }} />
                {/* Borda glass */}
                <div className="absolute inset-0 rounded-3xl pointer-events-none"
                  style={{ border: '1px solid rgba(255,255,255,0.16)' }} />

                {/* Badge vencimento */}
                <div className="absolute top-4 right-4 px-2.5 py-1 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)' }}>
                  <p className="text-white/75 text-[10px] font-medium">Vence dia {card.dueDay}</p>
                </div>

                <div className="relative z-10 p-5 h-full flex flex-col justify-between">
                  {/* Topo */}
                  <div className="flex items-start justify-between">
                    <div>
                      <BrandSymbol brand={card.brand} />
                      <p className="text-white/70 text-xs mt-1.5 font-medium">{card.name}</p>
                    </div>
                    {/* NFC */}
                    <div className="flex flex-col gap-0.5 mt-1 opacity-40">
                      {[14, 11, 8].map(w => (
                        <div key={w} className="h-0.5 rounded-full bg-white" style={{ width: w }} />
                      ))}
                    </div>
                  </div>

                  {/* Número */}
                  <p className="text-white/50 font-mono text-sm tracking-[0.22em]">
                    •••• •••• •••• {card.lastDigits}
                  </p>

                  {/* Base */}
                  <div>
                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <p className="text-white/40 text-[10px] mb-0.5 uppercase tracking-wide">Fatura</p>
                        <p className="text-white font-bold text-xl tabular-nums leading-none">{formatCurrency(spent)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/40 text-[10px] mb-0.5 uppercase tracking-wide">Disponível</p>
                        <p className="text-white/85 font-semibold text-sm tabular-nums leading-none">{formatCurrency(available)}</p>
                      </div>
                    </div>
                    <div className="h-1 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${usedPct}%`, background: 'rgba(255,255,255,0.75)' }} />
                    </div>
                    <p className="text-white/30 text-[10px] mt-1">{Math.round(usedPct)}% do limite</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dots */}
      {total > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="transition-all duration-300 rounded-full"
              style={{
                width: i === activeIdx ? 20 : 6,
                height: 6,
                background: i === activeIdx ? 'hsl(263 70% 58%)' : 'hsl(var(--border))',
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}


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
    supabase.auth.getUser().then(({ data: { user } }) =>
      setUserName(user?.user_metadata?.name ?? ''));
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

  // ── Cálculos ─────────────────────────────────────────────────────────────
  // Assinaturas com cardId → aparecem como lançamentos de cartão
  const subInstallments = useMemo(
    () => subscriptionsAsInstallments(subscriptions, month),
    [subscriptions, month],
  );

  const allInstallments = useMemo(
    () => [...computeInstallmentsForMonth(expenses, cards, month), ...subInstallments],
    [expenses, cards, month, subInstallments],
  );
  const cardMap        = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards]);
  const getExpenseById = (id: string) => expenses.find(e => e.id === id);
  const invoiceMap     = useMemo(() => new Map(invoices.map(inv => [inv.cardId, inv])), [invoices]);

  const totalCardSpent = useMemo(() =>
    cards.reduce((sum, card) => {
      const confirmed = invoiceMap.get(card.id);
      if (confirmed && confirmed.actualAmount > 0) return sum + confirmed.actualAmount;
      return sum + allInstallments.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
    }, 0),
  [cards, invoiceMap, allInstallments]);

  const totalCardCalculated = useMemo(() => allInstallments.reduce((s, i) => s + i.amount, 0), [allInstallments]);
  const totalLimit          = useMemo(() => cards.reduce((s, c) => s + c.limit, 0), [cards]);
  const installmentsByCard  = useMemo(() => new Map(
    cards.map(c => [c.id, allInstallments.filter(i => i.cardId === c.id).reduce((s, i) => s + i.amount, 0)])
  ), [cards, allInstallments]);

  const totalVarInc  = useMemo(() => varTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),  [varTxs]);
  const totalVarExp  = useMemo(() => varTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [varTxs]);
  const totalIncome  = useMemo(() => incomes.reduce((s, i) => s + i.amount, 0) + totalVarInc,                    [incomes, totalVarInc]);
  // Assinaturas sem cartão (cobradas direto, não via fatura)
  const totalSubsNoCard = useMemo(
    () => subscriptions.filter(s => s.active && !s.cardId).reduce((s, sub) => s + monthlyAmount(sub), 0),
    [subscriptions],
  );

  const totalExpense = useMemo(
    () => totalCardSpent + fixedExpenses.reduce((s, f) => s + f.amount, 0) + totalVarExp + totalSubsNoCard,
    [totalCardSpent, fixedExpenses, totalVarExp, totalSubsNoCard],
  );
  const balance      = totalIncome - totalExpense;

  // Pendente = gastos que ainda não foram pagos (total - já pagos via checklist)
  // A receber = receitas que ainda não entraram
  const paidExpense = useMemo(() => {
    const paidFixed  = fixedExpenses.filter(f => f.paidMonths?.includes(month)).reduce((s, f) => s + f.amount, 0);
    const paidCards  = invoices.filter(inv => inv.actualAmount > 0).reduce((s, inv) => s + inv.actualAmount, 0);
    return paidFixed + paidCards;
  }, [fixedExpenses, invoices, month]);

  const receivedIncome = useMemo(() =>
    incomes.filter(i => i.receivedMonths?.includes(month)).reduce((s, i) => s + i.amount, 0),
  [incomes, month]);

  const pendingExpense  = Math.max(0, totalExpense - paidExpense);
  const toReceive       = Math.max(0, totalIncome - receivedIncome);

  const txCount = useMemo(() => allInstallments.length + varTxs.length, [allInstallments, varTxs]);

  const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
  const daysElapsed = month === getCurrentMonth() ? Math.max(1, new Date().getDate()) : daysInMonth;
  const avgDaily    = totalExpense > 0 ? totalExpense / daysElapsed : 0;

  const expenseRatio = totalIncome > 0 ? Math.min(100, (totalExpense / totalIncome) * 100) : 0;

  const pieData = useMemo(() => {
    const totals = { ...computeCategoryTotals(allInstallments, fixedExpenses) };
    varTxs.filter(t => t.type === 'expense').forEach(t => {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });
    return Object.entries(totals).filter(([, v]) => v > 0)
      .map(([key, value]) => ({ name: resolveCategoryInfo(key).label, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [allInstallments, fixedExpenses, varTxs]);

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
          <button onClick={() => setHidden(v => !v)}
            className="p-2 rounded-xl transition-colors"
            style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--muted))')}
            onMouseLeave={e => (e.currentTarget.style.background = 'hsl(var(--secondary))')}>
            {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <div className="xl:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <button className="p-2 rounded-xl transition-colors"
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
                    className="relative rounded-3xl overflow-hidden p-5"
                    style={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  >

                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                          style={{ background: 'hsl(var(--primary) / 0.1)' }}>
                          <span className="text-xs">📊</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground">Gastos por categoria</p>
                      </div>
                      <div className="flex gap-4 items-center">
                        <div className="w-32 h-32 shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={56} dataKey="value" stroke="none">
                                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} opacity={0.9} />)}
                              </Pie>
                              <Tooltip
                                formatter={(v: number) => [formatCurrency(v), '']}
                                contentStyle={{
                                  background: 'hsl(240 10% 8%)',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  color: 'white',
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          {pieData.slice(0, 6).map((d, i) => (
                            <div key={d.name} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-xs text-muted-foreground truncate flex-1">{d.name}</span>
                              <span className="text-xs font-semibold tabular-nums text-foreground">{formatCurrency(d.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
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
                    {loadingData && (
                      <div className="py-10 text-center">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Carregando...</p>
                      </div>
                    )}
                    {!loadingData && isEmpty && (
                      <div className="py-10 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
                          <Wallet size={20} className="text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Nenhum lançamento</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {activeCount > 0 ? 'Limpe os filtros' : 'Adicione um gasto ou receita'}
                        </p>
                      </div>
                    )}
                    {!loadingData && !isEmpty && (
                      <>
                        <AnimatePresence mode="popLayout">
                          {visibleInstallments.slice(0, collapseInst.visible).map((inst) => {
                            const orig = getExpenseById(inst.expenseId);
                            return (
                              <motion.div key={inst.expenseId + inst.installmentNumber}
                                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                                className="flex items-center gap-3 py-2.5 px-2 rounded-xl group transition-colors"
                                onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--secondary) / 0.5)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                <CategoryIcon category={inst.category} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate text-foreground">{inst.expenseName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {inst.totalInstallments > 1
                                      ? `${inst.installmentNumber}/${inst.totalInstallments} · ${cardMap.get(inst.cardId)?.name ?? ''}`
                                      : `À vista · ${cardMap.get(inst.cardId)?.name ?? ''}`}
                                  </p>
                                </div>
                                <span className="text-sm font-bold text-destructive tabular-nums">{formatCurrency(inst.amount)}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => orig && setEditingExpense(orig)}
                                    className="p-1 rounded-lg text-white/30 hover:text-white/70 transition-colors">
                                    <Pencil size={12} />
                                  </button>
                                  <button onClick={() => setDeletingExpenseId(inst.expenseId)}
                                    className="p-1 rounded-lg text-white/30 hover:text-red-400 transition-colors">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                        <ShowMoreButton expanded={collapseInst.expanded} hidden={collapseInst.hidden} onToggle={collapseInst.toggle} />

                        {visibleVarTxs.length > 0 && (
                          <>
                            {visibleInstallments.length > 0 && <SectionDivider label="Variáveis" />}
                            <AnimatePresence mode="popLayout">
                              {visibleVarTxs.slice(0, collapseVar.visible).map((tx) => (
                                <motion.div key={tx.id}
                                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                                  className="flex items-center gap-3 py-2.5 px-2 rounded-xl group transition-colors"
                                  onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--secondary) / 0.5)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                  <CategoryIcon category={tx.category} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate text-foreground">{tx.name}</p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      {METHOD_ICONS[tx.paymentMethod] ?? null}
                                      {PAYMENT_METHOD_CONFIG[tx.paymentMethod]?.label ?? tx.paymentMethod}
                                      {tx.date && ` · ${tx.date.split('-').reverse().slice(0, 2).join('/')}`}
                                    </p>
                                  </div>
                                  <span className={cn('text-sm font-bold tabular-nums', tx.type === 'income' ? 'text-emerald-400' : 'text-red-400')}>
                                    {tx.type === 'income' ? '+' : ''}{formatCurrency(tx.amount)}
                                  </span>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingVar(tx)} className="p-1 rounded-lg text-white/30 hover:text-white/70 transition-colors"><Pencil size={12} /></button>
                                    <button onClick={() => setDeletingVarId(tx.id)} className="p-1 rounded-lg text-white/30 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                            <ShowMoreButton expanded={collapseVar.expanded} hidden={collapseVar.hidden} onToggle={collapseVar.toggle} />
                          </>
                        )}

                        {visibleFixed.length > 0 && (
                          <>
                            {(visibleInstallments.length > 0 || visibleVarTxs.length > 0) && <SectionDivider label="Fixos" />}
                            {visibleFixed.slice(0, collapseFixed.visible).map(f => (
                              <div key={f.id} className="flex items-center gap-3 py-2.5 px-2 rounded-xl"
                                onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--secondary) / 0.5)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <CategoryIcon category={f.category} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate text-foreground">{f.name}</p>
                                  <p className="text-xs text-muted-foreground">Fixo mensal</p>
                                </div>
                                <span className="text-sm font-bold text-destructive tabular-nums">{formatCurrency(f.amount)}</span>
                              </div>
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