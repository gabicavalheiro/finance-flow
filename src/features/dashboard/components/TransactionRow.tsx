import { forwardRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/helpers';

interface Props {
  icon: ReactNode;
  title: string;
  subtitle: ReactNode;
  amount: number;
  tone: 'expense' | 'income';
  onEdit?: () => void;
  onDelete?: () => void;
  /** Nome usado nos rótulos de acessibilidade dos botões ("Editar Mercado"). */
  label?: string;
}

/**
 * Linha de lançamento do dashboard. Hover por CSS (sem handlers de mouse), ações
 * sempre visíveis em telas de toque e ao navegar por teclado.
 */
export const TransactionRow = forwardRef<HTMLDivElement, Props>(function TransactionRow(
  { icon, title, subtitle, amount, tone, onEdit, onDelete, label = title }, ref,
) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
      className="group flex items-center gap-3 py-2.5 px-2 rounded-xl transition-colors hover:bg-secondary/50 focus-within:bg-secondary/50"
    >
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">{subtitle}</p>
      </div>
      <span className={cn('text-sm font-bold tabular-nums', tone === 'income' ? 'text-emerald-400' : 'text-destructive')}>
        {tone === 'income' ? '+' : ''}{formatCurrency(amount)}
      </span>
      {(onEdit || onDelete) && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
          {onEdit && (
            <button type="button" onClick={onEdit} aria-label={`Editar ${label}`}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
              <Pencil size={12} />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} aria-label={`Remover ${label}`}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
});
