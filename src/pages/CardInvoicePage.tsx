// src/pages/CardInvoicePage.tsx
//
// Lançamentos de UM cartão, fatura a fatura (mês de vencimento).
// Rota: /cards/:cardId/fatura?month=YYYY-MM
//
// Mostra a lista da fatura (data da compra, descrição, categoria, parcela, valor)
// e um painel lateral com valor da fatura, status, fechamento e vencimento.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowDown, ArrowUp, CalendarX2, CalendarCheck, Download,
  Pencil, Trash2, Receipt, FileSearch, Lock, TableProperties,
} from 'lucide-react';
import MonthSelector from '@/components/MonthSelector';
import CategoryIcon from '@/components/CategoryIcon';
import EditExpenseDialog from '@/components/EditExpenseDialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useFinanceData } from '@/contexts/FinanceDataContext';
import {
  computeInstallmentsForMonth, deleteExpense, getInvoicesForMonth, CardInvoice,
} from '@/lib/store';
import { subscriptionsAsInstallments } from '@/lib/subscriptions';
import { resolveCategoryInfo } from '@/lib/customCategories';
import { cardSurface, CARD_BORDER } from '@/lib/cardStyle';
import {
  invoiceFinalAmount, invoicePaidAmount, invoicePaymentStatus, INVOICE_STATUS_LABEL,
  InvoicePaymentStatus,
} from '@/lib/invoiceStatus';
import { addMonths, formatCurrency, getCurrentMonth } from '@/lib/helpers';
import { CreditCard, Expense } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Dia limitado ao tamanho do mês (fechamento dia 31 em fevereiro → 28/29). */
function dateInMonth(ym: string, day: number): Date {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, Math.min(day, last));
}

/** Mês em que fecha a fatura que vence em `dueMonth` (mesma regra de helpers.ts). */
function closeMonthFor(dueMonth: string, card: CreditCard): string {
  return card.dueDay < card.closingDay ? addMonths(dueMonth, -1) : dueMonth;
}

const fmtDayMonth = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
const fmtShort = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtIsoDate = (iso: string) => iso.split('-').reverse().join('/');

const STATUS_TONE: Record<InvoicePaymentStatus, string> = {
  pending: 'text-foreground',
  paid:    'text-emerald-400',
  partial: 'text-amber-400',
  over:    'text-sky-400',
};

interface Row {
  key:         string;
  date:        string;       // YYYY-MM-DD (data da compra) — '' quando não se aplica
  name:        string;
  category:    string;
  installment: string;       // "2/5" ou "À vista"
  amount:      number;
  expense?:    Expense;      // ausente para assinaturas
  isSubscription: boolean;
}

function exportCsv(rows: Row[], card: CreditCard, month: string) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [
    ['Data', 'Descrição', 'Categoria', 'Parcela', 'Valor'].join(';'),
    ...rows.map(r => [
      r.date ? fmtIsoDate(r.date) : '',
      esc(r.name),
      esc(resolveCategoryInfo(r.category).label),
      r.installment,
      r.amount.toFixed(2).replace('.', ','),
    ].join(';')),
  ];
  // BOM para o Excel abrir acentos corretamente
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fatura-${card.name.toLowerCase().replace(/\s+/g, '-')}-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function CardInvoicePage() {
  const { cardId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { cards, expenses, subscriptions, loading, version, refresh } = useFinanceData();

  const monthParam = params.get('month') ?? '';
  const month = MONTH_RE.test(monthParam) ? monthParam : getCurrentMonth();
  const setMonth = (m: string) => setParams({ month: m }, { replace: true });

  const [sortAsc, setSortAsc]       = useState(true);
  const [invoice, setInvoice]       = useState<CardInvoice | undefined>();
  const [editing, setEditing]       = useState<Expense | null>(null);
  const [deleting, setDeleting]     = useState<Expense | null>(null);

  const card = cards.find(c => c.id === cardId);

  // Valor real/pago registrado na tela Faturas
  useEffect(() => {
    let alive = true;
    getInvoicesForMonth(month)
      .then(list => { if (alive) setInvoice(list.find(i => i.cardId === cardId)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [month, cardId, version]);

  const rows: Row[] = useMemo(() => {
    if (!card) return [];
    const byId = new Map(expenses.map(e => [e.id, e]));

    const fromExpenses: Row[] = computeInstallmentsForMonth(expenses, [card], month).map(inst => {
      const exp = byId.get(inst.expenseId);
      return {
        key:         `${inst.expenseId}-${inst.installmentNumber}`,
        date:        exp?.date ?? '',
        name:        inst.expenseName,
        category:    inst.category,
        installment: inst.totalInstallments > 1
          ? `${inst.installmentNumber}/${inst.totalInstallments}`
          : 'À vista',
        amount:      inst.amount,
        expense:     exp,
        isSubscription: false,
      };
    });

    const fromSubs: Row[] = subscriptionsAsInstallments(subscriptions, month)
      .filter(s => s.cardId === card.id)
      .map(s => ({
        key:         `sub-${s.expenseId}`,
        date:        '',
        name:        s.expenseName,
        category:    s.category,
        installment: 'Mensal',
        amount:      s.amount,
        isSubscription: true,
      }));

    const all = [...fromExpenses, ...fromSubs];
    all.sort((a, b) => {
      // Sem data (assinaturas) sempre no fim
      if (!a.date && !b.date) return a.name.localeCompare(b.name);
      if (!a.date) return 1;
      if (!b.date) return -1;
      return sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    });
    return all;
  }, [card, expenses, subscriptions, month, sortAsc]);

  // ── Estados de carregamento / cartão inexistente ───────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh]">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60dvh] gap-3 text-muted-foreground px-4 text-center">
        <FileSearch size={32} strokeWidth={1.2} />
        <p className="text-sm">Cartão não encontrado</p>
        <Link to="/cards" className="text-xs text-primary underline underline-offset-2">Voltar para Meus Cartões</Link>
      </div>
    );
  }

  // ── Números da fatura ──────────────────────────────────────────────────────
  const calculated  = rows.reduce((s, r) => s + r.amount, 0);
  const finalAmount = invoiceFinalAmount(invoice, calculated);
  const hasActual   = !!invoice && invoice.actualAmount > 0;
  const paid        = invoicePaidAmount(invoice);
  const status      = invoicePaymentStatus(paid, finalAmount);
  const isEmpty     = rows.length === 0;

  const closeMonth  = closeMonthFor(month, card);
  const closingDate = dateInMonth(closeMonth, card.closingDay);
  const dueDate     = dateInMonth(month, card.dueDay ?? card.closingDay);
  const periodStart = dateInMonth(addMonths(closeMonth, -1), card.closingDay);
  periodStart.setDate(periodStart.getDate() + 1);

  const statusLabel = isEmpty && !invoice
    ? 'Sem lançamentos'
    : status === 'paid' ? 'Fatura paga' : INVOICE_STATUS_LABEL[status];

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteExpense(deleting.id);
      toast.success('Gasto removido');
      setDeleting(null);
      refresh();
    } catch {
      toast.error('Erro ao remover gasto');
    }
  };

  const rowActions = (r: Row) =>
    r.expense ? (
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={() => setEditing(r.expense!)}
          aria-label={`Editar ${r.name}`}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={() => setDeleting(r.expense!)}
          aria-label={`Remover ${r.name}`}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    ) : r.isSubscription ? (
      <div className="flex justify-end">
        <Link to="/subscriptions" className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2">
          Assinaturas
        </Link>
      </div>
    ) : null;

  return (
    <div className="pb-24 md:pb-10 px-4 md:px-8 pt-6 md:pt-8 max-w-6xl mx-auto space-y-5">
      {/* Cabeçalho: voltar + seletor de cartão */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => navigate('/cards')}
          aria-label="Voltar para Meus Cartões"
          className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <Select
          value={card.id}
          onValueChange={id => navigate(`/cards/${id}/fatura?month=${month}`, { replace: true })}
        >
          <SelectTrigger
            className="h-10 w-auto min-w-[200px] rounded-full border-0 text-white font-semibold px-4 gap-2"
            style={{ background: cardSurface(card.brand, card.customGradient), border: CARD_BORDER }}
            aria-label="Trocar cartão"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cards.map(c => (
              <SelectItem key={c.id} value={c.id}>
                Cartão: {c.name} •••• {c.lastDigits}{c.active === false ? ' (bloqueado)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {card.active === false && (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-secondary text-muted-foreground">
            <Lock size={10} /> Bloqueado
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">
        {/* ── Lista de lançamentos ─────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden order-2 lg:order-1">
          <div className="p-3 border-b border-border">
            <MonthSelector month={month} onChange={setMonth} />
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              Compras de {fmtShort(periodStart)} a {fmtShort(closingDate)} · {rows.length} lançamento{rows.length !== 1 ? 's' : ''}
            </p>
          </div>

          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Receipt size={28} strokeWidth={1.2} />
              <p className="text-sm">Nenhum lançamento nesta fatura</p>
            </div>
          ) : (
            <>
              {/* Desktop: tabela */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left font-semibold px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSortAsc(v => !v)}
                          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                          aria-label={`Ordenar por data ${sortAsc ? 'decrescente' : 'crescente'}`}
                        >
                          Data {sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        </button>
                      </th>
                      <th className="text-left font-semibold px-4 py-3">Descrição</th>
                      <th className="text-left font-semibold px-4 py-3">Categoria</th>
                      <th className="text-left font-semibold px-4 py-3">Parcela</th>
                      <th className="text-right font-semibold px-4 py-3">Valor</th>
                      <th className="text-right font-semibold px-4 py-3 w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <motion.tr
                        key={r.key}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.02, 0.3) }}
                        className="border-b border-border/60 last:border-0 hover:bg-secondary/40 transition-colors"
                      >
                        <td className="px-4 py-3 tabular-nums text-muted-foreground whitespace-nowrap">
                          {r.date ? fmtIsoDate(r.date) : '—'}
                        </td>
                        <td className="px-4 py-3 font-medium max-w-[260px] truncate" title={r.name}>{r.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <CategoryIcon category={r.category} size={14} />
                            <span className="text-xs">{resolveCategoryInfo(r.category).label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{r.installment}</td>
                        <td className="px-4 py-3 text-right font-semibold text-destructive tabular-nums whitespace-nowrap">
                          {formatCurrency(r.amount)}
                        </td>
                        <td className="px-4 py-3">{rowActions(r)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: lista */}
              <div className="md:hidden">
                <div className="flex justify-end px-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSortAsc(v => !v)}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                  >
                    Data {sortAsc ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                  </button>
                </div>
                {rows.map(r => (
                  <div key={r.key} className="flex items-center gap-3 px-3 py-2.5 border-b border-border/60 last:border-0">
                    <CategoryIcon category={r.category} size={14} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.date ? fmtIsoDate(r.date) : 'Assinatura'} · {r.installment}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-destructive tabular-nums">{formatCurrency(r.amount)}</span>
                    {rowActions(r)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Painel da fatura ─────────────────────────────────────────────── */}
        <div className="space-y-3 order-1 lg:order-2">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Valor da fatura</p>
            <p className="text-xl font-bold tabular-nums">{formatCurrency(finalAmount)}</p>
            {hasActual && Math.abs(finalAmount - calculated) > 0.009 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Valor real informado · calculado {formatCurrency(calculated)}
              </p>
            )}
            {!hasActual && !isEmpty && (
              <p className="text-[10px] text-muted-foreground mt-1">Calculado pelos lançamentos</p>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <p className={cn('text-lg font-bold', STATUS_TONE[status])}>{statusLabel}</p>
            {(status === 'partial' || status === 'over') && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Pago {formatCurrency(paid)} de {formatCurrency(finalAmount)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Fechamento</p>
                <p className="text-sm lg:text-base font-bold">{fmtDayMonth(closingDate)}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <CalendarX2 size={16} />
              </div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Vencimento</p>
                <p className="text-sm lg:text-base font-bold">{fmtDayMonth(dueDate)}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <CalendarCheck size={16} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              to="/faturas"
              className="flex items-center justify-center gap-2 h-10 rounded-xl border border-border text-xs font-medium hover:bg-secondary transition-colors"
            >
              <TableProperties size={14} /> Registrar valor pago
            </Link>
            <button
              type="button"
              disabled={isEmpty}
              onClick={() => exportCsv(rows, card, month)}
              className="flex items-center justify-center gap-2 h-10 rounded-xl border border-border text-xs font-medium hover:bg-secondary transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <Download size={14} /> Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <EditExpenseDialog
          expense={editing}
          cards={cards}
          open={!!editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={v => !v && setDeleting(null)}>
        <AlertDialogContent className="bg-card border-border max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.installments > 1
                ? `"${deleting.name}" é parcelado em ${deleting.installments}x — todas as parcelas serão removidas, não só a desta fatura.`
                : `"${deleting?.name}" será removido.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
