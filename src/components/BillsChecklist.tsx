// src/components/BillsChecklist.tsx
//
// Checklist mensal de contas com atualização otimista:
//  - Ganhos fixos   → marcar como recebido (receivedMonths)
//  - Gastos fixos   → marcar como pago     (paidMonths)
//  - Faturas cartão → marcar como paga + registrar valor real (upsertInvoice)
//
// Usa estado local otimista para feedback imediato — não depende do ciclo
// de refresh do pai para atualizar a UI.

import { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, CreditCard as CardIcon,
  ArrowUpCircle, ArrowDownCircle, ChevronDown, ChevronUp,
  Check, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/helpers';
import {
  updateFixedExpense, updateIncome,
  computeInstallmentsForMonth, CardInvoice,
  upsertInvoice,
} from '@/lib/store';
import { CreditCard as CardType, FixedExpense, FixedIncome, Expense } from '@/lib/types';
import { toast } from 'sonner';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  month: string;
  fixedExpenses: FixedExpense[];
  incomes: FixedIncome[];
  cards: CardType[];
  expenses: Expense[];
  invoices: CardInvoice[];
  onUpdated: () => void | Promise<void>;
}

// ─── Input inline de valor da fatura ─────────────────────────────────────────

function CardAmountInput({
  calculated,
  current,
  onSave,
  onCancel,
}: {
  calculated: number;
  current: number;
  onSave: (v: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [raw, setRaw]     = useState(current > 0 ? String(current).replace('.', ',') : '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = async () => {
    const parsed = parseFloat(raw.replace(',', '.'));
    if (!raw.trim() || isNaN(parsed) || parsed <= 0) {
      toast.error('Digite um valor válido');
      return;
    }
    setSaving(true);
    await onSave(parsed);
    setSaving(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="pt-1">
      <p className="text-[10px] text-muted-foreground mb-1.5">
        Quanto você pagou? (estimado: {formatCurrency(calculated)})
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            R$
          </span>
          <input
            ref={inputRef}
            value={raw}
            onChange={e => setRaw(e.target.value)}
            onKeyDown={handleKey}
            placeholder={calculated.toFixed(2).replace('.', ',')}
            className="w-full pl-8 pr-2 py-1.5 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
        >
          <Check size={14} />
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="w-8 h-8 rounded-lg bg-secondary text-muted-foreground hover:bg-secondary/60 flex items-center justify-center transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BillsChecklist({
  month, fixedExpenses, incomes, cards, expenses, invoices, onUpdated,
}: Props) {
  const [collapsed, setCollapsed]         = useState(false);
  const [loadingId, setLoadingId]         = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  // Estado otimista: sobrepõe props enquanto o servidor confirma
  const [paidSet,     setPaidSet]     = useState<Set<string>>(new Set());
  const [receivedSet, setReceivedSet] = useState<Set<string>>(new Set());
  const [cardActuals, setCardActuals] = useState<Record<string, number>>({});

  // Sincroniza estado otimista com props quando chegam dados frescos do servidor
  useEffect(() => {
    setPaidSet(new Set(fixedExpenses.filter(f => f.paidMonths.includes(month)).map(f => f.id)));
  }, [fixedExpenses, month]);

  useEffect(() => {
    setReceivedSet(new Set(incomes.filter(i => i.receivedMonths.includes(month)).map(i => i.id)));
  }, [incomes, month]);

  useEffect(() => {
    const map: Record<string, number> = {};
    for (const inv of invoices) {
      map[inv.cardId] = inv.actualAmount;
    }
    setCardActuals(map);
  }, [invoices]);

  // ── Faturas de cartão ─────────────────────────────────────────────────────
  const installments = useMemo(
    () => computeInstallmentsForMonth(expenses, cards, month),
    [expenses, cards, month],
  );

  const cardItems = useMemo(() =>
    cards.flatMap(card => {
      const calculated = installments
        .filter(i => i.cardId === card.id)
        .reduce((s, i) => s + i.amount, 0);
      if (calculated === 0) return [];
      const actual  = cardActuals[card.id] ?? 0;
      return [{
        id: card.id, name: `Fatura ${card.name}`,
        calculated, actual,
        isPaid: actual > 0,
        dueDay: card.dueDay,
      }];
    }),
  [cards, installments, cardActuals]);

  // ── Gastos fixos ──────────────────────────────────────────────────────────
  const expenseItems = useMemo(() =>
    fixedExpenses.map(fe => ({
      id: fe.id, name: fe.name, amount: fe.amount,
      dueDay: 99,
      isPaid: paidSet.has(fe.id),
    })),
  [fixedExpenses, paidSet]);

  // ── Ganhos fixos ──────────────────────────────────────────────────────────
  const incomeItems = useMemo(() =>
    incomes.map(inc => ({
      id: inc.id, name: inc.name, amount: inc.amount,
      receiveDay: inc.receiveDay ?? 1,
      isReceived: receivedSet.has(inc.id),
    })),
  [incomes, receivedSet]);

  // ── Totais ────────────────────────────────────────────────────────────────
  // Usa o valor real pago quando disponível (actual), senão usa estimado (calculated)
  const totalExpense = useMemo(() =>
    expenseItems.reduce((s, i) => s + i.amount, 0) +
    cardItems.reduce((s, i) => s + (i.actual > 0 ? i.actual : i.calculated), 0),
  [expenseItems, cardItems]);

  const totalIncome = useMemo(() =>
    incomeItems.reduce((s, i) => s + i.amount, 0),
  [incomeItems]);

  const paidExpense = useMemo(() =>
    expenseItems.filter(i => i.isPaid).reduce((s, i) => s + i.amount, 0) +
    cardItems.filter(i => i.isPaid).reduce((s, i) => s + (i.actual || i.calculated), 0),
  [expenseItems, cardItems]);

  const receivedIncome = useMemo(() =>
    incomeItems.filter(i => i.isReceived).reduce((s, i) => s + i.amount, 0),
  [incomeItems]);

  const currentBalance  = receivedIncome - paidExpense;
  const expectedBalance = totalIncome - totalExpense;

  // ── Progresso ─────────────────────────────────────────────────────────────
  const totalBills  = expenseItems.length + cardItems.length;
  const paidBills   = expenseItems.filter(i => i.isPaid).length
                    + cardItems.filter(i => i.isPaid).length;
  const progress    = totalBills > 0 ? (paidBills / totalBills) * 100 : 0;
  const receivedCnt = incomeItems.filter(i => i.isReceived).length;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const toggleFixedExpense = async (id: string, isPaid: boolean) => {
    const item = fixedExpenses.find(f => f.id === id);
    if (!item || loadingId) return;

    // Atualização otimista imediata
    setPaidSet(prev => {
      const next = new Set(prev);
      isPaid ? next.delete(id) : next.add(id);
      return next;
    });

    setLoadingId(id);
    const newPaid = isPaid
      ? item.paidMonths.filter(m => m !== month)
      : [...item.paidMonths, month];
    try {
      await updateFixedExpense(id, { paidMonths: newPaid });
      toast.success(isPaid ? 'Marcado como pendente' : 'Pago ✓');
      await onUpdated();
    } catch {
      // Reverte o otimista em caso de erro
      setPaidSet(prev => {
        const next = new Set(prev);
        isPaid ? next.add(id) : next.delete(id);
        return next;
      });
      toast.error('Erro ao atualizar');
    } finally {
      setLoadingId(null);
    }
  };

  const toggleIncome = async (id: string, isReceived: boolean) => {
    const item = incomes.find(i => i.id === id);
    if (!item || loadingId) return;

    // Atualização otimista imediata
    setReceivedSet(prev => {
      const next = new Set(prev);
      isReceived ? next.delete(id) : next.add(id);
      return next;
    });

    setLoadingId(id);
    const newReceived = isReceived
      ? item.receivedMonths.filter(m => m !== month)
      : [...item.receivedMonths, month];
    try {
      await updateIncome(id, { receivedMonths: newReceived });
      toast.success(isReceived ? 'Marcado como pendente' : 'Recebido ✓');
      await onUpdated();
    } catch {
      setReceivedSet(prev => {
        const next = new Set(prev);
        isReceived ? next.add(id) : next.delete(id);
        return next;
      });
      toast.error('Erro ao atualizar');
    } finally {
      setLoadingId(null);
    }
  };

  const saveCardPayment = async (cardId: string, amount: number) => {
    // Atualização otimista imediata
    setCardActuals(prev => ({ ...prev, [cardId]: amount }));
    setEditingCardId(null);
    setLoadingId(cardId);
    try {
      await upsertInvoice({ cardId, month, actualAmount: amount, notes: '' });
      toast.success('Fatura registrada ✓');
      await onUpdated();
    } catch {
      setCardActuals(prev => ({ ...prev, [cardId]: 0 }));
      toast.error('Erro ao salvar');
    } finally {
      setLoadingId(null);
    }
  };

  const clearCardPayment = async (cardId: string) => {
    const prev_actual = cardActuals[cardId] ?? 0;
    // Atualização otimista imediata
    setCardActuals(prev => ({ ...prev, [cardId]: 0 }));
    setLoadingId(cardId);
    try {
      await upsertInvoice({ cardId, month, actualAmount: 0, notes: '' });
      toast.success('Marcado como pendente');
      await onUpdated();
    } catch {
      setCardActuals(prev => ({ ...prev, [cardId]: prev_actual }));
      toast.error('Erro ao atualizar');
    } finally {
      setLoadingId(null);
    }
  };

  // ── Lista ordenada por dia ─────────────────────────────────────────────────
  const allExpenses = useMemo(() => [
    ...expenseItems.map(i => ({ ...i, type: 'fixed' as const })),
    ...cardItems.map(i => ({ ...i, type: 'card' as const, amount: i.calculated })),
  ].sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99)), [expenseItems, cardItems]);

  const sortedIncomes = useMemo(() =>
    [...incomeItems].sort((a, b) => a.receiveDay - b.receiveDay),
  [incomeItems]);

  const isEmpty = allExpenses.length === 0 && sortedIncomes.length === 0;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">

      {/* ── Cabeçalho ─── */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left select-none hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Checklist do mês</p>
            <p className="text-[10px] text-muted-foreground">
              {paidBills}/{totalBills} contas pagas · {receivedCnt}/{incomeItems.length} recebidas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: progress === 100 ? 'hsl(152 69% 45%)' : 'hsl(263 70% 58%)',
              }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground w-8 text-right tabular-nums">
            {Math.round(progress)}%
          </span>
          {collapsed
            ? <ChevronDown size={15} className="text-muted-foreground ml-1" />
            : <ChevronUp   size={15} className="text-muted-foreground ml-1" />
          }
        </div>
      </button>

      {/* ── Conteúdo ─── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* Cards de previsão */}
            <div className="px-5 pb-4 grid grid-cols-2 gap-3">
              <div className="bg-secondary/50 rounded-xl p-3 space-y-0.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Saldo atual</p>
                <p className={cn('text-base font-bold tabular-nums', currentBalance >= 0 ? 'text-emerald-400' : 'text-destructive')}>
                  {currentBalance >= 0 ? '+' : ''}{formatCurrency(currentBalance)}
                </p>
                <p className="text-[9px] text-muted-foreground">recebido − pago até agora</p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-3 space-y-0.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Previsão final</p>
                <p className={cn('text-base font-bold tabular-nums', expectedBalance >= 0 ? 'text-emerald-400' : 'text-destructive')}>
                  {expectedBalance >= 0 ? '+' : ''}{formatCurrency(expectedBalance)}
                </p>
                <p className="text-[9px] text-muted-foreground">todos ganhos − todos gastos</p>
              </div>
            </div>

            <div className="px-5 pb-5 space-y-5">
              {isEmpty && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhum ganho ou gasto cadastrado para este mês
                </p>
              )}

              {/* ── Ganhos ── */}
              {sortedIncomes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowUpCircle size={13} className="text-emerald-400 shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Entradas</span>
                    <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                      {formatCurrency(receivedIncome)} / {formatCurrency(totalIncome)}
                    </span>
                  </div>
                  {sortedIncomes.map((item, idx) => (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => toggleIncome(item.id, item.isReceived)}
                      disabled={!!loadingId}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left',
                        item.isReceived
                          ? 'bg-emerald-500/8 border-emerald-500/25'
                          : 'bg-card border-border hover:border-emerald-500/40',
                        loadingId === item.id && 'opacity-60',
                      )}
                    >
                      {item.isReceived
                        ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                        : <Circle       size={16} className="text-muted-foreground shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium truncate', item.isReceived && 'line-through text-muted-foreground')}>
                          {item.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">dia {item.receiveDay}</p>
                      </div>
                      <span className={cn('text-sm font-semibold tabular-nums shrink-0',
                        item.isReceived ? 'text-emerald-400' : 'text-foreground',
                      )}>
                        +{formatCurrency(item.amount)}
                      </span>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* ── Saídas ── */}
              {allExpenses.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowDownCircle size={13} className="text-destructive shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Saídas</span>
                    <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                      {formatCurrency(paidExpense)} / {formatCurrency(totalExpense)}
                    </span>
                  </div>

                  {allExpenses.map((item, idx) => {
                    const isCard    = item.type === 'card';
                    const cardData  = isCard ? cardItems.find(c => c.id === item.id) : null;
                    const actual    = cardData?.actual ?? 0;
                    const calc      = cardData?.calculated ?? item.amount;
                    // Três estados para faturas de cartão:
                    //   isPartial → pagou algo mas menos que o estimado (laranja)
                    //   done      → pagou o estimado ou mais (roxo)
                    //   nenhum    → ainda não pagou (vermelho)
                    const isPartial = isCard && actual > 0 && actual < calc;
                    const done      = item.isPaid && !isPartial;
                    const anyPaid   = item.isPaid; // inclui parcial
                    const isEditing = isCard && editingCardId === item.id;

                    // Cores dinâmicas por estado
                    const bgClass   = done      ? 'bg-primary/6 border-primary/25'
                                    : isPartial ? 'bg-amber-500/6 border-amber-500/25'
                                    : 'bg-card border-border';
                    const iconColor = done      ? 'text-primary'
                                    : isPartial ? 'text-amber-400'
                                    : 'text-muted-foreground';
                    const valColor  = done      ? isCard ? 'text-primary' : 'text-muted-foreground line-through'
                                    : isPartial ? 'text-amber-400'
                                    : 'text-destructive';

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={cn(
                          'rounded-xl border transition-all',
                          bgClass,
                          isCard && !anyPaid && 'hover:border-primary/30',
                          loadingId === item.id && 'opacity-60',
                        )}
                      >
                        <div
                          onClick={() => {
                            if (loadingId) return;
                            if (isCard) {
                              // Se já tem qualquer valor pago → limpa (volta a pendente)
                              // Se não tem → abre input
                              anyPaid ? clearCardPayment(item.id) : setEditingCardId(isEditing ? null : item.id);
                            } else {
                              toggleFixedExpense(item.id, done);
                            }
                          }}
                          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none rounded-xl"
                        >
                          {isCard
                            ? anyPaid
                              ? <CheckCircle2 size={16} className={cn('shrink-0', iconColor)} />
                              : <CardIcon size={15} className={cn('shrink-0', isEditing ? 'text-primary' : 'text-muted-foreground')} />
                            : done
                              ? <CheckCircle2 size={16} className="text-primary shrink-0" />
                              : <Circle size={16} className="text-muted-foreground shrink-0" />
                          }
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm font-medium truncate', done && !isCard && 'line-through text-muted-foreground')}>
                              {item.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {isCard
                                ? done
                                  ? `pago ${formatCurrency(actual)} · vence dia ${item.dueDay}`
                                  : isPartial
                                    ? `parcial ${formatCurrency(actual)} de ${formatCurrency(calc)} · vence dia ${item.dueDay} · toque para editar`
                                    : isEditing
                                      ? 'digite o valor pago...'
                                      : `estimado · vence dia ${item.dueDay} · toque para registrar`
                                : item.dueDay < 99 ? `dia ${item.dueDay}` : 'fixo mensal'
                              }
                            </p>
                          </div>
                          <span className={cn('text-sm font-semibold tabular-nums shrink-0', valColor)}>
                            -{formatCurrency(isCard && anyPaid && actual ? actual : item.amount)}
                          </span>
                        </div>

                        <AnimatePresence>
                          {isEditing && !done && (
                            <motion.div
                              key="input"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden px-3 pb-3"
                            >
                              <CardAmountInput
                                calculated={cardData?.calculated ?? 0}
                                current={cardData?.actual ?? 0}
                                onSave={v => saveCardPayment(item.id, v)}
                                onCancel={() => setEditingCardId(null)}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}