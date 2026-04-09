import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, TrendingDown, TrendingUp, Scale,
  Pencil, Trash2, ArrowDownCircle, ArrowUpCircle,
  Zap, Banknote, ArrowLeftRight, CreditCard as DebitIcon, FileText,
} from 'lucide-react';
import MonthSelector from '@/components/MonthSelector';
import AddExpenseDialog from '@/components/AddExpenseDialog';
import AddVariableDialog from '@/components/AddVariableDialog';
import EditExpenseDialog from '@/components/EditExpenseDialog';
import CategoryIcon from '@/components/CategoryIcon';
import { getCurrentMonth, formatCurrency } from '@/lib/helpers';
import {
  getCards, getInstallmentsForMonth, getFixedExpenses,
  getCategoryTotalsForMonth, getIncomes, getExpenses, saveExpenses,
  getVariableForMonth, saveVariableTransactions, getVariableTransactions,
} from '@/lib/store';
import { CATEGORY_CONFIG, ExpenseCategory, Expense, PAYMENT_METHOD_CONFIG } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PIE_COLORS = [
  'hsl(263 70% 58%)', 'hsl(220 70% 55%)', 'hsl(30 90% 55%)', 'hsl(152 69% 45%)',
  'hsl(0 72% 51%)', 'hsl(280 70% 58%)', 'hsl(320 70% 55%)', 'hsl(45 90% 50%)',
  'hsl(200 80% 50%)', 'hsl(210 70% 55%)',
];

const METHOD_ICONS: Record<string, React.ReactNode> = {
  pix:      <Zap size={11} />,
  cash:     <Banknote size={11} />,
  transfer: <ArrowLeftRight size={11} />,
  debit:    <DebitIcon size={11} />,
  boleto:   <FileText size={11} />,
};

export default function Dashboard() {
  const [month, setMonth]                         = useState(getCurrentMonth());
  const [refreshKey, setRefreshKey]               = useState(0);
  const [selectedCardId, setSelectedCardId]       = useState<string | null>(null);
  const [editingExpense, setEditingExpense]        = useState<Expense | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [deletingVarId, setDeletingVarId]         = useState<string | null>(null);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const cards          = getCards();
  const allInstallments = getInstallmentsForMonth(month);
  const fixedExpenses  = getFixedExpenses();
  const incomes        = getIncomes();
  const varTxs         = getVariableForMonth(month);
  const categoryTotals = getCategoryTotalsForMonth(month);

  const cardMap = new Map(cards.map(c => [c.id, c]));
  const getExpenseById = (id: string) => getExpenses().find(e => e.id === id);

  // Apply card filter to installments
  const installments = selectedCardId
    ? allInstallments.filter(i => i.cardId === selectedCardId)
    : allInstallments;

  // Totals (always from all cards for the summary)
  const totalCard   = allInstallments.reduce((s, i) => s + i.amount, 0);
  const totalFixed  = fixedExpenses.reduce((s, f) => s + f.amount, 0);
  const totalVarExp = varTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalVarInc = varTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalMonth  = totalCard + totalFixed + totalVarExp;
  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0) + totalVarInc;
  const balance     = totalIncome - totalMonth;
  const totalLimit  = cards.reduce((s, c) => s + c.limit, 0);
  const available   = totalLimit - totalCard;
  const spentPct    = totalIncome > 0 ? Math.min((totalMonth / totalIncome) * 100, 100) : 0;

  const chartData = Object.entries(categoryTotals).map(([key, value]) => ({
    name: CATEGORY_CONFIG[key as ExpenseCategory]?.label || key,
    value: Math.round(value * 100) / 100,
  }));

  const confirmDeleteCard = () => {
    if (!deletingExpenseId) return;
    saveExpenses(getExpenses().filter(e => e.id !== deletingExpenseId));
    setDeletingExpenseId(null);
    refresh();
    toast.success('Gasto removido');
  };

  const confirmDeleteVar = () => {
    if (!deletingVarId) return;
    saveVariableTransactions(getVariableTransactions().filter(t => t.id !== deletingVarId));
    setDeletingVarId(null);
    refresh();
    toast.success('Lançamento removido');
  };

  return (
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">FinanceFlow</h1>
          <p className="text-xs text-muted-foreground">Seu gestor inteligente</p>
        </div>
        <div className="flex items-center gap-2">
          <AddVariableDialog onAdded={refresh} />
          <AddExpenseDialog cards={cards} onAdded={refresh} />
        </div>
      </div>

      <MonthSelector month={month} onChange={setMonth} />

      {/* Balance hero */}
      {totalIncome > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="gradient-primary rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Scale size={16} className="opacity-80" />
            <span className="text-xs opacity-80 font-medium">Saldo do mês</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(balance)}</p>
          <div className="space-y-1">
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white/70 rounded-full transition-all duration-500" style={{ width: `${spentPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] opacity-70">
              <span>{formatCurrency(totalMonth)} gasto</span>
              <span>{formatCurrency(totalIncome)} total</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={16} className="text-destructive" />
            <span className="text-xs text-muted-foreground">Total gasto</span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(totalMonth)}</p>
          {totalVarExp > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">inclui {formatCurrency(totalVarExp)} variável</p>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-success" />
            <span className="text-xs text-muted-foreground">Total ganhos</span>
          </div>
          <p className="text-lg font-bold text-success">{formatCurrency(totalIncome)}</p>
          {totalVarInc > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">inclui {formatCurrency(totalVarInc)} variável</p>
          )}
        </motion.div>

        {cards.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="col-span-2 bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={16} className="text-accent" />
              <span className="text-xs text-muted-foreground">Limite disponível (cartões)</span>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-lg font-bold">{formatCurrency(available)}</p>
              <p className="text-xs text-muted-foreground">de {formatCurrency(totalLimit)}</p>
            </div>
            <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all"
                style={{ width: totalLimit > 0 ? `${(totalCard / totalLimit) * 100}%` : '0%' }} />
            </div>
          </motion.div>
        )}
      </div>

      {/* Pie chart */}
      {chartData.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl p-4 border border-border">
          <h2 className="text-sm font-semibold mb-3">Gastos por categoria</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                  {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ background: 'hsl(240 6% 10%)', border: '1px solid hsl(240 4% 18%)', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {chartData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {d.name}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Transactions ── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {/* Header + card filter */}
        <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">
          <h2 className="text-sm font-semibold">Lançamentos do mês</h2>

          {/* Card filter pills */}
          {cards.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
              {/* All */}
              <button
                onClick={() => setSelectedCardId(null)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border',
                  selectedCardId === null
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-border text-muted-foreground hover:border-muted-foreground/50',
                )}
              >
                Todos
              </button>

              {cards.map(card => {
                const cardSpent = allInstallments
                  .filter(i => i.cardId === card.id)
                  .reduce((s, i) => s + i.amount, 0);
                const isActive = selectedCardId === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCardId(isActive ? null : card.id)}
                    className={cn(
                      'shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border',
                      isActive
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-border text-muted-foreground hover:border-muted-foreground/50',
                    )}
                  >
                    {/* Color dot from card gradient */}
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: card.customGradient ?? 'hsl(263 70% 58%)' }}
                    />
                    {card.name}
                    {cardSpent > 0 && (
                      <span className="opacity-60">{formatCurrency(cardSpent)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 space-y-1">
          {installments.length === 0 && fixedExpenses.length === 0 && varTxs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              {selectedCardId ? 'Nenhum lançamento neste cartão' : 'Nenhum lançamento registrado'}
            </p>
          ) : (
            <>
              {/* Card installments */}
              <AnimatePresence mode="popLayout">
                {installments.map((inst, i) => {
                  const orig = getExpenseById(inst.expenseId);
                  return (
                    <motion.div
                      key={`${inst.expenseId}-${i}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-secondary/50 transition-colors group"
                    >
                      <CategoryIcon category={inst.category} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{inst.expenseName}</p>
                        <p className="text-xs text-muted-foreground">
                          {inst.totalInstallments > 1 ? `${inst.installmentNumber}/${inst.totalInstallments}` : 'À vista'}
                          {' · '}{cardMap.get(inst.cardId)?.name ?? 'Cartão'}
                        </p>
                      </div>
                      <span className="text-sm font-semibold">{formatCurrency(inst.amount)}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {orig && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                            onClick={() => setEditingExpense(orig)}>
                            <Pencil size={12} />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeletingExpenseId(inst.expenseId)}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Variable transactions — always shown regardless of card filter */}
              {!selectedCardId && varTxs.length > 0 && (
                <>
                  {installments.length > 0 && (
                    <div className="flex items-center gap-2 py-2">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Variáveis</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  {varTxs.sort((a, b) => b.date.localeCompare(a.date)).map(tx => (
                    <div key={tx.id}
                      className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-secondary/50 transition-colors group">
                      <div className="flex items-center justify-center rounded-xl w-8 h-8 shrink-0"
                        style={{
                          background: tx.type === 'income' ? 'hsl(152 69% 45% / 0.15)' : 'hsl(0 72% 51% / 0.15)',
                          color:      tx.type === 'income' ? 'hsl(152 69% 45%)'         : 'hsl(0 72% 51%)',
                        }}>
                        {tx.type === 'income' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.name}</p>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          {METHOD_ICONS[tx.paymentMethod]}
                          <span>{PAYMENT_METHOD_CONFIG[tx.paymentMethod].label}</span>
                          <span>·</span>
                          <span>{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold"
                        style={{ color: tx.type === 'income' ? 'hsl(152 69% 45%)' : undefined }}>
                        {tx.type === 'income' ? '+' : ''}{formatCurrency(tx.amount)}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeletingVarId(tx.id)}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Fixed expenses — always shown when no card filter */}
              {!selectedCardId && fixedExpenses.length > 0 && (
                <>
                  {(installments.length > 0 || varTxs.length > 0) && (
                    <div className="flex items-center gap-2 py-2">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Fixos</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  {fixedExpenses.map(f => (
                    <div key={f.id} className="flex items-center gap-3 py-2 px-2 rounded-xl">
                      <CategoryIcon category={f.category} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.name}</p>
                        <p className="text-xs text-muted-foreground">Fixo mensal</p>
                      </div>
                      <span className="text-sm font-semibold">{formatCurrency(f.amount)}</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {editingExpense && (
        <EditExpenseDialog expense={editingExpense} cards={cards} open={!!editingExpense}
          onClose={() => setEditingExpense(null)} onSaved={refresh} />
      )}

      <AlertDialog open={!!deletingExpenseId} onOpenChange={v => !v && setDeletingExpenseId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir gasto?</AlertDialogTitle>
            <AlertDialogDescription>Todas as parcelas serão removidas de todos os meses.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCard} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingVarId} onOpenChange={v => !v && setDeletingVarId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lançamento?</AlertDialogTitle>
            <AlertDialogDescription>Este lançamento será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteVar} className="bg-destructive hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}