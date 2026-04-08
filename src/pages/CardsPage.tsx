import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import AddCardDialog from '@/components/AddCardDialog';
import AddExpenseDialog from '@/components/AddExpenseDialog';
import MonthSelector from '@/components/MonthSelector';
import CategoryIcon from '@/components/CategoryIcon';
import { getCards, saveCards, getInstallmentsForMonth } from '@/lib/store';
import { BRAND_GRADIENTS } from '@/lib/types';
import { formatCurrency, getCurrentMonth } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function CardsPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [cards, setCards] = useState(getCards);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => {
    setCards(getCards());
    setRefreshKey(k => k + 1);
  }, []);

  const installments = getInstallmentsForMonth(month);

  const deleteCard = (id: string) => {
    const updated = cards.filter(c => c.id !== id);
    saveCards(updated);
    setCards(updated);
    toast.success('Cartão removido');
  };

  return (
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold">Meus Cartões</h1>
      <MonthSelector month={month} onChange={setMonth} />

      {/* Card list */}
      <div className="space-y-4">
        {cards.map((card, idx) => {
          const cardInst = installments.filter(i => i.cardId === card.id);
          const spent = cardInst.reduce((s, i) => s + i.amount, 0);

          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <div className={`${card.customGradient ? '' : BRAND_GRADIENTS[card.brand]} rounded-2xl p-5 relative overflow-hidden text-white`} style={card.customGradient ? { background: card.customGradient } : undefined}>
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -mr-10 -mt-10 pointer-events-none" />
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div>
                    <p className="text-sm font-medium opacity-80">{card.name}</p>
                    <p className="text-xs opacity-60 capitalize">{card.brand}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={(e) => { e.stopPropagation(); deleteCard(card.id); }}>
                    <Trash2 size={14} />
                  </Button>
                </div>
                <p className="text-lg tracking-[0.2em] font-mono mb-4">•••• •••• •••• {card.lastDigits}</p>
                <div className="flex justify-between text-xs">
                  <div>
                    <span className="opacity-60">Gasto</span>
                    <p className="font-semibold">{formatCurrency(spent)}</p>
                  </div>
                  <div className="text-right">
                    <span className="opacity-60">Limite</span>
                    <p className="font-semibold">{formatCurrency(card.limit)}</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white/70 rounded-full transition-all" style={{ width: `${Math.min((spent / card.limit) * 100, 100)}%` }} />
                </div>
              </div>

              {/* Card expenses */}
              {cardInst.length > 0 && (
                <div className="bg-card rounded-2xl mt-2 p-3 border border-border space-y-2">
                  {cardInst.map((inst, i) => (
                    <div key={`${inst.expenseId}-${i}`} className="flex items-center gap-3">
                      <CategoryIcon category={inst.category} size={16} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{inst.expenseName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {inst.totalInstallments > 1 ? `Parcela ${inst.installmentNumber}/${inst.totalInstallments}` : 'À vista'}
                        </p>
                      </div>
                      <span className="text-xs font-semibold">{formatCurrency(inst.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}

        <AddCardDialog onAdded={refresh} />
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-4">
        <AddExpenseDialog cards={cards} onAdded={refresh} />
      </div>
    </div>
  );
}
