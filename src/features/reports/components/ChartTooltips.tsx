import { formatCurrency } from '@/lib/helpers';
import { cn } from '@/lib/utils';

export function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-2xl px-3 py-2.5 shadow-lg text-xs min-w-[140px]">
      <p className="font-semibold mb-1.5 capitalize">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color ?? p.fill }} />
            {p.name}
          </span>
          <span className="font-medium">{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Tooltip do gráfico de fluxo ─────────────────────────────────────────────
export function FlowTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const entrada = payload.find((p: any) => p.dataKey === 'entradas');
  const saida   = payload.find((p: any) => p.dataKey === 'saidas');
  const saldo   = payload.find((p: any) => p.dataKey === 'saldo');
  return (
    <div className="bg-card border border-border rounded-2xl px-3 py-2.5 shadow-lg text-xs min-w-[160px]">
      <p className="font-semibold mb-1.5">Dia {label}</p>
      {entrada && (
        <p className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full shrink-0 bg-emerald-400" /> Entradas
          </span>
          <span className="font-medium text-emerald-400">+{formatCurrency(entrada.value)}</span>
        </p>
      )}
      {saida && (
        <p className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="w-2 h-2 rounded-full shrink-0 bg-red-400" /> Saídas
          </span>
          <span className="font-medium text-red-400">-{formatCurrency(saida.value)}</span>
        </p>
      )}
      {saldo && (
        <p className="flex items-center justify-between gap-3 py-0.5 border-t border-border mt-1 pt-1">
          <span className="flex items-center gap-1.5 text-violet-400">
            <span className="w-2 h-2 rounded-full shrink-0 bg-violet-400" /> Saldo acum.
          </span>
          <span className={cn('font-medium', saldo.value >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {saldo.value >= 0 ? '+' : ''}{formatCurrency(saldo.value)}
          </span>
        </p>
      )}
    </div>
  );
}
