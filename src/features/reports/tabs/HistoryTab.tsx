import { motion } from 'framer-motion';
import { Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import MonthSelector from '@/components/MonthSelector';
import { ChartTooltip } from '@/features/reports/components/ChartTooltips';
import { C } from '@/features/reports/constants';
import { formatCurrency } from '@/lib/helpers';

interface Props {
  month: string;
  setMonth: (m: string) => void;
  barDataHist: { name: string; gastos: number; receitas: number }[];
  totalFixedIncome: number;
  totalHist: number;
}

export default function HistoryTab({ month, setMonth, barDataHist, totalFixedIncome, totalHist }: Props) {
  return (
    <motion.div
      key="historico"
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="px-4 md:px-8 space-y-4"
    >
      <MonthSelector month={month} onChange={setMonth} />

      <div className="stat-grid gap-3">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingUp size={10} className="text-success" /> Receitas
          </p>
          <p className="text-lg font-bold text-success tabular-nums">{formatCurrency(totalFixedIncome)}</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border">
          <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingDown size={10} className="text-destructive" /> Gastos
          </p>
          <p className="text-lg font-bold text-destructive tabular-nums">{formatCurrency(totalHist)}</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border">
          <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
            <Scale size={10} /> Saldo
          </p>
          <p className="text-lg font-bold tabular-nums" style={{ color: (totalFixedIncome - totalHist) >= 0 ? 'hsl(152 69% 45%)' : 'hsl(0 84% 60%)' }}>
            {formatCurrency(totalFixedIncome - totalHist)}
          </p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Últimos 6 meses</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barDataHist} barGap={3} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={60} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.15)' }} />
              <Bar dataKey="receitas" name="Receitas" fill={C.greenHot} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="gastos"   name="Gastos"   fill={C.redHot}   radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </motion.div>
  );
}
