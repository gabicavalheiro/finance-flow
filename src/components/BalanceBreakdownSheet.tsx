// src/components/BalanceBreakdownSheet.tsx
//
// Painel lateral que abre ao clicar em "Saldo do mês" no Dashboard.
// Mostra de onde vem cada centavo: cartões, fixos, variáveis, receitas.

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard, ArrowDownCircle, ArrowUpCircle,
  Zap, TrendingDown, TrendingUp, Scale, ChevronRight,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { formatCurrency } from '@/lib/helpers';
import { computeInstallmentsForMonth, CardInvoice } from '@/lib/store';
import {
  CreditCard as CardType, FixedExpense, FixedIncome,
  VariableTransaction, Expense, BRAND_GRADIENTS,
} from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  open:          boolean;
  onClose:       () => void;
  month:         string;
  cards:         CardType[];
  expenses:      Expense[];
  fixedExpenses: FixedExpense[];
  incomes:       FixedIncome[];
  varTxs:        VariableTransaction[];
  invoices?:     CardInvoice[];
}

// ── Linha de item ──────────────────────────────────────────────────────────────
function Row({
  label, sub, amount, type, indent = false,
}: {
  label: string; sub?: string; amount: number;
  type: 'income' | 'expense' | 'neutral';
  indent?: boolean;
}) {
  const color =
    type === 'income'  ? 'text-emerald-400' :
    type === 'expense' ? 'text-destructive'  :
    'text-foreground';

  return (
    <div className={cn('flex items-center justify-between py-2', indent && 'pl-4 border-l border-border ml-2')}>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm truncate', indent ? 'text-muted-foreground' : 'font-medium')}>{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
      <span className={cn('text-sm font-semibold tabular-nums ml-3 shrink-0', color)}>
        {type === 'income' ? '+' : type === 'expense' ? '-' : ''}{formatCurrency(amount)}
      </span>
    </div>
  );
}

// ── Separador de grupo ────────────────────────────────────────────────────────
function GroupHeader({ label, total, type }: { label: string; total: number; type: 'income' | 'expense' }) {
  const color = type === 'income' ? 'text-emerald-400' : 'text-destructive';
  const bg    = type === 'income' ? 'bg-emerald-500/10' : 'bg-destructive/10';
  return (
    <div className={cn('flex items-center justify-between px-3 py-2 rounded-xl mt-3 mb-1', bg)}>
      <span className={cn('text-xs font-semibold uppercase tracking-wide', color)}>{label}</span>
      <span className={cn('text-sm font-bold tabular-nums', color)}>
        {type === 'income' ? '+' : '-'}{formatCurrency(total)}
      </span>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function BalanceBreakdownSheet({
  open, onClose, month,
  cards, expenses, fixedExpenses, incomes, varTxs, invoices = [],
}: Props) {

  const installments = useMemo(
    () => computeInstallmentsForMonth(expenses, cards, month),
    [expenses, cards, month],
  );

  // ── Totais por cartão (usa fatura confirmada quando disponível) ───────────
  const invoiceMap = useMemo(
    () => new Map((invoices ?? []).map(inv => [inv.cardId, inv])),
    [invoices],
  );

  const cardTotals = useMemo(() =>
    cards.map(card => {
      const confirmed = invoiceMap.get(card.id);
      const calculated = installments
        .filter(i => i.cardId === card.id)
        .reduce((s, i) => s + i.amount, 0);
      const amount = (confirmed && confirmed.actualAmount > 0)
        ? confirmed.actualAmount
        : calculated;
      const isConfirmed = !!(confirmed && confirmed.actualAmount > 0);
      return {
        card, amount, isConfirmed,
        count: installments.filter(i => i.cardId === card.id).length,
      };
    }).filter(c => c.amount > 0),
  [cards, installments, invoiceMap]);

  const totalCards = cardTotals.reduce((s, c) => s + c.amount, 0);

  // ── Gastos fixos ──────────────────────────────────────────────────────────
  const totalFixed = fixedExpenses.reduce((s, f) => s + f.amount, 0);

  // ── Variáveis ─────────────────────────────────────────────────────────────
  const varExp  = varTxs.filter(t => t.type === 'expense');
  const varInc  = varTxs.filter(t => t.type === 'income');
  const totalVarExp = varExp.reduce((s, t) => s + t.amount, 0);
  const totalVarInc = varInc.reduce((s, t) => s + t.amount, 0);

  // ── Receitas fixas ────────────────────────────────────────────────────────
  const totalFixedIncome = incomes.reduce((s, i) => s + i.amount, 0);

  // ── Totais gerais ─────────────────────────────────────────────────────────
  const totalIncome  = totalFixedIncome + totalVarInc;
  const totalExpense = totalCards + totalFixed + totalVarExp;
  const balance      = totalIncome - totalExpense;

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[92vw] sm:w-[420px] p-0 flex flex-col overflow-hidden">

        {/* Header fixo */}
        <SheetHeader className="px-5 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Scale size={18} className="text-primary" />
            Composição do Saldo
          </SheetTitle>
          <p className="text-xs text-muted-foreground">De onde vem o saldo do mês</p>
        </SheetHeader>

        {/* Saldo total em destaque */}
        <div className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Saldo do mês</p>
              <p className={cn(
                'text-3xl font-bold tabular-nums',
                balance >= 0 ? 'text-emerald-400' : 'text-destructive',
              )}>
                {formatCurrency(balance)}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground space-y-1">
              <p className="text-emerald-400 font-medium">+{formatCurrency(totalIncome)}</p>
              <p className="text-destructive font-medium">-{formatCurrency(totalExpense)}</p>
            </div>
          </div>

          {/* Barra de balanço */}
          {totalIncome > 0 && (
            <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((totalExpense / totalIncome) * 100, 100)}%`,
                  background: (totalExpense / totalIncome) > 1
                    ? 'hsl(0 72% 51%)'
                    : (totalExpense / totalIncome) > 0.85
                      ? 'hsl(38 92% 50%)'
                      : 'hsl(152 69% 45%)',
                }}
              />
            </div>
          )}
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-1">

          {/* ══ ENTRADAS ══ */}
          <GroupHeader label="Entradas" total={totalIncome} type="income" />

          {/* Receitas fixas */}
          {incomes.map((inc, i) => (
            <motion.div
              key={inc.id}
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Row
                label={inc.name}
                sub="Receita fixa"
                amount={inc.amount}
                type="income"
              />
            </motion.div>
          ))}

          {/* Receitas variáveis */}
          {varInc.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 mt-2 mb-0.5">
                <Zap size={11} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium">Receitas variáveis</span>
              </div>
              {varInc.map((tx, i) => (
                <motion.div key={tx.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
                  <Row label={tx.name} sub={tx.date.split('-').reverse().join('/')} amount={tx.amount} type="income" indent />
                </motion.div>
              ))}
            </>
          )}

          {incomes.length === 0 && varInc.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhuma receita registrada</p>
          )}

          {/* ══ SAÍDAS ══ */}
          <GroupHeader label="Saídas" total={totalExpense} type="expense" />

          {/* Cartões de crédito */}
          {cardTotals.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 mt-2 mb-0.5">
                <CreditCard size={11} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium">Cartões de crédito</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-bold">{formatCurrency(totalCards)}</span>
              </div>
              {cardTotals.map((ct, i) => (
                <motion.div key={ct.card.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                  <Row
                    label={ct.card.name}
                    sub={`${ct.isConfirmed ? '✓ fatura confirmada' : `${ct.count} lançamento${ct.count !== 1 ? 's' : ''}`} · •••• ${ct.card.lastDigits}`}
                    amount={ct.amount}
                    type="expense"
                    indent
                  />
                </motion.div>
              ))}
            </>
          )}

          {/* Gastos fixos */}
          {fixedExpenses.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 mt-3 mb-0.5">
                <ArrowDownCircle size={11} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium">Gastos fixos</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-bold">{formatCurrency(totalFixed)}</span>
              </div>
              {fixedExpenses.map((fe, i) => (
                <motion.div key={fe.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
                  <Row label={fe.name} sub="Fixo mensal" amount={fe.amount} type="expense" indent />
                </motion.div>
              ))}
            </>
          )}

          {/* Gastos variáveis */}
          {varExp.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 mt-3 mb-0.5">
                <Zap size={11} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium">Gastos variáveis</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-bold">{formatCurrency(totalVarExp)}</span>
              </div>
              {varExp.map((tx, i) => (
                <motion.div key={tx.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
                  <Row label={tx.name} sub={tx.date.split('-').reverse().join('/')} amount={tx.amount} type="expense" indent />
                </motion.div>
              ))}
            </>
          )}

          {totalExpense === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhum gasto registrado</p>
          )}

          {/* ══ Resumo numérico ══ */}
          <div className="mt-6 pt-4 border-t border-border space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <TrendingUp size={12} className="text-emerald-400" /> Total receitas
              </span>
              <span className="font-semibold text-emerald-400 tabular-nums">+{formatCurrency(totalIncome)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <TrendingDown size={12} className="text-destructive" /> Total gastos
              </span>
              <span className="font-semibold text-destructive tabular-nums">-{formatCurrency(totalExpense)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-border">
              <span className="font-bold flex items-center gap-1.5">
                <Scale size={13} className="text-primary" /> Saldo
              </span>
              <span className={cn('font-bold tabular-nums', balance >= 0 ? 'text-emerald-400' : 'text-destructive')}>
                {formatCurrency(balance)}
              </span>
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}