import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { IncomeCategory, FixedIncome, INCOME_CATEGORY_CONFIG } from '@/lib/types';
import { getIncomes, saveIncomes } from '@/lib/store';
import { generateId } from '@/lib/helpers';
import CurrencyInput from '@/components/CurrencyInput';

interface Props { onAdded: () => void; }

export default function AddIncomeDialog({ onAdded }: Props) {
  const [open, setOpen]           = useState(false);
  const [name, setName]           = useState('');
  const [amount, setAmount]       = useState('');
  const [category, setCategory]   = useState<IncomeCategory>('salary');
  const [receiveDay, setReceiveDay] = useState('5');

  const handleSubmit = () => {
    if (!name || !amount) { toast.error('Preencha todos os campos'); return; }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { toast.error('Valor inválido'); return; }
    const day = parseInt(receiveDay);
    if (!day || day < 1 || day > 31) { toast.error('Dia de recebimento inválido (1–31)'); return; }
    const income: FixedIncome = { id: generateId(), name, amount: parsed, category, receiveDay: day, receivedMonths: [] };
    const all = getIncomes();
    all.push(income);
    saveIncomes(all);
    toast.success(`${name} adicionado aos ganhos!`);
    setName(''); setAmount(''); setCategory('salary'); setReceiveDay('5');
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
        <DialogHeader><DialogTitle>Novo Ganho Fixo</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Salário" className="bg-secondary border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <CurrencyInput value={amount} onChange={setAmount} className="bg-secondary border-border" />
            </div>
            <div>
              <Label>Dia de recebimento</Label>
              <Input type="number" min={1} max={31} value={receiveDay} onChange={e => setReceiveDay(e.target.value)} placeholder="5" className="bg-secondary border-border" />
            </div>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={category} onValueChange={v => setCategory(v as IncomeCategory)}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(INCOME_CATEGORY_CONFIG).map(([key, cfg]) => (
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