import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ArrowLeftRight, CreditCard as CreditCardIcon } from 'lucide-react';
import { toast } from 'sonner';
import { CreditCard, ExpenseCategory, Expense, CATEGORY_CONFIG } from '@/lib/types';
import { addExpense } from '@/lib/store';
import { generateId, getCurrentMonth, addMonths } from '@/lib/helpers';
import CurrencyInput from '@/components/CurrencyInput';
import DatePicker from '@/components/DatePicker';

interface Props {
  cards: CreditCard[];
  onAdded: () => void;
  /** Compact gradient icon trigger (e.g. dashboard header). */
  iconOnly?: boolean;
}

function purchaseDateForBillingMonth(billingMonth: string): string {
  return `${billingMonth}-01`;
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export default function AddExpenseDialog({ cards, onAdded, iconOnly = false }: Props) {
  const [open, setOpen]               = useState(false);
  const [name, setName]               = useState('');
  const [category, setCategory]       = useState<ExpenseCategory>('other');
  const [cardId, setCardId]           = useState('');
  const [date, setDate]               = useState(new Date().toISOString().split('T')[0]);
  const [installments, setInstallments] = useState('1');
  const [currentInst, setCurrentInst]   = useState('1');
  const [useInstRef, setUseInstRef]     = useState(false);
  const [totalCents, setTotalCents]     = useState(0);
  const [instCents, setInstCents]       = useState(0);
  const lastEdited = useRef<'total' | 'inst'>('total');
  const [saving, setSaving]             = useState(false);

  const totalInst = parseInt(installments) || 1;
  const currInst  = Math.min(parseInt(currentInst) || 1, totalInst);

  const handleTotalChange = (raw: string) => {
    lastEdited.current = 'total';
    const cents = raw ? Math.round(parseFloat(raw) * 100) : 0;
    setTotalCents(cents);
    if (totalInst > 1) setInstCents(Math.round(cents / totalInst));
  };

  const handleInstChange = (raw: string) => {
    lastEdited.current = 'inst';
    const cents = raw ? Math.round(parseFloat(raw) * 100) : 0;
    setInstCents(cents);
    setTotalCents(cents * totalInst);
  };

  useEffect(() => {
    if (totalInst === 1) { setInstCents(totalCents); return; }
    if (lastEdited.current === 'total') setInstCents(Math.round(totalCents / totalInst));
    else setTotalCents(instCents * totalInst);
  }, [installments]); // eslint-disable-line

  useEffect(() => {
    if (totalInst === 1) { setUseInstRef(false); setCurrentInst('1'); setDate(new Date().toISOString().split('T')[0]); }
  }, [installments]);

  useEffect(() => {
    if (!useInstRef || totalInst <= 1) return;
    const thisMonth = getCurrentMonth();
    const firstBillingMonth = addMonths(thisMonth, -(currInst - 1));
    setDate(purchaseDateForBillingMonth(firstBillingMonth));
  }, [currentInst, useInstRef, installments]);

  // Pre-select first card
  useEffect(() => {
    if (cards.length > 0 && !cardId) setCardId(cards[0].id);
  }, [cards, cardId]);

  const reset = () => {
    setName(''); setTotalCents(0); setInstCents(0);
    setCategory('other'); setCardId(cards[0]?.id ?? '');
    setInstallments('1'); setCurrentInst('1'); setUseInstRef(false);
    setDate(new Date().toISOString().split('T')[0]);
    lastEdited.current = 'total';
  };

  const previewMonths = () => {
    if (totalInst <= 1) return null;
    const thisMonth = getCurrentMonth();
    const firstBillingMonth = useInstRef ? addMonths(thisMonth, -(currInst - 1)) : thisMonth;
    const months = Array.from({ length: Math.min(totalInst, 4) }, (_, i) => {
      const m = addMonths(firstBillingMonth, i).split('-');
      return `${m[1]}/${m[0].slice(2)}`;
    });
    const last = addMonths(firstBillingMonth, totalInst - 1).split('-');
    return months.join(', ') + (totalInst > 4 ? ` ... ${last[1]}/${last[0].slice(2)}` : '');
  };

  const handleSubmit = async () => {
    if (!name || !totalCents || !cardId) {
      toast.error(!totalCents ? 'Informe um valor' : 'Preencha todos os campos obrigatórios');
      return;
    }
    const expense: Expense = {
      id: generateId(), cardId, name,
      totalAmount: totalCents / 100,
      category, date,
      installments: totalInst,
    };
    setSaving(true);
    try {
      await addExpense(expense);
      const desc = totalInst > 1
        ? `${totalInst}x de R$ ${centsToDisplay(instCents)}${useInstRef ? ` (a partir da parcela ${currInst})` : ''}`
        : `R$ ${centsToDisplay(totalCents)} à vista`;
      toast.success(`${name} adicionado! ${desc}`);
      reset();
      setOpen(false);
      onAdded();
    } catch {
      toast.error('Erro ao adicionar gasto');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <button
            type="button"
            className="rounded-full h-9 w-9 flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, hsl(220 70% 55%), hsl(263 70% 58%), hsl(300 65% 55%))',
              boxShadow: '0 0 16px hsl(263 70% 58% / 0.5)',
              color: '#fff',
            }}
          >
            <CreditCardIcon size={16} />
          </button>
        ) : (
          <Button variant="outline" className="rounded-xl border-border gap-2 text-sm">
            <Plus size={16} /> Gasto no cartão
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle>Novo Gasto no Cartão</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Assinatura Netflix"
              className="bg-secondary border-border" />
          </div>

          <div>
            <Label>Cartão</Label>
            <Select value={cardId} onValueChange={setCardId}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione um cartão" /></SelectTrigger>
              <SelectContent>
                {cards.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name} •••• {c.lastDigits}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Categoria</Label>
            <Select value={category} onValueChange={v => setCategory(v as ExpenseCategory)}>
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
              <Label>Valor total (R$)</Label>
              <CurrencyInput value={totalCents ? (totalCents / 100).toFixed(2) : ''} onChange={handleTotalChange}
                className="bg-secondary border-border" />
            </div>
            <div>
              <Label>Parcelas</Label>
              <Select value={installments} onValueChange={setInstallments}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">À vista</SelectItem>
                  {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {totalInst > 1 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label className="text-xs">Valor por parcela</Label>
                <button type="button" onClick={() => setUseInstRef(s => !s)}
                  className="flex items-center gap-1 text-[10px] text-primary hover:underline">
                  <ArrowLeftRight size={10} /> {useInstRef ? 'Usar data da compra' : 'Já estou na parcela X'}
                </button>
              </div>
              <CurrencyInput value={instCents ? (instCents / 100).toFixed(2) : ''} onChange={handleInstChange}
                className="bg-secondary border-border" />
              {useInstRef && (
                <div className="mt-2 flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground shrink-0">Parcela atual:</Label>
                  <Input type="number" min={1} max={totalInst} value={currentInst}
                    onChange={e => setCurrentInst(e.target.value)}
                    className="bg-secondary border-border h-8 text-sm w-20" />
                  <span className="text-xs text-muted-foreground">de {totalInst}</span>
                </div>
              )}
            </div>
          )}

          {totalInst <= 1 && (
            <div>
              <Label>Data da compra</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
          )}

          {previewMonths() && (
            <p className="text-[10px] text-muted-foreground bg-secondary rounded-lg px-3 py-2">
              📅 Cobrado em: {previewMonths()}
            </p>
          )}

          <Button onClick={handleSubmit} disabled={saving} className="w-full gradient-primary">
            {saving ? 'Adicionando...' : 'Adicionar gasto'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}