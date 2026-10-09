import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/helpers';
import { Goal, addGoal, updateGoal } from '@/lib/goals';
import CurrencyInput from '@/components/CurrencyInput';
import { GOAL_COLORS, GOAL_EMOJIS, PRIORITY_LABELS, PRIORITY_COLORS, emptyForm } from '@/features/goals/constants';

// ─── Dialog criar/editar ──────────────────────────────────────────────────────
export function GoalDialog({
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
      <DialogContent className="bg-card border-border max-w-sm max-h-[90dvh] overflow-y-auto">
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
