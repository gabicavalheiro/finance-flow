import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/helpers';
import { Goal, updateGoalSaved } from '@/lib/goals';
import CurrencyInput from '@/components/CurrencyInput';

// ─── Dialog de economia ───────────────────────────────────────────────────────
export function AddSavingsDialog({ goal, onSaved }: { goal: Goal; onSaved: () => void }) {
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
