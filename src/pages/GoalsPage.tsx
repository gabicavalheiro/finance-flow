import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Plus, Pencil, Trash2, Check, ChevronDown, ChevronUp,
  Loader2, TrendingUp, AlertTriangle, Sparkles, PiggyBank, Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/helpers';
import { getFixedExpenses, getIncomes } from '@/lib/store';
import {
  Goal, GoalStats, computeGoalStats,
  getGoals, addGoal, updateGoal, deleteGoal, updateGoalSaved,
} from '@/lib/goals';
import CurrencyInput from '@/components/CurrencyInput';

// ─── Constantes ───────────────────────────────────────────────────────────────
const GOAL_COLORS = [
  { label: 'Verde',   value: '152 69% 45%' },
  { label: 'Azul',    value: '217 91% 60%' },
  { label: 'Roxo',    value: '270 70% 60%' },
  { label: 'Laranja', value: '25 95% 53%'  },
  { label: 'Rosa',    value: '330 80% 60%' },
  { label: 'Ciano',   value: '192 80% 50%' },
];

// Emojis testados — sem variantes complexas que quebram em alguns sistemas
const GOAL_EMOJIS = [
  '🎯','🏠','🚗','✈️','💻','📱','🎓','💍',
  '🏖️','🎸','📷','💰','🛍️','🎮','🚀',
];

const PRIORITY_LABELS: Record<number, string> = { 1: 'Alta', 2: 'Média', 3: 'Baixa' };
const PRIORITY_COLORS: Record<number, string> = {
  1: 'hsl(0 84% 60%)',
  2: 'hsl(25 95% 53%)',
  3: 'hsl(152 69% 45%)',
};

// ─── Form vazio ───────────────────────────────────────────────────────────────
function emptyForm(): Omit<Goal, 'id' | 'createdAt'> {
  return {
    name:           '',
    emoji:          '🎯',
    targetAmount:   0,
    currentSaved:   0,
    monthsDeadline: 12,
    startDate:      new Date().toISOString().slice(0, 10),
    color:          '152 69% 45%',
    priority:       2,
  };
}

// ─── Badge de viabilidade ─────────────────────────────────────────────────────
function FeasibilityBadge({ f }: { f: GoalStats['feasibility'] }) {
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
function ProgressBar({ pct, color }: { pct: number; color: string }) {
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

// ─── Dialog criar/editar ──────────────────────────────────────────────────────
function GoalDialog({
  initial, monthlyBalance, onSaved, trigger,
  open: controlledOpen, onOpenChange: controlledOnOpenChange,
}: {
  initial?: Goal;
  monthlyBalance: number;
  onSaved: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open    = isControlled ? controlledOpen! : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) controlledOnOpenChange?.(v);
    else setInternalOpen(v);
  };

  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState(emptyForm());

  useEffect(() => {
    if (open) setForm(initial ? { ...initial } : emptyForm());
  }, [open, initial]);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const monthlySavingsNeeded = form.targetAmount > 0 && form.monthsDeadline > 0
    ? (form.targetAmount - form.currentSaved) / form.monthsDeadline
    : 0;

  const ratio = monthlyBalance > 0 && monthlySavingsNeeded > 0
    ? monthlySavingsNeeded / monthlyBalance : 0;

  const handleSave = async () => {
    if (!form.name.trim())      { toast.error('Informe o nome da meta'); return; }
    if (form.targetAmount <= 0) { toast.error('Informe o valor da meta'); return; }
    if (form.monthsDeadline < 1){ toast.error('Prazo mínimo: 1 mês'); return; }
    setSaving(true);
    try {
      const goal: Goal = {
        ...form,
        id:        initial?.id ?? crypto.randomUUID(),
        createdAt: initial?.createdAt ?? new Date().toISOString(),
      };
      if (initial) await updateGoal(goal);
      else         await addGoal(goal);
      toast.success(initial ? 'Meta atualizada!' : 'Meta criada!');
      onSaved();
      setOpen(false);
    } catch {
      toast.error('Erro ao salvar meta. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="bg-card border-border max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar meta' : 'Nova meta'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">

          {/* Emoji picker */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ícone</Label>
            <div className="flex flex-wrap gap-1.5">
              {GOAL_EMOJIS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => set('emoji', e)}
                  className={cn(
                    'text-xl w-10 h-10 rounded-xl border transition-all flex items-center justify-center',
                    form.emoji === e
                      ? 'border-primary bg-primary/10 scale-110'
                      : 'border-border bg-secondary hover:border-muted-foreground',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome da meta</Label>
            <Input
              placeholder="Ex: Viagem para Europa"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="bg-secondary border-border"
            />
          </div>

          {/* Valor alvo */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor total da meta (R$)</Label>
            <CurrencyInput
              value={form.targetAmount ? String(form.targetAmount) : ''}
              onChange={v => set('targetAmount', parseFloat(v) || 0)}
              className="bg-secondary border-border"
            />
          </div>

          {/* Já guardou */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Já guardou (R$)</Label>
            <CurrencyInput
              value={form.currentSaved ? String(form.currentSaved) : ''}
              onChange={v => set('currentSaved', Math.min(parseFloat(v) || 0, form.targetAmount))}
              className="bg-secondary border-border"
            />
          </div>

          {/* Prazo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Em quantos meses quer atingir?</Label>
              <span className="text-sm font-bold tabular-nums">
                {form.monthsDeadline} {form.monthsDeadline === 1 ? 'mês' : 'meses'}
              </span>
            </div>
            <input
              type="range" min={1} max={60} step={1}
              value={form.monthsDeadline}
              onChange={e => set('monthsDeadline', parseInt(e.target.value))}
              className="w-full accent-primary h-1.5 rounded-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1 mês</span>
              <span>5 anos</span>
            </div>
          </div>

          {/* Preview de economia */}
          {monthlySavingsNeeded > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-secondary p-3 space-y-2"
            >
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                Previsão de economia
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Economizar por mês</span>
                <span className="text-sm font-bold" style={{ color: `hsl(${form.color})` }}>
                  {formatCurrency(monthlySavingsNeeded)}
                </span>
              </div>
              {monthlyBalance > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Seu saldo fixo mensal</span>
                    <span className="text-xs text-muted-foreground">{formatCurrency(monthlyBalance)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, ratio * 100)}%`,
                        background: ratio > 0.9 ? 'hsl(0 84% 60%)' : ratio > 0.6 ? 'hsl(25 95% 53%)' : 'hsl(152 69% 45%)',
                      }}
                    />
                  </div>
                  {monthlySavingsNeeded > monthlyBalance && (
                    <p className="text-[10px] text-destructive flex items-center gap-1">
                      <AlertTriangle size={10} />
                      Supera seu saldo. Considere aumentar o prazo.
                    </p>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* Prioridade */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Prioridade</Label>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set('priority', p)}
                  className={cn(
                    'flex-1 py-1.5 rounded-xl text-xs font-medium border transition-all',
                    form.priority === p
                      ? 'text-white border-transparent'
                      : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
                  )}
                  style={form.priority === p ? { background: PRIORITY_COLORS[p] } : {}}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Cor */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cor</Label>
            <div className="flex gap-2">
              {GOAL_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => set('color', c.value)}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    form.color === c.value ? 'border-foreground scale-110 shadow-md' : 'border-transparent hover:scale-105',
                  )}
                  style={{ background: `hsl(${c.value})` }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

        </div>

        {/* Botões */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1 border-border"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 text-white"
            style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? <Loader2 size={14} className="animate-spin" />
              : initial ? 'Salvar alterações' : 'Criar meta'
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card de meta ─────────────────────────────────────────────────────────────
function GoalCard({
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

// ─── Dialog de economia ───────────────────────────────────────────────────────
function AddSavingsDialog({ goal, onSaved }: { goal: Goal; onSaved: () => void }) {
  const [open, setOpen]     = useState(true);
  const [value, setValue]   = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const amount = parseFloat(value) || 0;
    if (amount <= 0) { toast.error('Informe um valor'); return; }
    setSaving(true);
    try {
      const newSaved = Math.min(goal.currentSaved + amount, goal.targetAmount);
      await updateGoalSaved(goal.id, newSaved);
      toast.success(newSaved >= goal.targetAmount
        ? '🎉 Meta concluída! Parabéns!'
        : `+${formatCurrency(amount)} registrado!`);
      onSaved();
      setOpen(false);
    } catch {
      toast.error('Erro ao registrar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onSaved()}>
      <DialogContent className="bg-card border-border max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{goal.emoji}</span>
            <span className="truncate">{goal.name}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-xs text-muted-foreground">
            Já guardou: <strong className="text-foreground tabular-nums">{formatCurrency(goal.currentSaved)}</strong>{' '}
            de {formatCurrency(goal.targetAmount)}
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor economizado agora (R$)</Label>
            <CurrencyInput value={value} onChange={setValue} className="bg-secondary border-border" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 border-border"
            onClick={() => { setOpen(false); onSaved(); }}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 text-white gap-1.5"
            style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
            <div className="grid grid-cols-3 gap-3 text-center">
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