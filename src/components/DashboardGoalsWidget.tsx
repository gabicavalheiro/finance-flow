// src/components/DashboardGoalsWidget.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, ArrowRight, PiggyBank } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { getGoals, computeGoalStats, Goal } from '@/lib/goals';

interface Props {
  monthlyBalance: number;
}

export default function DashboardGoalsWidget({ monthlyBalance }: Props) {
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    getGoals().then(all => {
      setGoals(all.filter(g => g.currentSaved < g.targetAmount).slice(0, 3));
    });
  }, []);

  if (goals.length === 0) return null;

  const totalMonthlyNeeded = goals.reduce((s, g) => {
    return s + computeGoalStats(g, monthlyBalance).monthlySavingsNeeded;
  }, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="relative rounded-3xl overflow-hidden"
      style={{
        background: 'hsl(0 0% 60% / 0.05)',
        border: '1px solid hsl(0 0% 60% / 0.15)',
      }}
    >

      {/* Brilho */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'none' }} />

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'hsl(0 0% 60% / 0.1)', backdropFilter: 'blur(8px)' }}>
              <Target size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Metas</p>
              <p className="text-[10px] text-muted-foreground">{goals.length} ativa{goals.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/goals')}
            className="flex items-center gap-1 text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors"
          >
            Ver todas <ArrowRight size={12} />
          </button>
        </div>

        {/* Lista de metas */}
        <div className="space-y-3">
          {goals.map((g, i) => {
            const stats = computeGoalStats(g, monthlyBalance);
            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="space-y-2 rounded-2xl p-3"
                style={{ background: 'hsl(var(--secondary) / 0.5)', border: '1px solid hsl(var(--border))' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{g.emoji}</span>
                    <span className="text-sm font-medium text-foreground truncate">{g.name}</span>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground shrink-0 ml-2 tabular-nums">
                    {stats.progressPct.toFixed(0)}%
                  </span>
                </div>

                {/* Barra de progresso */}
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--secondary))' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `hsl(${g.color})` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, stats.progressPct)}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.08 }}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {formatCurrency(g.currentSaved)} / {formatCurrency(g.targetAmount)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {stats.monthsLeft} {stats.monthsLeft === 1 ? 'mês' : 'meses'}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        {totalMonthlyNeeded > 0 && (
          <div className="mt-4 pt-3 flex items-center justify-between"
            style={{ borderTop: '1px solid hsl(var(--border))' }}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <PiggyBank size={12} />
              <span>Economia mensal</span>
            </div>
            <span
              className="text-xs font-bold tabular-nums"
              style={{
                color: monthlyBalance > 0 && totalMonthlyNeeded > monthlyBalance
                  ? 'hsl(0 84% 65%)'
                  : 'hsl(152 69% 50%)',
              }}
            >
              {formatCurrency(totalMonthlyNeeded)}/mês
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}