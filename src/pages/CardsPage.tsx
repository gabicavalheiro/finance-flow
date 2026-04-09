import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Pencil } from 'lucide-react';
import AddCardDialog from '@/components/AddCardDialog';
import AddExpenseDialog from '@/components/AddExpenseDialog';
import EditCardDialog from '@/components/EditCardDialog';
import MonthSelector from '@/components/MonthSelector';
import { getCards, saveCards, getInstallmentsForMonth } from '@/lib/store';
import { BRAND_GRADIENTS, CreditCard } from '@/lib/types';
import { formatCurrency, getCurrentMonth } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function CardsPage() {
  const [month, setMonth]           = useState(getCurrentMonth());
  const [cards, setCards]           = useState(getCards);
  const [editingCard, setEditingCard]       = useState<CreditCard | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  const refresh = useCallback(() => setCards(getCards()), []);

  const installments = getInstallmentsForMonth(month);

  const confirmDelete = () => {
    if (!deletingCardId) return;
    saveCards(cards.filter(c => c.id !== deletingCardId));
    setCards(getCards());
    setDeletingCardId(null);
    toast.success('Cartão removido');
  };

  return (
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold">Meus Cartões</h1>
      <MonthSelector month={month} onChange={setMonth} />

      <div className="space-y-4">
        {cards.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-10">Nenhum cartão cadastrado</p>
        )}

        {cards.map((card, idx) => {
          const spent   = installments.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
          const usedPct = Math.min((spent / card.limit) * 100, 100);

          return (
            <motion.div key={card.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}>

              <div
                className={`${card.customGradient ? '' : BRAND_GRADIENTS[card.brand]} rounded-2xl p-5 relative overflow-hidden text-white`}
                style={card.customGradient ? { background: card.customGradient } : undefined}
              >
                {/* orbs */}
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -mr-12 -mt-12 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-black/10 -ml-8 -mb-8 pointer-events-none" />

                {/* Top row */}
                <div className="flex justify-between items-start mb-8 relative z-10">
                  <div>
                    <p className="text-base font-semibold">{card.name}</p>
                    <p className="text-xs opacity-60 capitalize mt-0.5">{card.brand}</p>
                  </div>
                  {/* Edit + Delete */}
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon"
                      className="h-8 w-8 hover:bg-white/15 rounded-xl"
                      onClick={() => setEditingCard(card)}>
                      <Pencil size={13} />
                    </Button>
                    <Button variant="ghost" size="icon"
                      className="h-8 w-8 hover:bg-white/15 rounded-xl"
                      onClick={() => setDeletingCardId(card.id)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>

                {/* Card number */}
                <p className="text-lg tracking-[0.22em] font-mono mb-6 opacity-90">
                  •••• •••• •••• {card.lastDigits}
                </p>

                {/* Stats */}
                <div className="flex justify-between text-xs mb-3">
                  <div>
                    <p className="opacity-60 mb-0.5">Fatura atual</p>
                    <p className="font-bold text-sm">{formatCurrency(spent)}</p>
                  </div>
                  <div className="text-center">
                    <p className="opacity-60 mb-0.5">Limite total</p>
                    <p className="font-bold text-sm">{formatCurrency(card.limit)}</p>
                  </div>
                  <div className="text-right">
                    <p className="opacity-60 mb-0.5">Disponível</p>
                    <p className="font-bold text-sm">{formatCurrency(card.limit - spent)}</p>
                  </div>
                </div>

                {/* Usage bar */}
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${usedPct}%`,
                      background: usedPct > 85 ? 'hsl(0 90% 70%)' : 'rgba(255,255,255,0.75)',
                    }} />
                </div>

                <p className="text-[10px] opacity-45 mt-2">
                  Fecha dia {card.closingDay} · {Math.round(usedPct)}% utilizado
                </p>
              </div>
            </motion.div>
          );
        })}

        <AddCardDialog onAdded={refresh} />
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-4">
        <AddExpenseDialog cards={cards} onAdded={refresh} />
      </div>

      {/* Edit dialog */}
      {editingCard && (
        <EditCardDialog
          card={editingCard}
          open={!!editingCard}
          onClose={() => setEditingCard(null)}
          onSaved={refresh}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deletingCardId} onOpenChange={v => !v && setDeletingCardId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cartão?</AlertDialogTitle>
            <AlertDialogDescription>
              O cartão será removido. Os gastos vinculados continuam salvos.
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