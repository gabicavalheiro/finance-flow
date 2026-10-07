import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp } from 'lucide-react';
import HealthBadge from '@/features/reports/components/HealthBadge';
import { MonthForecast } from '@/features/reports/types';
import { formatCurrency } from '@/lib/helpers';
import { cn } from '@/lib/utils';

export default function ForecastCard({ fc }: { fc: MonthForecast }) {
  const [expanded, setExpanded] = useState(false);
  const balanceColor = fc.balance >= 0 ? 'hsl(152 69% 45%)' : 'hsl(0 84% 60%)';
  const stripColor   = fc.balance >= fc.totalIncome * 0.3
    ? 'hsl(152 69% 45%)' : fc.balance >= 0
    ? 'hsl(38 92% 50%)' : 'hsl(0 84% 60%)';

  return (
    <div className={cn(
      'bg-card rounded-2xl border border-border overflow-hidden',
      fc.isCurrent && 'ring-1 ring-primary/30',
    )}>
      <div className="h-1 w-full" style={{ background: stripColor }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="font-semibold text-sm capitalize">{fc.label}</p>
            <div className="flex items-center gap-2 mt-1">
              <HealthBadge balance={fc.balance} income={fc.totalIncome} />
              {fc.isCurrent && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                  Mês atual
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className="text-base font-bold tabular-nums" style={{ color: balanceColor }}>
              {fc.balance >= 0 ? '+' : ''}{formatCurrency(fc.balance)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-between bg-success/8 rounded-lg px-3 py-2">
            <span className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp size={10} className="text-success" /> Receitas
            </span>
            <span className="font-semibold text-success tabular-nums">{formatCurrency(fc.totalIncome)}</span>
          </div>
          <div className="flex items-center justify-between bg-destructive/8 rounded-lg px-3 py-2">
            <span className="flex items-center gap-1 text-muted-foreground">
              <TrendingDown size={10} className="text-destructive" /> Gastos
            </span>
            <span className="font-semibold text-destructive tabular-nums">{formatCurrency(fc.totalExpense)}</span>
          </div>
        </div>

        {fc.cardBreakdown.some(c => c.amount > 0) && (
          <div className="mt-3 space-y-1.5">
            {fc.cardBreakdown.filter(c => c.amount > 0).map(card => {
              const pct = fc.totalExpense > 0 ? (card.amount / fc.totalExpense) * 100 : 0;
              return (
                <div key={card.cardId}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: 'hsl(263 70% 58%)' }} />
                      <span className="font-medium">{card.cardName}</span>
                    </div>
                    <span className="font-semibold tabular-nums">{formatCurrency(card.amount)}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'hsl(263 70% 58%)' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {fc.installmentDetail.length > 0 && (
          <>
            <button
              onClick={() => setExpanded(p => !p)}
              className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expanded
                ? 'Ocultar parcelas'
                : `${fc.installmentDetail.length} parcela${fc.installmentDetail.length > 1 ? 's' : ''} neste mês`}
            </button>
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-2.5">
                    {fc.installmentDetail.map((inst, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{inst.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {inst.totalInstallments > 1
                              ? `${inst.installmentNumber}/${inst.totalInstallments} · ${inst.cardName}`
                              : `À vista · ${inst.cardName}`}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums shrink-0">
                          {formatCurrency(inst.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
