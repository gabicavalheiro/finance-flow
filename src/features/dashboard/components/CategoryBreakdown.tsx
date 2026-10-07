import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/helpers';
import { PIE_COLORS } from '../constants';
import type { PieSlice } from '../calculations';

/** Gastos por categoria: rosca com o total ao centro + legenda com participação (%). */
export function CategoryBreakdown({ data, hidden = false }: { data: PieSlice[]; hidden?: boolean }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const money = (v: number) => (hidden ? '••••' : formatCurrency(v));

  return (
    <section aria-label="Gastos por categoria">
      <p className="text-sm font-semibold text-foreground mb-4">Gastos por categoria</p>
      <div className="flex gap-4 items-center">
        <div className="relative w-36 h-36 shrink-0" role="img"
          aria-label={`Total de ${money(total)} em ${data.length} categorias`}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={44} outerRadius={64} paddingAngle={2}
                dataKey="value" stroke="none" isAnimationActive={false}>
                {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>
            <span className="text-xs font-bold tabular-nums text-foreground">{money(total)}</span>
          </div>
        </div>
        <ul className="flex-1 min-w-0 space-y-2.5">
          {data.slice(0, 6).map((d, i) => {
            const pct = total > 0 ? (d.value / total) * 100 : 0;
            return (
              <li key={d.name}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-xs text-muted-foreground truncate flex-1">{d.name}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{Math.round(pct)}%</span>
                  <span className="text-xs font-semibold tabular-nums text-foreground">{money(d.value)}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-secondary overflow-hidden" aria-hidden>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
