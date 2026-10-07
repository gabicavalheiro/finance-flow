import React from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/helpers';
import { cn } from '@/lib/utils';

// ─── SUMMARY CARD (Saldo / Pendente / A receber) ──────────────────────────────
// Superfície neutra; só o saldo recebe a cor de destaque (orquídea). Verde e
// vermelho aparecem apenas no ícone, para o número continuar sendo o foco.
export type SummaryTone = 'primary' | 'danger' | 'success';

const TONES: Record<SummaryTone, { surface: string; icon: string }> = {
  primary: { surface: 'bg-primary/[0.08] border-primary/30', icon: 'bg-primary/15 text-primary' },
  danger:  { surface: 'bg-card border-border',               icon: 'bg-destructive/15 text-destructive' },
  success: { surface: 'bg-card border-border',               icon: 'bg-success/15 text-success' },
};

export function SummaryCard({
  label, value, sub, icon, tone = 'danger', delay = 0, onClick, hidden,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
  tone?: SummaryTone;
  delay?: number;
  onClick?: () => void;
  hidden?: boolean;
}) {
  const t = TONES[tone];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.3 }}
      onClick={onClick}
      className={cn(
        'rounded-2xl border p-4 md:p-5 transition-colors',
        t.surface,
        onClick && 'cursor-pointer hover:border-primary/50',
      )}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', t.icon)}>
          {icon}
        </div>
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
      </div>

      <p className={cn(
        'font-display font-semibold tabular-nums leading-none',
        hidden ? 'text-muted-foreground/40 tracking-[0.4em] text-base' : 'text-3xl',
        !hidden && value < 0 ? 'text-destructive' : !hidden && 'text-foreground',
      )}>
        {hidden ? '• • • • •' : formatCurrency(value)}
      </p>

      {sub && !hidden && (
        <p className="text-muted-foreground text-xs mt-2.5 leading-tight">{sub}</p>
      )}
    </motion.div>
  );
}
