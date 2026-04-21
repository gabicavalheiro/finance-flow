import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import MonthSelector from '@/components/MonthSelector';
import { getCurrentMonth, formatCurrency, addMonths } from '@/lib/helpers';
import {
  getCards, getExpenses, getFixedExpenses,
  computeInstallmentsForMonth, computeCategoryTotals,
} from '@/lib/store';
import { CreditCard, Expense, FixedExpense } from '@/lib/types';
import { resolveCategoryInfo } from '@/lib/customCategories';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

export default function ReportsPage() {
  const [month, setMonth]       = useState(getCurrentMonth());
  const [cards, setCards]       = useState<CreditCard[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fixed, setFixed]       = useState<FixedExpense[]>([]);
  const [loading, setLoading]   = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [c, e, f] = await Promise.all([getCards(), getExpenses(), getFixedExpenses()]);
    setCards(c); setExpenses(e); setFixed(f);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const installments   = computeInstallmentsForMonth(expenses, cards, month);
  const categoryTotals = computeCategoryTotals(installments, fixed);

  // Últimos 6 meses para o gráfico de barras
  const barData = Array.from({ length: 6 }, (_, i) => {
    const m     = addMonths(month, -(5 - i));
    const label = new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1]) - 1)
      .toLocaleDateString('pt-BR', { month: 'short' });
    const inst  = computeInstallmentsForMonth(expenses, cards, m);
    const total = inst.reduce((s, x) => s + x.amount, 0)
                + fixed.reduce((s, f) => s + f.amount, 0);
    return { name: label, total };
  });

  // ── FIX: usa resolveCategoryInfo para suportar categorias customizadas ──
  const categoryList = Object.entries(categoryTotals)
    .map(([key, value]) => {
      const info = resolveCategoryInfo(key);
      return { key, label: info.label, value, color: info.color };
    })
    .sort((a, b) => b.value - a.value);

  const total = categoryList.reduce((s, c) => s + c.value, 0);

  const cardTotals = cards.map(card => ({
    card,
    total: installments.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0),
  }));

  return (
    <div className="pb-24 md:pb-10 px-4 md:px-8 pt-6 md:pt-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Relatórios</h1>
      <MonthSelector month={month} onChange={setMonth} />

      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-10">Carregando...</p>
      ) : (
        <>
          {/* ── Layout desktop: 2 colunas ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Gráfico de barras — últimos 6 meses */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-card rounded-2xl p-4 border border-border md:col-span-2"
            >
              <h2 className="text-sm font-semibold mb-3">Evolução mensal</h2>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false} tickLine={false} width={55}
                      tickFormatter={v => `R$${v}`}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Bar dataKey="total" fill="hsl(263 70% 58%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Por categoria */}
            <div className="bg-card rounded-2xl p-4 border border-border">
              <h2 className="text-sm font-semibold mb-3">Por categoria</h2>
              {categoryList.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Sem dados para este mês</p>
              ) : (
                <div className="space-y-3">
                  {categoryList.map(cat => (
                    <div key={cat.key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{cat.label}</span>
                        <span className="font-semibold">
                          {formatCurrency(cat.value)}{' '}
                          <span className="text-muted-foreground font-normal">
                            ({total > 0 ? Math.round((cat.value / total) * 100) : 0}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${total > 0 ? (cat.value / total) * 100 : 0}%`,
                            background: `hsl(${cat.color})`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Por cartão */}
            {cardTotals.length > 0 && (
              <div className="bg-card rounded-2xl p-4 border border-border">
                <h2 className="text-sm font-semibold mb-3">Por cartão</h2>
                <div className="space-y-2">
                  {cardTotals.map(({ card, total: ct }) => (
                    <div key={card.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full"
                          style={{ background: card.customGradient ?? 'hsl(263 70% 58%)' }} />
                        <span className="text-sm">{card.name} •••• {card.lastDigits}</span>
                      </div>
                      <span className="text-sm font-semibold">{formatCurrency(ct)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}