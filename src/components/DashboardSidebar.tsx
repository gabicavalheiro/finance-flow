// src/components/DashboardSidebar.tsx
import { useMemo, useState, useEffect, useCallback } from 'react';
import { Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreditCard as CardType, FixedIncome, Expense, FixedExpense } from '@/lib/types';
import { computeInstallmentsForMonth } from '@/lib/store';
import { getBudgets, Budget } from '@/lib/budgets';
import { resolveCategoryInfo } from '@/lib/customCategories';
import BudgetSettingsDialog from '@/components/BudgetSettingsDialog';

interface Props {
  cards: CardType[];
  incomes: FixedIncome[];
  expenses: Expense[];
  fixedExpenses: FixedExpense[];
  month: string;
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

function dayDateLabel(day: number, todayDay: number): string {
  if (day === todayDay) return 'Hoje';
  const now = new Date();
  let d = new Date(now.getFullYear(), now.getMonth(), day);
  if (d < now) d = new Date(now.getFullYear(), now.getMonth() + 1, day);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

export default function DashboardSidebar({ cards, incomes, expenses, fixedExpenses, month }: Props) {
  const today = new Date().getDate();

  const [budgets, setBudgets]         = useState<Budget[]>([]);
  const [budgetOpen, setBudgetOpen]   = useState(false);

  const loadBudgets = useCallback(async () => {
    const data = await getBudgets();
    setBudgets(data);
  }, []);

  useEffect(() => { loadBudgets(); }, [loadBudgets]);

  // ── Parcelas do mês ────────────────────────────────────────────────────────
  const installments = useMemo(
    () => computeInstallmentsForMonth(expenses, cards, month),
    [expenses, cards, month],
  );

  // Totais
  const totalCard = installments.reduce((s, i) => s + i.amount, 0);
  const totalFix  = fixedExpenses.reduce((s, f) => s + f.amount, 0);
  const totalExp  = totalCard + totalFix;
  const totalInc  = incomes.reduce((s, i) => s + i.amount, 0);
  const balance   = totalInc - totalExp;

  // ── Alertas ativos ─────────────────────────────────────────────────────────
  const activeAlerts = useMemo(() => {
    const list: { id: string; label: string; sub: string; color: string; bg: string }[] = [];

    const nextIncEntry = incomes
      .filter(i => i.receiveDay && i.receiveDay <= 100 && i.receiveDay > today)
      .sort((a, b) => (a.receiveDay ?? 99) - (b.receiveDay ?? 99))[0];

    const receivedSoFar = incomes
      .filter(i => i.receiveDay && i.receiveDay <= today)
      .reduce((s, i) => s + i.amount, 0);

    for (const card of cards) {
      const amt = installments.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
      if (amt === 0) continue;

      if (nextIncEntry?.receiveDay && card.dueDay < nextIncEntry.receiveDay && receivedSoFar < amt) {
        list.push({
          id: `gap-${card.id}`,
          label: 'Déficit previsto',
          sub: `${fmt(amt - receivedSoFar)} a menos para pagar ${card.name} em ${dayDateLabel(card.dueDay, today)}`,
          color: 'text-red-300',
          bg: 'bg-red-500/12 border-red-500/20',
        });
      }

      const du = daysUntil(card.dueDay);
      if (du >= 0 && du <= 7 && !(nextIncEntry?.receiveDay && card.dueDay < nextIncEntry.receiveDay)) {
        list.push({
          id: `fatura-${card.id}`,
          label: `Fatura ${card.name}`,
          sub: `${fmt(amt)} vencem em ${dayDateLabel(card.dueDay, today)}`,
          color: 'text-amber-300',
          bg: 'bg-amber-500/12 border-amber-500/20',
        });
      }
    }

    if (balance > 0 && list.length === 0) {
      list.push({
        id: 'ok',
        label: 'Mês positivo',
        sub: `Saldo: +${fmt(balance)} após todos os gastos`,
        color: 'text-emerald-300',
        bg: 'bg-emerald-500/12 border-emerald-500/20',
      });
    }

    return list;
  }, [cards, incomes, installments, balance, today]);

  // ── Gastos por categoria ───────────────────────────────────────────────────
  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of installments) map[i.category] = (map[i.category] || 0) + i.amount;
    for (const f of fixedExpenses) map[f.category] = (map[f.category] || 0) + f.amount;
    return map;
  }, [installments, fixedExpenses]);

  // ── Próximos eventos ordenados ─────────────────────────────────────────────
  const events = useMemo(() => {
    const list: { id: string; label: string; date: string; sortDay: number; amount: number; type: 'income' | 'expense' }[] = [];

    for (const inc of incomes) {
      if (!inc.receiveDay || inc.receiveDay > 100) continue;
      list.push({
        id: `inc-${inc.id}`,
        label: `Receb. ${inc.name}`,
        date: dayDateLabel(inc.receiveDay, today),
        sortDay: inc.receiveDay === today ? -1 : inc.receiveDay,
        amount: inc.amount,
        type: 'income',
      });
    }

    for (const card of cards) {
      const amt = installments.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
      if (amt === 0) continue;
      list.push({
        id: `card-${card.id}`,
        label: `${card.name} vence`,
        date: dayDateLabel(card.dueDay, today),
        sortDay: card.dueDay === today ? -1 : card.dueDay,
        amount: amt,
        type: 'expense',
      });
    }

    return list.sort((a, b) => a.sortDay - b.sortDay).slice(0, 6);
  }, [incomes, cards, installments, today]);

  return (
    <>
      <div className="space-y-4">

        {/* ── Alertas Ativos ───────────────────────────────────────────────── */}
        {activeAlerts.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-3">
              Alertas Ativos
            </p>
            <div className="space-y-2">
              {activeAlerts.map(alert => (
                <div key={alert.id} className={cn('rounded-xl border px-3 py-2.5', alert.bg)}>
                  <p className={cn('text-[12px] font-semibold leading-snug', alert.color)}>{alert.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{alert.sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Orçamento Mensal ─────────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">
              Orçamento Mensal
            </p>
            <button
              onClick={() => setBudgetOpen(true)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded-md hover:bg-primary/10"
            >
              <Settings2 size={11} />
              Configurar
            </button>
          </div>

          {budgets.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground mb-2">Nenhum orçamento definido</p>
              <button
                onClick={() => setBudgetOpen(true)}
                className="text-xs text-primary hover:underline"
              >
                + Definir orçamentos
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {budgets.map(b => {
                const info  = resolveCategoryInfo(b.category);
                const spent = spentByCategory[b.category] ?? 0;
                const pct   = Math.min(100, (spent / b.amount) * 100);
                const over  = spent > b.amount;
                return (
                  <div key={b.category}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-foreground/80 font-medium">{info.label}</span>
                      <span className={cn('text-[11px] font-medium tabular-nums', over ? 'text-red-400' : 'text-muted-foreground')}>
                        {fmt(spent)} / {fmt(b.amount)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: over
                            ? 'hsl(0 72% 51%)'
                            : pct > 80
                              ? 'hsl(38 92% 50%)'
                              : `hsl(${info.color})`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Próximos Eventos ─────────────────────────────────────────────── */}
        {events.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-3">
              Próximos Eventos
            </p>
            <div>
              {events.map((ev, i) => (
                <div
                  key={ev.id}
                  className={cn('flex items-center justify-between py-2.5', i < events.length - 1 && 'border-b border-border/50')}
                >
                  <div>
                    <p className="text-[12px] font-medium text-foreground/90 leading-snug">{ev.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{ev.date}</p>
                  </div>
                  <span className={cn(
                    'text-[12px] font-bold tabular-nums px-2 py-1 rounded-lg',
                    ev.type === 'income' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10',
                  )}>
                    {ev.type === 'income' ? '+' : '-'}{fmt(ev.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Dialog de configuração de orçamento */}
      <BudgetSettingsDialog
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        onSaved={loadBudgets}
      />
    </>
  );
}