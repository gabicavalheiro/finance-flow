// src/components/BillsChecklist.tsx
import { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, CreditCard as CardIcon,
  ArrowUpCircle, ArrowDownCircle, ChevronDown, ChevronUp,
  Check, X, ListChecks, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/helpers';
import { invoicePaymentStatus, invoicePaidAmount } from '@/lib/invoiceStatus';
import {
  updateFixedExpense, updateIncome,
  computeInstallmentsForMonth, CardInvoice,
  upsertInvoice,
} from '@/lib/store';
import { CreditCard as CardType, FixedExpense, FixedIncome, Expense } from '@/lib/types';
import { toast } from 'sonner';

interface Props {
  month: string;
  fixedExpenses: FixedExpense[];
  incomes: FixedIncome[];
  cards: CardType[];
  expenses: Expense[];
  invoices: CardInvoice[];
  onUpdated: () => void | Promise<void>;
}

function CardAmountInput({
  calculated, current, onSave, onCancel, onClear,
}: {
  calculated: number; current: number;
  onSave: (v: number) => Promise<void>; onCancel: () => void;
  onClear?: () => void;
}) {
  const [raw, setRaw]       = useState(current > 0 ? String(current).replace('.', ',') : '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const handleSave = async () => {
    const parsed = parseFloat(raw.replace(',', '.'));
    if (!raw.trim() || isNaN(parsed) || parsed <= 0) { toast.error('Digite um valor válido'); return; }
    setSaving(true);
    await onSave(parsed);
    setSaving(false);
  };

  return (
    <div className="pt-2">
      <p className="text-[10px] text-muted-foreground mb-1.5">
        Quanto você pagou? (fatura: {formatCurrency(calculated)}) — pode ser parcial
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
          <input
            ref={inputRef}
            value={raw}
            onChange={e => setRaw(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
            placeholder={calculated.toFixed(2).replace('.', ',')}
            className="w-full pl-8 pr-2 py-1.5 text-sm rounded-xl text-white outline-none focus:ring-1 focus:ring-white/30"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
          />
        </div>
        <button onClick={handleSave} disabled={saving}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
          style={{ background: 'hsl(152 69% 45% / 0.15)' }}>
          <Check size={14} className="text-emerald-300" />
        </button>
        <button onClick={onCancel} disabled={saving}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0"
          style={{ background: 'hsl(var(--border))' }}>
          <X size={14} className="text-muted-foreground" />
        </button>
      </div>
      {onClear && (
        <button onClick={onClear} disabled={saving}
          className="mt-2 text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50">
          Marcar como pendente
        </button>
      )}
    </div>
  );
}

export default function BillsChecklist({
  month, fixedExpenses, incomes, cards, expenses, invoices, onUpdated,
}: Props) {
  const [collapsed, setCollapsed]       = useState(false);
  const [loadingId, setLoadingId]       = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  const [paidSet,     setPaidSet]     = useState<Set<string>>(new Set());
  const [receivedSet, setReceivedSet] = useState<Set<string>>(new Set());
  const [cardPaid, setCardPaid] = useState<Record<string, number>>({});

  useEffect(() => {
    setPaidSet(new Set(fixedExpenses.filter(f => f.paidMonths.includes(month)).map(f => f.id)));
  }, [fixedExpenses, month]);

  useEffect(() => {
    setReceivedSet(new Set(incomes.filter(i => i.receivedMonths.includes(month)).map(i => i.id)));
  }, [incomes, month]);

  useEffect(() => {
    const map: Record<string, number> = {};
    for (const inv of invoices) map[inv.cardId] = invoicePaidAmount(inv);
    setCardPaid(map);
  }, [invoices]);

  // Valor FINAL da fatura informado em Faturas (0 = não informado → usa o calculado)
  const cardFinals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inv of invoices) map[inv.cardId] = inv.actualAmount > 0 ? inv.actualAmount : 0;
    return map;
  }, [invoices]);

  const installments = useMemo(
    () => computeInstallmentsForMonth(expenses, cards, month),
    [expenses, cards, month],
  );

  const cardItems = useMemo(() =>
    cards.flatMap(card => {
      const calculated = installments.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
      if (calculated === 0) return [];
      const finalAmount = cardFinals[card.id] > 0 ? cardFinals[card.id] : calculated;
      const paid   = cardPaid[card.id] ?? 0;
      const status = invoicePaymentStatus(paid, finalAmount);
      return [{
        id: card.id, name: `Fatura ${card.name}`, calculated, finalAmount, paid,
        isPaid: paid > 0, isPartial: status === 'partial', status, dueDay: card.dueDay,
      }];
    }),
  [cards, installments, cardPaid, cardFinals]);

  const expenseItems = useMemo(() =>
    fixedExpenses.map(fe => ({ id: fe.id, name: fe.name, amount: fe.amount, dueDay: 99, isPaid: paidSet.has(fe.id) })),
  [fixedExpenses, paidSet]);

  const incomeItems = useMemo(() =>
    incomes.map(inc => ({ id: inc.id, name: inc.name, amount: inc.amount, receiveDay: inc.receiveDay ?? 1, isReceived: receivedSet.has(inc.id) })),
  [incomes, receivedSet]);

  const totalExpense    = useMemo(() => expenseItems.reduce((s, i) => s + i.amount, 0) + cardItems.reduce((s, i) => s + i.finalAmount, 0), [expenseItems, cardItems]);
  const totalIncome     = useMemo(() => incomeItems.reduce((s, i) => s + i.amount, 0), [incomeItems]);
  const paidExpense     = useMemo(() => expenseItems.filter(i => i.isPaid).reduce((s, i) => s + i.amount, 0) + cardItems.reduce((s, i) => s + i.paid, 0), [expenseItems, cardItems]);
  const receivedIncome  = useMemo(() => incomeItems.filter(i => i.isReceived).reduce((s, i) => s + i.amount, 0), [incomeItems]);
  const currentBalance  = receivedIncome - paidExpense;
  const expectedBalance = totalIncome - totalExpense;

  const totalBills  = expenseItems.length + cardItems.length;
  const paidBills   = expenseItems.filter(i => i.isPaid).length + cardItems.filter(i => i.isPaid && !i.isPartial).length;
  const progress    = totalBills > 0 ? (paidBills / totalBills) * 100 : 0;
  const receivedCnt = incomeItems.filter(i => i.isReceived).length;

  const allExpenses = useMemo(() => [
    ...expenseItems.map(i => ({ ...i, type: 'fixed' as const })),
    ...cardItems.map(i => ({ ...i, type: 'card' as const, amount: i.finalAmount })),
  ].sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99)), [expenseItems, cardItems]);

  const sortedIncomes = useMemo(() => [...incomeItems].sort((a, b) => a.receiveDay - b.receiveDay), [incomeItems]);
  const isEmpty = allExpenses.length === 0 && sortedIncomes.length === 0;

  const toggleFixedExpense = async (id: string, isPaid: boolean) => {
    const item = fixedExpenses.find(f => f.id === id);
    if (!item || loadingId) return;
    setPaidSet(prev => { const n = new Set(prev); isPaid ? n.delete(id) : n.add(id); return n; });
    setLoadingId(id);
    const newPaid = isPaid ? item.paidMonths.filter(m => m !== month) : [...item.paidMonths, month];
    try { await updateFixedExpense(id, { paidMonths: newPaid }); toast.success(isPaid ? 'Pendente' : 'Pago ✓'); await onUpdated(); }
    catch { setPaidSet(prev => { const n = new Set(prev); isPaid ? n.add(id) : n.delete(id); return n; }); toast.error('Erro'); }
    finally { setLoadingId(null); }
  };

  const toggleIncome = async (id: string, isReceived: boolean) => {
    const item = incomes.find(i => i.id === id);
    if (!item || loadingId) return;
    setReceivedSet(prev => { const n = new Set(prev); isReceived ? n.delete(id) : n.add(id); return n; });
    setLoadingId(id);
    const newReceived = isReceived ? item.receivedMonths.filter(m => m !== month) : [...item.receivedMonths, month];
    try { await updateIncome(id, { receivedMonths: newReceived }); toast.success(isReceived ? 'Pendente' : 'Recebido ✓'); await onUpdated(); }
    catch { setReceivedSet(prev => { const n = new Set(prev); isReceived ? n.add(id) : n.delete(id); return n; }); toast.error('Erro'); }
    finally { setLoadingId(null); }
  };

  const saveCardPayment = async (cardId: string, amount: number) => {
    const before = cardPaid[cardId] ?? 0;
    setCardPaid(prev => ({ ...prev, [cardId]: amount }));
    setEditingCardId(null);
    setLoadingId(cardId);
    // Só o valor PAGO muda — o valor final da fatura (Faturas) fica como está
    try { await upsertInvoice({ cardId, month, paidAmount: amount }); toast.success('Pagamento registrado ✓'); await onUpdated(); }
    catch { setCardPaid(prev => ({ ...prev, [cardId]: before })); toast.error('Erro ao salvar'); }
    finally { setLoadingId(null); }
  };

  const clearCardPayment = async (cardId: string) => {
    const prev = cardPaid[cardId] ?? 0;
    setCardPaid(p => ({ ...p, [cardId]: 0 }));
    setLoadingId(cardId);
    try { await upsertInvoice({ cardId, month, paidAmount: 0 }); toast.success('Pendente'); await onUpdated(); }
    catch { setCardPaid(p => ({ ...p, [cardId]: prev })); toast.error('Erro'); }
    finally { setLoadingId(null); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="relative rounded-3xl overflow-hidden"
      style={{
        background: 'hsl(0 0% 60% / 0.05)',
        border: '1px solid hsl(0 0% 60% / 0.15)',
      }}
    >

      {/* Brilho diagonal */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'none' }} />

      {/* ── Cabeçalho ── */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="relative z-10 w-full flex items-center justify-between px-5 py-4 text-left select-none transition-colors"
        style={{ background: collapsed ? 'transparent' : 'transparent' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'hsl(0 0% 60% / 0.12)', backdropFilter: 'blur(8px)' }}>
            <ListChecks size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Checklist do mês</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {paidBills}/{totalBills} pagas · {receivedCnt}/{incomeItems.length} recebidas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Barra de progresso */}
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 rounded-full overflow-hidden bg-secondary">
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
                style={{ background: progress === 100 ? 'hsl(152 69% 50%)' : 'hsl(0 0% 55%)' }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums w-8">{Math.round(progress)}%</span>
          </div>
          {collapsed
            ? <ChevronDown size={15} className="text-muted-foreground" />
            : <ChevronUp   size={15} className="text-muted-foreground" />}
        </div>
      </button>

      {/* ── Conteúdo ── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden relative z-10"
          >
            {/* Mini cards saldo atual / previsão */}
            <div className="px-5 pb-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-3.5 space-y-1"
                style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Saldo atual</p>
                <p className={cn('text-base font-bold tabular-nums', currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {currentBalance >= 0 ? '+' : ''}{formatCurrency(currentBalance)}
                </p>
                <p className="text-[9px] text-muted-foreground/60">recebido − pago até agora</p>
              </div>
              <div className="rounded-2xl p-3.5 space-y-1"
                style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Previsão final</p>
                <p className={cn('text-base font-bold tabular-nums', expectedBalance >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {expectedBalance >= 0 ? '+' : ''}{formatCurrency(expectedBalance)}
                </p>
                <p className="text-[9px] text-muted-foreground/60">todos ganhos − todos gastos</p>
              </div>
            </div>

            <div className="px-5 pb-5 space-y-5">
              {isEmpty && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhum ganho ou gasto cadastrado para este mês
                </p>
              )}

              {/* ── Entradas ── */}
              {sortedIncomes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUpCircle size={13} className="text-emerald-400 shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Entradas</span>
                    <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                      {formatCurrency(receivedIncome)} / {formatCurrency(totalIncome)}
                    </span>
                  </div>
                  {sortedIncomes.map((item, idx) => (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                      onClick={() => toggleIncome(item.id, item.isReceived)}
                      disabled={!!loadingId}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl border transition-all text-left',
                        loadingId === item.id && 'opacity-60',
                      )}
                      style={{
                        background: item.isReceived ? 'hsl(152 69% 45% / 0.1)' : 'hsl(var(--secondary) / 0.5)',
                        border: item.isReceived ? '1px solid hsl(152 69% 45% / 0.3)' : '1px solid hsl(var(--border))',
                      }}
                    >
                      {item.isReceived
                        ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                        : <Circle       size={16} className="text-muted-foreground/40 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium truncate text-foreground', item.isReceived && 'line-through text-muted-foreground')}>
                          {item.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">dia {item.receiveDay}</p>
                      </div>
                      <span className={cn('text-sm font-bold tabular-nums shrink-0', item.isReceived ? 'text-emerald-500' : 'text-foreground')}>
                        +{formatCurrency(item.amount)}
                      </span>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* ── Saídas ── */}
              {allExpenses.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownCircle size={13} className="text-red-400 shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Saídas</span>
                    <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                      {formatCurrency(paidExpense)} / {formatCurrency(totalExpense)}
                    </span>
                  </div>

                  {allExpenses.map((item, idx) => {
                    const isCard   = item.type === 'card';
                    const cardData = isCard ? cardItems.find(c => c.id === item.id) : null;
                    const paid     = cardData?.paid ?? 0;
                    const calc     = cardData?.calculated ?? 0;
                    const finalAmt = cardData?.finalAmount ?? calc;
                    const isEditing = editingCardId === item.id;
                    const isPartial = !!cardData?.isPartial;
                    const isOver    = cardData?.status === 'over';

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                        className="rounded-2xl overflow-hidden transition-all"
                        style={{
                          background: isPartial ? 'hsl(38 92% 50% / 0.10)' : item.isPaid ? 'hsl(0 72% 51% / 0.08)' : 'hsl(var(--secondary) / 0.5)',
                          border: isPartial ? '1px solid hsl(38 92% 50% / 0.45)' : item.isPaid ? '1px solid hsl(0 72% 51% / 0.2)' : '1px solid hsl(var(--border))',
                        }}
                      >
                        <button
                          onClick={() => {
                            if (isCard && (!item.isPaid || isPartial)) { setEditingCardId(isEditing ? null : item.id); }
                            else if (isCard && item.isPaid) { clearCardPayment(item.id); }
                            else { toggleFixedExpense(item.id, item.isPaid); }
                          }}
                          disabled={!!loadingId}
                          className="w-full flex items-center gap-3 px-3.5 py-3 text-left transition-all"
                        >
                          {isPartial
                            ? <AlertCircle size={16} className="text-amber-400 shrink-0" />
                            : item.isPaid
                              ? <CheckCircle2 size={16} className="text-red-400 shrink-0" />
                              : <Circle       size={16} className="text-muted-foreground/40 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {isCard && <CardIcon size={11} className="text-muted-foreground shrink-0" />}
                              <p className={cn('text-sm font-medium truncate text-foreground', item.isPaid && !isPartial && 'line-through text-muted-foreground')}>
                                {item.name}
                              </p>
                              {isPartial && (
                                <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-400">
                                  Pago parcial
                                </span>
                              )}
                              {isOver && (
                                <span className="shrink-0 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-400">
                                  Pago a mais
                                </span>
                              )}
                            </div>
                            {isPartial && (
                              <p className="text-[10px] text-amber-400/90 mt-0.5 tabular-nums">
                                faltam {formatCurrency(finalAmt - paid)} de {formatCurrency(finalAmt)} · pago {formatCurrency(paid)}
                              </p>
                            )}
                            {item.dueDay && item.dueDay !== 99 && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">vence dia {item.dueDay}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className={cn('text-sm font-bold tabular-nums', isPartial ? 'text-amber-400' : item.isPaid ? 'text-destructive' : 'text-foreground')}>
                              {isCard
                                ? formatCurrency(finalAmt)
                                : formatCurrency((item as any).amount)}
                            </p>
                            {isCard && Math.abs(finalAmt - calc) > 0.009 && (
                              <p className="text-[9px] text-muted-foreground/50 line-through tabular-nums">{formatCurrency(calc)}</p>
                            )}
                          </div>
                        </button>

                        {/* Input de valor da fatura */}
                        <AnimatePresence>
                          {isEditing && isCard && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
                              className="overflow-hidden px-3.5 pb-3"
                            >
                              <CardAmountInput
                                calculated={cardData?.finalAmount ?? 0}
                                current={cardData?.paid ?? 0}
                                onSave={v => saveCardPayment(item.id, v)}
                                onCancel={() => setEditingCardId(null)}
                                onClear={(cardData?.paid ?? 0) > 0 ? () => { setEditingCardId(null); clearCardPayment(item.id); } : undefined}
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