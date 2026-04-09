import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Pencil } from 'lucide-react';
import AddCardDialog from '@/components/AddCardDialog';
import AddExpenseDialog from '@/components/AddExpenseDialog';
import EditCardDialog from '@/components/EditCardDialog';
import MonthSelector from '@/components/MonthSelector';
import { getCards, deleteCard, getExpenses, computeInstallmentsForMonth } from '@/lib/store';
import { BRAND_GRADIENTS, CreditCard, Expense } from '@/lib/types';
import { formatCurrency, getCurrentMonth } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function CardsPage() {
  const [month, setMonth]                         = useState(getCurrentMonth());
  const [cards, setCards]                         = useState<CreditCard[]>([]);
  const [expenses, setExpenses]                   = useState<Expense[]>([]);
  const [editingCard, setEditingCard]             = useState<CreditCard | null>(null);
  const [deletingCardId, setDeletingCardId]       = useState<string | null>(null);
  const [loading, setLoading]                     = useState(true);

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
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold">Meus Cartões</h1>
      <MonthSelector month={month} onChange={setMonth} />

      <div className="space-y-4">
        {loading && (
          <p className="text-xs text-muted-foreground text-center py-10">Carregando...</p>
        )}

        {!loading && cards.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-10">Nenhum cartão cadastrado</p>
        )}

        {cards.map((card, idx) => {
          const spent   = installments.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
          const usedPct = Math.min((spent / card.limit) * 100, 100);

          return (
            <motion.div key={card.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}>
              <div
                className={`${card.customGradient ? '' : BRAND_GRADIENTS[card.brand]} rounded-2xl p-5 relative overflow-hidden text-white`}
                style={card.customGradient ? { background: card.customGradient } : undefined}
              >
                {/* Decorative circles */}
                <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
                <div className="absolute -right-2 top-8 w-16 h-16 rounded-full bg-white/10" />

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-xs font-medium opacity-80 mb-0.5">{card.brand.toUpperCase()}</p>
                      <p className="text-base font-bold">{card.name}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingCard(card)}
                        className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeletingCardId(card.id)}
                        className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
                      >
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

                  {/* Progress */}
                  <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/80 rounded-full transition-all duration-500"
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] opacity-60 mt-1">{Math.round(usedPct)}% do limite utilizado</p>
                </div>
              </div>

              {/* Installments for this card */}
              {installments.filter(i => i.cardId === card.id).length > 0 && (
                <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-2 border-b border-border">
                    <p className="text-xs font-medium text-muted-foreground">Lançamentos do mês</p>
                  </div>
                  {installments.filter(i => i.cardId === card.id).map((inst, ii) => (
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
                </div>
              )}

              {/* Add expense button for this card */}
              <div className="mt-2">
                <AddExpenseDialog cards={[card]} onAdded={loadAll} />
              </div>
            </motion.div>
          );
        })}

        <AddCardDialog onAdded={loadAll} />
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