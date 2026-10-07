import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import SpendingForecastPanel from '@/features/forecast/SpendingForecastPanel';
import { buildCommittedByMonth } from '@/features/reports/calculations';
import { ChartTooltip } from '@/features/reports/components/ChartTooltips';
import ForecastCard from '@/features/reports/components/ForecastCard';
import { C } from '@/features/reports/constants';
import { monthLabel } from '@/features/reports/format';
import { MonthForecast } from '@/features/reports/types';
import { formatCurrency } from '@/lib/helpers';
import { CreditCard, Expense } from '@/lib/types';

interface Props {
  forecasts: MonthForecast[];
  expenses: Expense[];
  cards: CreditCard[];
  current: string;
  totalFixedIncome: number;
  totalFixedExpense: number;
}

export default function ForecastTab({ forecasts, expenses, cards, current, totalFixedIncome, totalFixedExpense }: Props) {
  const committedByMonth = useMemo(
    () => buildCommittedByMonth({ expenses, cards, forecasts, totalFixedExpense }),
    [expenses, cards, forecasts, totalFixedExpense],
  );

  const futureForecasts = forecasts.filter(f => f.isFuture);
  const lightestMonth   = futureForecasts.reduce<MonthForecast | null>(
    (best, fc) => !best || fc.balance > best.balance ? fc : best, null);
  const heaviestMonth   = futureForecasts.reduce<MonthForecast | null>(
    (worst, fc) => !worst || fc.totalExpense > worst.totalExpense ? fc : worst, null);

  const barDataForecast = forecasts.map(fc => ({
    name: monthLabel(fc.month), gastos: fc.totalExpense, receitas: fc.totalIncome,
    isPast: fc.isPast, isCurrent: fc.isCurrent, isFuture: fc.isFuture,
  }));

  return (
    <motion.div
      key="previsao"
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="px-4 md:px-8 space-y-4"
    >
      {futureForecasts.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {lightestMonth && (
            <div className="bg-success/8 border border-success/25 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <CheckCircle2 size={13} className="text-success" />
                <p className="text-[10px] font-semibold text-success uppercase tracking-wide">Mês mais leve</p>
              </div>
              <p className="text-sm font-bold capitalize">{monthLabel(lightestMonth.month, false)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sobra <strong className="text-success">{formatCurrency(lightestMonth.balance)}</strong>
              </p>
            </div>
          )}
          {heaviestMonth && (
            <div className="bg-destructive/8 border border-destructive/25 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle size={13} className="text-destructive" />
                <p className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Mês mais pesado</p>
              </div>
              <p className="text-sm font-bold capitalize">{monthLabel(heaviestMonth.month, false)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <strong className="text-destructive">{formatCurrency(heaviestMonth.totalExpense)}</strong> em gastos
              </p>
            </div>
          )}
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
          Visão geral — passado e futuro
        </p>
        <p className="text-[10px] text-muted-foreground mb-3">
          Cores mais escuras = passado · mais vivas = futuro/atual
        </p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barDataForecast} barGap={3} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={60} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.15)' }} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="gastos" name="Gastos" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {barDataForecast.map((e, idx) => (
                  <Cell key={idx} fill={e.isCurrent ? C.redHot : e.isFuture ? C.redMid : C.redDim} />
                ))}
              </Bar>
              <Bar dataKey="receitas" name="Receitas" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {barDataForecast.map((e, idx) => (
                  <Cell key={idx} fill={e.isCurrent ? C.greenHot : e.isFuture ? C.greenMid : C.greenDim} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-5 mt-2">
          {[
            { color: C.redHot,   label: 'Gastos (atual)'   },
            { color: C.greenHot, label: 'Receitas (atual)' },
            { color: C.redDim,   label: 'Passado'          },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      <SpendingForecastPanel
        expenses={expenses}
        cards={cards}
        currentMonth={current}
        committedByMonth={committedByMonth}
        monthlyIncome={totalFixedIncome}
      />

      <div className="flex items-start gap-2 bg-primary/8 border border-primary/20 rounded-xl px-4 py-3">
        <Sparkles size={13} className="text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Os cartões abaixo usam só o que já é <strong className="text-foreground">conhecido</strong>: parcelas cadastradas e{' '}
          <strong className="text-foreground">ganhos/gastos fixos</strong>. O gasto variável esperado está na previsão com ML, acima.
        </p>
      </div>

      <div className="space-y-3">
        {forecasts.map((fc, i) => (
          <motion.div key={fc.month} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <ForecastCard fc={fc} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
