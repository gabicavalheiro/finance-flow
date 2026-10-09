import React from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2, CheckCircle2, Circle, Pause, Play, ExternalLink, Loader2, CreditCard as CreditCardIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/helpers';
import { safeHttpUrl } from '@/lib/safeUrl';
import { Subscription, SUBSCRIPTION_CATEGORIES, monthlyAmount } from '@/lib/subscriptions';
import { CYCLE_LABELS } from '@/features/subscriptions/constants';

export interface SubCardProps {
  sub:            Subscription;
  month:          string;
  cardName?:      string;
  onEdit:         (s: Subscription) => void;
  onDelete:       (s: Subscription) => void;
  onTogglePaid:   (s: Subscription) => void;
  onToggleActive: (s: Subscription) => void;
  loadingId:      string | null;
}

export function SubCard({
  sub, month, cardName,
  onEdit, onDelete, onTogglePaid, onToggleActive, loadingId,
}: SubCardProps) {
  const isPaid    = sub.paidMonths.includes(month);
  const isLoading = loadingId === sub.id;
  const monthly   = monthlyAmount(sub);
  const catInfo   = SUBSCRIPTION_CATEGORIES.find(c => c.value === sub.category);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'relative flex items-center gap-3 p-4 rounded-2xl border transition-all',
        sub.active ? 'bg-card border-border' : 'bg-muted/30 border-border/50 opacity-60',
      )}
    >
      {/* Ícone */}
      <div className={cn(
        'w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0',
        sub.active ? 'bg-primary/10' : 'bg-muted',
      )}>
        {sub.icon ?? catInfo?.emoji ?? '📦'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn('text-sm font-semibold truncate', !sub.active && 'text-muted-foreground')}>
            {sub.name}
          </p>
          {!sub.active && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">
              Pausada
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {catInfo?.emoji} {catInfo?.label}
          </span>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <span className="text-xs text-muted-foreground">
            Dia {sub.billingDay} · {CYCLE_LABELS[sub.billingCycle]}
          </span>
          {cardName && (
            <React.Fragment>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CreditCardIcon size={10} />
                {cardName}
              </span>
            </React.Fragment>
          )}
          {safeHttpUrl(sub.url) && (
            <React.Fragment>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <a
                href={safeHttpUrl(sub.url) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary/70 hover:text-primary transition-colors"
              >
                <ExternalLink size={11} />
              </a>
            </React.Fragment>
          )}
        </div>
      </div>

      {/* Valor */}
      <div className="text-right shrink-0">
        <p className={cn(
          'text-sm font-bold tabular-nums',
          sub.active ? 'text-foreground' : 'text-muted-foreground',
        )}>
          {formatCurrency(monthly)}/mês
        </p>
        {sub.billingCycle === 'annual' && (
          <p className="text-[10px] text-muted-foreground">{formatCurrency(sub.amount)}/ano</p>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 shrink-0">
        {sub.active && (
          <button
            onClick={() => onTogglePaid(sub)}
            disabled={!!isLoading}
            title={isPaid ? 'Desmarcar pagamento' : 'Marcar como pago'}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
              isPaid
                ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                : 'bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary',
            )}
          >
            {isLoading
              ? <Loader2 size={14} className="animate-spin" />
              : isPaid ? <CheckCircle2 size={14} /> : <Circle size={14} />
            }
          </button>
        )}

        <button
          onClick={() => onToggleActive(sub)}
          disabled={!!isLoading}
          title={sub.active ? 'Pausar' : 'Retomar'}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary text-muted-foreground hover:bg-amber-500/10 hover:text-amber-400 transition-all"
        >
          {sub.active ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <button
          onClick={() => onEdit(sub)}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
        >
          <Pencil size={14} />
        </button>

        <button
          onClick={() => onDelete(sub)}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────
