import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import { CreditCard, ExpenseCategory, Expense, CATEGORY_CONFIG } from '@/lib/types';
import { getExpenses, saveExpenses } from '@/lib/store';
import { generateId, getCurrentMonth, addMonths } from '@/lib/helpers';
import CurrencyInput from '@/components/CurrencyInput';
import DatePicker from '@/components/DatePicker';

interface Props {
  cards: CreditCard[];
  onAdded: () => void;
}

function purchaseDateForBillingMonth(billingMonth: string): string {
  return `${billingMonth}-01`;
}

// cents → display string "300,00"
function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export default function AddExpenseDialog({ cards, onAdded }: Props) {
  const [open, setOpen]               = useState(false);
  const [name, setName]               = useState('');
  const [category, setCategory]       = useState<ExpenseCategory>('other');
  const [cardId, setCardId]           = useState('');
  const [date, setDate]               = useState(new Date().toISOString().split('T')[0]);
  const [installments, setInstallments] = useState('1');
  const [currentInst, setCurrentInst]   = useState('1');
  const [useInstRef, setUseInstRef]     = useState(false);

  // Two-way value: store as cents integers
  const [totalCents, setTotalCents]       = useState(0);
  const [instCents, setInstCents]         = useState(0);
  const lastEdited = useRef<'total' | 'inst'>('total');

  const totalInst = parseInt(installments) || 1;
  const currInst  = Math.min(parseInt(currentInst) || 1, totalInst);

  // Sync the other field whenever one changes
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

  // When installment count changes, recalculate from the last-edited field
  useEffect(() => {
    if (totalInst === 1) {
      setInstCents(totalCents);
      return;
    }
    if (lastEdited.current === 'total') {
      setInstCents(Math.round(totalCents / totalInst));
    } else {
      setTotalCents(instCents * totalInst);
    }
  }, [installments]); // eslint-disable-line

  // When installments changes, reset currentInst
  useEffect(() => {
    if (totalInst === 1) {
      setUseInstRef(false);
      setCurrentInst('1');
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [installments]);

  // Recalculate purchase date in ref mode
  useEffect(() => {
    if (!useInstRef || totalInst <= 1) return;
    const thisMonth = getCurrentMonth();
    const firstBillingMonth = addMonths(thisMonth, -(currInst - 1));
    setDate(purchaseDateForBillingMonth(firstBillingMonth));
  }, [currentInst, useInstRef, installments]);

  const reset = () => {
    setName(''); setTotalCents(0); setInstCents(0);
    setCategory('other'); setCardId('');
    setInstallments('1'); setCurrentInst('1'); setUseInstRef(false);
    setDate(new Date().toISOString().split('T')[0]);
    lastEdited.current = 'total';
  };

  const previewMonths = () => {
    if (totalInst <= 1) return null;
    const thisMonth = getCurrentMonth();
    const firstBillingMonth = useInstRef
      ? addMonths(thisMonth, -(currInst - 1))
      : thisMonth;
    const months = Array.from({ length: Math.min(totalInst, 4) }, (_, i) => {
      const m = addMonths(firstBillingMonth, i).split('-');
      return `${m[1]}/${m[0].slice(2)}`;
    });
    const last = addMonths(firstBillingMonth, totalInst - 1).split('-');
    return months.join(', ') + (totalInst > 4 ? ` ... ${last[1]}/${last[0].slice(2)}` : '');
  };

  const handleSubmit = () => {
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
    saveExpenses([...getExpenses(), expense]);
    const desc = totalInst > 1
      ? `${totalInst}x de R$ ${centsToDisplay(instCents)}${useInstRef ? ` · parcela ${currInst}/${totalInst} este mês` : ''}`
      : undefined;
    toast.success(`${name} adicionado!`, { description: desc });
    reset();
    setOpen(false);
    onAdded();
  };

  const showInstField = totalInst > 1;

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="rounded-full h-12 w-12 p-0 shadow-lg shadow-destructive/30"
          style={{ background: 'hsl(0 72% 51%)' }}>
          <Plus size={24} />
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-card border-border max-w-sm rounded-3xl p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Novo Gasto no Cartão</DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Supermercado" className="bg-secondary border-border rounded-xl h-11" />
          </div>

          {/* Value fields */}
          <div className={showInstField ? 'grid grid-cols-[1fr_auto_1fr] items-end gap-2' : ''}>
            {/* Total */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {showInstField ? 'Valor total' : 'Valor (R$)'}
              </Label>
              <CurrencyInput
                value={totalCents ? String(totalCents / 100) : ''}
                onChange={handleTotalChange}
                className="bg-secondary border-border rounded-xl h-11"
              />
            </div>

            {/* Arrow icon between fields */}
            {showInstField && (
              <div className="flex items-center justify-center h-11 w-8">
                <ArrowLeftRight size={14} className="text-muted-foreground" />
              </div>
            )}

            {/* Per installment */}
            {showInstField && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Valor parcela</Label>
                <CurrencyInput
                  value={instCents ? String(instCents / 100) : ''}
                  onChange={handleInstChange}
                  className="bg-secondary border-border rounded-xl h-11"
                />
              </div>
            )}
          </div>

          {/* Card + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cartão</Label>
              <Select value={cardId} onValueChange={setCardId}>
                <SelectTrigger className="bg-secondary border-border rounded-xl h-11">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {cards.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} •••• {c.lastDigits}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={category} onValueChange={v => setCategory(v as ExpenseCategory)}>
                <SelectTrigger className="bg-secondary border-border rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Installments */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Parcelas</Label>
            <Select value={installments} onValueChange={setInstallments}>
              <SelectTrigger className="bg-secondary border-border rounded-xl h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">À vista</SelectItem>
                {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
                  <SelectItem key={n} value={String(n)}>
                    {n}x{totalCents ? ` · R$ ${centsToDisplay(Math.round(totalCents / n))}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Installment reference box */}
          {totalInst > 1 && (
            <div className="bg-secondary/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">Já está pagando?</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Informe em qual parcela você está</p>
                </div>
                <button
                  onClick={() => {
                    const next = !useInstRef;
                    setUseInstRef(next);
                    if (!next) {
                      setCurrentInst('1');
                      setDate(new Date().toISOString().split('T')[0]);
                    }
                  }}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  style={{ background: useInstRef ? 'hsl(263 70% 58%)' : 'hsl(240 5% 25%)' }}
                >
                  <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                    style={{ transform: useInstRef ? 'translateX(22px)' : 'translateX(4px)' }} />
                </button>
              </div>

              {useInstRef ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentInst(String(Math.max(1, currInst - 1)))}
                      className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors shrink-0">
                      −
                    </button>
                    <div className="flex-1 bg-card rounded-xl h-9 flex items-center justify-center text-sm font-semibold border border-border">
                      Parcela {currInst} de {totalInst}
                    </div>
                    <button onClick={() => setCurrentInst(String(Math.min(totalInst, currInst + 1)))}
                      className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors shrink-0">
                      +
                    </button>
                  </div>
                  {previewMonths() && (
                    <div className="bg-card rounded-xl p-3 border border-border">
                      <p className="text-[10px] text-muted-foreground font-medium mb-1">Lançamentos nos meses:</p>
                      <p className="text-xs font-medium text-primary">{previewMonths()}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Data da compra</Label>
                  <DatePicker value={date} onChange={setDate} />
                </div>
              )}
            </div>
          )}

          {/* Date for à vista */}
          {totalInst === 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-2 border-t border-border">
          <Button onClick={handleSubmit} className="w-full gradient-primary h-12 rounded-2xl font-semibold text-sm">
            Adicionar gasto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}