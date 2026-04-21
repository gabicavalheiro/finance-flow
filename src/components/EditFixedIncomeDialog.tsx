import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FixedIncome, IncomeCategory } from '@/lib/types';
import { updateIncome } from '@/lib/store';
import CurrencyInput from '@/components/CurrencyInput';
import CategorySelect from '@/components/CategorySelect';

interface Props {
  income: FixedIncome;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditFixedIncomeDialog({ income, open, onClose, onSaved }: Props) {
  const [name, setName]             = useState(income.name);
  const [amount, setAmount]         = useState(String(income.amount));
  const [category, setCategory]     = useState<string>(income.category);
  const [receiveDay, setReceiveDay] = useState(String(income.receiveDay ?? ''));
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    setName(income.name);
    setAmount(String(income.amount));
    setCategory(income.category);
    setReceiveDay(String(income.receiveDay ?? ''));
  }, [income]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Informe o nome'); return; }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { toast.error('Valor inválido'); return; }
    const day = parseInt(receiveDay);
    if (receiveDay && (isNaN(day) || day < 1 || day > 31)) {
      toast.error('Dia de recebimento inválido (1–31)'); return;
    }

    setSaving(true);
    try {
      await updateIncome(income.id, {
        name: name.trim(),
        amount: parsed,
        category: category as IncomeCategory,
        receiveDay: receiveDay ? day : undefined,
      });
      toast.success('Ganho fixo atualizado!');
      onSaved();
      onClose();
    } catch {
      toast.error('Erro ao atualizar ganho fixo');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-card border-border rounded-3xl max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Editar Ganho Fixo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Salário, Freelance..."
              className="bg-secondary border-border"
            />
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
            <CurrencyInput value={amount} onChange={setAmount} className="bg-secondary border-border" />
          </div>

          {/* Categoria + Dia de recebimento */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <CategorySelect
                value={category}
                onChange={setCategory}
                type="income"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dia de recebimento</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={receiveDay}
                onChange={e => setReceiveDay(e.target.value)}
                placeholder="Ex: 5"
                className="bg-secondary border-border"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 border-border" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              className="flex-1 text-white"
              style={{ background: 'linear-gradient(135deg, hsl(152 69% 45%), hsl(210 70% 55%))' }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}