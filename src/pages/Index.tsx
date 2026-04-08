import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingDown, ArrowUpRight } from 'lucide-react';
import MonthSelector from '@/components/MonthSelector';
import AddExpenseDialog from '@/components/AddExpenseDialog';
import CategoryIcon from '@/components/CategoryIcon';
import { getCurrentMonth, formatCurrency } from '@/lib/helpers';
import { getCards, getInstallmentsForMonth, getFixedExpenses, getCategoryTotalsForMonth } from '@/lib/store';
import { CATEGORY_CONFIG, ExpenseCategory } from '@/lib/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const PIE_COLORS = [
  'hsl(263 70% 58%)', 'hsl(220 70% 55%)', 'hsl(30 90% 55%)', 'hsl(152 69% 45%)',
  'hsl(0 72% 51%)', 'hsl(280 70% 58%)', 'hsl(320 70% 55%)', 'hsl(45 90% 50%)',
  'hsl(200 80% 50%)', 'hsl(210 70% 55%)',
];

export default function Dashboard() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  const cards = getCards();
  const installments = getInstallmentsForMonth(month);
  const fixedExpenses = getFixedExpenses();
  const categoryTotals = getCategoryTotalsForMonth(month);

  const totalCard = installments.reduce((s, i) => s + i.amount, 0);
  const totalFixed = fixedExpenses.reduce((s, f) => s + f.amount, 0);
  const totalMonth = totalCard + totalFixed;
  const totalLimit = cards.reduce((s, c) => s + c.limit, 0);
  const available = totalLimit - totalCard;

  const chartData = Object.entries(categoryTotals).map(([key, value]) => ({
    name: CATEGORY_CONFIG[key as ExpenseCategory]?.label || key,
    value: Math.round(value * 100) / 100,
  }));

  return (
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">FinanceFlow</h1>
          <p className="text-xs text-muted-foreground">Seu gestor inteligente</p>
        </div>
        <AddExpenseDialog cards={cards} onAdded={refresh} />
      </div>

      <MonthSelector month={month} onChange={setMonth} />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={16} className="text-destructive" />
            <span className="text-xs text-muted-foreground">Total gasto</span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(totalMonth)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="gradient-primary rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={16} />
            <span className="text-xs opacity-80">Disponível</span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(available)}</p>
        </motion.div>
      </div>

      {/* Pie Chart */}
      {chartData.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="bg-card rounded-2xl p-4 border border-border">
          <h2 className="text-sm font-semibold mb-3">Gastos por categoria</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ background: 'hsl(240 6% 10%)', border: '1px solid hsl(240 4% 18%)', borderRadius: '12px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {chartData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {d.name}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent transactions */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <h2 className="text-sm font-semibold mb-3">Lançamentos do mês</h2>
        {installments.length === 0 && fixedExpenses.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum gasto registrado</p>
        ) : (
          <div className="space-y-3">
            {installments.map((inst, i) => (
              <div key={`${inst.expenseId}-${i}`} className="flex items-center gap-3">
                <CategoryIcon category={inst.category} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inst.expenseName}</p>
                  <p className="text-xs text-muted-foreground">
                    {inst.totalInstallments > 1 ? `${inst.installmentNumber}/${inst.totalInstallments}` : 'À vista'}
                  </p>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(inst.amount)}</span>
              </div>
            ))}
            {fixedExpenses.map((f) => (
              <div key={f.id} className="flex items-center gap-3">
                <CategoryIcon category={f.category} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <p className="text-xs text-muted-foreground">Fixo</p>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(f.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
