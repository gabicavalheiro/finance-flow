import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, TrendingDown, TrendingUp, Scale,
  Pencil, Trash2, ArrowDownCircle, ArrowUpCircle,
  Zap, Banknote, ArrowLeftRight, CreditCard as DebitIcon, FileText,
  Menu, LogOut, UserRound, Mail, RefreshCw, ChevronRight,
} from 'lucide-react';
import MonthSelector from '@/components/MonthSelector';
import AddExpenseDialog from '@/components/AddExpenseDialog';
import AddVariableDialog from '@/components/AddVariableDialog';
import EditExpenseDialog from '@/components/EditExpenseDialog';
import CategoryIcon from '@/components/CategoryIcon';
import { getCurrentMonth, formatCurrency } from '@/lib/helpers';
import {
  getCards, getExpenses, getFixedExpenses, getIncomes,
  getVariableForMonth, deleteExpense, deleteVariableTransaction,
  computeInstallmentsForMonth, computeCategoryTotals,
} from '@/lib/store';
import { getUser, logoutUser } from '@/lib/auth';
import {
  CATEGORY_CONFIG, ExpenseCategory, Expense, CreditCard,
  FixedExpense, FixedIncome, VariableTransaction, PAYMENT_METHOD_CONFIG,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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

// Gera as iniciais do nome para o avatar
function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function Dashboard() {
  const [month, setMonth]                         = useState(getCurrentMonth());
  const [selectedCardId, setSelectedCardId]       = useState<string | null>(null);
  const [editingExpense, setEditingExpense]        = useState<Expense | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [deletingVarId, setDeletingVarId]         = useState<string | null>(null);

  // Menu sheet
  const [menuOpen, setMenuOpen]     = useState(false);
  const [logoutDialog, setLogout]   = useState(false);
  const [userName, setUserName]     = useState('');
  const [userEmail, setUserEmail]   = useState('');

  // Data state
  const [cards, setCards]               = useState<CreditCard[]>([]);
  const [expenses, setExpenses]         = useState<Expense[]>([]);
  const [fixedExpenses, setFixed]       = useState<FixedExpense[]>([]);
  const [incomes, setIncomes]           = useState<FixedIncome[]>([]);
  const [varTxs, setVarTxs]             = useState<VariableTransaction[]>([]);
  const [loadingData, setLoadingData]   = useState(true);

  // Carrega usuário uma vez
  useEffect(() => {
    getUser().then(u => {
      if (u) { setUserName(u.name); setUserEmail(u.email); }
    });
  }, []);

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    const [c, e, f, i, v] = await Promise.all([
      getCards(), getExpenses(), getFixedExpenses(), getIncomes(), getVariableForMonth(month),
    ]);
    setCards(c); setExpenses(e); setFixed(f); setIncomes(i); setVarTxs(v);
    setLoadingData(false);
  }, [month]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const allInstallments = computeInstallmentsForMonth(expenses, cards, month);
  const installments    = selectedCardId ? allInstallments.filter(i => i.cardId === selectedCardId) : allInstallments;
  const categoryTotals  = computeCategoryTotals(allInstallments, fixedExpenses);

  const totalLimit     = cards.reduce((s, c) => s + c.limit, 0);
  const totalCardSpent = allInstallments.reduce((s, i) => s + i.amount, 0);
  const available      = totalLimit - totalCardSpent;

  const totalVarInc  = varTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalVarExp  = varTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const receivedFixedIncome = incomes
    .filter(i => i.receivedMonths.includes(month))
    .reduce((s, i) => s + i.amount, 0);
  const pendingFixedIncome = incomes
    .filter(i => !i.receivedMonths.includes(month))
    .reduce((s, i) => s + i.amount, 0);

  const totalIncome  = receivedFixedIncome + totalVarInc;
  const totalExpense = totalCardSpent + fixedExpenses.reduce((s, f) => s + f.amount, 0) + totalVarExp;
  const balance      = totalIncome - totalExpense;

  const cardMap        = new Map(cards.map(c => [c.id, c]));
  const getExpenseById = (id: string) => expenses.find(e => e.id === id);

  const pieData = Object.entries(categoryTotals)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: CATEGORY_CONFIG[key as ExpenseCategory]?.label ?? key,
      value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const confirmDeleteExpense = async () => {
    if (!deletingExpenseId) return;
    try {
      await deleteExpense(deletingExpenseId);
      setDeletingExpenseId(null);
      toast.success('Gasto removido');
      loadAll();
    } catch { toast.error('Erro ao remover gasto'); }
  };

  const confirmDeleteVar = async () => {
    if (!deletingVarId) return;
    try {
      await deleteVariableTransaction(deletingVarId);
      setDeletingVarId(null);
      toast.success('Lançamento removido');
      loadAll();
    } catch { toast.error('Erro ao remover lançamento'); }
  };

  const handleLogout = async () => {
    await logoutUser();
    // App.tsx detecta via onAuthStateChange
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pb-24 px-4 pt-5 max-w-lg mx-auto space-y-5">

      {/* ── App header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))',
              boxShadow: '0 4px 12px hsl(263 70% 58% / 0.4)',
            }}
          >
            <Wallet size={17} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Finanças</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Controle pessoal</p>
          </div>
        </div>

        {/* Menu hambúrguer → abre Sheet de perfil */}
        <button
          onClick={() => setMenuOpen(true)}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-secondary"
          style={{ color: 'hsl(240 5% 65%)' }}
        >
          <Menu size={18} />
        </button>
      </div>

      {/* ── Sheet de perfil ── */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="right"
          className="w-72 bg-card border-border p-0 flex flex-col"
        >
          {/* Cabeçalho com avatar + dados */}
          <div
            className="px-6 pt-8 pb-6"
            style={{ background: 'linear-gradient(135deg, hsl(263 70% 58% / 0.15), hsl(220 70% 55% / 0.08))' }}
          >
            {/* Avatar com iniciais */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg mb-4 select-none"
              style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
            >
              {userName ? getInitials(userName) : <UserRound size={24} />}
            </div>

            <p className="text-base font-semibold leading-tight">
              {userName || 'Usuário'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Mail size={11} />
              {userEmail || '—'}
            </p>
          </div>

          {/* Divisor */}
          <div className="h-px bg-border mx-6" />

          {/* Opções */}
          <div className="flex-1 px-4 py-4 space-y-1">

            {/* Trocar de conta */}
            <button
              onClick={async () => {
                setMenuOpen(false);
                await logoutUser();
                // App.tsx redireciona para AuthPage automaticamente
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-secondary group"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary group-hover:bg-secondary/60">
                <RefreshCw size={15} className="text-muted-foreground" />
              </div>
              <span className="flex-1 text-left">Trocar de conta</span>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>

            {/* Sair */}
            <button
              onClick={() => { setMenuOpen(false); setLogout(true); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-destructive/10 group"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary group-hover:bg-destructive/15">
                <LogOut size={15} className="text-destructive" />
              </div>
              <span className="flex-1 text-left text-destructive">Sair</span>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* Rodapé */}
          <div className="px-6 pb-8 pt-2">
            <p className="text-[10px] text-muted-foreground/50 text-center">Finanças · Controle pessoal</p>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Diálogo de confirmação de logout ── */}
      <AlertDialog open={logoutDialog} onOpenChange={setLogout}>
        <AlertDialogContent className="bg-card border-border max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da conta</AlertDialogTitle>
            <AlertDialogDescription>
              {userName ? `Até logo, ${userName.split(' ')[0]}!` : 'Deseja sair?'} Você precisará fazer login novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-destructive hover:bg-destructive/90">
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MonthSelector month={month} onChange={setMonth} />

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-4 border border-border col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <Scale size={16} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Saldo do mês</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: balance >= 0 ? 'hsl(152 69% 45%)' : 'hsl(0 72% 51%)' }}>
            {formatCurrency(balance)}
          </p>
          {pendingFixedIncome > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">
              + {formatCurrency(pendingFixedIncome)} em ganhos fixos pendentes
            </p>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={16} className="text-destructive" />
            <span className="text-xs text-muted-foreground">Total gastos</span>
          </div>
          <p className="text-lg font-bold text-destructive">{formatCurrency(totalExpense)}</p>
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
          {pendingFixedIncome > 0 && (
            <p className="text-[10px] mt-0.5" style={{ color: 'hsl(38 92% 50%)' }}>
              {formatCurrency(pendingFixedIncome)} pendente
            </p>
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
              <div className="h-full rounded-full transition-all"
                style={{
                  width: totalLimit > 0 ? `${Math.min((totalCardSpent / totalLimit) * 100, 100)}%` : '0%',
                  background: 'linear-gradient(90deg, hsl(263 70% 58%), hsl(220 70% 55%))',
                }} />
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Pie chart ── */}
      {pieData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-card rounded-2xl p-4 border border-border">
          <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">Gastos por categoria</p>
          <div className="flex gap-4 items-center">
            <div className="h-36 w-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={52} paddingAngle={2} dataKey="value">
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {pieData.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  <span className="truncate text-muted-foreground flex-1">{entry.name}</span>
                  <span className="font-medium shrink-0">{formatCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Transactions ── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div>
            <p className="text-sm font-semibold">Lançamentos</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {installments.length + varTxs.length} registro{installments.length + varTxs.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AddVariableDialog onAdded={loadAll} />
            {cards.length > 0 && <AddExpenseDialog cards={cards} onAdded={loadAll} iconOnly />}
          </div>
        </div>

        {cards.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setSelectedCardId(null)}
                className={cn(
                  'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap',
                  !selectedCardId ? 'text-white' : 'bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary',
                )}
                style={!selectedCardId ? {
                  background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(280 65% 50%))',
                  boxShadow: '0 0 10px hsl(263 70% 58% / 0.35)',
                } : {}}
              >
                Todos
              </button>
              {cards.map(card => {
                const cardSpent = allInstallments.filter(i => i.cardId === card.id).reduce((s, i) => s + i.amount, 0);
                const isActive  = selectedCardId === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCardId(isActive ? null : card.id)}
                    className={cn(
                      'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap',
                      isActive ? 'text-white' : 'bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary',
                    )}
                    style={isActive ? {
                      background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))',
                      boxShadow: '0 0 10px hsl(263 70% 58% / 0.35)',
                    } : {}}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: isActive ? 'rgba(255,255,255,0.7)' : (card.customGradient ?? 'hsl(263 70% 58%)') }}
                    />
                    {card.name}
                    {cardSpent > 0 && (
                      <span className={isActive ? 'opacity-70' : 'opacity-50'}>{formatCurrency(cardSpent)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {cards.length > 0 && <div className="mx-4 h-px bg-border" />}

        <div className="p-4 space-y-1">
          {loadingData ? (
            <p className="text-xs text-muted-foreground text-center py-6">Carregando...</p>
          ) : installments.length === 0 && fixedExpenses.length === 0 && varTxs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              {selectedCardId ? 'Nenhum lançamento neste cartão' : 'Nenhum lançamento registrado'}
            </p>
          ) : (
            <>
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
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          {METHOD_ICONS[tx.paymentMethod] ?? null}
                          {PAYMENT_METHOD_CONFIG[tx.paymentMethod]?.label ?? tx.paymentMethod}
                          {' · '}{tx.date.split('-').reverse().slice(0, 2).join('/')}
                        </p>
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

      {editingExpense && (
        <EditExpenseDialog
          expense={editingExpense}
          cards={cards}
          open={!!editingExpense}
          onClose={() => setEditingExpense(null)}
          onSaved={loadAll}
        />
      )}

      <AlertDialog open={!!deletingExpenseId} onOpenChange={v => !v && setDeletingExpenseId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover gasto?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteExpense} className="bg-destructive hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingVarId} onOpenChange={v => !v && setDeletingVarId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lançamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
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