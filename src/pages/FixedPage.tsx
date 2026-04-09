import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check, Trash2, ArrowDownCircle, ArrowUpCircle, CalendarDays } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import AddFixedExpenseDialog from '@/components/AddFixedExpenseDialog';
import AddIncomeDialog from '@/components/AddIncomeDialog';
import CategoryIcon from '@/components/CategoryIcon';
import IncomeIcon from '@/components/IncomeIcon';
import MonthSelector from '@/components/MonthSelector';
import {
  getFixedExpenses, saveFixedExpenses,
  getIncomes, saveIncomes,
} from '@/lib/store';
import { formatCurrency, getCurrentMonth } from '@/lib/helpers';
import { INCOME_CATEGORY_CONFIG } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function FixedPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [fixedState, setFixedState] = useState(getFixedExpenses);
  const [incomeState, setIncomeState] = useState(getIncomes);

  const refresh = useCallback(() => {
    setFixedState(getFixedExpenses());
    setIncomeState(getIncomes());
  }, []);

  const totalIncome  = incomeState.reduce((s, i) => s + i.amount, 0);
  const totalExpense = fixedState.reduce((s, f) => s + f.amount, 0);
  const balance      = totalIncome - totalExpense;
  const balancePct   = totalIncome > 0 ? Math.min((totalExpense / totalIncome) * 100, 100) : 0;

  const paidCount     = fixedState.filter(f => f.paidMonths.includes(month)).length;
  const receivedCount = incomeState.filter(i => i.receivedMonths.includes(month)).length;

  /* ── expense handlers ── */
  const togglePaid = (id: string) => {
    const updated = fixedState.map(f => {
      if (f.id !== id) return f;
      const paid = f.paidMonths.includes(month);
      return { ...f, paidMonths: paid ? f.paidMonths.filter(m => m !== month) : [...f.paidMonths, month] };
    });
    saveFixedExpenses(updated);
    setFixedState(updated);
  };

  const deleteFixed = (id: string) => {
    const updated = fixedState.filter(f => f.id !== id);
    saveFixedExpenses(updated);
    setFixedState(updated);
    toast.success('Removido');
  };

  /* ── income handlers ── */
  const toggleReceived = (id: string) => {
    const updated = incomeState.map(i => {
      if (i.id !== id) return i;
      const got = i.receivedMonths.includes(month);
      return { ...i, receivedMonths: got ? i.receivedMonths.filter(m => m !== month) : [...i.receivedMonths, month] };
    });
    saveIncomes(updated);
    setIncomeState(updated);
  };

  const deleteIncome = (id: string) => {
    const updated = incomeState.filter(i => i.id !== id);
    saveIncomes(updated);
    setIncomeState(updated);
    toast.success('Removido');
  };

  return (
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold">Ganhos & Gastos Fixos</h1>

      <MonthSelector month={month} onChange={setMonth} />

      {/* ── Balance card ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl p-5 border border-border space-y-3"
      >
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Saldo mensal fixo</p>

        <div className="flex justify-between items-end">
          <div>
            <p
              className="text-2xl font-bold"
              style={{ color: balance >= 0 ? 'hsl(152 69% 45%)' : 'hsl(0 72% 51%)' }}
            >
              {formatCurrency(balance)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {balance >= 0 ? 'Sobra após gastos fixos' : 'Gastos superam ganhos'}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>{Math.round(balancePct)}% comprometido</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${balancePct}%`,
              background: balancePct > 90
                ? 'hsl(0 72% 51%)'
                : balancePct > 70
                  ? 'hsl(38 92% 50%)'
                  : 'hsl(152 69% 45%)',
            }}
          />
        </div>

        {/* Income / Expense row */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="flex items-center gap-2">
            <ArrowUpCircle size={16} className="text-success shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Ganhos</p>
              <p className="text-sm font-semibold text-success">{formatCurrency(totalIncome)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ArrowDownCircle size={16} className="text-destructive shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Gastos fixos</p>
              <p className="text-sm font-semibold text-destructive">{formatCurrency(totalExpense)}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Incomes section ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Ganhos Fixos</h2>
            <p className="text-[10px] text-muted-foreground">{receivedCount}/{incomeState.length} recebidos</p>
          </div>
          <AddIncomeDialog onAdded={refresh} />
        </div>

        {incomeState.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum ganho cadastrado</p>
        )}

        {/* Sort by receiveDay */}
        {[...incomeState]
          .sort((a, b) => (a.receiveDay ?? 1) - (b.receiveDay ?? 1))
          .map((income, idx) => {
            const isReceived = income.receivedMonths.includes(month);
            const cfg = INCOME_CATEGORY_CONFIG[income.category];
            return (
              <motion.div
                key={income.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`bg-card rounded-xl p-3 border border-border flex items-center gap-3 transition-opacity ${isReceived ? 'opacity-60' : ''}`}
              >
                <Checkbox
                  checked={isReceived}
                  onCheckedChange={() => toggleReceived(income.id)}
                  className="border-muted-foreground data-[state=checked]:bg-success data-[state=checked]:border-success"
                />
                <IncomeIcon category={income.category} size={16} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isReceived ? 'line-through' : ''}`}>
                    {income.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{cfg.label}</span>
                    {income.receiveDay && (
                      <>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <CalendarDays size={10} className="text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          Todo dia {income.receiveDay}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-sm font-semibold text-success">{formatCurrency(income.amount)}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteIncome(income.id)}>
                  <Trash2 size={13} className="text-muted-foreground" />
                </Button>
              </motion.div>
            );
          })}
      </section>

      {/* ── Fixed expenses section ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Gastos Fixos</h2>
            <p className="text-[10px] text-muted-foreground">{paidCount}/{fixedState.length} pagos</p>
          </div>
          <AddFixedExpenseDialog onAdded={refresh} />
        </div>

        {fixedState.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum gasto fixo cadastrado</p>
        )}

        {fixedState.map((f, idx) => {
          const isPaid = f.paidMonths.includes(month);
          return (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className={`bg-card rounded-xl p-3 border border-border flex items-center gap-3 transition-opacity ${isPaid ? 'opacity-60' : ''}`}
            >
              <Checkbox
                checked={isPaid}
                onCheckedChange={() => togglePaid(f.id)}
                className="border-muted-foreground data-[state=checked]:bg-success data-[state=checked]:border-success"
              />
              <CategoryIcon category={f.category} size={16} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isPaid ? 'line-through' : ''}`}>{f.name}</p>
              </div>
              <span className="text-sm font-semibold text-destructive">{formatCurrency(f.amount)}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteFixed(f.id)}>
                <Trash2 size={13} className="text-muted-foreground" />
              </Button>
            </motion.div>
          );
        })}
      </section>
    </div>
  );
}