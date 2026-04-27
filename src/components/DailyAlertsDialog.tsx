// src/components/DailyAlertsDialog.tsx
//
// Dois modos de uso:
//
// 1. Modo rota (App.tsx) — abre ao ENTRAR em /reports ou /faturas:
//    <DailyAlertsDialog />
//
// 2. Modo mês (FaturaPage / ReportsPage) — abre ao mudar de mês:
//    <DailyAlertsDialog month={month} />
//
// Quando `month` é passado, o dialog dispara a cada mudança de mês.
// Quando não é passado, dispara ao entrar nas rotas-alvo.

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, AlertTriangle, TrendingDown, TrendingUp,
  CreditCard, Calendar, CheckCircle2, Info, Bell,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  getCards, getIncomes, getExpenses, getFixedExpenses,
  computeInstallmentsForMonth,
} from '@/lib/store';
import { CreditCard as CardType, FixedIncome, Expense, FixedExpense } from '@/lib/types';
import { getCurrentMonth, addMonths } from '@/lib/helpers';

const TRIGGER_PATHS = ['/reports', '/faturas'];

type Severity = 'critical' | 'warning' | 'info' | 'success';

interface DailyAlert {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  icon: React.ReactNode;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function daysUntil(day: number): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let t = new Date(now.getFullYear(), now.getMonth(), day);
  if (t < now) t = new Date(now.getFullYear(), now.getMonth() + 1, day);
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / 86_400_000);
}

function todayStr() {
  return new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).replace('.', '');
}

function dayDate(day: number): string {
  const now = new Date();
  let d = new Date(now.getFullYear(), now.getMonth(), day);
  if (d < now) d = new Date(now.getFullYear(), now.getMonth() + 1, day);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ─── Estilos por severidade ───────────────────────────────────────────────────
const SEV_STYLE: Record<Severity, { iconBg: string; iconColor: string; border: string }> = {
  critical: { iconBg: 'bg-red-500/15',     iconColor: 'text-red-400',     border: 'border-red-500/20'    },
  warning:  { iconBg: 'bg-amber-500/15',   iconColor: 'text-amber-400',   border: 'border-amber-500/20'  },
  info:     { iconBg: 'bg-blue-500/15',    iconColor: 'text-blue-400',    border: 'border-blue-500/20'   },
  success:  { iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-400', border: 'border-emerald-500/20'},
};

// ─── Gerador de alertas ───────────────────────────────────────────────────────
function buildAlerts(
  cards: CardType[],
  incomes: FixedIncome[],
  expenses: Expense[],
  fixed: FixedExpense[],
  targetMonth: string,
): DailyAlert[] {
  const alerts: DailyAlert[] = [];
  const today     = new Date().getDate();
  const curMonth  = getCurrentMonth();
  const isCurrent = targetMonth === curMonth;
  const nextMonth = addMonths(targetMonth, 1);

  const curInst    = computeInstallmentsForMonth(expenses, cards, targetMonth);
  const totalCard  = curInst.reduce((s, i) => s + i.amount, 0);
  const totalFix   = fixed.reduce((s, f) => s + f.amount, 0);
  const totalExp   = totalCard + totalFix;
  const totalInc   = incomes.reduce((s, i) => s + i.amount, 0);
  const balance    = totalInc - totalExp;

  // ── Label do mês para contexto ────────────────────────────────────────────
  const [y, m] = targetMonth.split('-').map(Number);
  const monthName = new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long' });
  const monthCtx  = isCurrent ? 'este mês' : `em ${monthName}`;

  // 1. Recebimentos hoje (só no mês atual)
  if (isCurrent) {
    for (const inc of incomes) {
      if (inc.receiveDay === today) {
        alerts.push({
          id: `inc-today-${inc.id}`, severity: 'info',
          title: `Próximo recebimento: ${fmt(inc.amount)} — hoje`,
          description: `${inc.name} previsto para entrada hoje. Saldo atual: ${fmt(balance)}.`,
          icon: <TrendingUp size={18} />,
        });
      }
    }
  }

  // 2. Gap de caixa: fatura vence antes do próximo recebimento (só mês atual)
  if (isCurrent) {
    const nextIncEntry = incomes
      .filter(i => i.receiveDay && i.receiveDay <= 100 && i.receiveDay > today)
      .sort((a, b) => (a.receiveDay ?? 99) - (b.receiveDay ?? 99))[0];

    const receivedSoFar = incomes
      .filter(i => i.receiveDay && i.receiveDay <= today)
      .reduce((s, i) => s + i.amount, 0);

    for (const card of cards) {
      const du  = daysUntil(card.dueDay);
      const amt = curInst.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
      if (amt === 0) continue;

      if (nextIncEntry?.receiveDay && card.dueDay < nextIncEntry.receiveDay && receivedSoFar < amt) {
        const deficit = amt - receivedSoFar;
        alerts.push({
          id: `cashflow-${card.id}`, severity: 'critical',
          title: `Saldo negativo previsto em ${du} dia${du !== 1 ? 's' : ''}!`,
          description: `Você recebe ${fmt(nextIncEntry.amount)} no dia ${nextIncEntry.receiveDay}, mas tem ${fmt(amt)} de fatura do ${card.name} vencendo em ${dayDate(card.dueDay)}. Déficit de ${fmt(deficit)}.`,
          icon: <AlertTriangle size={18} />,
        });
      } else if (du === 0) {
        alerts.push({
          id: `card-today-${card.id}`, severity: 'critical',
          title: `Fatura do ${card.name} vence HOJE!`,
          description: `${fmt(amt)} vencem hoje. Pague para evitar juros.`,
          icon: <CreditCard size={18} />,
        });
      } else if (du <= 3) {
        const covers = balance >= amt;
        alerts.push({
          id: `card-critical-${card.id}`, severity: 'critical',
          title: `Fatura do ${card.name} vence em ${du} dia${du !== 1 ? 's' : ''}!`,
          description: `${fmt(amt)} vencem em ${dayDate(card.dueDay)}. ${covers ? `Você terá ${fmt(balance - amt)} disponíveis.` : `Faltam ${fmt(amt - balance)} para cobrir.`}`,
          icon: <CreditCard size={18} />,
        });
      } else if (du <= 7) {
        const covers = balance >= amt;
        alerts.push({
          id: `card-warn-${card.id}`, severity: 'warning',
          title: `Fatura do ${card.name} vence em ${du} dias`,
          description: `${fmt(amt)} vencem em ${dayDate(card.dueDay)}. ${covers ? `Você terá ${fmt(balance - amt)} disponíveis.` : `Faltam ${fmt(amt - balance)} para cobrir.`}`,
          icon: <CreditCard size={18} />,
        });
      }
    }
  }

  // 3. Balanço geral do mês selecionado
  if (balance < 0) {
    alerts.push({
      id: 'balance-neg', severity: 'critical',
      title: `Gastos maiores que a renda ${monthCtx}!`,
      description: `Renda: ${fmt(totalInc)} · Gastos: ${fmt(totalExp)} · Déficit: ${fmt(Math.abs(balance))}.`,
      icon: <TrendingDown size={18} />,
    });
  } else if (balance >= totalInc * 0.2 && totalInc > 0) {
    alerts.push({
      id: 'balance-ok', severity: 'success',
      title: `Balanço saudável ${monthCtx}`,
      description: `Sobram ${fmt(balance)} após todos os compromissos. Continue assim!`,
      icon: <CheckCircle2 size={18} />,
    });
  }

  // 4. Recebimentos próximos (só mês atual)
  if (isCurrent) {
    for (const inc of incomes) {
      if (!inc.receiveDay || inc.receiveDay > 100) continue;
      const du = daysUntil(inc.receiveDay);
      if (du > 0 && du <= 3) {
        alerts.push({
          id: `inc-soon-${inc.id}`, severity: 'info',
          title: `Recebimento em ${du} dia${du !== 1 ? 's' : ''}: ${fmt(inc.amount)}`,
          description: `${inc.name} previsto para ${dayDate(inc.receiveDay)}.`,
          icon: <TrendingUp size={18} />,
        });
      }
    }
  }

  // 5. Prévia do mês seguinte ao selecionado
  const nextInst    = computeInstallmentsForMonth(expenses, cards, nextMonth);
  const nextCardAmt = nextInst.reduce((s, i) => s + i.amount, 0);
  const nextTotal   = nextCardAmt + totalFix;
  const nextBal     = totalInc - nextTotal;
  const [ny, nm]    = nextMonth.split('-').map(Number);
  const nextName    = new Date(ny, nm - 1).toLocaleDateString('pt-BR', { month: 'long' });

  if (nextBal < 0) {
    alerts.push({
      id: 'next-neg', severity: 'warning',
      title: `${isCurrent ? 'Próximo mês' : nextName} terá déficit`,
      description: `Gastos previstos: ${fmt(nextTotal)} · Renda: ${fmt(totalInc)} · Déficit: ${fmt(Math.abs(nextBal))}.`,
      icon: <Info size={18} />,
    });
  }

  const order: Severity[] = ['critical', 'warning', 'info', 'success'];
  return alerts.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  /** Quando passado, dispara ao mudar de mês. Quando omitido, dispara ao entrar na rota. */
  month?: string;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DailyAlertsDialog({ month }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const prevPath  = useRef('');
  const prevMonth = useRef('');

  const [open, setOpen]           = useState(false);
  const [alerts, setAlerts]       = useState<DailyAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // ── Modo rota: dispara ao entrar em /reports ou /faturas ──────────────────
  useEffect(() => {
    if (month !== undefined) return; // modo mês ativo, ignora rota
    const cur  = location.pathname;
    const prev = prevPath.current;
    if (TRIGGER_PATHS.includes(cur) && !TRIGGER_PATHS.includes(prev)) {
      setDismissed(new Set());
      load(getCurrentMonth());
    }
    prevPath.current = cur;
  }, [location.pathname, month]);

  // ── Modo mês: dispara ao mudar de mês ─────────────────────────────────────
  useEffect(() => {
    if (month === undefined) return;
    if (month === prevMonth.current) return; // evita loop na montagem
    prevMonth.current = month;
    setDismissed(new Set());
    load(month);
  }, [month]);

  async function load(targetMonth: string) {
    try {
      const [cards, incomes, expenses, fixed] = await Promise.all([
        getCards(), getIncomes(), getExpenses(), getFixedExpenses(),
      ]);
      const built = buildAlerts(cards, incomes, expenses, fixed, targetMonth);
      setAlerts(built);
      if (built.length > 0) setOpen(true);
    } catch (e) {
      console.error('DailyAlertsDialog:', e);
    }
  }

  const visible = alerts.filter(a => !dismissed.has(a.id));

  return (
    <AnimatePresence>
      {open && visible.length > 0 && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Wrapper de centralização */}
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
            <motion.div
              key="dialog"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', damping: 26, stiffness: 340 }}
              className="w-full max-w-sm pointer-events-auto bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-violet-600/20 flex items-center justify-center">
                    <Bell size={14} className="text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground leading-none">Avisos do dia</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">— {todayStr()}</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/15 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Lista de alertas */}
              <div className="px-4 py-3 space-y-2.5 max-h-[55vh] overflow-y-auto">
                <AnimatePresence initial={false}>
                  {visible.map((alert, i) => {
                    const s = SEV_STYLE[alert.severity];
                    return (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8, height: 0, marginBottom: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={cn('flex gap-3 p-3 rounded-xl border bg-white/[0.025]', s.border)}
                      >
                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', s.iconBg, s.iconColor)}>
                          {alert.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground text-[13px] font-semibold leading-snug">{alert.title}</p>
                          <p className="text-muted-foreground text-[11px] mt-1 leading-relaxed">{alert.description}</p>
                        </div>
                        <button
                          onClick={() => setDismissed(p => new Set(p).add(alert.id))}
                          className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/10 transition-colors flex-shrink-0 mt-1"
                        >
                          <X size={10} />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="px-4 py-4 flex gap-2.5 border-t border-white/8">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/8 border border-white/10 text-muted-foreground text-sm font-medium hover:bg-white/12 hover:text-foreground transition-colors"
                >
                  Ver depois
                </button>
                <button
                  onClick={() => { setOpen(false); navigate('/reports'); }}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-violet-900/30"
                >
                  Ver previsões
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}