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
import DayPicker from '@/components/DayPicker';

interface Props {
  income: FixedIncome;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditFixedIncomeDialog({ income, open, onClose, onSaved }: Props) {
  const [name, setName]         = useState(income.name);
  const [amount, setAmount]     = useState(String(income.amount));
  const [category, setCategory] = useState<string>(income.category);
  const [receiveDay, setDay]    = useState<number>(income.receiveDay ?? 105);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    setName(income.name);
    setAmount(String(income.amount));
    setCategory(income.category);
    setDay(income.receiveDay ?? 105);
  }, [income]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Informe o nome'); return; }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { toast.error('Valor inválido'); return; }

    setSaving(true);
    try {
      await updateIncome(income.id, {
        name: name.trim(),
        amount: parsed,
        category: category as IncomeCategory,
        receiveDay,
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
      <DialogContent className="bg-card border-border rounded-3xl max-w-sm mx-auto p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Editar Ganho Fixo</DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4">
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

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <CategorySelect value={category} onChange={setCategory} type="income" />
          </div>

          {/* Dia de recebimento */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Quando recebe</Label>
            <DayPicker value={receiveDay} onChange={setDay} />
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-2">
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
      </DialogContent>
    </Dialog>
  );
}