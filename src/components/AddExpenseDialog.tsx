import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard as CreditCardIcon, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import { CreditCard, ExpenseCategory, Expense } from '@/lib/types';
import { addExpense } from '@/lib/store';
import { generateId, getCurrentMonth, addMonths } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import CategorySelect from '@/components/CategorySelect';
import CurrencyInput from '@/components/CurrencyInput';
import DatePicker from '@/components/DatePicker';
import NumberStepper from '@/components/ui/number-stepper';

interface Props {
  cards: CreditCard[];
  onAdded: () => void;
  /** Botão compacto com ícone de cartão (usado no header do dashboard) */
  iconOnly?: boolean;
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export default function AddExpenseDialog({ cards, onAdded, iconOnly = false }: Props) {
  const [open, setOpen]                 = useState(false);
  const [name, setName]                 = useState('');
  const [category, setCategory]         = useState<ExpenseCategory>('other');
  const [cardId, setCardId]             = useState('');
  const [date, setDate]                 = useState(new Date().toISOString().split('T')[0]);
  const [installments, setInstallments] = useState('1');
  const [currentInst, setCurrentInst]   = useState('1');
  const [useInstRef, setUseInstRef]     = useState(false);
  const [totalCents, setTotalCents]     = useState(0);
  const [instCents, setInstCents]       = useState(0);
  const lastEdited                      = useRef<'total' | 'inst'>('total');
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
    if (lastEdited.current === 'total') {
      setInstCents(Math.round(totalCents / totalInst));
    } else {
      setTotalCents(instCents * totalInst);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalInst]);

  const reset = () => {
    setName(''); setCategory('other'); setCardId('');
    setDate(new Date().toISOString().split('T')[0]);
    setInstallments('1'); setCurrentInst('1');
    setUseInstRef(false); setTotalCents(0); setInstCents(0);
    lastEdited.current = 'total';
  };

  const computePurchaseDate = (): string => {
    if (!useInstRef || totalInst <= 1) return date;
    const card       = cards.find(c => c.id === cardId);
    const closing    = card?.closingDay ?? 10;
    const cur        = getCurrentMonth();
    const monthsBack = currInst - 1;
    const billing    = addMonths(cur, -monthsBack);
    const [y, m]     = billing.split('-').map(Number);
    const purchaseDay = closing + 1;
    const d = new Date(y, m - 1, purchaseDay);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!name || !totalCents || !cardId) {
      toast.error(!totalCents ? 'Informe um valor' : 'Preencha todos os campos obrigatórios');
      return;
    }
    const finalDate = useInstRef ? computePurchaseDate() : date;
    const expense: Expense = {
      id: generateId(), cardId, name,
      totalAmount: totalCents / 100,
      category, date: finalDate,
      installments: totalInst,
    };
    setSaving(true);
    try {
      await addExpense(expense);
      const desc = totalInst > 1
        ? `${totalInst}x de R$ ${centsToDisplay(instCents)}${useInstRef ? ` · parcela ${currInst}/${totalInst} este mês` : ''}`
        : undefined;
      toast.success(`${name} adicionado!`, { description: desc });
      reset();
      setOpen(false);
      onAdded();
    } catch {
      toast.error('Erro ao salvar gasto');
    }
    setSaving(false);
  };

  const showInstField = totalInst > 1;

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <button
            className="relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-150 hover:scale-105 active:scale-95"
            style={{
              borderColor: 'hsl(0 72% 51% / 0.6)',
              background: 'hsl(0 72% 51% / 0.08)',
              color: 'hsl(0 72% 51%)',
            }}
            title="Adicionar gasto no cartão"
          >
            <CreditCardIcon size={20} />
          </button>
        ) : (
          <Button
            variant="outline"
            className="w-full border-dashed border-muted-foreground/30 rounded-xl"
          >
            <CreditCardIcon size={15} className="mr-2" /> Adicionar gasto
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        className={cn(
          "bg-card border-border rounded-3xl p-0 overflow-hidden transition-[max-width] duration-200",
          showInstField ? "max-w-md" : "max-w-sm",
        )}
      >
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Novo Gasto no Cartão</DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto overflow-x-hidden">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Supermercado" className="bg-secondary border-border rounded-xl h-11" />
          </div>

          {/* Valor */}
          <div className={showInstField ? 'grid grid-cols-[1fr_auto_1fr] items-end gap-2' : ''}>
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs text-muted-foreground">
                {showInstField ? 'Valor total' : 'Valor (R$)'}
              </Label>
              <CurrencyInput
                value={totalCents ? String(totalCents / 100) : ''}
                onChange={handleTotalChange}
                className="bg-secondary border-border rounded-xl h-11 w-full"
              />
            </div>
            {showInstField && (
              <>
                <ArrowLeftRight size={14} className="text-muted-foreground mb-3 shrink-0" />
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs text-muted-foreground">Valor por parcela</Label>
                  <CurrencyInput
                    value={instCents ? String(instCents / 100) : ''}
                    onChange={handleInstChange}
                    className="bg-secondary border-border rounded-xl h-11 w-full"
                  />
                </div>
              </>
            )}
          </div>

          {/* Cartão + Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 min-w-0">
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
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <CategorySelect
                type="expense"
                value={category}
                onChange={v => setCategory(v as ExpenseCategory)}
                className="h-11"
              />
            </div>
          </div>

          {/* Parcelas */}
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

          {/* Referência de parcela */}
          {totalInst > 1 && (
            <div className="rounded-xl bg-secondary/60 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground min-w-0 truncate">Qual parcela cai este mês?</Label>
                <button
                  type="button"
                  onClick={() => setUseInstRef(v => !v)}
                  className={cn(
                    'shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors',
                    useInstRef ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {useInstRef ? 'ativo' : 'inativo'}
                </button>
              </div>
              {useInstRef && (
                <div className="flex items-center gap-3 flex-wrap">
                  <NumberStepper value={currInst} min={1} max={totalInst}
                    onChange={v => setCurrentInst(String(v))} />
                  <span className="text-xs text-muted-foreground">de {totalInst} parcelas</span>
                </div>
              )}
            </div>
          )}

          {/* Data */}
          {!useInstRef && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data da compra</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full h-12 rounded-2xl font-semibold text-sm text-white"
            style={{ background: 'hsl(0 72% 51%)' }}
          >
            {saving ? 'Salvando...' : 'Adicionar gasto'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}