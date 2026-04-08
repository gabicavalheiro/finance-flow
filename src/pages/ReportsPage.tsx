import { useState } from 'react';
import { motion } from 'framer-motion';
import MonthSelector from '@/components/MonthSelector';
import { getCurrentMonth, formatCurrency, addMonths } from '@/lib/helpers';
import { getCards, getTotalForMonth, getCategoryTotalsForMonth, getInstallmentsForMonth, getFixedExpenses } from '@/lib/store';
import { CATEGORY_CONFIG, ExpenseCategory } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

export default function ReportsPage() {
  const [month, setMonth] = useState(getCurrentMonth());

  const categoryTotals = getCategoryTotalsForMonth(month);
  const cards = getCards();
  const fixedExpenses = getFixedExpenses();

  // Last 6 months bar chart
  const barData = [];
  for (let i = 5; i >= 0; i--) {
    const m = addMonths(month, -i);
    const label = new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1]) - 1)
      .toLocaleDateString('pt-BR', { month: 'short' });
    barData.push({ name: label, total: getTotalForMonth(m) });
  }

  // Category breakdown sorted
  const categoryList = Object.entries(categoryTotals)
    .map(([key, value]) => ({
      key: key as ExpenseCategory,
      label: CATEGORY_CONFIG[key as ExpenseCategory]?.label || key,
      value,
      color: CATEGORY_CONFIG[key as ExpenseCategory]?.color || '240 5% 55%',
    }))
    .sort((a, b) => b.value - a.value);

  const total = categoryList.reduce((s, c) => s + c.value, 0);

  // Per card
  const installments = getInstallmentsForMonth(month);
  const cardTotals = cards.map(card => ({
    card,
    total: installments.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0),
  }));

  return (
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold">Relatórios</h1>
      <MonthSelector month={month} onChange={setMonth} />

      {/* Bar chart */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-2xl p-4 border border-border">
        <h2 className="text-sm font-semibold mb-3">Evolução mensal</h2>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 18%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(240 5% 55%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(240 5% 55%)' }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `R$${v}`} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ background: 'hsl(240 6% 10%)', border: '1px solid hsl(240 4% 18%)', borderRadius: '12px', fontSize: '12px' }}
              />
              <Bar dataKey="total" fill="hsl(263 70% 58%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Category breakdown */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <h2 className="text-sm font-semibold mb-3">Por categoria</h2>
        {categoryList.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>
        ) : (
          <div className="space-y-3">
            {categoryList.map(cat => (
              <div key={cat.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{cat.label}</span>
                  <span className="font-semibold">{formatCurrency(cat.value)} <span className="text-muted-foreground font-normal">({total > 0 ? Math.round((cat.value / total) * 100) : 0}%)</span></span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${total > 0 ? (cat.value / total) * 100 : 0}%`, background: `hsl(${cat.color})` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per card */}
      {cardTotals.length > 0 && (
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h2 className="text-sm font-semibold mb-3">Por cartão</h2>
          <div className="space-y-2">
            {cardTotals.map(({ card, total: ct }) => (
              <div key={card.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full gradient-primary" />
                  <span className="text-sm">{card.name} •••• {card.lastDigits}</span>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(ct)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
