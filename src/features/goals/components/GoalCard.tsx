import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, PiggyBank, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/helpers';
import { Goal, GoalStats } from '@/lib/goals';
import { PRIORITY_LABELS } from '@/features/goals/constants';
import { FeasibilityBadge, ProgressBar } from '@/features/goals/components/GoalIndicators';

// ─── Card de meta ─────────────────────────────────────────────────────────────
export function GoalCard({
  goal, stats, onEdit, onDelete, onAddSavings,
}: {
  goal: Goal;
  stats: GoalStats;
  onEdit: () => void;
  onDelete: () => void;
  onAddSavings: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={cn(
        'bg-card rounded-2xl border overflow-hidden',
        stats.isCompleted ? 'border-success/40' : 'border-border',
      )}
    >
      {/* Faixa de cor */}
      <div className="h-0.5" style={{ background: `hsl(${goal.color})` }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: `hsl(${goal.color} / 0.12)` }}
          >
            {goal.emoji}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="font-semibold text-sm truncate">{goal.name}</h3>
              {stats.isCompleted
                ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">✓ Concluída</span>
                : stats.isOverdue
                ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">Vencida</span>
                : <FeasibilityBadge f={stats.feasibility} />
              }
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Prioridade {PRIORITY_LABELS[goal.priority]}
              {!stats.isCompleted && ` · ${stats.monthsLeft} ${stats.monthsLeft === 1 ? 'mês' : 'meses'} restantes`}
            </p>
          </div>

          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
              onClick={onEdit}
            >
              <Pencil size={12} />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        </div>

        {/* Progresso */}
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatCurrency(goal.currentSaved)} de {formatCurrency(goal.targetAmount)}
            </span>
            <span className="text-xs font-bold tabular-nums" style={{ color: `hsl(${goal.color})` }}>
              {stats.progressPct.toFixed(0)}%
            </span>
          </div>
          <ProgressBar pct={stats.progressPct} color={goal.color} />
        </div>

        {/* Info rápida */}
        {!stats.isCompleted && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <PiggyBank size={11} />
              <span>Falta <strong className="text-foreground tabular-nums">{formatCurrency(stats.remaining)}</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={11} />
              <span>Até <strong className="text-foreground">{stats.deadlineDate}</strong></span>
            </div>
          </div>
        )}

        {/* Expandir */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-xs text-muted-foreground mt-3 hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'Menos detalhes' : 'Ver detalhes'}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-3 border-t border-border space-y-2">
                {!stats.isCompleted && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-secondary rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Economizar/mês</p>
                      <p className="text-sm font-bold tabular-nums" style={{ color: `hsl(${goal.color})` }}>
                        {formatCurrency(stats.monthlySavingsNeeded)}
                      </p>
                    </div>
                    <div className="bg-secondary rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Meses restantes</p>
                      <p className="text-sm font-bold tabular-nums">{stats.monthsLeft}</p>
                    </div>
                  </div>
                )}
                {!stats.isCompleted && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-xs border-border"
                    onClick={onAddSavings}
                  >
                    <Plus size={13} /> Registrar economia
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
