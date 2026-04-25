import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, ArrowRight, PiggyBank } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { getGoals, computeGoalStats, Goal } from '@/lib/goals';

interface Props {
  monthlyBalance: number; // saldo fixo mensal calculado no dashboard
}

export default function DashboardGoalsWidget({ monthlyBalance }: Props) {
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    getGoals().then(all => {
      // Só mostra as ativas, ordenadas por prioridade
      setGoals(all.filter(g => g.currentSaved < g.targetAmount).slice(0, 3));
    });
  }, []);

  if (goals.length === 0) return null;

  const totalMonthlyNeeded = goals.reduce((s, g) => {
    const stats = computeGoalStats(g, monthlyBalance);
    return s + stats.monthlySavingsNeeded;
  }, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="bg-card rounded-2xl border border-border p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={15} className="text-primary" />
          <span className="text-sm font-semibold">Metas</span>
        </div>
        <button
          onClick={() => navigate('/goals')}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Ver todas <ArrowRight size={12} />
        </button>
      </div>

      {/* Lista de metas */}
      <div className="space-y-2.5">
        {goals.map(g => {
          const stats = computeGoalStats(g, monthlyBalance);
          return (
            <div key={g.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{g.emoji}</span>
                  <span className="text-xs font-medium truncate">{g.name}</span>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                  {stats.progressPct.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `hsl(${g.color})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, stats.progressPct)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground">
                  {formatCurrency(g.currentSaved)} / {formatCurrency(g.targetAmount)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {stats.monthsLeft} {stats.monthsLeft === 1 ? 'mês' : 'meses'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: total necessário por mês */}
      {totalMonthlyNeeded > 0 && (
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <PiggyBank size={12} />
            <span>Economia mensal total</span>
          </div>
          <span
            className="text-xs font-bold"
            style={{
              color: monthlyBalance > 0 && totalMonthlyNeeded > monthlyBalance
                ? 'hsl(0 84% 60%)'
                : 'hsl(152 69% 45%)',
            }}
          >
            {formatCurrency(totalMonthlyNeeded)}/mês
          </span>
        </div>
      )}
    </motion.div>
  );
}
