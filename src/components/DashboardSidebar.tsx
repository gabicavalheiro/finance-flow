// src/components/DashboardSidebar.tsx
import { useMemo, useState, useEffect, useCallback } from 'react';
import { Settings2, TrendingUp, TrendingDown, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreditCard as CardType, FixedIncome, Expense, FixedExpense, VariableTransaction } from '@/lib/types';
import { computeInstallmentsForMonth, CardInvoice } from '@/lib/store';
import { getBudgets, Budget } from '@/lib/budgets';
import { resolveCategoryInfo } from '@/lib/customCategories';
import BudgetSettingsDialog from '@/components/BudgetSettingsDialog';
import { Subscription, monthlyAmount, subscriptionsAsInstallments } from '@/lib/subscriptions';

interface Props {
  cards:          CardType[];
  incomes:        FixedIncome[];
  expenses:       Expense[];
  fixedExpenses:  FixedExpense[];
  subscriptions?: Subscription[];
  varTxs?:        VariableTransaction[];
  invoices?:      CardInvoice[];
  month:          string;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dayDateLabel(day: number, todayDay: number): string {
  if (day === todayDay) return 'Hoje';
  const now = new Date();
  let d = new Date(now.getFullYear(), now.getMonth(), day);
  if (d < now) d = new Date(now.getFullYear(), now.getMonth() + 1, day);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

export default function DashboardSidebar({
  cards, incomes, expenses, fixedExpenses,
  subscriptions = [], varTxs = [], invoices = [], month,
}: Props) {
  const today = new Date().getDate();
  const [budgets, setBudgets]       = useState<Budget[]>([]);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const loadBudgets = useCallback(async () => { setBudgets(await getBudgets()); }, []);
  useEffect(() => { loadBudgets(); }, [loadBudgets]);

  const installments    = useMemo(() => computeInstallmentsForMonth(expenses, cards, month), [expenses, cards, month]);
  const subInstallments = useMemo(() => subscriptionsAsInstallments(subscriptions, month), [subscriptions, month]);
  const allInst         = useMemo(() => [...installments, ...subInstallments], [installments, subInstallments]);
  const invoiceMap      = useMemo(() => new Map(invoices.map(i => [i.cardId, i])), [invoices]);

  const totalCard = useMemo(() =>
    cards.reduce((sum, card) => {
      const c = invoiceMap.get(card.id);
      if (c && c.actualAmount > 0) return sum + c.actualAmount;
      return sum + allInst.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
    }, 0), [cards, invoiceMap, allInst]);

  const totalFix   = fixedExpenses.reduce((s, f) => s + f.amount, 0);
  const totalSubsN = useMemo(() => subscriptions.filter(s => s.active && !s.cardId).reduce((s, sub) => s + monthlyAmount(sub), 0), [subscriptions]);
  const totalVarE  = varTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalVarI  = varTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExp   = totalCard + totalFix + totalSubsN + totalVarE;
  const totalInc   = incomes.reduce((s, i) => s + i.amount, 0) + totalVarI;
  const balance    = totalInc - totalExp;
  const totalSubs  = useMemo(() => subscriptions.filter(s => s.active).reduce((s, sub) => s + monthlyAmount(sub), 0), [subscriptions]);
  const ratio      = totalInc > 0 ? Math.min(100, Math.round((totalExp / totalInc) * 100)) : 0;

  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of allInst) map[i.category] = (map[i.category] || 0) + i.amount;
    for (const f of fixedExpenses) map[f.category] = (map[f.category] || 0) + f.amount;
    for (const v of varTxs.filter(t => t.type === 'expense')) map[v.category] = (map[v.category] || 0) + v.amount;
    for (const s of subscriptions.filter(s => s.active && !s.cardId)) map[s.category] = (map[s.category] || 0) + monthlyAmount(s);
    return map;
  }, [allInst, fixedExpenses, varTxs, subscriptions]);

  const budgetUsage = useMemo(() =>
    budgets.map(b => {
      const spent = spentByCategory[b.category] || 0;
      const pct   = b.amount > 0 ? Math.min((spent / b.amount) * 100, 100) : 0;
      const info  = resolveCategoryInfo(b.category);
      return { ...b, spent, pct, label: info.label, color: info.color };
    }), [budgets, spentByCategory]);

  const events = useMemo(() => {
    const list: { id: string; label: string; date: string; sortDay: number; amount: number; type: 'income' | 'expense' }[] = [];
    for (const inc of incomes) {
      if (!inc.receiveDay || inc.receiveDay > 100) continue;
      list.push({ id: `inc-${inc.id}`, label: inc.name, date: dayDateLabel(inc.receiveDay, today), sortDay: inc.receiveDay === today ? -1 : inc.receiveDay, amount: inc.amount, type: 'income' });
    }
    for (const card of cards) {
      const amt = allInst.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
      if (amt === 0) continue;
      list.push({ id: `card-${card.id}`, label: card.name, date: dayDateLabel(card.dueDay, today), sortDay: card.dueDay === today ? -1 : card.dueDay, amount: amt, type: 'expense' });
    }
    return list.sort((a, b) => a.sortDay - b.sortDay).slice(0, 6);
  }, [incomes, cards, allInst, today]);

  const isPositive = balance >= 0;

  return (
    <>
      <div className="space-y-3">

        {/* ── BALANCE CARD ── */}
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: isPositive
              ? 'linear-gradient(135deg, hsl(152 55% 20%) 0%, hsl(165 50% 15%) 100%)'
              : 'linear-gradient(135deg, hsl(0 55% 22%) 0%, hsl(15 50% 16%) 100%)',
            border: `1px solid ${isPositive ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Saldo do mês</p>
              <span className={cn(
                'flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full',
                isPositive ? 'bg-emerald-400/20 text-emerald-300' : 'bg-red-400/20 text-red-300',
              )}>
                {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {ratio}%
              </span>
            </div>
            <p className={cn('text-2xl font-bold tabular-nums', isPositive ? 'text-emerald-300' : 'text-red-300')}>
              {fmt(balance)}
            </p>
            {/* Progress bar */}
            <div className="mt-3 h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${ratio}%`,
                  background: ratio > 90 ? 'hsl(0 80% 65%)' : ratio > 70 ? 'hsl(38 95% 62%)' : 'hsl(152 70% 55%)',
                }} />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-white/35">
              <span>{fmt(totalInc)} receitas</span>
              <span>{fmt(totalExp)} gastos</span>
            </div>
          </div>
          {totalSubs > 0 && (
            <div className="px-4 py-2.5 flex items-center justify-between"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-[10px] text-white/40">Assinaturas ({subscriptions.filter(s => s.active).length}x)</span>
              <span className="text-[10px] font-semibold text-red-400">{fmt(totalSubs)}</span>
            </div>
          )}
        </div>

        {/* ── ORÇAMENTOS ── */}
        {budgetUsage.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">Orçamentos</p>
              <button onClick={() => setBudgetOpen(true)}
                className="flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary transition-colors">
                <Settings2 size={10} /> Editar
              </button>
            </div>
            <div className="space-y-2.5">
              {budgetUsage.slice(0, 5).map(b => (
                <div key={b.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground/80 font-medium">{b.label}</span>
                    <span className="text-[10px] tabular-nums"
                      style={{ color: b.pct > 90 ? 'hsl(0 72% 55%)' : b.pct > 70 ? 'hsl(38 92% 50%)' : 'hsl(var(--muted-foreground))' }}>
                      {fmt(b.spent)}<span className="text-muted-foreground/40"> / {fmt(b.amount)}</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${b.pct}%`,
                        background: b.pct > 90 ? 'hsl(0 72% 55%)' : b.pct > 70 ? 'hsl(38 92% 50%)' : `hsl(${b.color})`,
                      }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PRÓXIMOS EVENTOS ── */}
        {events.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">Próximos eventos</p>
              <Calendar size={12} className="text-muted-foreground/40" />
            </div>
            {events.map(ev => (
              <div key={ev.id}
                className="flex items-center gap-3 px-1 py-2 rounded-xl transition-colors hover:bg-secondary/50">
                {/* Color dot */}
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: ev.type === 'income' ? 'hsl(152 69% 45% / 0.15)' : 'hsl(0 72% 51% / 0.12)',
                  }}>
                  {ev.type === 'income'
                    ? <TrendingUp size={13} className="text-emerald-500" />
                    : <TrendingDown size={13} className="text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground/80 truncate">{ev.label}</p>
                  <p className="text-[10px] text-muted-foreground/50">{ev.date}</p>
                </div>
                <span className={cn(
                  'text-[11px] font-bold px-2 py-0.5 rounded-lg tabular-nums shrink-0',
                  ev.type === 'income'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-red-500/10 text-red-500',
                )}>
                  {ev.type === 'income' ? '+' : '-'}{fmt(ev.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <BudgetSettingsDialog open={budgetOpen} onClose={() => setBudgetOpen(false)} onSaved={loadBudgets} />
    </>
  );
}