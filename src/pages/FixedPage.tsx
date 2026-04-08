import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import AddFixedExpenseDialog from '@/components/AddFixedExpenseDialog';
import CategoryIcon from '@/components/CategoryIcon';
import MonthSelector from '@/components/MonthSelector';
import { getFixedExpenses, saveFixedExpenses } from '@/lib/store';
import { formatCurrency, getCurrentMonth } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function FixedPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  const fixedExpenses = getFixedExpenses();
  const totalFixed = fixedExpenses.reduce((s, f) => s + f.amount, 0);
  const paidCount = fixedExpenses.filter(f => f.paidMonths.includes(month)).length;

  const togglePaid = (id: string) => {
    const updated = fixedExpenses.map(f => {
      if (f.id !== id) return f;
      const paid = f.paidMonths.includes(month);
      return {
        ...f,
        paidMonths: paid ? f.paidMonths.filter(m => m !== month) : [...f.paidMonths, month],
      };
    });
    saveFixedExpenses(updated);
    refresh();
  };

  const deleteFixed = (id: string) => {
    saveFixedExpenses(fixedExpenses.filter(f => f.id !== id));
    toast.success('Removido');
    refresh();
  };

  return (
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Gastos Fixos</h1>
        <AddFixedExpenseDialog onAdded={refresh} />
      </div>

      <MonthSelector month={month} onChange={setMonth} />

      {/* Summary */}
      <div className="bg-card rounded-2xl p-4 border border-border flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Total mensal</p>
          <p className="text-lg font-bold">{formatCurrency(totalFixed)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Check size={16} className="text-success" />
          <span className="text-sm font-medium">{paidCount}/{fixedExpenses.length} pagos</span>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {fixedExpenses.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-10">Nenhum gasto fixo cadastrado</p>
        )}
        {fixedExpenses.map((f, idx) => {
          const isPaid = f.paidMonths.includes(month);
          return (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className={`bg-card rounded-xl p-3 border border-border flex items-center gap-3 transition-opacity ${isPaid ? 'opacity-60' : ''}`}
            >
              <Checkbox checked={isPaid} onCheckedChange={() => togglePaid(f.id)} className="border-muted-foreground data-[state=checked]:bg-success data-[state=checked]:border-success" />
              <CategoryIcon category={f.category} size={16} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isPaid ? 'line-through' : ''}`}>{f.name}</p>
              </div>
              <span className="text-sm font-semibold">{formatCurrency(f.amount)}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteFixed(f.id)}>
                <Trash2 size={13} className="text-muted-foreground" />
              </Button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
