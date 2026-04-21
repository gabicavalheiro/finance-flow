import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CreditCard, ExpenseCategory, Expense, CATEGORY_CONFIG } from '@/lib/types';
import { updateExpense } from '@/lib/store';
import CategorySelect from '@/components/CategorySelect';
import CurrencyInput from '@/components/CurrencyInput';
import DatePicker from '@/components/DatePicker';

interface Props {
  expense: Expense;
  cards: CreditCard[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditExpenseDialog({ expense, cards, open, onClose, onSaved }: Props) {
  const [name, setName]                 = useState(expense.name);
  const [amount, setAmount]             = useState(String(expense.totalAmount));
  const [category, setCategory]         = useState<ExpenseCategory>(expense.category);
  const [cardId, setCardId]             = useState(expense.cardId);
  const [date, setDate]                 = useState(expense.date);
  const [installments, setInstallments] = useState(String(expense.installments));
  const [saving, setSaving]             = useState(false);

  const handleSave = async () => {
    if (!name || !amount || !cardId) { toast.error('Preencha todos os campos'); return; }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { toast.error('Valor inválido'); return; }

    const updated: Expense = {
      ...expense, name, totalAmount: parsed,
      category, cardId, date,
      installments: parseInt(installments) || 1,
    };

    setSaving(true);
    try {
      await updateExpense(updated);
      toast.success('Gasto atualizado!');
      onSaved();
      onClose();
    } catch {
      toast.error('Erro ao atualizar gasto');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle>Editar Gasto</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="bg-secondary border-border" />
          </div>
          <div>
            <Label>Valor total (R$)</Label>
            <CurrencyInput value={amount} onChange={setAmount} className="bg-secondary border-border" />
          </div>
          <div>
            <Label>Cartão</Label>
            <Select value={cardId} onValueChange={setCardId}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {cards.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name} •••• {c.lastDigits}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <div className="mt-1">
              <CategorySelect
                type="expense"
                value={category}
                onChange={v => setCategory(v as ExpenseCategory)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data da compra</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div>
              <Label>Parcelas</Label>
              <Select value={installments} onValueChange={setInstallments}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">À vista</SelectItem>
                  {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 border-border" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 gradient-primary">
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}