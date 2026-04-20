import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ExpenseCategory, FixedExpense, CATEGORY_CONFIG, PaymentMethod, PAYMENT_METHOD_CONFIG } from '@/lib/types';
import { addFixedExpense } from '@/lib/store';
import { generateId } from '@/lib/helpers';
import CurrencyInput from '@/components/CurrencyInput';

interface Props { onAdded: () => void; }

export default function AddFixedExpenseDialog({ onAdded }: Props) {
  const [open, setOpen]               = useState(false);
  const [name, setName]               = useState('');
  const [amount, setAmount]           = useState('');
  const [category, setCategory]       = useState<ExpenseCategory>('home');
  const [paymentMethod, setPayment]   = useState<PaymentMethod>('pix');
  const [saving, setSaving]           = useState(false);

  const reset = () => {
    setName(''); setAmount('');
    setCategory('home'); setPayment('pix');
  };

  const handleSubmit = async () => {
    if (!name || !amount) { toast.error('Preencha todos os campos'); return; }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { toast.error('Valor inválido'); return; }

    const fixed: FixedExpense = {
      id: generateId(),
      name,
      amount: parsed,
      category,
      paymentMethod,
      paidMonths: [],
    };

    setSaving(true);
    try {
      await addFixedExpense(fixed);
      toast.success(`${name} adicionado aos gastos fixos!`);
      reset();
      setOpen(false);
      onAdded();
    } catch {
      toast.error('Erro ao adicionar gasto fixo');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-dashed border-muted-foreground/30 rounded-xl">
          <Plus size={16} className="mr-2" /> Adicionar
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo Gasto Fixo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Nome */}
          <div>
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Aluguel, Internet, Academia…"
              className="bg-secondary border-border"
            />
          </div>

          {/* Valor */}
          <div>
            <Label>Valor (R$)</Label>
            <CurrencyInput value={amount} onChange={setAmount} className="bg-secondary border-border" />
          </div>

          {/* Forma de pagamento + Categoria lado a lado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={paymentMethod} onValueChange={v => setPayment(v as PaymentMethod)}>
                <SelectTrigger className="bg-secondary border-border mt-1">
                  <SelectValue />
                </SelectTrigger>
                {/*
                  max-h + overflow-y-auto evita que a lista seja cortada no mobile.
                  position="popper" mantém o dropdown no viewport.
                */}
                <SelectContent
                  className="max-h-[280px] overflow-y-auto"
                  position="popper"
                  avoidCollisions
                >
                  {Object.entries(PAYMENT_METHOD_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Categoria</Label>
              <Select value={category} onValueChange={v => setCategory(v as ExpenseCategory)}>
                <SelectTrigger className="bg-secondary border-border mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  className="max-h-[280px] overflow-y-auto"
                  position="popper"
                  avoidCollisions
                >
                  {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={saving} className="w-full gradient-primary">
            {saving ? 'Adicionando...' : 'Adicionar gasto fixo'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}