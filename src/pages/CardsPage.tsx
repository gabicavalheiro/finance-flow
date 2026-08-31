import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Pencil, CalendarX2, CalendarCheck, Lock, Unlock, AlertTriangle } from 'lucide-react';
import AddCardDialog from '@/components/AddCardDialog';
import AddExpenseDialog from '@/components/AddExpenseDialog';
import EditCardDialog from '@/components/EditCardDialog';
import MonthSelector from '@/components/MonthSelector';
import ShowMoreButton from '@/components/ShowMoreButton';
import { useCollapse } from '@/hooks/useCollapse';
import {
  deleteCard, computeInstallmentsForMonth, getInvoicesForMonth, CardInvoice,
  setCardActive, getCardPendingInstallments, CardPendingSummary,
} from '@/lib/store';
import { subscriptionsAsInstallments } from '@/lib/subscriptions';
import { BRAND_GRADIENTS, CreditCard } from '@/lib/types';
import { useFinanceData } from '@/contexts/FinanceDataContext';
import { formatCurrency, getCurrentMonth, getMonthLabel } from '@/lib/helpers';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { MonthlyInstallment } from '@/lib/types';

// ── Sub-componente para cada cartão com seu próprio collapse ──
function CardItem({
  card, idx, month, installments, actualAmount, pending, onEdit, onDelete, onToggleActive, onAdded,
}: {
  card: CreditCard;
  idx: number;
  month: string;
  installments: MonthlyInstallment[];
  /** Valor real confirmado em Faturas (sobrescreve o calculado quando definido) */
  actualAmount?: number;
  /** Parcelas ainda pendentes deste cartão (mesmo bloqueado, continuam contando) */
  pending: CardPendingSummary;
  onEdit: (c: CreditCard) => void;
  onDelete: (id: string) => void;
  onToggleActive: (c: CreditCard) => void;
  onAdded: () => void;
}) {
  const cardInst   = installments.filter(i => i.cardId === card.id);
  const calculated = cardInst.reduce((s, i) => s + i.amount, 0);
  const hasActual  = actualAmount != null && actualAmount > 0;
  const spent      = hasActual ? actualAmount! : calculated;
  const usedPct    = Math.min((spent / card.limit) * 100, 100);
  const collapse   = useCollapse(cardInst.length);
  const isBlocked  = card.active === false;

  return (
    <motion.div key={card.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}>
      {/* Face do cartão */}
      <div
        className={`${card.customGradient ? '' : BRAND_GRADIENTS[card.brand]} rounded-2xl p-5 relative overflow-hidden text-white transition-all`}
        style={{
          ...(card.customGradient ? { background: card.customGradient } : undefined),
          ...(isBlocked ? { filter: 'grayscale(0.85)', opacity: 0.72 } : undefined),
        }}
      >
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
        <div className="absolute -right-2 top-8 w-16 h-16 rounded-full bg-white/10" />

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-xs font-medium opacity-80 mb-0.5">{card.brand.toUpperCase()}</p>
              <p className="text-base font-bold flex items-center gap-1.5">
                {card.name}
                {isBlocked && (
                  <span className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-black/30">
                    <Lock size={9} /> Bloqueado
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => onToggleActive(card)}
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
                aria-label={isBlocked ? 'Reativar cartão' : 'Bloquear cartão'}
              >
                {isBlocked ? <Unlock size={13} /> : <Lock size={13} />}
              </button>
              <button onClick={() => onEdit(card)} className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors">
                <Pencil size={13} />
              </button>
              <button onClick={() => onDelete(card.id)} className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <p className="text-lg font-mono tracking-widest opacity-80 mb-4">•••• •••• •••• {card.lastDigits}</p>

          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] opacity-70 mb-0.5">Limite disponível</p>
              <p className="text-base font-bold">{formatCurrency(card.limit - spent)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] opacity-70 mb-0.5">
                Fatura {month.split('-').reverse().join('/')}{hasActual ? ' · real' : ''}
              </p>
              <p className="text-base font-semibold">{formatCurrency(spent)}</p>
            </div>
          </div>

          <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white/80 rounded-full transition-all duration-500" style={{ width: `${usedPct}%` }} />
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-3 opacity-80">
              <div className="flex items-center gap-1">
                <CalendarX2 size={11} />
                <p className="text-[10px] font-medium">Fecha dia {card.closingDay}</p>
              </div>
              <div className="flex items-center gap-1">
                <CalendarCheck size={11} />
                <p className="text-[10px] font-medium">Vence dia {card.dueDay ?? '–'}</p>
              </div>
            </div>
            <p className="text-[10px] opacity-60">{Math.round(usedPct)}% utilizado</p>
          </div>
        </div>
      </div>

      {/* Lançamentos colapsáveis */}
      {cardInst.length > 0 && (
        <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-border flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Lançamentos do mês
              <span className="ml-1 opacity-60">({cardInst.length})</span>
            </p>
          </div>
          {cardInst.slice(0, collapse.visible).map((inst, ii) => (
            <div key={ii} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{inst.expenseName}</p>
                <p className="text-xs text-muted-foreground">
                  {inst.totalInstallments > 1 ? `${inst.installmentNumber}/${inst.totalInstallments}` : 'À vista'}
                </p>
              </div>
              <span className="text-sm font-semibold">{formatCurrency(inst.amount)}</span>
            </div>
          ))}
          <div className="px-2 pb-1">
            <ShowMoreButton expanded={collapse.expanded} hidden={collapse.hidden} onToggle={collapse.toggle} />
          </div>
        </div>
      )}

      {/* Aviso de parcelas pendentes — continua visível mesmo bloqueado */}
      {isBlocked && pending.count > 0 && (
        <div className="mt-2 flex items-start gap-2 bg-warning/10 border border-warning/25 rounded-xl px-3 py-2.5">
          <AlertTriangle size={13} className="text-warning mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-foreground font-medium">
              Ainda restam {pending.count} parcela{pending.count > 1 ? 's' : ''} ({formatCurrency(pending.amount)})
            </span>{' '}
            deste cartão até {pending.finalMonth ? getMonthLabel(pending.finalMonth) : '–'}.
          </p>
        </div>
      )}

      <div className="mt-2">
        {isBlocked ? (
          <div className="flex items-center justify-center gap-2 border border-dashed border-muted-foreground/30 rounded-2xl h-12 text-xs text-muted-foreground">
            <Lock size={12} /> Cartão bloqueado — reative pra adicionar novos gastos
          </div>
        ) : (
          <AddExpenseDialog cards={[card]} onAdded={onAdded} />
        )}
      </div>
    </motion.div>
  );
}

export default function CardsPage() {
  const { cards, expenses, subscriptions, loading, refresh } = useFinanceData();
  const [month, setMonth]                   = useState(getCurrentMonth());
  const [invoices, setInvoices]             = useState<CardInvoice[]>([]);
  const [editingCard, setEditingCard]       = useState<CreditCard | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [blockConfirm, setBlockConfirm]     = useState<{ card: CreditCard; pending: CardPendingSummary } | null>(null);

  // Mantém o nome usado no resto do arquivo — agora delega pro refresh do
  // contexto global, que é a mesma fonte de dados usada pela tela Início.
  const loadAll = refresh;

  // Faturas com valor real confirmado (tela Faturas) — sobrescreve o calculado
  useEffect(() => {
    getInvoicesForMonth(month).then(setInvoices).catch(() => {});
  }, [month]);

  const actualByCard = new Map(invoices.map(inv => [inv.cardId, inv.actualAmount]));

  // Assinaturas vinculadas a um cartão entram na fatura do mês igual a um gasto normal
  const installments = [
    ...computeInstallmentsForMonth(expenses, cards, month),
    ...subscriptionsAsInstallments(subscriptions, month),
  ];

  // Parcelas ainda pendentes por cartão, sempre a partir do mês atual real —
  // independe do mês que está sendo visualizado na tela.
  const pendingByCard = useMemo(() => {
    const map = new Map<string, CardPendingSummary>();
    const currentMonth = getCurrentMonth();
    cards.forEach(card => map.set(card.id, getCardPendingInstallments(expenses, card, currentMonth)));
    return map;
  }, [cards, expenses]);

  const blockedWithPending = cards
    .filter(c => c.active === false)
    .map(c => ({ card: c, pending: pendingByCard.get(c.id) ?? { count: 0, amount: 0, finalMonth: null } }))
    .filter(x => x.pending.count > 0);

  // Cartões ativos primeiro, bloqueados no fim — mas nenhum some da tela
  const sortedCards = [...cards].sort((a, b) => Number(a.active === false) - Number(b.active === false));

  const confirmDelete = async () => {
    if (!deletingCardId) return;
    try {
      await deleteCard(deletingCardId);
      setDeletingCardId(null);
      toast.success('Cartão removido');
      loadAll();
    } catch {
      toast.error('Erro ao remover cartão');
    }
  };

  const handleToggleActive = (card: CreditCard) => {
    if (card.active === false) {
      // Reativar não precisa de confirmação
      setCardActive(card.id, true)
        .then(() => { toast.success(`${card.name} reativado`); loadAll(); })
        .catch(() => toast.error('Erro ao reativar cartão'));
      return;
    }
    const pending = pendingByCard.get(card.id) ?? { count: 0, amount: 0, finalMonth: null };
    setBlockConfirm({ card, pending });
  };

  const confirmBlock = async () => {
    if (!blockConfirm) return;
    try {
      await setCardActive(blockConfirm.card.id, false);
      toast.success(`${blockConfirm.card.name} bloqueado`);
      setBlockConfirm(null);
      loadAll();
    } catch {
      toast.error('Erro ao bloquear cartão');
    }
  };

  return (
    <div className="pb-24 md:pb-10 px-4 md:px-8 pt-6 md:pt-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Meus Cartões</h1>
      <MonthSelector month={month} onChange={setMonth} />

      {/* Aviso explicativo */}
      <div className="flex items-start gap-2 bg-primary/8 border border-primary/20 rounded-xl px-4 py-3">
        <CalendarX2 size={15} className="text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Gastos registrados <span className="text-foreground font-medium">até o dia de fechamento</span> entram na fatura do mês atual.
          Após esse dia, o gasto vai para a <span className="text-foreground font-medium">próxima fatura</span>.
        </p>
      </div>

      {/* Módulo: cartões bloqueados com parcelas pendentes */}
      {blockedWithPending.length > 0 && (
        <div className="bg-warning/8 border border-warning/25 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-warning" />
            <p className="text-xs font-semibold text-warning uppercase tracking-wide">
              Cartões bloqueados com parcelas pendentes
            </p>
          </div>
          {blockedWithPending.map(({ card, pending }) => (
            <div key={card.id} className="flex items-center justify-between gap-3 bg-card/60 rounded-xl px-3 py-2.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Lock size={12} className="text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{card.name}</span>
              </div>
              <span className="text-muted-foreground text-right shrink-0">
                {pending.count} parcela{pending.count > 1 ? 's' : ''} · <span className="font-semibold text-foreground">{formatCurrency(pending.amount)}</span>
                {' '}até {pending.finalMonth ? getMonthLabel(pending.finalMonth) : '–'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Grid de cartões */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading && (
          <p className="text-xs text-muted-foreground text-center py-10 col-span-full">Carregando...</p>
        )}

        {!loading && cards.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-10 col-span-full">Nenhum cartão cadastrado</p>
        )}

        {sortedCards.map((card, idx) => (
          <CardItem
            key={card.id}
            card={card}
            idx={idx}
            month={month}
            installments={installments}
            actualAmount={actualByCard.get(card.id)}
            pending={pendingByCard.get(card.id) ?? { count: 0, amount: 0, finalMonth: null }}
            onEdit={setEditingCard}
            onDelete={setDeletingCardId}
            onToggleActive={handleToggleActive}
            onAdded={loadAll}
          />
        ))}

        {!loading && <AddCardDialog onAdded={loadAll} />}
      </div>

      {/* Edit card dialog */}
      {editingCard && (
        <EditCardDialog
          card={editingCard}
          open={!!editingCard}
          onClose={() => setEditingCard(null)}
          onSaved={loadAll}
        />
      )}

      {/* Delete card dialog */}
      <AlertDialog open={!!deletingCardId} onOpenChange={v => !v && setDeletingCardId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cartão?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os gastos associados a este cartão também serão removidos.
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

      {/* Block card dialog */}
      <AlertDialog open={!!blockConfirm} onOpenChange={v => !v && setBlockConfirm(null)}>
        <AlertDialogContent className="bg-card border-border max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear {blockConfirm?.card.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {blockConfirm && blockConfirm.pending.count > 0 ? (
                <>
                  Você não vai poder adicionar novos gastos nesse cartão. Mas atenção:{' '}
                  <span className="text-foreground font-medium">
                    ainda restam {blockConfirm.pending.count} parcela{blockConfirm.pending.count > 1 ? 's' : ''}
                    {' '}({formatCurrency(blockConfirm.pending.amount)}) até{' '}
                    {blockConfirm.pending.finalMonth ? getMonthLabel(blockConfirm.pending.finalMonth) : '–'}
                  </span>
                  . Elas continuam aparecendo normalmente até serem pagas.
                </>
              ) : (
                'Você não vai poder adicionar novos gastos nesse cartão até reativá-lo.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBlock} className="bg-warning hover:bg-warning/90">
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}