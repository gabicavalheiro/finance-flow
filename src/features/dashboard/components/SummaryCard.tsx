import React from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/helpers';
import { cn } from '@/lib/utils';

// ─── SUMMARY CARD (Saldo / Pendente / A receber) ──────────────────────────────
// Superfície neutra; o saldo é o card de destaque, invertido em preto e branco
// (preto no tema claro, branco no escuro). Verde e vermelho aparecem só no ícone,
// para o número continuar sendo o foco.
export type SummaryTone = 'primary' | 'danger' | 'success';

// Negativo no card invertido: vermelho mais claro sobre preto, mais escuro sobre branco.
const NEGATIVE: Record<SummaryTone, string> = {
  primary: 'text-red-400 dark:text-red-600',
  danger:  'text-destructive',
  success: 'text-destructive',
};

const TONES: Record<SummaryTone, { surface: string; icon: string; label: string; value: string; sub: string }> = {
  primary: {
    surface: 'bg-primary text-primary-foreground border-primary shadow-lg',
    icon:    'bg-primary-foreground/10 text-primary-foreground',
    label:   'text-primary-foreground/75',
    value:   'text-primary-foreground',
    sub:     'text-primary-foreground/70',
  },
  danger:  { surface: 'bg-card border-border', icon: 'bg-destructive/15 text-destructive', label: 'text-muted-foreground', value: 'text-foreground', sub: 'text-muted-foreground' },
  success: { surface: 'bg-card border-border', icon: 'bg-success/15 text-success',         label: 'text-muted-foreground', value: 'text-foreground', sub: 'text-muted-foreground' },
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
        onClick && 'cursor-pointer hover-ring',
      )}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', t.icon)}>
          {icon}
        </div>
        <p className={cn('text-sm font-medium', t.label)}>{label}</p>
      </div>

      <p className={cn(
        'font-display font-semibold tabular-nums leading-none',
        hidden ? cn(t.sub, 'tracking-[0.4em] text-base') : 'text-3xl',
        !hidden && value < 0 ? NEGATIVE[tone] : !hidden && t.value,
      )}>
        {hidden ? '• • • • •' : formatCurrency(value)}
      </p>

      {sub && !hidden && (
        <p className={cn('text-xs mt-2.5 leading-tight', t.sub)}>{sub}</p>
      )}
    </motion.div>
  );
}
