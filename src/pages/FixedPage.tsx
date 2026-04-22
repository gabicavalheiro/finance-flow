import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, ArrowDownCircle, ArrowUpCircle, CalendarDays, Pencil } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import AddFixedExpenseDialog from '@/components/AddFixedExpenseDialog';
import AddIncomeDialog from '@/components/AddIncomeDialog';
import EditFixedExpenseDialog from '@/components/EditFixedExpenseDialog';
import EditFixedIncomeDialog from '@/components/EditFixedIncomeDialog';
import CategoryIcon from '@/components/CategoryIcon';
import IncomeIcon from '@/components/IncomeIcon';
import MonthSelector from '@/components/MonthSelector';
import ShowMoreButton from '@/components/ShowMoreButton';
import { useCollapse } from '@/hooks/useCollapse';
import {
  getFixedExpenses, updateFixedExpense, deleteFixedExpense,
  getIncomes, updateIncome, deleteIncome,
} from '@/lib/store';
import { formatCurrency, getCurrentMonth } from '@/lib/helpers';
import { INCOME_CATEGORY_CONFIG, FixedExpense, FixedIncome } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatReceiveDay } from '@/components/DayPicker';

export default function FixedPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [fixedState, setFixedState] = useState<FixedExpense[]>([]);
  const [incomeState, setIncomeState] = useState<FixedIncome[]>([]);
  const [loading, setLoading] = useState(true);

  // estados de edição
  const [editingFixed, setEditingFixed] = useState<FixedExpense | null>(null);
  const [editingIncome, setEditingIncome] = useState<FixedIncome | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [f, i] = await Promise.all([getFixedExpenses(), getIncomes()]);
    setFixedState(f); setIncomeState(i);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const totalIncome = incomeState.reduce((s, i) => s + i.amount, 0);
  const totalExpense = fixedState.reduce((s, f) => s + f.amount, 0);
  const balance = totalIncome - totalExpense;
  const balancePct = totalIncome > 0 ? Math.min((totalExpense / totalIncome) * 100, 100) : 0;

  const paidCount = fixedState.filter(f => f.paidMonths.includes(month)).length;
  const receivedCount = incomeState.filter(i => i.receivedMonths.includes(month)).length;

  // ── Collapses ──
  const collapseIncome = useCollapse(incomeState.length);
  const collapseFixed = useCollapse(fixedState.length);

  /* ── Expense handlers ── */
  const togglePaid = async (id: string) => {
    const item = fixedState.find(f => f.id === id);
    if (!item) return;
    const paid = item.paidMonths.includes(month);
    const newPaidMonths = paid
      ? item.paidMonths.filter(m => m !== month)
      : [...item.paidMonths, month];
    setFixedState(prev => prev.map(f => f.id === id ? { ...f, paidMonths: newPaidMonths } : f));
    try {
      await updateFixedExpense(id, { paidMonths: newPaidMonths });
    } catch {
      toast.error('Erro ao atualizar'); loadAll();
    }
  };

  const handleDeleteFixed = async (id: string) => {
    setFixedState(prev => prev.filter(f => f.id !== id));
    try {
      await deleteFixedExpense(id);
      toast.success('Removido');
    } catch {
      toast.error('Erro ao remover'); loadAll();
    }
  };

  /* ── Income handlers ── */
  const toggleReceived = async (id: string) => {
    const item = incomeState.find(i => i.id === id);
    if (!item) return;
    const got = item.receivedMonths.includes(month);
    const newReceivedMonths = got
      ? item.receivedMonths.filter(m => m !== month)
      : [...item.receivedMonths, month];
    setIncomeState(prev => prev.map(i => i.id === id ? { ...i, receivedMonths: newReceivedMonths } : i));
    try {
      await updateIncome(id, { receivedMonths: newReceivedMonths });
    } catch {
      toast.error('Erro ao atualizar'); loadAll();
    }
  };

  const handleDeleteIncome = async (id: string) => {
    setIncomeState(prev => prev.filter(i => i.id !== id));
    try {
      await deleteIncome(id);
      toast.success('Removido');
    } catch {
      toast.error('Erro ao remover'); loadAll();
    }
  };

  return (
    <div className="pb-24 md:pb-10 px-4 md:px-8 pt-6 md:pt-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Ganhos & Gastos Fixos</h1>

      <MonthSelector month={month} onChange={setMonth} />

      {/* Cartão de saldo */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl p-5 border border-border space-y-3"
      >
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Saldo mensal fixo</p>

        <div className="flex justify-between items-end">
          <div>
            <p className="text-2xl font-bold" style={{ color: balance >= 0 ? 'hsl(152 69% 45%)' : 'hsl(0 72% 51%)' }}>
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

        <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${balancePct}%`,
              background: balancePct > 90 ? 'hsl(0 72% 51%)' : balancePct > 70 ? 'hsl(38 92% 50%)' : 'hsl(152 69% 45%)',
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="flex items-center gap-2">
            <ArrowUpCircle size={16} className="text-success shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Ganhos</p>
              <p className="text-sm font-semibold" style={{ color: 'hsl(152 69% 45%)' }}>{formatCurrency(totalIncome)}</p>
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

      {/* Grid lado a lado no desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── Ganhos Fixos ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Ganhos Fixos</h2>
              <p className="text-[10px] text-muted-foreground">{receivedCount}/{incomeState.length} recebidos</p>
            </div>
            <AddIncomeDialog onAdded={loadAll} />
          </div>

          {loading && <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>}

          {!loading && incomeState.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum ganho cadastrado</p>
          )}

          {[...incomeState]
            .sort((a, b) => (a.receiveDay ?? 1) - (b.receiveDay ?? 1))
            .slice(0, collapseIncome.visible)
            .map((income, idx) => {
              const isReceived = income.receivedMonths.includes(month);
              return (
                <motion.div
                  key={income.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`bg-card rounded-xl p-3 border border-border flex items-center gap-3 transition-opacity group ${isReceived ? 'opacity-60' : ''}`}
                >
                  <Checkbox
                    checked={isReceived}
                    onCheckedChange={() => toggleReceived(income.id)}
                    className="border-muted-foreground data-[state=checked]:bg-success data-[state=checked]:border-success shrink-0"
                  />
                  <IncomeIcon category={income.category} size={16} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isReceived ? 'line-through text-muted-foreground' : ''}`}>
                      {income.name}
                    </p>
                    {income.receiveDay && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarDays size={10} /> {formatReceiveDay(income.receiveDay)}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'hsl(152 69% 45%)' }}>
                    +{formatCurrency(income.amount)}
                  </span>
                  {/* Botões editar + deletar */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                      onClick={() => setEditingIncome(income)}
                    >
                      <Pencil size={12} />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDeleteIncome(income.id)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          <ShowMoreButton expanded={collapseIncome.expanded} hidden={collapseIncome.hidden} onToggle={collapseIncome.toggle} />
        </section>

        {/* ── Gastos Fixos ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Gastos Fixos</h2>
              <p className="text-[10px] text-muted-foreground">{paidCount}/{fixedState.length} pagos</p>
            </div>
            <AddFixedExpenseDialog onAdded={loadAll} />
          </div>

          {!loading && fixedState.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum gasto fixo cadastrado</p>
          )}

          {fixedState.slice(0, collapseFixed.visible).map((fixed, idx) => {
            const isPaid = fixed.paidMonths.includes(month);
            return (
              <motion.div
                key={fixed.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`bg-card rounded-xl p-3 border border-border flex items-center gap-3 transition-opacity group ${isPaid ? 'opacity-60' : ''}`}
              >
                <Checkbox
                  checked={isPaid}
                  onCheckedChange={() => togglePaid(fixed.id)}
                  className="border-muted-foreground data-[state=checked]:bg-destructive data-[state=checked]:border-destructive shrink-0"
                />
                <CategoryIcon category={fixed.category} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isPaid ? 'line-through text-muted-foreground' : ''}`}>
                    {fixed.name}
                  </p>
                  <p className="text-xs text-muted-foreground">Fixo mensal</p>
                </div>
                <span className="text-sm font-semibold text-destructive">{formatCurrency(fixed.amount)}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                    onClick={() => setEditingFixed(fixed)}
                  >
                    <Pencil size={12} />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDeleteFixed(fixed.id)}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </motion.div>
            );
          })}
          <ShowMoreButton expanded={collapseFixed.expanded} hidden={collapseFixed.hidden} onToggle={collapseFixed.toggle} />
        </section>
      </div>

      {/* Dialogs de edição */}
      {editingFixed && (
        <EditFixedExpenseDialog
          expense={editingFixed}
          open={!!editingFixed}
          onClose={() => setEditingFixed(null)}
          onSaved={() => { setEditingFixed(null); loadAll(); }}
        />
      )}

      {editingIncome && (
        <EditFixedIncomeDialog
          income={editingIncome}
          open={!!editingIncome}
          onClose={() => setEditingIncome(null)}
          onSaved={() => { setEditingIncome(null); loadAll(); }}
        />
      )}
    </div>
  );
}