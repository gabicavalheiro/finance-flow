import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  ExpenseCategory, IncomeCategory,
  CATEGORY_CONFIG, INCOME_CATEGORY_CONFIG,
  PaymentMethod, PAYMENT_METHOD_CONFIG,
  VariableTransaction,
} from '@/lib/types';
import { getVariableTransactions, saveVariableTransactions } from '@/lib/store';
import { generateId } from '@/lib/helpers';
import CurrencyInput from '@/components/CurrencyInput';
import DatePicker from '@/components/DatePicker';

interface Props { onAdded: () => void; }

export default function AddVariableDialog({ onAdded }: Props) {
  const [open, setOpen]           = useState(false);
  const [type, setType]           = useState<'expense' | 'income'>('expense');
  const [name, setName]           = useState('');
  const [amount, setAmount]       = useState('');
  const [method, setMethod]       = useState<PaymentMethod>('pix');
  const [category, setCategory]   = useState<ExpenseCategory | IncomeCategory>('other');
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0]);

  const reset = () => {
    setName(''); setAmount(''); setMethod('pix');
    setCategory('other'); setDate(new Date().toISOString().split('T')[0]);
  };

  const handleTypeChange = (t: 'expense' | 'income') => {
    setType(t);
    setCategory(t === 'expense' ? 'other' : 'salary');
  };

  const handleSubmit = () => {
    if (!name || !amount) { toast.error('Preencha todos os campos'); return; }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { toast.error('Valor inválido'); return; }

    const tx: VariableTransaction = {
      id: generateId(), name, amount: parsed,
      type, paymentMethod: method, category, date,
    };
    saveVariableTransactions([...getVariableTransactions(), tx]);
    toast.success(`${name} ${type === 'income' ? 'recebido' : 'registrado'}!`);
    reset();
    setOpen(false);
    onAdded();
  };

  const expenseCategories = Object.entries(CATEGORY_CONFIG);
  const incomeCategories  = Object.entries(INCOME_CATEGORY_CONFIG);

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="rounded-full h-12 w-12 p-0 border-2 border-success/60 hover:bg-success/10 text-success hover:border-success"
          style={{ color: 'hsl(152 69% 45%)' }}
        >
          <Plus size={22} />
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-card border-border max-w-sm rounded-3xl p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Lançamento Variável</DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Type toggle */}
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
              <ArrowUpCircle size={15} /> Recebido
            </button>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
            <CurrencyInput value={amount} onChange={setAmount} className="bg-secondary border-border rounded-xl h-11" />
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={type === 'expense' ? 'Ex: Almoço, Feira...' : 'Ex: Freela, Venda...'}
              className="bg-secondary border-border rounded-xl h-11"
            />
          </div>

          {/* Method + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Forma de pagamento</Label>
              <Select value={method} onValueChange={v => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="bg-secondary border-border rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={category} onValueChange={v => setCategory(v as any)}>
                <SelectTrigger className="bg-secondary border-border rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(type === 'expense' ? expenseCategories : incomeCategories).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data</Label>
            <DatePicker value={date} onChange={setDate} />
          </div>
        </div>

        <div className="px-6 pb-6">
          <Button
            onClick={handleSubmit}
            className="w-full h-12 rounded-2xl font-semibold text-sm"
            style={{
              background: type === 'expense'
                ? 'hsl(0 72% 51%)'
                : 'hsl(152 69% 45%)',
            }}
          >
            {type === 'expense' ? 'Registrar gasto' : 'Registrar recebimento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}