import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ExpenseCategory, FixedExpense, CATEGORY_CONFIG } from '@/lib/types';
import { getFixedExpenses, saveFixedExpenses } from '@/lib/store';
import { generateId } from '@/lib/helpers';

interface Props {
  onAdded: () => void;
}

export default function AddFixedExpenseDialog({ onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('subscription');

  const handleSubmit = () => {
    if (!name || !amount) {
      toast.error('Preencha todos os campos');
      return;
    }
    const fixed: FixedExpense = {
      id: generateId(),
      name,
      amount: parseFloat(amount),
      category,
      paidMonths: [],
    };
    const all = getFixedExpenses();
    all.push(fixed);
    saveFixedExpenses(all);
    toast.success(`${name} adicionado aos gastos fixos!`);
    setName(''); setAmount(''); setCategory('subscription');
    setOpen(false);
    onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Netflix" className="bg-secondary border-border" />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="29,90" className="bg-secondary border-border" />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSubmit} className="w-full gradient-primary">Adicionar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
