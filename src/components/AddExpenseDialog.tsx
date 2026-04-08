import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { CreditCard, ExpenseCategory, Expense, CATEGORY_CONFIG } from '@/lib/types';
import { getExpenses, saveExpenses } from '@/lib/store';
import { generateId } from '@/lib/helpers';

interface Props {
  cards: CreditCard[];
  onAdded: () => void;
}

export default function AddExpenseDialog({ cards, onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [cardId, setCardId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [installments, setInstallments] = useState('1');

  const reset = () => {
    setName(''); setAmount(''); setCategory('other');
    setCardId(''); setDate(new Date().toISOString().split('T')[0]); setInstallments('1');
  };

  const handleSubmit = () => {
    if (!name || !amount || !cardId) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    const expense: Expense = {
      id: generateId(),
      cardId,
      name,
      totalAmount: parseFloat(amount),
      category,
      date,
      installments: parseInt(installments) || 1,
    };
    const all = getExpenses();
    all.push(expense);
    saveExpenses(all);
    toast.success(`${name} adicionado!`, {
      description: parseInt(installments) > 1
        ? `${installments}x de R$ ${(parseFloat(amount) / parseInt(installments)).toFixed(2)}`
        : undefined,
    });
    reset();
    setOpen(false);
    onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-primary rounded-full h-12 w-12 p-0 shadow-lg shadow-primary/30">
          <Plus size={24} />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo Gasto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Supermercado" className="bg-secondary border-border" />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="bg-secondary border-border" />
          </div>
          <div>
            <Label>Cartão</Label>
            <Select value={cardId} onValueChange={setCardId}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {cards.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name} •••• {c.lastDigits}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div>
              <Label>Parcelas</Label>
              <Select value={installments} onValueChange={setInstallments}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">À vista</SelectItem>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSubmit} className="w-full gradient-primary">Adicionar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
