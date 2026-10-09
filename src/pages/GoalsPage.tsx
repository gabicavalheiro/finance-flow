import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Plus, Check, ChevronDown, ChevronUp, Loader2, TrendingUp, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/helpers';
import { getFixedExpenses, getIncomes } from '@/lib/store';
import { Goal, computeGoalStats, getGoals, deleteGoal } from '@/lib/goals';
import { GoalDialog } from '@/features/goals/components/GoalDialog';
import { GoalCard } from '@/features/goals/components/GoalCard';
import { AddSavingsDialog } from '@/features/goals/components/AddSavingsDialog';

// ─── Página ───────────────────────────────────────────────────────────────────
export default function GoalsPage() {
  const [goals, setGoals]                   = useState<Goal[]>([]);
  const [monthlyBalance, setMonthlyBalance] = useState(0);
  const [loading, setLoading]               = useState(true);
  const [editingGoal, setEditingGoal]       = useState<Goal | null>(null);
  const [deletingId, setDeletingId]         = useState<string | null>(null);
  const [addSavingsGoal, setAddSavingsGoal] = useState<Goal | null>(null);
  const [showCompleted, setShowCompleted]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, fixedExp, incomes] = await Promise.all([
        getGoals(), getFixedExpenses(), getIncomes(),
      ]);
      setGoals(g);
      const totalIncome  = incomes.reduce((s, i) => s + i.amount, 0);
      const totalExpense = fixedExp.reduce((s, f) => s + f.amount, 0);
      setMonthlyBalance(Math.max(0, totalIncome - totalExpense));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deletingId) return;
    try { await deleteGoal(deletingId); toast.success('Meta removida'); load(); }
    catch { toast.error('Erro ao remover'); }
    finally { setDeletingId(null); }
  };

  const activeGoals    = goals.filter(g => (g.currentSaved ?? 0) < g.targetAmount);
  const completedGoals = goals.filter(g => (g.currentSaved ?? 0) >= g.targetAmount);

  const totalMonthlyNeeded = activeGoals.reduce((s, g) => {
    const stats = computeGoalStats(g, monthlyBalance);
    return s + stats.monthlySavingsNeeded;
  }, 0);

  return (
    <div className="pb-24 md:pb-10 max-w-2xl mx-auto">

      {/* Cabeçalho */}
      <header className="px-4 md:px-8 pt-5 md:pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target size={16} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Metas</h1>
              <p className="text-xs text-muted-foreground">Planeje seus objetivos financeiros</p>
            </div>
          </div>
          <GoalDialog
            monthlyBalance={monthlyBalance}
            onSaved={load}
            trigger={
              <Button size="sm" className="gap-1.5"
                style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}>
                <Plus size={14} /> Nova meta
              </Button>
            }
          />
        </div>
      </header>

      <div className="px-4 md:px-8 space-y-4">

        {/* Resumo geral */}
        {!loading && goals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border border-border p-4"
          >
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-3">Visão geral</p>
            <div className="stat-grid gap-3 text-center">
              <div>
                <p className="text-lg font-bold">{activeGoals.length}</p>
                <p className="text-[10px] text-muted-foreground">Ativas</p>
              </div>
              <div>
                <p className="text-lg font-bold text-success tabular-nums">
                  {formatCurrency(goals.reduce((s, g) => s + g.currentSaved, 0))}
                </p>
                <p className="text-[10px] text-muted-foreground">Economizado</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums" style={{ color: 'hsl(25 95% 53%)' }}>
                  {formatCurrency(totalMonthlyNeeded)}
                </p>
                <p className="text-[10px] text-muted-foreground">Necessário/mês</p>
              </div>
            </div>

            {/* Comprometimento do saldo */}
            {monthlyBalance > 0 && totalMonthlyNeeded > 0 && (
              <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <TrendingUp size={11} /> Comprometimento do saldo mensal
                  </span>
                  <span className="font-medium">
                    {Math.min(100, Math.round((totalMonthlyNeeded / monthlyBalance) * 100))}%
                  </span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (totalMonthlyNeeded / monthlyBalance) * 100)}%`,
                      background: totalMonthlyNeeded > monthlyBalance
                        ? 'hsl(0 84% 60%)'
                        : totalMonthlyNeeded > monthlyBalance * 0.6
                        ? 'hsl(25 95% 53%)' : 'hsl(152 69% 45%)',
                    }}
                  />
                </div>
                {totalMonthlyNeeded > monthlyBalance && (
                  <p className="text-[10px] text-destructive flex items-center gap-1">
                    <AlertTriangle size={10} />
                    A soma das metas supera seu saldo mensal. Revise os prazos.
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Estado vazio */}
        {!loading && goals.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground"
          >
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
              <Sparkles size={28} strokeWidth={1.2} />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium text-foreground">Nenhuma meta criada</p>
              <p className="text-sm">Defina objetivos e veja quanto economizar por mês.</p>
            </div>
            <GoalDialog
              monthlyBalance={monthlyBalance}
              onSaved={load}
              trigger={
                <Button
                  className="gap-2 text-white"
                  style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
                >
                  <Target size={15} /> Criar primeira meta
                </Button>
              }
            />
          </motion.div>
        )}

        {/* Metas ativas */}
        {!loading && activeGoals.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Ativas ({activeGoals.length})
            </p>
            <AnimatePresence mode="popLayout">
              {activeGoals.map(g => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  stats={computeGoalStats(g, monthlyBalance)}
                  onEdit={() => setEditingGoal(g)}
                  onDelete={() => setDeletingId(g.id)}
                  onAddSavings={() => setAddSavingsGoal(g)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Metas concluídas */}
        {!loading && completedGoals.length > 0 && (
          <div className="space-y-3">
            <button
              onClick={() => setShowCompleted(v => !v)}
              className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide font-medium hover:text-foreground transition-colors"
            >
              <Check size={13} className="text-success" />
              Concluídas ({completedGoals.length})
              {showCompleted ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            <AnimatePresence>
              {showCompleted && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  {completedGoals.map(g => (
                    <GoalCard
                      key={g.id}
                      goal={g}
                      stats={computeGoalStats(g, monthlyBalance)}
                      onEdit={() => setEditingGoal(g)}
                      onDelete={() => setDeletingId(g.id)}
                      onAddSavings={() => {}}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

      </div>

      {/* Dialog edição — monta fresh a cada vez, open=true fixo */}
      {editingGoal && (
        <GoalDialog
          initial={editingGoal}
          monthlyBalance={monthlyBalance}
          open={true}
          onOpenChange={v => { if (!v) setEditingGoal(null); }}
          onSaved={() => { setEditingGoal(null); load(); }}
        />
      )}

      {/* Dialog economia */}
      {addSavingsGoal && (
        <AddSavingsDialog
          goal={addSavingsGoal}
          onSaved={() => { setAddSavingsGoal(null); load(); }}
        />
      )}

      {/* Dialog exclusão */}
      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover meta</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação é irreversível. Os dados da meta serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}