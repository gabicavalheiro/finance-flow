import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Banknote, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  ExpenseCategory, IncomeCategory,
  PaymentMethod, PAYMENT_METHOD_CONFIG,
  VariableTransaction,
} from '@/lib/types';
import { addVariableTransaction } from '@/lib/store';
import { generateId } from '@/lib/helpers';
import CategorySelect from '@/components/CategorySelect';
import CurrencyInput from '@/components/CurrencyInput';
import DatePicker from '@/components/DatePicker';

interface Props { onAdded: () => void; }

export default function AddVariableDialog({ onAdded }: Props) {
  const [open, setOpen]         = useState(false);
  const [type, setType]         = useState<'expense' | 'income'>('expense');
  const [name, setName]         = useState('');
  const [amount, setAmount]     = useState('');
  const [method, setMethod]     = useState<PaymentMethod>('pix');
  const [category, setCategory] = useState<ExpenseCategory | IncomeCategory>('other');
  const [date, setDate]         = useState(new Date().toISOString().split('T')[0]);

  const reset = () => {
    setName(''); setAmount(''); setMethod('pix');
    setCategory('other'); setDate(new Date().toISOString().split('T')[0]);
  };

  const handleTypeChange = (t: 'expense' | 'income') => {
    setType(t);
    setCategory(t === 'expense' ? 'other' : 'salary');
  };

  const handleSubmit = async () => {
    if (!name || !amount) { toast.error('Preencha todos os campos'); return; }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { toast.error('Valor inválido'); return; }

    const tx: VariableTransaction = {
      id: generateId(), name, amount: parsed,
      type, paymentMethod: method, category, date,
    };
    try {
      await addVariableTransaction(tx);
      toast.success(`${name} ${type === 'income' ? 'recebido' : 'registrado'}!`);
      reset();
      setOpen(false);
      onAdded();
    } catch {
      toast.error('Erro ao registrar lançamento');
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <button
          className="relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-150 hover:scale-105 active:scale-95"
          style={{
            borderColor: 'hsl(152 69% 45% / 0.6)',
            background: 'hsl(152 69% 45% / 0.08)',
            color: 'hsl(152 69% 45%)',
          }}
          title="Adicionar ganho / gasto variável"
        >
          <Banknote size={20} />
        </button>
      </DialogTrigger>

      <DialogContent className="bg-card border-border max-w-sm rounded-3xl p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Lançamento Variável</DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2 bg-secondary rounded-xl p-1">
            <button
              onClick={() => handleTypeChange('expense')}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={type === 'expense'
                ? { background: 'hsl(0 72% 51%)', color: '#fff' }
                : { color: 'hsl(240 5% 55%)' }
              }
            >
              <ArrowDownCircle size={15} /> Gasto
            </button>
            <button
              onClick={() => handleTypeChange('income')}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={type === 'income'
                ? { background: 'hsl(152 69% 45%)', color: '#fff' }
                : { color: 'hsl(240 5% 55%)' }
              }
            >
              <ArrowUpCircle size={15} /> Ganho
            </button>
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Descrição do lançamento"
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
              <CategorySelect
                type={type}
                value={category}
                onChange={v => setCategory(v as ExpenseCategory | IncomeCategory)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Método</Label>
              <Select value={method} onValueChange={v => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(PAYMENT_METHOD_CONFIG) as [PaymentMethod, { label: string }][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Data */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data</Label>
            <DatePicker value={date} onChange={setDate} />
          </div>
        </div>

        <div className="px-6 pb-6">
          <Button
            onClick={() => void handleSubmit()}
            className="w-full h-12 rounded-2xl font-semibold text-sm text-white"
            style={{
              background: type === 'expense' ? 'hsl(0 72% 51%)' : 'hsl(152 69% 45%)',
            }}
          >
            {type === 'expense' ? 'Registrar gasto' : 'Registrar recebimento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}