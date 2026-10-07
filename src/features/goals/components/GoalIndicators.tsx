import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { GoalStats } from '@/lib/goals';

// ─── Badge de viabilidade ─────────────────────────────────────────────────────
export function FeasibilityBadge({ f }: { f: GoalStats['feasibility'] }) {
  const cfg = {
    ok:    { label: 'Viável',   cls: 'bg-success/15 text-success border-success/30'              },
    tight: { label: 'Apertado', cls: 'bg-warning/15 text-warning border-warning/30'              },
    hard:  { label: 'Difícil',  cls: 'bg-destructive/15 text-destructive border-destructive/30'  },
  }[f];
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', cfg.cls)}>
      {cfg.label}
    </span>
  );
}

// ─── Barra de progresso ───────────────────────────────────────────────────────
export function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 bg-secondary rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: `hsl(${color})` }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, pct)}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
}
