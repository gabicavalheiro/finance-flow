// src/pages/FaturaPage.tsx — OTIMIZADO
//
// Melhorias:
// 1. loadHistory usa getInvoicesForMonthRange() — 1 query ao invés de 12 paralelas
// 2. Spinner só aparece no primeiro load; versioning silencioso depois
// 3. Salvar fatura atualiza estado local sem refetch
// 4. historyMonths estável (não recalcula a cada render)

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, AlertTriangle, Info, FileSearch,
  StickyNote, ChevronDown, ChevronUp, TableProperties,
} from 'lucide-react';
import MonthSelector from '@/components/MonthSelector';
import ShowMoreButton from '@/components/ShowMoreButton';
import DailyAlertsDialog from '@/components/DailyAlertsDialog';
import { useCollapse } from '@/hooks/useCollapse';
import { getCurrentMonth, formatCurrency } from '@/lib/helpers';
import {
  computeInstallmentsForMonth,
  getInvoicesForMonth,
  getInvoicesForMonthRange,
  upsertInvoice,
  CardInvoice,
} from '@/lib/store';
import { BRAND_GRADIENTS, CreditCard, MonthlyInstallment } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useFinanceData } from '@/contexts/FinanceDataContext';

// ── Helpers ───────────────────────────────────────────────────────────────────
function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]}/${String(y).slice(2)}`;
}

// ── Sub-componente por cartão ─────────────────────────────────────────────────
function FaturaCardItem({
  card, idx, calculated, cardInst, draft, diff, isOk, isOver, isUnder,
  saving, note, onDraftChange, onNoteChange, onSave,
}: {
  card: CreditCard; idx: number; calculated: number;
  cardInst: MonthlyInstallment[]; draft: string;
  diff: number | null; isOk: boolean; isOver: boolean; isUnder: boolean;
  saving: string | null; note: string;
  onDraftChange: (v: string) => void;
  onNoteChange:  (v: string) => void;
  onSave: () => void;
}) {
  const collapse = useCollapse(cardInst.length);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className="bg-card rounded-2xl border border-border overflow-hidden"
    >
      {/* Cabeçalho colorido */}
      <div
        className={`${card.customGradient ? '' : BRAND_GRADIENTS[card.brand]} px-4 py-3 flex items-center justify-between`}
        style={card.customGradient ? { background: card.customGradient } : undefined}
      >
        <div>
          <p className="font-semibold text-white text-sm">{card.name}</p>
          <p className="text-white/70 text-xs">•••• {card.lastDigits}</p>
        </div>
        <div className="text-right">
          <p className="text-white/70 text-[10px]">Calculado</p>
          <p className="text-white font-bold text-sm">{formatCurrency(calculated)}</p>
        </div>
      </div>

      {/* Corpo */}
      <div className="p-4 space-y-3">
        {/* Input da fatura real */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Valor real da fatura</label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder={formatCurrency(calculated)}
              value={draft}
              onChange={e => onDraftChange(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <button
            onClick={onSave}
            disabled={saving === card.id}
            className="mt-5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 transition-opacity"
          >
            {saving === card.id ? '...' : 'Salvar'}
          </button>
        </div>

        {/* Diff */}
        {diff !== null && (
          <div className={cn(
            'flex items-center gap-1.5 text-xs rounded-lg px-3 py-2',
            isOk    && 'bg-emerald-500/10 text-emerald-400',
            isOver  && 'bg-destructive/10 text-destructive',
            isUnder && 'bg-amber-500/10 text-amber-400',
          )}>
            {isOk    && <CheckCircle2 size={12} />}
            {isOver  && <AlertTriangle size={12} />}
            {isUnder && <Info size={12} />}
            <span>
              {isOk    && 'Fatura confere!'}
              {isOver  && `Fatura ${formatCurrency(Math.abs(diff))} acima do calculado`}
              {isUnder && `Fatura ${formatCurrency(Math.abs(diff))} abaixo do calculado`}
            </span>
          </div>
        )}

        {/* Nota */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <StickyNote size={10} /> Observação
          </label>
          <Input
            placeholder="Ex: inclui anuidade..."
            value={note}
            onChange={e => onNoteChange(e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        {/* Parcelas detalhadas */}
        {cardInst.length > 0 && (
          <div>
            <button
              onClick={collapse.toggle}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {collapse.expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {collapse.expanded ? 'Ocultar' : 'Ver'} {cardInst.length} lançamento{cardInst.length !== 1 ? 's' : ''}
            </button>

            <AnimatePresence>
              {(collapse.expanded || collapse.visible > 0) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden mt-2 space-y-1"
                >
                  {cardInst.slice(0, collapse.visible).map(inst => (
                    <div
                      key={`${inst.expenseId}-${inst.installmentNumber}`}
                      className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0"
                    >
                      <span className="text-foreground truncate max-w-[60%]">{inst.expenseName}</span>
                      <span className="text-muted-foreground">
                        {inst.installmentNumber}/{inst.totalInstallments} · {formatCurrency(inst.amount)}
                      </span>
                    </div>
                  ))}
                  {collapse.hidden > 0 && (
                    <ShowMoreButton
                      expanded={collapse.expanded}
                      hidden={collapse.hidden}
                      onToggle={collapse.toggle}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface HistoryRow {
  month:      string;
  calculated: number;
  actual:     number | null;
  diff:       number | null;
}

// ── Página principal ──────────────────────────────────────────────────────────
const HISTORY_MONTHS = 12;

export default function FaturaPage() {
  const [month, setMonth] = useState(getCurrentMonth());

  const { cards, expenses, version } = useFinanceData();

  // Faturas do mês selecionado
  const [invoices, setInvoices] = useState<CardInvoice[]>([]);
  const [drafts,   setDrafts]   = useState<Record<string, string>>({});
  const [notes,    setNotes]    = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);

  // Histórico
  const [historyRows,    setHistoryRows]    = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Meses estáveis para o histórico — calculados apenas uma vez
  const historyMonths = useMemo(() => {
    const cur = getCurrentMonth();
    return Array.from({ length: HISTORY_MONTHS }, (_, i) =>
      addMonths(cur, -(HISTORY_MONTHS - 1 - i)),
    );
  }, []); // sem deps — lista de meses não muda na sessão

  // ── Faturas do mês selecionado ───────────────────────────────────────────
  const isFirstInvoiceLoad = useRef(true);

  const loadInvoices = useCallback(async () => {
    // Spinner apenas no primeiro load; nas revalidações (version), silencioso
    if (isFirstInvoiceLoad.current) setLoading(true);
    const inv = await getInvoicesForMonth(month);
    setInvoices(inv);
    const newDrafts: Record<string, string> = {};
    const newNotes:  Record<string, string> = {};
    for (const invoice of inv) {
      newDrafts[invoice.cardId] = invoice.actualAmount > 0 ? String(invoice.actualAmount) : '';
      newNotes[invoice.cardId]  = invoice.notes ?? '';
    }
    setDrafts(newDrafts);
    setNotes(newNotes);
    setLoading(false);
    isFirstInvoiceLoad.current = false;
  }, [month]);

  // Recarrega quando muda o mês OU quando version sobe (qualquer mutação global)
  useEffect(() => {
    isFirstInvoiceLoad.current = true; // spinner ao trocar de mês
    loadInvoices();
  }, [loadInvoices, version]);

  // ── Histórico — 1 query batch ao invés de 12 paralelas ──────────────────
  const loadHistory = useCallback(async () => {
    if (cards.length === 0) return;
    setHistoryLoading(true);

    // Uma única chamada ao Supabase para todos os 12 meses
    const invoicesByMonth = await getInvoicesForMonthRange(historyMonths);

    const rows: HistoryRow[] = historyMonths.map(m => {
      const monthInvoices  = invoicesByMonth[m] ?? [];
      const inst           = computeInstallmentsForMonth(expenses, cards, m);
      const calculated     = inst.reduce((s, i) => s + i.amount, 0);
      const confirmedTotal = monthInvoices
        .filter(inv => inv.actualAmount > 0)
        .reduce((s, inv) => s + inv.actualAmount, 0);
      const hasConfirmed = monthInvoices.some(inv => inv.actualAmount > 0);
      const actual       = hasConfirmed ? confirmedTotal : null;
      const diff         = actual !== null ? actual - calculated : null;
      return { month: m, calculated, actual, diff };
    });

    const filtered = rows
      .filter(r => r.calculated > 0 || r.actual !== null)
      .reverse(); // mais recente primeiro

    setHistoryRows(filtered);
    setHistoryLoading(false);
  }, [historyMonths, cards, expenses]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── Cálculos do mês selecionado ──────────────────────────────────────────
  const installments = useMemo(
    () => computeInstallmentsForMonth(expenses, cards, month),
    [expenses, cards, month],
  );

  const invoiceMap = useMemo(
    () => new Map(invoices.map(i => [i.cardId, i])),
    [invoices],
  );

  const totalCalc = useMemo(
    () => installments.reduce((s, i) => s + i.amount, 0),
    [installments],
  );

  const totalActual = useMemo(() =>
    cards.reduce((sum, c) => {
      const inv = invoiceMap.get(c.id);
      if (inv && inv.actualAmount > 0) return sum + inv.actualAmount;
      return sum + installments.filter(i => i.cardId === c.id).reduce((s, i) => s + i.amount, 0);
    }, 0),
  [cards, invoiceMap, installments]);

  const calculatedByCard = (cardId: string) =>
    installments.filter(i => i.cardId === cardId).reduce((s, i) => s + i.amount, 0);

  // ── Salvar fatura ─────────────────────────────────────────────────────────
  const handleSave = async (card: CreditCard) => {
    const raw    = drafts[card.id] ?? '';
    const parsed = parseFloat(raw.replace(',', '.'));
    if (raw && (isNaN(parsed) || parsed < 0)) { toast.error('Valor inválido'); return; }
    setSaving(card.id);
    try {
      await upsertInvoice({
        cardId: card.id, month,
        actualAmount: isNaN(parsed) ? 0 : parsed,
        notes: notes[card.id] ?? '',
      });
      toast.success('Fatura salva!');
      // Atualiza estado local imediatamente, sem esperar refetch
      setInvoices(prev => {
        const idx = prev.findIndex(i => i.cardId === card.id);
        const updated: CardInvoice = {
          cardId: card.id, month,
          actualAmount: isNaN(parsed) ? 0 : parsed,
          notes: notes[card.id] ?? '',
        };
        if (idx >= 0) {
          const next = [...prev]; next[idx] = updated; return next;
        }
        return [...prev, updated];
      });
    } catch {
      toast.error('Erro ao salvar fatura');
    } finally {
      setSaving(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-8">
      <header className="px-4 md:px-8 pt-5 md:pt-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <TableProperties size={20} className="text-primary" />
            Faturas
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Confira e registre os valores reais</p>
        </div>
        <DailyAlertsDialog month={month} />
      </header>

      <div className="px-4 md:px-8 space-y-4">
        <MonthSelector month={month} onChange={setMonth} />

        {/* Resumo */}
        {cards.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Calculado</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(totalCalc)}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Real / Estimado</p>
              <p className="text-lg font-bold">{formatCurrency(totalActual)}</p>
            </div>
          </div>
        )}

        {/* Cartões */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <FileSearch size={32} strokeWidth={1.2} />
            <p className="text-sm">Nenhum cartão cadastrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map((card, idx) => {
              const calculated = calculatedByCard(card.id);
              const cardInst   = installments.filter(i => i.cardId === card.id);
              const draft      = drafts[card.id] ?? '';
              const inv        = invoiceMap.get(card.id);
              const actual     = inv?.actualAmount ?? 0;
              const diff       = actual > 0 ? actual - calculated : null;
              const isOk       = diff !== null && Math.abs(diff) < 0.01;
              const isOver     = diff !== null && diff > 0.01;
              const isUnder    = diff !== null && diff < -0.01;

              return (
                <FaturaCardItem
                  key={card.id}
                  card={card} idx={idx}
                  calculated={calculated}
                  cardInst={cardInst}
                  draft={draft}
                  diff={diff} isOk={isOk} isOver={isOver} isUnder={isUnder}
                  saving={saving}
                  note={notes[card.id] ?? ''}
                  onDraftChange={v => setDrafts(prev => ({ ...prev, [card.id]: v }))}
                  onNoteChange={v => setNotes(prev => ({ ...prev, [card.id]: v }))}
                  onSave={() => handleSave(card)}
                />
              );
            })}
          </div>
        )}

        {/* Histórico */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <TableProperties size={14} className="text-muted-foreground" />
            <span className="text-sm font-medium">Histórico de faturas</span>
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : historyRows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhum dado histórico</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Mês</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Calculado</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Real</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map(row => (
                    <tr key={row.month} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{monthLabel(row.month)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {formatCurrency(row.calculated)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {row.actual !== null ? formatCurrency(row.actual) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className={cn(
                        'px-4 py-2.5 text-right font-medium',
                        row.diff === null                           && 'text-muted-foreground',
                        row.diff !== null && Math.abs(row.diff) < 0.01 && 'text-emerald-400',
                        row.diff !== null && row.diff > 0.01          && 'text-destructive',
                        row.diff !== null && row.diff < -0.01         && 'text-amber-400',
                      )}>
                        {row.diff !== null
                          ? `${row.diff > 0 ? '+' : ''}${formatCurrency(row.diff)}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}