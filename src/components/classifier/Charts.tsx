// Gráficos do Classificador: barras por categoria e colunas por período.
// Uma única cor (a de destaque do app) — a categoria é identificada pelo rótulo, não pela cor.
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/helpers';

export interface ChartDatum { key: string; label: string; total: number }

const BAR = 'hsl(var(--primary))';
const compact = (v: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

function ValueTable({ rows, grand }: { rows: ChartDatum[]; grand: number }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-muted-foreground text-left">
          <th className="font-medium pb-2">Item</th>
          <th className="font-medium pb-2 text-right">Total</th>
          <th className="font-medium pb-2 text-right w-16">%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-border/60">
            <td className="py-1.5">{r.label}</td>
            <td className="py-1.5 text-right tabular-nums">{formatCurrency(r.total)}</td>
            <td className="py-1.5 text-right tabular-nums text-muted-foreground">
              {grand > 0 ? Math.round((r.total / grand) * 100) : 0}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Barras horizontais, da maior para a menor; clicar numa barra filtra a página por ela. */
export function CategoryBars({
  data, selected, onSelect, asTable,
}: {
  data: ChartDatum[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  asTable: boolean;
}) {
  const grand = data.reduce((a, d) => a + d.total, 0);
  const max = Math.max(...data.map((d) => d.total), 1);
  if (!data.length) return <p className="text-sm text-muted-foreground py-6 text-center">Sem gastos no filtro atual.</p>;
  if (asTable) return <ValueTable rows={data} grand={grand} />;
  return (
    <ul className="space-y-1">
      {data.map((d) => {
        const active = selected === d.key;
        const dim = selected !== null && !active;
        return (
          <li key={d.key}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(active ? null : d.key)}
              title={`${d.label}: ${formatCurrency(d.total)} (${Math.round((d.total / grand) * 100)}%)`}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors',
                'hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active && 'bg-secondary',
              )}
            >
              <span className="w-24 shrink-0 truncate text-sm">{d.label}</span>
              <span className="flex-1 flex items-center gap-2 min-w-0">
                <span
                  className={cn('h-3.5 rounded-r-[4px] transition-opacity', dim && 'opacity-35')}
                  style={{ width: `${Math.max((d.total / max) * 82, 1.5)}%`, background: BAR }}
                />
                <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                  {formatCurrency(d.total)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Colunas por dia ou por mês. Só o maior valor leva rótulo fixo; o resto aparece no hover/foco. */
export function PeriodColumns({ data, asTable }: { data: ChartDatum[]; asTable: boolean }) {
  const [hover, setHover] = useState<string | null>(null);
  const grand = data.reduce((a, d) => a + d.total, 0);
  const max = Math.max(...data.map((d) => d.total), 1);
  const PLOT = 132; // altura útil das colunas (px); o eixo fica fora dela
  if (!data.length) return <p className="text-sm text-muted-foreground py-6 text-center">Sem gastos no filtro atual.</p>;
  if (asTable) return <ValueTable rows={data} grand={grand} />;
  const peak = data.reduce((a, d) => (d.total > a.total ? d : a), data[0]);
  const labelEvery = data.length > 16 ? Math.ceil(data.length / 8) : 1;
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1 min-w-full" style={{ height: PLOT + 44 }} role="list">
        {data.map((d, i) => {
          const h = Math.max((d.total / max) * PLOT, 2);
          const show = hover === d.key || (hover === null && d.key === peak.key);
          return (
            <div
              key={d.key}
              role="listitem"
              tabIndex={0}
              aria-label={`${d.label}: ${formatCurrency(d.total)}`}
              onPointerEnter={() => setHover(d.key)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(d.key)}
              onBlur={() => setHover(null)}
              className="flex-1 min-w-[14px] flex flex-col items-center justify-end outline-none focus-visible:bg-secondary rounded"
              style={{ height: '100%' }}
            >
              <span className={cn('text-[11px] tabular-nums mb-1 whitespace-nowrap', show ? 'text-foreground' : 'opacity-0')}>
                {compact(d.total)}
              </span>
              <span
                className="w-full max-w-[24px] rounded-t-[4px] transition-opacity"
                style={{ height: h, background: BAR, opacity: hover && hover !== d.key ? 0.45 : 1 }}
              />
              <span className="h-5 mt-1.5 text-[11px] text-muted-foreground whitespace-nowrap">
                {i % labelEvery === 0 ? d.label : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
