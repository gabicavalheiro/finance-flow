// Estados padrão de tela — loading, vazio e erro — para as páginas não reinventarem cada um.
// Regras: sempre dizem o que aconteceu e o que fazer; anunciam-se a leitores de tela
// (role="status"/"alert"); respeitam tema claro/escuro via tokens do Tailwind.

import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RotateCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function LoadingState({ rows = 3, label = 'Carregando…', className }: {
  rows?: number; label?: string; className?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cn('space-y-3', className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn('h-20 w-full rounded-2xl', i === 0 && 'h-28')} />
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn(
      'flex flex-col items-center text-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10',
      className,
    )}>
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
        {icon ?? <Inbox size={18} aria-hidden />}
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Algo deu errado', message, onRetry, className }: {
  title?: string; message?: string; onRetry?: () => void; className?: string;
}) {
  return (
    <div role="alert" className={cn(
      'flex flex-col items-center text-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-8',
      className,
    )}>
      <AlertTriangle size={20} className="text-destructive" aria-hidden />
      <p className="text-sm font-semibold">{title}</p>
      {message && <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">{message}</p>}
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-2 gap-1.5">
          <RotateCw size={13} aria-hidden /> Tentar de novo
        </Button>
      )}
    </div>
  );
}
