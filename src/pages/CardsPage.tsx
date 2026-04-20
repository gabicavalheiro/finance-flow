import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Pencil, CalendarX2, CalendarCheck } from 'lucide-react';
import AddCardDialog from '@/components/AddCardDialog';
import AddExpenseDialog from '@/components/AddExpenseDialog';
import EditCardDialog from '@/components/EditCardDialog';
import MonthSelector from '@/components/MonthSelector';
import ShowMoreButton from '@/components/ShowMoreButton';
import { useCollapse } from '@/hooks/useCollapse';
import { getCards, deleteCard, getExpenses, computeInstallmentsForMonth } from '@/lib/store';
import { BRAND_GRADIENTS, CreditCard, Expense } from '@/lib/types';
import { formatCurrency, getCurrentMonth } from '@/lib/helpers';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { MonthlyInstallment } from '@/lib/types';

// ── Sub-componente para cada cartão com seu próprio collapse ──
function CardItem({
  card, idx, month, installments, onEdit, onDelete, onAdded,
}: {
  card: CreditCard;
  idx: number;
  month: string;
  installments: MonthlyInstallment[];
  onEdit: (c: CreditCard) => void;
  onDelete: (id: string) => void;
  onAdded: () => void;
}) {
  const cardInst = installments.filter(i => i.cardId === card.id);
  const spent    = cardInst.reduce((s, i) => s + i.amount, 0);
  const usedPct  = Math.min((spent / card.limit) * 100, 100);
  const collapse = useCollapse(cardInst.length);

  return (
    <motion.div key={card.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}>
      {/* Face do cartão */}
      <div
        className={`${card.customGradient ? '' : BRAND_GRADIENTS[card.brand]} rounded-2xl p-5 relative overflow-hidden text-white`}
        style={card.customGradient ? { background: card.customGradient } : undefined}
      >
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
        <div className="absolute -right-2 top-8 w-16 h-16 rounded-full bg-white/10" />

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-xs font-medium opacity-80 mb-0.5">{card.brand.toUpperCase()}</p>
              <p className="text-base font-bold">{card.name}</p>
            </div>
            <div className="flex gap-1">
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
              <p className="text-[10px] opacity-70 mb-0.5">Fatura {month.split('-').reverse().join('/')}</p>
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

      <div className="mt-2">
        <AddExpenseDialog cards={[card]} onAdded={onAdded} />
      </div>
    </motion.div>
  );
}

export default function CardsPage() {
  const [month, setMonth]                   = useState(getCurrentMonth());
  const [cards, setCards]                   = useState<CreditCard[]>([]);
  const [expenses, setExpenses]             = useState<Expense[]>([]);
  const [editingCard, setEditingCard]       = useState<CreditCard | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [loading, setLoading]               = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [c, e] = await Promise.all([getCards(), getExpenses()]);
    setCards(c); setExpenses(e);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const installments = computeInstallmentsForMonth(expenses, cards, month);

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

      {/* Grid de cartões */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading && (
          <p className="text-xs text-muted-foreground text-center py-10 col-span-full">Carregando...</p>
        )}

        {!loading && cards.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-10 col-span-full">Nenhum cartão cadastrado</p>
        )}

        {cards.map((card, idx) => (
          <CardItem
            key={card.id}
            card={card}
            idx={idx}
            month={month}
            installments={installments}
            onEdit={setEditingCard}
            onDelete={setDeletingCardId}
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
    </div>
  );
}