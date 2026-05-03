// src/pages/FaturaPage.tsx
import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, FileSearch, StickyNote } from 'lucide-react';
import MonthSelector from '@/components/MonthSelector';
import ShowMoreButton from '@/components/ShowMoreButton';
import DailyAlertsDialog from '@/components/DailyAlertsDialog';
import { useCollapse } from '@/hooks/useCollapse';
import { getCurrentMonth, formatCurrency } from '@/lib/helpers';
import {
  getCards, getExpenses, computeInstallmentsForMonth,
  getInvoicesForMonth, upsertInvoice, CardInvoice,
} from '@/lib/store';
import { BRAND_GRADIENTS, CreditCard, Expense, MonthlyInstallment } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  onNoteChange: (v: string) => void;
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
          <p className="text-white font-semibold text-sm">{card.name}</p>
          <p className="text-white/70 text-[11px]">•••• {card.lastDigits}</p>
        </div>
        <div className="text-right">
          <p className="text-white/70 text-[10px]">Calculado</p>
          <p className="text-white font-bold text-base tabular-nums">{formatCurrency(calculated)}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Lançamentos colapsáveis */}
        {cardInst.length > 0 ? (
          <div className="space-y-1">
            {cardInst.slice(0, collapse.visible).map((inst, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-secondary/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{inst.expenseName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {inst.totalInstallments > 1 ? `${inst.installmentNumber}/${inst.totalInstallments}` : 'À vista'}
                  </p>
                </div>
                <span className="text-xs font-semibold tabular-nums">{formatCurrency(inst.amount)}</span>
              </div>
            ))}
            <ShowMoreButton expanded={collapse.expanded} hidden={collapse.hidden} onToggle={collapse.toggle} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhum lançamento registrado</p>
        )}

        {/* Input valor real */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Info size={11} /> Valor real cobrado pelo banco
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <Input
                value={draft}
                onChange={e => onDraftChange(e.target.value)}
                placeholder={calculated.toFixed(2).replace('.', ',')}
                className="pl-9 bg-secondary border-border"
                onKeyDown={e => e.key === 'Enter' && onSave()}
              />
            </div>
            <button
              onClick={onSave}
              disabled={saving === card.id}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
            >
              {saving === card.id ? '...' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* Diferença */}
        {diff !== null && (
          <div className={cn(
            'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium',
            isOk    && 'bg-success/10 text-success',
            isOver  && 'bg-warning/10 text-warning',
            isUnder && 'bg-destructive/10 text-destructive',
          )}>
            {isOk    && <CheckCircle2 size={15} />}
            {(isOver || isUnder) && <AlertTriangle size={15} />}
            <span>
              {isOk    && 'Valores conferem ✓'}
              {isOver  && `Banco cobrou ${formatCurrency(diff)} a mais — possível gasto não registrado`}
              {isUnder && `Banco cobrou ${formatCurrency(Math.abs(diff))} a menos — verifique os lançamentos`}
            </span>
          </div>
        )}

        {/* Observações */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <StickyNote size={11} /> Observações (opcional)
          </label>
          <Input
            value={note}
            onChange={e => onNoteChange(e.target.value)}
            placeholder="Ex: Fatura com IOF, estorno pendente..."
            className="bg-secondary border-border text-xs h-9"
          />
        </div>
      </div>
    </motion.div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function FaturaPage() {
  const [month, setMonth]       = useState(getCurrentMonth());
  const [cards, setCards]       = useState<CreditCard[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [invoices, setInvoices] = useState<CardInvoice[]>([]);
  const [drafts, setDrafts]     = useState<Record<string, string>>({});
  const [notes, setNotes]       = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [c, e, inv] = await Promise.all([
      getCards(), getExpenses(), getInvoicesForMonth(month),
    ]);
    setCards(c); setExpenses(e); setInvoices(inv);

    const newDrafts: Record<string, string> = {};
    const newNotes: Record<string, string>  = {};
    for (const invoice of inv) {
      newDrafts[invoice.cardId] = invoice.actualAmount > 0
        ? String(invoice.actualAmount) : '';
      newNotes[invoice.cardId]  = invoice.notes ?? '';
    }
    setDrafts(newDrafts);
    setNotes(newNotes);
    setLoading(false);
  }, [month]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const installments = computeInstallmentsForMonth(expenses, cards, month);

  const calculatedByCard = (cardId: string) =>
    installments.filter(i => i.cardId === cardId).reduce((s, i) => s + i.amount, 0);

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
      toast.success(`Fatura do ${card.name} salva!`);
      loadAll();
    } catch { toast.error('Erro ao salvar'); }
    setSaving(null);
  };

  const totalCalculated = cards.reduce((s, c) => s + calculatedByCard(c.id), 0);
  const totalActual     = invoices.reduce((s, i) => s + i.actualAmount, 0);
  const totalDiff       = totalActual - totalCalculated;

  return (
    <div className="pb-24 md:pb-10 px-4 md:px-8 pt-6 md:pt-8 max-w-5xl mx-auto space-y-6">

      {/* Avisos automáticos */}
      <DailyAlertsDialog month={month} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileSearch size={20} className="text-primary" />
            Conferência de Faturas
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Digite o valor real cobrado pelo banco e compare com o calculado
          </p>
        </div>
      </div>

      <MonthSelector month={month} onChange={setMonth} />

      {/* ✅ Resumo geral — corrigido para não extravazar no mobile */}
      {!loading && cards.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-2xl p-2.5 sm:p-4 border border-border">
            <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide mb-1 leading-tight">
              Calculado
            </p>
            <p className="text-xs sm:text-base font-bold text-muted-foreground tabular-nums leading-tight break-all">
              {formatCurrency(totalCalculated)}
            </p>
          </div>
          <div className="bg-card rounded-2xl p-2.5 sm:p-4 border border-border">
            <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide mb-1 leading-tight">
              Real (banco)
            </p>
            <p className="text-xs sm:text-base font-bold tabular-nums leading-tight break-all">
              {formatCurrency(totalActual)}
            </p>
          </div>
          <div className={cn(
            'rounded-2xl p-2.5 sm:p-4 border',
            Math.abs(totalDiff) < 0.01
              ? 'bg-success/10 border-success/30'
              : 'bg-warning/10 border-warning/30',
          )}>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide mb-1 leading-tight">
              Diferença
            </p>
            <p className={cn(
              'text-xs sm:text-base font-bold tabular-nums leading-tight break-all',
              Math.abs(totalDiff) < 0.01 ? 'text-success' : 'text-warning',
            )}>
              {totalDiff >= 0 ? '+' : ''}{formatCurrency(totalDiff)}
            </p>
          </div>
        </div>
      )}

      {/* Lista de cartões */}
      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-10">Carregando...</p>
      ) : cards.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-10">Nenhum cartão cadastrado</p>
      ) : (
        <div className="space-y-4">
          {cards.map((card, idx) => {
            const calculated = calculatedByCard(card.id);
            const cardInst   = installments.filter(i => i.cardId === card.id);
            const draft      = drafts[card.id] ?? '';
            const note       = notes[card.id]  ?? '';
            const actualInv  = invoices.find(i => i.cardId === card.id);
            const actual     = actualInv?.actualAmount ?? null;
            const diff       = actual !== null ? actual - calculated : null;
            const isOk       = diff !== null && Math.abs(diff) < 0.01;
            const isOver     = diff !== null && diff > 0.01;
            const isUnder    = diff !== null && diff < -0.01;

            return (
              <FaturaCardItem
                key={card.id}
                card={card} idx={idx} calculated={calculated}
                cardInst={cardInst} draft={draft} diff={diff}
                isOk={isOk} isOver={isOver} isUnder={isUnder}
                saving={saving} note={note}
                onDraftChange={v => setDrafts(p => ({ ...p, [card.id]: v }))}
                onNoteChange={v => setNotes(p => ({ ...p, [card.id]: v }))}
                onSave={() => handleSave(card)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}