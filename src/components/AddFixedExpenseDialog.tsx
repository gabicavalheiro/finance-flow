import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ExpenseCategory, FixedExpense, PaymentMethod, PAYMENT_METHOD_CONFIG } from '@/lib/types';
import { addFixedExpense } from '@/lib/store';
import { generateId } from '@/lib/helpers';
import CategorySelect from '@/components/CategorySelect';
import CurrencyInput from '@/components/CurrencyInput';

interface Props {
  onAdded: () => void | Promise<void>;
}

/**
 * Novo gasto fixo — não exige cartão. É um gasto que se repete todo mês
 * (aluguel, internet, medicamentos...). Se o valor costuma mudar, marque
 * "Valor variável": o valor informado vale como padrão em todos os meses e
 * pode ser ajustado mês a mês depois.
 */
export default function AddFixedExpenseDialog({ onAdded }: Props) {
  const [open, setOpen]         = useState(false);
  const [name, setName]         = useState('');
  const [amount, setAmount]     = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [payment, setPayment]   = useState<PaymentMethod>('pix');
  const [variable, setVariable] = useState(false);
  const [saving, setSaving]     = useState(false);

  const reset = () => {
    setName(''); setAmount(''); setCategory('other');
    setPayment('pix'); setVariable(false);
  };

  const handleSubmit = async () => {
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!name.trim())                    { toast.error('Informe o nome do gasto'); return; }
    if (isNaN(parsed) || parsed <= 0)    { toast.error('Informe um valor'); return; }

    const fixed: FixedExpense = {
      id: generateId(),
      name: name.trim(),
      amount: parsed,
      category,
      paidMonths: [],
      paymentMethod: payment,
      ...(variable ? { variable: true } : {}),
    };

    setSaving(true);
    try {
      await addFixedExpense(fixed);
      toast.success(`${fixed.name} adicionado!`);
      reset();
      setOpen(false);
      await onAdded();
    } catch (err) {
      console.error('addFixedExpense:', err);
      toast.error('Erro ao salvar o gasto fixo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 border-dashed border-muted-foreground/30 rounded-xl">
          <Plus size={14} /> Adicionar
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-card border-border rounded-3xl max-w-sm p-0 gap-0 flex flex-col max-h-[92dvh]">
        <div className="px-5 sm:px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Novo Gasto Fixo</DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Aluguel, Internet, Medicamentos"
              className="bg-secondary border-border rounded-xl h-11" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {variable ? 'Valor padrão mensal (R$)' : 'Valor mensal (R$)'}
            </Label>
            <CurrencyInput value={amount} onChange={setAmount}
              className="bg-secondary border-border rounded-xl h-11 w-full" />
          </div>

          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <CategorySelect type="expense" value={category}
                onChange={v => setCategory(v as ExpenseCategory)} className="h-11" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs text-muted-foreground">Pagamento</Label>
              <Select value={payment} onValueChange={v => setPayment(v as PaymentMethod)}>
                <SelectTrigger className="bg-secondary border-border rounded-xl h-11">
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

          <div className="flex items-start justify-between gap-3 rounded-xl bg-secondary/60 p-3">
            <div className="min-w-0">
              <p className="text-xs font-medium">Valor variável</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                Conta o valor padrão em todos os meses; você ajusta o valor real de cada mês depois.
              </p>
            </div>
            <Switch checked={variable} onCheckedChange={setVariable} aria-label="Valor variável" />
          </div>
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-border flex gap-2 shrink-0">
          <Button variant="outline" className="flex-1 border-border" onClick={() => { reset(); setOpen(false); }} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="flex-1 text-white"
            style={{ background: 'linear-gradient(135deg, hsl(0 0% 32%), hsl(0 0% 12%))' }}>
            {saving ? 'Salvando...' : 'Adicionar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
