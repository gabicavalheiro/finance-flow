import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FixedExpense, ExpenseCategory, PaymentMethod, CATEGORY_CONFIG, PAYMENT_METHOD_CONFIG } from '@/lib/types';
import { updateFixedExpense } from '@/lib/store';
import CurrencyInput from '@/components/CurrencyInput';

interface Props {
  expense: FixedExpense;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditFixedExpenseDialog({ expense, open, onClose, onSaved }: Props) {
  const [name, setName]               = useState(expense.name);
  const [amount, setAmount]           = useState(String(expense.amount));
  const [category, setCategory]       = useState<ExpenseCategory>(expense.category);
  const [paymentMethod, setPayment]   = useState<PaymentMethod>(expense.paymentMethod ?? 'pix');
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    setName(expense.name);
    setAmount(String(expense.amount));
    setCategory(expense.category);
    setPayment(expense.paymentMethod ?? 'pix');
  }, [expense]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Informe o nome'); return; }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { toast.error('Valor inválido'); return; }

    setSaving(true);
    try {
      await updateFixedExpense(expense.id, {
        name: name.trim(),
        amount: parsed,
        category,
        paymentMethod,
      });
      toast.success('Gasto fixo atualizado!');
      onSaved();
      onClose();
    } catch {
      toast.error('Erro ao atualizar gasto fixo');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-card border-border rounded-3xl max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Editar Gasto Fixo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Aluguel, Netflix..."
              className="bg-secondary border-border"
            />
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
            <CurrencyInput value={amount} onChange={setAmount} className="bg-secondary border-border" />
          </div>

          {/* Categoria + Método */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={category} onValueChange={v => setCategory(v as ExpenseCategory)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pagamento</Label>
              <Select value={paymentMethod} onValueChange={v => setPayment(v as PaymentMethod)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PAYMENT_METHOD_CONFIG) as [PaymentMethod, { label: string }][]).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 border-border" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              className="flex-1 text-white"
              style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
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
