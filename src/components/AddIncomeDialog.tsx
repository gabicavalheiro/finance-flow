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
import DayPicker from '@/components/DayPicker';

interface Props { onAdded: () => void; }

export default function AddIncomeDialog({ onAdded }: Props) {
  const [open, setOpen]         = useState(false);
  const [name, setName]         = useState('');
  const [amount, setAmount]     = useState('');
  const [category, setCategory] = useState<string>('salary');
  const [receiveDay, setDay]    = useState(105); // padrão: 5º dia útil
  const [saving, setSaving]     = useState(false);

  const reset = () => {
    setName(''); setAmount(''); setCategory('salary'); setDay(105);
  };

  const handleSubmit = async () => {
    if (!name || !amount) { toast.error('Preencha todos os campos'); return; }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { toast.error('Valor inválido'); return; }

    const income: FixedIncome = {
      id: generateId(), name, amount: parsed,
      category: category as IncomeCategory,
      receiveDay, receivedMonths: [],
    };

    setSaving(true);
    try {
      await addIncome(income);
      toast.success(`${name} adicionado aos ganhos!`);
      reset();
      setOpen(false);
      onAdded();
    } catch {
      toast.error('Erro ao adicionar ganho');
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

      <DialogContent className="bg-card border-border max-w-sm rounded-3xl p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Novo Ganho Fixo</DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Salário, Freelance..."
              className="bg-secondary border-border"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
            <CurrencyInput value={amount} onChange={setAmount} className="bg-secondary border-border" />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <CategorySelect value={category} onChange={setCategory} type="income" />
          </div>

          {/* Dia de recebimento */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Quando recebe</Label>
            <DayPicker value={receiveDay} onChange={setDay} />
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 border-border"
            onClick={() => { reset(); setOpen(false); }}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 text-white"
            style={{ background: 'linear-gradient(135deg, hsl(152 69% 45%), hsl(210 70% 55%))' }}
          >
            {saving ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}