import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  VariableTransaction, PaymentMethod, ExpenseCategory, IncomeCategory,
  PAYMENT_METHOD_CONFIG,
} from '@/lib/types';
import { updateVariableTransaction } from '@/lib/store';
import CurrencyInput from '@/components/CurrencyInput';
import DatePicker from '@/components/DatePicker';
import CategorySelect from '@/components/CategorySelect';

interface Props {
  transaction: VariableTransaction;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditVariableDialog({ transaction, open, onClose, onSaved }: Props) {
  const [name, setName]         = useState(transaction.name);
  const [amount, setAmount]     = useState(String(transaction.amount));
  const [type, setType]         = useState<'expense' | 'income'>(transaction.type);
  const [method, setMethod]     = useState<PaymentMethod>(transaction.paymentMethod);
  const [category, setCategory] = useState<string>(transaction.category);
  const [date, setDate]         = useState(transaction.date);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    setName(transaction.name);
    setAmount(String(transaction.amount));
    setType(transaction.type);
    setMethod(transaction.paymentMethod);
    setCategory(transaction.category);
    setDate(transaction.date);
  }, [transaction]);

  const handleTypeChange = (t: 'expense' | 'income') => {
    setType(t);
    setCategory(t === 'expense' ? 'other' : 'salary');
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Informe o nome'); return; }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { toast.error('Valor inválido'); return; }

    setSaving(true);
    try {
      await updateVariableTransaction(transaction.id, {
        name: name.trim(),
        amount: parsed,
        type,
        paymentMethod: method,
        category: category as ExpenseCategory | IncomeCategory,
        date,
      });
      toast.success('Lançamento atualizado!');
      onSaved();
      onClose();
    } catch {
      toast.error('Erro ao atualizar lançamento');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-card border-border rounded-3xl max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Editar lançamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Tipo */}
          <div className="flex bg-secondary rounded-xl p-1">
            {(['expense', 'income'] as const).map(t => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                className="flex-1 text-sm font-medium py-2 rounded-lg transition-all duration-200"
                style={{
                  background: type === t ? 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' : 'transparent',
                  color: type === t ? '#fff' : 'hsl(240 5% 55%)',
                }}
              >
                {t === 'expense' ? 'Gasto' : 'Ganho'}
              </button>
            ))}
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="bg-secondary border-border" />
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
            <CurrencyInput value={amount} onChange={setAmount} className="bg-secondary border-border" />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <CategorySelect
              value={category}
              onChange={setCategory}
              type={type}
            />
          </div>

          {/* Método de pagamento */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Método de pagamento</Label>
            <Select value={method} onValueChange={v => setMethod(v as PaymentMethod)}>
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

          {/* Data */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data</Label>
            <DatePicker value={date} onChange={setDate} />
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 border-border" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
              onClick={handleSubmit}
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