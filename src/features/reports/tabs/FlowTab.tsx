import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import MonthSelector from '@/components/MonthSelector';
import { DailyFlowPoint } from '@/features/reports/calculations';
import { FlowTooltip } from '@/features/reports/components/ChartTooltips';
import { C } from '@/features/reports/constants';
import { monthLabel } from '@/features/reports/format';
import { formatCurrency } from '@/lib/helpers';
import { cn } from '@/lib/utils';

interface Props {
  month: string;
  setMonth: (m: string) => void;
  dailyFlowData: DailyFlowPoint[];
}

export default function FlowTab({ month, setMonth, dailyFlowData }: Props) {
  return (
    <motion.div
      key="fluxo"
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="px-4 md:px-8 space-y-4"
    >
      <MonthSelector month={month} onChange={setMonth} />

      <div className="stat-grid gap-3">
        {[
          { label: 'Entradas', value: dailyFlowData[dailyFlowData.length - 1]?.entradas ?? 0, color: 'text-emerald-400' },
          { label: 'Saídas',   value: dailyFlowData[dailyFlowData.length - 1]?.saidas   ?? 0, color: 'text-destructive' },
          { label: 'Saldo',    value: dailyFlowData[dailyFlowData.length - 1]?.saldo    ?? 0, color: (dailyFlowData[dailyFlowData.length - 1]?.saldo ?? 0) >= 0 ? 'text-emerald-400' : 'text-destructive' },
        ].map(item => (
          <div key={item.label} className="bg-card rounded-2xl p-4 border border-border">
            <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
            <p className={cn('text-base font-bold tabular-nums', item.color)}>
              {item.label === 'Saldo' && item.value >= 0 ? '+' : ''}{formatCurrency(item.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Entradas vs Saídas acumuladas */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
          Entradas vs Saídas acumuladas
        </p>
        <p className="text-[10px] text-muted-foreground mb-4">
          Valores acumulados dia a dia em {monthLabel(month, false)}
        </p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyFlowData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.greenHot} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.greenHot} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradSaidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.redHot} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.redHot} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="dia"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => v % 5 === 0 || v === 1 ? String(v) : ''}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false} width={62}
                tickFormatter={v => `R$${(v / 1000).toFixed(1)}k`}
              />
              <Tooltip content={<FlowTooltip />} />
              <Area type="monotone" dataKey="entradas" name="Entradas" stroke={C.greenHot} strokeWidth={2} fill="url(#gradEntradas)" dot={false} />
              <Area type="monotone" dataKey="saidas"   name="Saídas"   stroke={C.redHot}   strokeWidth={2} fill="url(#gradSaidas)"   dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Saldo acumulado */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
          Saldo acumulado do mês
        </p>
        <p className="text-[10px] text-muted-foreground mb-4">
          Entradas − saídas a cada dia de {monthLabel(month, false)}
        </p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyFlowData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="dia"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => v % 5 === 0 || v === 1 ? String(v) : ''}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false} tickLine={false} width={62}
                tickFormatter={v => `R$${(v / 1000).toFixed(1)}k`}
              />
              <Tooltip content={<FlowTooltip />} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 2" />
              <Line
                type="monotone" dataKey="saldo" name="Saldo"
                stroke={C.purple} strokeWidth={2.5}
                dot={false} activeDot={{ r: 4, fill: C.purple }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center mt-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="w-6 h-0.5 rounded-full inline-block" style={{ background: C.purple }} />
            Saldo acumulado
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 bg-primary/8 border border-primary/20 rounded-xl px-4 py-3">
        <Activity size={13} className="text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Entradas:</strong> ganhos fixos (pelo dia de recebimento) + lançamentos variáveis.{' '}
          <strong className="text-foreground">Saídas:</strong> faturas de cartão (pelo dia de vencimento) + gastos fixos (dia 1) + lançamentos variáveis.
        </p>
      </div>
    </motion.div>
  );
}
