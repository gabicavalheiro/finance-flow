import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { IncomeCategory, FixedIncome } from '@/lib/types';
import { addIncome } from '@/lib/store';
import { generateId } from '@/lib/helpers';
import CurrencyInput from '@/components/CurrencyInput';
import CategorySelect from '@/components/CategorySelect';

interface Props { onAdded: () => void; }

export default function AddIncomeDialog({ onAdded }: Props) {
  const [open, setOpen]             = useState(false);
  const [name, setName]             = useState('');
  const [amount, setAmount]         = useState('');
  const [category, setCategory]     = useState<string>('salary');
  const [receiveDay, setReceiveDay] = useState('5');
  const [saving, setSaving]         = useState(false);

  const handleSubmit = async () => {
    if (!name || !amount) { toast.error('Preencha todos os campos'); return; }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { toast.error('Valor inválido'); return; }
    const day = parseInt(receiveDay);
    if (!day || day < 1 || day > 31) { toast.error('Dia de recebimento inválido (1–31)'); return; }

    const income: FixedIncome = {
      id: generateId(), name, amount: parsed,
      category: category as IncomeCategory,
      receiveDay: day, receivedMonths: [],
    };

    setSaving(true);
    try {
      await addIncome(income);
      toast.success(`${name} adicionado aos ganhos!`);
      setName(''); setAmount(''); setCategory('salary'); setReceiveDay('5');
      setOpen(false);
      onAdded();
    } catch {
      toast.error('Erro ao adicionar ganho');
    }
    setSaving(false);
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
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Salário"
              className="bg-secondary border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <CurrencyInput value={amount} onChange={setAmount} className="bg-secondary border-border" />
            </div>
            <div>
              <Label>Dia de recebimento</Label>
              <Input type="number" min={1} max={31} value={receiveDay}
                onChange={e => setReceiveDay(e.target.value)}
                placeholder="5" className="bg-secondary border-border" />
            </div>
          </div>
          <div>
            <Label>Categoria</Label>
            <CategorySelect
              value={category}
              onChange={setCategory}
              type="income"
            />
          </div>
          <Button onClick={handleSubmit} disabled={saving} className="w-full gradient-primary">
            {saving ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}