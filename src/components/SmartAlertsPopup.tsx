import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, AlertTriangle, TrendingDown, TrendingUp, Bell,
  CreditCard, Calendar, CheckCircle2, Info,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  getCards, getIncomes, getExpenses, getFixedExpenses,
  computeInstallmentsForMonth,
} from '@/lib/store';
import { CreditCard as CardType, FixedIncome, Expense, FixedExpense } from '@/lib/types';
import { getCurrentMonth, addMonths } from '@/lib/helpers';

const TRIGGER_PATHS = ['/reports', '/faturas'];

type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';

interface SmartAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  detail?: string;
  icon: React.ReactNode;
  daysUntil?: number;
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function daysUntilDay(day: number): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let target = new Date(now.getFullYear(), now.getMonth(), day);
  if (target < now) target = new Date(now.getFullYear(), now.getMonth() + 1, day);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

function todayDay() { return new Date().getDate(); }

const SEV: Record<AlertSeverity, {
  bg: string; border: string; iconBg: string; badge: string; dot: string; label: string;
}> = {
  critical: {
    bg: 'bg-red-500/10', border: 'border-red-500/40',
    iconBg: 'bg-red-500/20 text-red-400', badge: 'bg-red-500 text-white',
    dot: 'bg-red-500', label: 'Crítico',
  },
  warning: {
    bg: 'bg-amber-500/10', border: 'border-amber-500/40',
    iconBg: 'bg-amber-500/20 text-amber-400', badge: 'bg-amber-500 text-white',
    dot: 'bg-amber-400', label: 'Atenção',
  },
  info: {
    bg: 'bg-violet-500/10', border: 'border-violet-500/40',
    iconBg: 'bg-violet-500/20 text-violet-400', badge: 'bg-violet-600 text-white',
    dot: 'bg-violet-400', label: 'Info',
  },
  success: {
    bg: 'bg-emerald-500/10', border: 'border-emerald-500/40',
    iconBg: 'bg-emerald-500/20 text-emerald-400', badge: 'bg-emerald-600 text-white',
    dot: 'bg-emerald-400', label: 'Tudo ok',
  },
};

function buildAlerts(
  cards: CardType[],
  incomes: FixedIncome[],
  expenses: Expense[],
  fixed: FixedExpense[],
): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const today     = todayDay();
  const curMonth  = getCurrentMonth();
  const nextMonth = addMonths(curMonth, 1);

  const curInst    = computeInstallmentsForMonth(expenses, cards, curMonth);
  const totalCard  = curInst.reduce((s, i) => s + i.amount, 0);
  const totalFixed = fixed.reduce((s, f) => s + f.amount, 0);
  const totalExp   = totalCard + totalFixed;
  const totalInc   = incomes.reduce((s, i) => s + i.amount, 0);
  const balance    = totalInc - totalExp;

  // 1. Balanço geral
  if (balance < 0) {
    alerts.push({
      id: 'balance-neg', severity: 'critical',
      title: 'Gastos maiores que a renda!',
      message: `Renda: ${formatBRL(totalInc)} · Gastos: ${formatBRL(totalExp)}`,
      detail: `Deficit de ${formatBRL(Math.abs(balance))} neste mês.`,
      icon: <TrendingDown size={18} />,
    });
  } else if (balance < totalInc * 0.1) {
    alerts.push({
      id: 'balance-tight', severity: 'warning',
      title: 'Orçamento bem apertado',
      message: `Sobram apenas ${formatBRL(balance)} após todos os compromissos.`,
      detail: `Apenas ${Math.round((balance / totalInc) * 100)}% da renda livre.`,
      icon: <AlertTriangle size={18} />,
    });
  } else {
    alerts.push({
      id: 'balance-ok', severity: 'success',
      title: 'Balanço saudável este mês',
      message: `${formatBRL(balance)} livres após todos os gastos.`,
      icon: <TrendingUp size={18} />,
    });
  }

  // 2. Vencimento de faturas
  for (const card of cards) {
    const du  = daysUntilDay(card.dueDay);
    const amt = curInst.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
    if (amt === 0) continue;

    const cobreStr = balance >= amt
      ? `✓ Sua renda cobre esta fatura.`
      : `⚠ Faltam ${formatBRL(amt - balance)} para cobrir.`;

    if (du <= 0) {
      alerts.push({
        id: `card-overdue-${card.id}`, severity: 'critical',
        title: `Fatura vencida: ${card.name}`,
        message: `${formatBRL(amt)} venceu há ${Math.abs(du)} dia(s). Pague logo para evitar juros.`,
        icon: <CreditCard size={18} />, daysUntil: du,
      });
    } else if (du <= 3) {
      alerts.push({
        id: `card-critical-${card.id}`, severity: 'critical',
        title: `Fatura vence em ${du} dia(s)!`,
        message: `${card.name} ••${card.lastDigits}: ${formatBRL(amt)} — vence dia ${card.dueDay}.`,
        detail: cobreStr,
        icon: <CreditCard size={18} />, daysUntil: du,
      });
    } else if (du <= 7) {
      alerts.push({
        id: `card-warn-${card.id}`, severity: 'warning',
        title: `Fatura em ${du} dias`,
        message: `${card.name} ••${card.lastDigits}: ${formatBRL(amt)} — vence dia ${card.dueDay}.`,
        detail: cobreStr,
        icon: <CreditCard size={18} />, daysUntil: du,
      });
    }
  }

  // 3. Recebimentos chegando
  for (const inc of incomes) {
    if (!inc.receiveDay || inc.receiveDay > 100) continue;
    const du = daysUntilDay(inc.receiveDay);
    if (du >= 0 && du <= 3) {
      alerts.push({
        id: `income-${inc.id}`, severity: 'info',
        title: du === 0 ? 'Recebimento hoje!' : `Recebimento em ${du} dia(s)`,
        message: `${inc.name}: ${formatBRL(inc.amount)} ${du === 0 ? 'entra hoje' : `no dia ${inc.receiveDay}`}.`,
        icon: <TrendingUp size={18} />, daysUntil: du,
      });
    }
  }

  // 4. Gap de caixa: cartão vence antes do próximo recebimento
  const nextIncEntry = incomes
    .filter(i => i.receiveDay && i.receiveDay <= 100 && i.receiveDay > today)
    .sort((a, b) => (a.receiveDay ?? 99) - (b.receiveDay ?? 99))[0];

  const receivedSoFar = incomes
    .filter(i => i.receiveDay && i.receiveDay <= today)
    .reduce((s, i) => s + i.amount, 0);

  for (const card of cards) {
    if (!nextIncEntry?.receiveDay) continue;
    if (card.dueDay >= nextIncEntry.receiveDay) continue;
    const du  = daysUntilDay(card.dueDay);
    if (du < 0 || du > 30) continue;
    const amt = curInst.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
    if (amt === 0 || receivedSoFar >= amt) continue;

    alerts.push({
      id: `cashflow-${card.id}`, severity: 'warning',
      title: 'Atenção ao fluxo de caixa',
      message: `Fatura ${card.name} (${formatBRL(amt)}) vence dia ${card.dueDay}, antes de receber ${nextIncEntry.name} no dia ${nextIncEntry.receiveDay}.`,
      detail: `Você precisa ter ${formatBRL(amt)} disponível antes do recebimento.`,
      icon: <Calendar size={18} />,
    });
  }

  // 5. Previsão mês seguinte
  const nextInst    = computeInstallmentsForMonth(expenses, cards, nextMonth);
  const nextCardAmt = nextInst.reduce((s, i) => s + i.amount, 0);
  const nextTotal   = nextCardAmt + totalFixed;
  const nextBalance = totalInc - nextTotal;
  if (nextBalance < 0) {
    alerts.push({
      id: 'next-neg', severity: 'warning',
      title: 'Próximo mês terá deficit',
      message: `Gastos previstos: ${formatBRL(nextTotal)} · Renda: ${formatBRL(totalInc)}`,
      detail: `Deficit de ${formatBRL(Math.abs(nextBalance))} no próximo mês.`,
      icon: <Info size={18} />,
    });
  }

  const order: AlertSeverity[] = ['critical', 'warning', 'info', 'success'];
  return alerts.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SmartAlertsPopup() {
  const location = useLocation();
  const prevPath = useRef<string>('');

  const [open, setOpen]           = useState(false);
  const [alerts, setAlerts]       = useState<SmartAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [idx, setIdx]             = useState(0);

  useEffect(() => {
    const cur  = location.pathname;
    const prev = prevPath.current;

    const isTarget  = TRIGGER_PATHS.includes(cur);
    const wasTarget = TRIGGER_PATHS.includes(prev);

    if (isTarget && !wasTarget) {
      setDismissed(new Set());
      setIdx(0);
      loadAndOpen();
    }

    prevPath.current = cur;
  }, [location.pathname]);

  async function loadAndOpen() {
    try {
      const [cards, incomes, expenses, fixed] = await Promise.all([
        getCards(), getIncomes(), getExpenses(), getFixedExpenses(),
      ]);
      const built = buildAlerts(cards, incomes, expenses, fixed);
      setAlerts(built);
      if (built.length > 0) setOpen(true);
    } catch (e) {
      console.error('SmartAlerts:', e);
    }
  }

  const visible = useMemo(
    () => alerts.filter(a => !dismissed.has(a.id)),
    [alerts, dismissed],
  );

  const current = visible[Math.min(idx, visible.length - 1)];
  const cfg     = current ? SEV[current.severity] : null;

  function dismiss(id: string) {
    setDismissed(prev => new Set(prev).add(id));
    setIdx(i => Math.max(0, Math.min(i, visible.length - 2)));
  }

  return (
    <AnimatePresence>
      {open && current && cfg && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50',
              'bg-[var(--color-surface,#16141d)] border-t border-white/10',
              'rounded-t-3xl px-5 pt-4 pb-10',
              'max-w-lg mx-auto shadow-2xl',
            )}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-[var(--color-primary,#7c3aed)]" />
                <span className="text-white font-semibold text-sm">Alertas Financeiros</span>
                <div className="flex gap-1.5 ml-1">
                  {(['critical','warning','info','success'] as AlertSeverity[]).map(sev => {
                    const count = visible.filter(a => a.severity === sev).length;
                    if (!count) return null;
                    return (
                      <span key={sev} className="flex items-center gap-0.5">
                        <span className={cn('w-2 h-2 rounded-full', SEV[sev].dot)} />
                        <span className="text-[10px] text-white/50">{count}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center
                  text-white/50 hover:text-white hover:bg-white/20 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Card alerta atual */}
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -30, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className={cn('rounded-2xl border p-4 mb-4', cfg.bg, cfg.border)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', cfg.iconBg)}>
                    {current.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', cfg.badge)}>
                        {SEV[current.severity].label}
                      </span>
                      {current.daysUntil !== undefined && (
                        <span className="text-[10px] text-white/40">
                          {current.daysUntil === 0 ? 'Hoje'
                            : current.daysUntil < 0 ? `${Math.abs(current.daysUntil)}d atrás`
                            : `em ${current.daysUntil}d`}
                        </span>
                      )}
                    </div>
                    <p className="text-white font-semibold text-sm leading-snug">{current.title}</p>
                    <p className="text-white/60 text-xs mt-1 leading-relaxed">{current.message}</p>
                    {current.detail && (
                      <p className="text-white/40 text-xs mt-2 pt-2 border-t border-white/10 leading-relaxed">
                        {current.detail}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => dismiss(current.id)}
                    className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center
                      text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors flex-shrink-0 mt-0.5"
                  >
                    <X size={12} />
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Paginação */}
            {visible.length > 1 && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-1.5 items-center">
                  {visible.map((a, i) => (
                    <button
                      key={a.id}
                      onClick={() => setIdx(i)}
                      className={cn(
                        'rounded-full transition-all h-1.5',
                        i === idx ? `w-5 ${SEV[a.severity].dot}` : 'w-1.5 bg-white/20',
                      )}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    disabled={idx === 0}
                    onClick={() => setIdx(i => Math.max(0, i - 1))}
                    className="text-[11px] text-white/40 hover:text-white/70 disabled:opacity-25
                      px-2.5 py-1 rounded-lg bg-white/5 transition-colors"
                  >
                    ← Ant
                  </button>
                  <button
                    disabled={idx >= visible.length - 1}
                    onClick={() => setIdx(i => Math.min(visible.length - 1, i + 1))}
                    className="text-[11px] text-white/40 hover:text-white/70 disabled:opacity-25
                      px-2.5 py-1 rounded-lg bg-white/5 transition-colors"
                  >
                    Próx →
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setOpen(false)}
              className="w-full py-3 rounded-2xl bg-white/5 border border-white/10
                text-white/50 text-sm font-medium hover:bg-white/10 hover:text-white/80
                transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={14} />
              Entendido, fechar
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}