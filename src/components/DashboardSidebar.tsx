// src/components/DashboardSidebar.tsx
import { useMemo, useState, useEffect, useCallback } from 'react';
import { Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreditCard as CardType, FixedIncome, Expense, FixedExpense, VariableTransaction } from '@/lib/types';
import { computeInstallmentsForMonth } from '@/lib/store';
import { getBudgets, Budget } from '@/lib/budgets';
import { resolveCategoryInfo } from '@/lib/customCategories';
import BudgetSettingsDialog from '@/components/BudgetSettingsDialog';

interface Props {
  cards: CardType[];
  incomes: FixedIncome[];
  expenses: Expense[];
  fixedExpenses: FixedExpense[];
  varTxs?: VariableTransaction[];  // ✅ OPCIONAL
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

export default function DashboardSidebar({ cards, incomes, expenses, fixedExpenses, varTxs = [], month }: Props) {
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

  // ✅ CORREÇÃO: Incluir transações variáveis no cálculo
  const totalCard   = installments.reduce((s, i) => s + i.amount, 0);
  const totalFix    = fixedExpenses.reduce((s, f) => s + f.amount, 0);
  const totalVarExp = varTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalVarInc = varTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  
  const totalExp    = totalCard + totalFix + totalVarExp;  // ✅ Agora inclui gastos variáveis
  const totalInc    = incomes.reduce((s, i) => s + i.amount, 0) + totalVarInc;  // ✅ Agora inclui receitas variáveis
  const balance     = totalInc - totalExp;

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
    // ✅ ADICIONADO: Incluir gastos variáveis
    for (const v of varTxs.filter(t => t.type === 'expense')) {
      map[v.category] = (map[v.category] || 0) + v.amount;
    }
    return map;
  }, [installments, fixedExpenses, varTxs]);

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

    return list.sort((a, b) => a.sortDay - b.sortDay).slice(0, 5);
  }, [incomes, cards, installments, today]);

  // ── Orçamentos ─────────────────────────────────────────────────────────────
  const budgetUsage = useMemo(() => {
    return budgets.map(b => {
      const spent = spentByCategory[b.category] || 0;
      const pct   = b.amount > 0 ? Math.min((spent / b.amount) * 100, 100) : 0;
      const info  = resolveCategoryInfo(b.category);
      return { ...b, spent, pct, label: info.label, color: info.color };
    });
  }, [budgets, spentByCategory]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="bg-card rounded-3xl border border-border p-5 space-y-5">

        {/* ── Seção: Saldo ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Saldo do mês</span>
            <span className={cn(
              'text-lg font-bold',
              balance >= 0 ? 'text-emerald-400' : 'text-red-400',
            )}>
              {fmt(balance)}
            </span>
          </div>

          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${totalInc > 0 ? Math.min((totalExp / totalInc) * 100, 100) : 0}%`,
                background: balance >= 0 ? 'hsl(152 69% 45%)' : 'hsl(0 72% 51%)',
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{fmt(totalInc)} receitas</span>
            <span>{fmt(totalExp)} gastos</span>
          </div>
        </div>

        {/* ── Alertas ── */}
        {activeAlerts.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
              Avisos
            </span>
            {activeAlerts.map(alert => (
              <div key={alert.id} className={cn('rounded-xl p-3 border', alert.bg)}>
                <p className={cn('text-xs font-semibold mb-0.5', alert.color)}>
                  {alert.label}
                </p>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  {alert.sub}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ── Orçamentos ── */}
        {budgetUsage.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                Orçamentos
              </span>
              <button
                onClick={() => setBudgetOpen(true)}
                className="text-[10px] text-primary hover:underline flex items-center gap-1"
              >
                <Settings2 size={10} />
                Editar
              </button>
            </div>

            {budgetUsage.slice(0, 5).map(b => (
              <div key={b.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{b.label}</span>
                  <span className={cn(
                    'tabular-nums',
                    b.pct > 90 ? 'text-red-400' : b.pct > 70 ? 'text-amber-400' : 'text-muted-foreground',
                  )}>
                    {fmt(b.spent)} / {fmt(b.amount)}
                  </span>
                </div>
                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${b.pct}%`,
                      background: b.pct > 90 ? 'hsl(0 72% 51%)' : b.pct > 70 ? 'hsl(38 92% 50%)' : 'hsl(152 69% 45%)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Próximos eventos ── */}
        {events.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
              Próximos eventos
            </span>
            <div className="space-y-1.5">
              {events.map(ev => (
                <div key={ev.id} className="flex items-center justify-between text-xs py-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{ev.label}</p>
                    <p className="text-[10px] text-muted-foreground">{ev.date}</p>
                  </div>
                  <span className={cn(
                    'text-xs font-semibold px-2 py-0.5 rounded-md shrink-0',
                    ev.type === 'income'
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-red-400 bg-red-500/10',
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