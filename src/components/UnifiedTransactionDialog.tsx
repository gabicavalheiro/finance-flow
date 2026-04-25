import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowUpCircle, ArrowDownCircle, CreditCard as CardIcon,
  Loader2, Zap, Banknote, ArrowLeftRight, FileText, MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getCurrentMonth, addMonths, generateId } from '@/lib/helpers';
import {
  ExpenseCategory, IncomeCategory, PaymentMethod,
  PAYMENT_METHOD_CONFIG, VariableTransaction, Expense, CreditCard,
} from '@/lib/types';
import { addVariableTransaction, addExpense, getCards } from '@/lib/store';
import CurrencyInput from '@/components/CurrencyInput';
import DatePicker from '@/components/DatePicker';
import CategorySelect from '@/components/CategorySelect';
import NumberStepper from '@/components/ui/number-stepper';

// ─── Tipos internos ───────────────────────────────────────────────────────────
type TxType   = 'expense' | 'income';
// 'card' é um valor especial interno (não é PaymentMethod do tipo)
type MethodVal = PaymentMethod | 'card';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultType?: TxType;
  onAdded?: () => void;
}

// ─── Ícones dos métodos (Lucide) ──────────────────────────────────────────────
const METHOD_ICON: Record<PaymentMethod, React.ReactNode> = {
  pix:      <Zap size={18} />,
  cash:     <Banknote size={18} />,
  transfer: <ArrowLeftRight size={18} />,
  debit:    <CardIcon size={18} />,
  boleto:   <FileText size={18} />,
  other:    <MoreHorizontal size={18} />,
};

// ─── Helper: data de compra correta para o cartão ─────────────────────────────
function computePurchaseDate(card: CreditCard, currInst: number): string {
  const closing      = card.closingDay ?? 10;
  const due          = card.dueDay ?? (closing + 7);
  const cur          = getCurrentMonth();
  const billingMonth = addMonths(cur, -(currInst - 1));

  // Se dueDay < closingDay, getBillingMonth aplica +1. Para cair em billingMonth,
  // a compra deve ser no mês anterior.
  const purchaseMonth = due < closing
    ? addMonths(billingMonth, -1)
    : billingMonth;

  const [y, m] = purchaseMonth.split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function UnifiedTransactionDialog({
  open, onOpenChange, defaultType = 'expense', onAdded,
}: Props) {
  const [type, setType]           = useState<TxType>(defaultType);
  const [name, setName]           = useState('');
  const [amountCents, setAmountCents] = useState(0);
  const [category, setCategory]   = useState<ExpenseCategory | IncomeCategory>('other');
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0]);

  // Método: 'card' = cartão de crédito (especial), outros = PaymentMethod
  const [method, setMethod]       = useState<MethodVal>('pix');

  // Campos de cartão
  const [cards, setCards]         = useState<CreditCard[]>([]);
  const [cardId, setCardId]       = useState('');
  const [totalInst, setTotalInst] = useState(1);
  const [currInst, setCurrInst]   = useState(1);
  const [useInstRef, setUseInstRef] = useState(false);
  const [instCents, setInstCents] = useState(0);
  const lastEdited = useRef<'total' | 'inst'>('total');
  const [saving, setSaving]       = useState(false);

  const isCard   = type === 'expense' && method === 'card';
  const isIncome = type === 'income';

  // ── Reset ao abrir ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setName('');
    setAmountCents(0);
    setInstCents(0);
    setCategory(defaultType === 'income' ? 'salary' : 'other');
    setDate(new Date().toISOString().split('T')[0]);
    setMethod('pix');
    setCardId('');
    setTotalInst(1);
    setCurrInst(1);
    setUseInstRef(false);
    lastEdited.current = 'total';
  }, [open, defaultType]);

  // ── Troca de tipo ─────────────────────────────────────────────────────────
  const handleTypeChange = (t: TxType) => {
    setType(t);
    setCategory(t === 'income' ? 'salary' : 'other');
    if (t === 'income' && method === 'card') setMethod('pix');
  };

  // ── Carrega cartões quando entra em modo card ─────────────────────────────
  useEffect(() => {
    if (isCard && cards.length === 0) {
      getCards().then(c => {
        setCards(c);
        if (c.length > 0) setCardId(c[0].id);
      });
    }
  }, [isCard]);

  // ── Sincronia valor total ↔ parcela ───────────────────────────────────────
  const handleTotalChange = (raw: string) => {
    lastEdited.current = 'total';
    const cents = raw ? Math.round(parseFloat(raw) * 100) : 0;
    setAmountCents(cents);
    if (totalInst > 1) setInstCents(Math.round(cents / totalInst));
  };

  const handleInstChange = (raw: string) => {
    lastEdited.current = 'inst';
    const cents = raw ? Math.round(parseFloat(raw) * 100) : 0;
    setInstCents(cents);
    setAmountCents(cents * totalInst);
  };

  useEffect(() => {
    if (totalInst === 1) { setInstCents(amountCents); return; }
    if (lastEdited.current === 'total') {
      setInstCents(Math.round(amountCents / totalInst));
    } else {
      setAmountCents(instCents * totalInst);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalInst]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!name.trim())      { toast.error('Informe o nome'); return; }
    if (!amountCents)      { toast.error('Informe o valor'); return; }
    if (isCard && !cardId) { toast.error('Selecione o cartão'); return; }

    setSaving(true);
    try {
      if (isCard) {
        const card      = cards.find(c => c.id === cardId)!;
        const finalDate = useInstRef && totalInst > 1
          ? computePurchaseDate(card, currInst)
          : date;

        const expense: Expense = {
          id:           generateId(),
          cardId,
          name,
          totalAmount:  amountCents / 100,
          installments: totalInst,
          category:     category as ExpenseCategory,
          date:         finalDate,
        };
        await addExpense(expense);
        const instFmt = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
        const desc = totalInst > 1
          ? `${totalInst}x de R$ ${instFmt(instCents)}${useInstRef ? ` · parcela ${currInst}/${totalInst} este mês` : ''}`
          : undefined;
        toast.success(`${name} adicionado!`, { description: desc });
      } else {
        const tx: VariableTransaction = {
          id:            generateId(),
          name,
          amount:        amountCents / 100,
          type,
          paymentMethod: method as PaymentMethod, // 'card' nunca chega aqui
          category:      category as ExpenseCategory | IncomeCategory,
          date,
        };
        await addVariableTransaction(tx);
        toast.success(`${name} ${type === 'income' ? 'recebido' : 'registrado'}!`);
      }

      onAdded?.();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao registrar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const accentGrad = isIncome
    ? 'linear-gradient(135deg, hsl(152 69% 45%), hsl(192 80% 50%))'
    : 'linear-gradient(135deg, hsl(0 72% 51%), hsl(25 95% 53%))';

  // Todos os métodos variáveis (PaymentMethod completo, sem filtrar nada)
  const allVarMethods = Object.entries(PAYMENT_METHOD_CONFIG) as [PaymentMethod, { label: string }][];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm rounded-3xl p-0 overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {isIncome ? 'Registrar receita' : isCard ? 'Gasto no cartão' : 'Registrar gasto'}
            </DialogTitle>
          </DialogHeader>

          {/* Toggle tipo */}
          <div className="grid grid-cols-2 gap-2 bg-secondary rounded-xl p-1 mt-3">
            {(['expense', 'income'] as TxType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all',
                  type === t ? 'text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
                style={type === t ? { background: t === 'expense'
                  ? 'linear-gradient(135deg, hsl(0 72% 51%), hsl(25 95% 53%))'
                  : 'linear-gradient(135deg, hsl(152 69% 45%), hsl(192 80% 50%))',
                } : {}}
              >
                {t === 'expense' ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
                {t === 'expense' ? 'Despesa' : 'Receita'}
              </button>
            ))}
          </div>
        </div>

        {/* Formulário */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">

          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {isIncome ? 'Descrição do recebimento' : 'Descrição do gasto'}
            </Label>
            <input
              type="text"
              placeholder={isIncome ? 'Ex: Salário, Freela...' : 'Ex: Mercado, Netflix...'}
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              className="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 border-border"
            />
          </div>

          {/* Valor total */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor {isCard && totalInst > 1 ? 'total' : ''} (R$)</Label>
            <CurrencyInput
              value={amountCents ? String(amountCents / 100) : ''}
              onChange={handleTotalChange}
              className="bg-secondary border-border"
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <CategorySelect
              type={isIncome ? 'income' : 'expense'}
              value={category}
              onChange={v => setCategory(v as any)}
            />
          </div>

          {/* ── Método (só despesa) ─────────────────────────────────────── */}
          {!isIncome && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Método de pagamento</Label>
              <div className="grid grid-cols-3 gap-2">

                {/* Cartão de crédito */}
                <button
                  type="button"
                  onClick={() => setMethod('card')}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all',
                    method === 'card'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-muted-foreground/40',
                  )}
                >
                  <CardIcon size={16} />
                  Cartão
                </button>

                {/* Métodos variáveis — todos os PaymentMethod */}
                {allVarMethods.map(([k, cfg]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMethod(k)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all',
                      method === k
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-muted-foreground/40',
                    )}
                  >
                    {METHOD_ICON[k]}
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Método income — select */}
          {isIncome && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Como recebeu</Label>
              <Select value={method as string} onValueChange={v => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allVarMethods.map(([k, cfg]) => (
                    <SelectItem key={k} value={k}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── Campos de cartão ─────────────────────────────────────────── */}
          <AnimatePresence>
            {isCard && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-3"
              >
                {/* Seletor de cartão */}
                {cards.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Cartão</Label>
                    <Select value={cardId} onValueChange={setCardId}>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue placeholder="Selecione o cartão" />
                      </SelectTrigger>
                      <SelectContent>
                        {cards.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Parcelas */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Número de parcelas</Label>
                  <Select
                    value={String(totalInst)}
                    onValueChange={v => {
                      const n = parseInt(v);
                      setTotalInst(n);
                      setCurrInst(Math.min(currInst, n));
                    }}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => i + 1).map(n => (
                        <SelectItem key={n} value={String(n)}>
                          {n === 1
                            ? 'À vista'
                            : `${n}x${amountCents > 0 ? ` · R$ ${((amountCents / n) / 100).toFixed(2).replace('.', ',')}` : ''}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Valor por parcela */}
                {totalInst > 1 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Valor por parcela (R$)</Label>
                    <CurrencyInput
                      value={instCents ? String(instCents / 100) : ''}
                      onChange={handleInstChange}
                      className="bg-secondary border-border"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Total: R$ {(amountCents / 100).toFixed(2).replace('.', ',')} em {totalInst}x
                    </p>
                  </div>
                )}

                {/* Referência de parcela */}
                {totalInst > 1 && (
                  <div className="bg-secondary rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium">Parcela de referência</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Informe qual parcela cai neste mês
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUseInstRef(v => !v)}
                        className={cn(
                          'relative w-10 rounded-full transition-colors shrink-0',
                          useInstRef ? 'bg-primary' : 'bg-muted',
                        )}
                        style={{ height: '22px' }}
                      >
                        <span
                          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
                          style={{ left: useInstRef ? '22px' : '2px' }}
                        />
                      </button>
                    </div>
                    {useInstRef && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Parcela atual:</span>
                        <NumberStepper
                          value={currInst}
                          min={1}
                          max={totalInst}
                          onChange={v => setCurrInst(v)}
                        />
                        <span className="text-xs text-muted-foreground">de {totalInst}</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Data (oculta quando parcela ref ativa no cartão) */}
          {!(isCard && useInstRef) && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <Button
            className="w-full h-11 rounded-2xl font-semibold text-sm text-white"
            style={{ background: accentGrad }}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving
              ? <Loader2 size={16} className="animate-spin" />
              : isIncome ? 'Registrar receita'
              : isCard   ? 'Adicionar ao cartão'
              :            'Registrar gasto'
            }
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}