import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ArrowUpCircle, ArrowDownCircle, X } from 'lucide-react';
import UnifiedTransactionDialog from '@/components/UnifiedTransactionDialog';

interface Props {
  onAdded?: () => void;
}

export default function QuickAddFAB({ onAdded }: Props) {
  const [expanded, setExpanded]   = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'expense' | 'income'>('expense');

  const open = (type: 'expense' | 'income') => {
    setDialogType(type);
    setExpanded(false);
    setDialogOpen(true);
  };

  return (
    <>
      {/* ── Overlay para fechar ao clicar fora ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpanded(false)}
          />
        )}
      </AnimatePresence>

      {/* ── FAB container ────────────────────────────────────────────────── */}
      {/* Mobile: acima da bottom nav (bottom-20). Desktop: bottom-6 right-6 */}
      <div className="fixed bottom-[4.5rem] right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-2">

        {/* ── Opções expandidas ── */}
        <AnimatePresence>
          {expanded && (
            <>
              {/* Receita */}
              <motion.button
                key="income"
                initial={{ opacity: 0, y: 12, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.85 }}
                transition={{ delay: 0.05 }}
                onClick={() => open('income')}
                className="flex items-center gap-2.5 pl-3 pr-4 h-11 rounded-full text-white shadow-lg text-sm font-semibold transition-transform active:scale-95 hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, hsl(152 69% 45%), hsl(192 80% 50%))' }}
              >
                <ArrowUpCircle size={18} />
                Receita
              </motion.button>

              {/* Despesa */}
              <motion.button
                key="expense"
                initial={{ opacity: 0, y: 12, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.85 }}
                transition={{ delay: 0 }}
                onClick={() => open('expense')}
                className="flex items-center gap-2.5 pl-3 pr-4 h-11 rounded-full text-white shadow-lg text-sm font-semibold transition-transform active:scale-95 hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%), hsl(25 95% 53%))' }}
              >
                <ArrowDownCircle size={18} />
                Despesa
              </motion.button>
            </>
          )}
        </AnimatePresence>

        {/* ── Botão principal (+ / ×) ── */}
        <motion.button
          onClick={() => setExpanded(v => !v)}
          whileTap={{ scale: 0.92 }}
          className="w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center transition-all hover:brightness-110"
          style={{
            background: expanded
              ? 'hsl(var(--muted-foreground))'
              : 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))',
          }}
          aria-label={expanded ? 'Fechar' : 'Novo lançamento'}
        >
          <motion.div
            animate={{ rotate: expanded ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Plus size={24} strokeWidth={2.5} />
          </motion.div>
        </motion.button>

      </div>

      {/* ── Dialog unificado ── */}
      <UnifiedTransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultType={dialogType}
        onAdded={onAdded}
      />
    </>
  );
}
