// src/pages/SubscriptionsPage.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Circle, Repeat2, ChevronDown, ChevronUp, Loader2, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency, getCurrentMonth } from '@/lib/helpers';
import { Subscription, getSubscriptions, deleteSubscription, toggleSubscriptionPaid, toggleSubscriptionActive, monthlyAmount } from '@/lib/subscriptions';
import { fixedAmountForMonth } from '@/lib/fixedExpenses';
import { computeInstallmentsForMonth, getVariableForMonth, deleteExpense, deleteFixedExpense, deleteVariableTransaction } from '@/lib/store';
import { VariableTransaction, PAYMENT_METHOD_CONFIG, Expense, FixedExpense } from '@/lib/types';
import { useFinanceData } from '@/contexts/FinanceDataContext';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import EditExpenseDialog from '@/components/EditExpenseDialog';
import EditFixedExpenseDialog from '@/components/EditFixedExpenseDialog';
import EditVariableDialog from '@/components/EditVariableDialog';
import { FormState } from '@/features/subscriptions/constants';
import { IdentifiedItem } from '@/features/subscriptions/types';
import { FormDialog } from '@/features/subscriptions/components/FormDialog';
import { SubCard } from '@/features/subscriptions/components/SubCard';

// ─── Constantes ───────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const { cards, expenses, fixedExpenses, refresh: refreshFinance } = useFinanceData();
  const [subs,       setSubs]       = useState<Subscription[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [month]                     = useState(getCurrentMonth());
  const [formOpen,   setFormOpen]   = useState(false);
  const [editing,    setEditing]    = useState<Subscription | undefined>();
  const [prefill,    setPrefill]    = useState<Partial<FormState> | undefined>();
  const [toDelete,   setToDelete]   = useState<Subscription | null>(null);
  const [loadingId,  setLoadingId]  = useState<string | null>(null);
  const [showPaused, setShowPaused] = useState(false);
  const [variableTx, setVariableTx] = useState<VariableTransaction[]>([]);

  // Edição/remoção do lançamento raiz (a partir da lista "Identificados")
  const [editingCardExpense,  setEditingCardExpense]  = useState<Expense | null>(null);
  const [editingFixedExpense, setEditingFixedExpense] = useState<FixedExpense | null>(null);
  const [editingVarTx,        setEditingVarTx]        = useState<VariableTransaction | null>(null);
  const [deletingIdentified,  setDeletingIdentified]  = useState<IdentifiedItem | null>(null);
  const [deletingRoot,        setDeletingRoot]        = useState(false);
  // Item de origem quando a assinatura é criada via "+" em "Identificados" —
  // usado pra remover o lançamento avulso original e não contar em dobro.
  const [quickAddSource, setQuickAddSource] = useState<IdentifiedItem | null>(null);

  const cardMap = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards]);

  // Busca lançamentos variáveis (PIX/dinheiro/etc.) do mês, só para identificar
  // os que estão na categoria "Assinatura"
  const loadVariableTx = useCallback(() => {
    getVariableForMonth(month).then(setVariableTx).catch(() => {});
  }, [month]);
  useEffect(() => { loadVariableTx(); }, [loadVariableTx]);

  // Nomes já cadastrados no controle formal de assinaturas — usado pra sumir
  // da lista de "identificados" assim que o item for adicionado (ou já existir).
  const subNames = useMemo(
    () => new Set(subs.map(s => s.name.trim().toLowerCase())),
    [subs],
  );

  // Todo lançamento (cartão, fixo ou variável) categorizado como "Assinatura"
  // que ainda não está cadastrado no controle formal acima. Apenas identificação
  // — não entra nos totais Mensal/Anual/Pagas, pra não duplicar valores.
  const identified = useMemo<IdentifiedItem[]>(() => {
    const items: IdentifiedItem[] = [];

    const expenseMap = new Map(expenses.map(e => [e.id, e]));
    computeInstallmentsForMonth(expenses, cards, month)
      .filter(inst => inst.category === 'subscription')
      .forEach(inst => {
        items.push({
          id:      `card-${inst.expenseId}-${inst.installmentNumber}`,
          name:    inst.expenseName,
          amount:  inst.amount,
          source:  'Cartão',
          detail:  cardMap.get(inst.cardId)?.name,
          cardId:  inst.cardId,
          expense: expenseMap.get(inst.expenseId),
        });
      });

    fixedExpenses
      .filter(fx => fx.category === 'subscription')
      .forEach(fx => {
        items.push({
          id: `fixed-${fx.id}`, name: fx.name, amount: fixedAmountForMonth(fx, month),
          source: 'Fixo', fixedExpense: fx,
        });
      });

    variableTx
      .filter(tx => tx.type === 'expense' && tx.category === 'subscription')
      .forEach(tx => {
        items.push({
          id:         `var-${tx.id}`,
          name:       tx.name,
          amount:     tx.amount,
          source:     'Variável',
          detail:     PAYMENT_METHOD_CONFIG[tx.paymentMethod]?.label,
          variableTx: tx,
        });
      });

    // Remove os que já foram cadastrados (por nome) no controle formal
    return items.filter(item => !subNames.has(item.name.trim().toLowerCase()));
  }, [expenses, cards, cardMap, fixedExpenses, variableTx, month, subNames]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSubs(await getSubscriptions());
    } catch (e) {
      console.error('Erro ao carregar assinaturas:', e);
      toast.error('Não consegui carregar as assinaturas. Tenta recarregar a página.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = useMemo(() => subs.filter(s => s.active),  [subs]);
  const paused = useMemo(() => subs.filter(s => !s.active), [subs]);

  const totalMonthly = useMemo(
    () => active.reduce((sum, s) => sum + monthlyAmount(s), 0),
    [active],
  );
  const totalAnnual = useMemo(
    () => active.reduce((sum, s) => sum + (s.billingCycle === 'annual' ? s.amount : s.amount * 12), 0),
    [active],
  );
  const paidThisMonth = useMemo(
    () => active.filter(s => s.paidMonths.includes(month)).length,
    [active, month],
  );
  const unpaidAmount = useMemo(
    () => active
      .filter(s => !s.paidMonths.includes(month))
      .reduce((sum, s) => sum + monthlyAmount(s), 0),
    [active, month],
  );

  const handleEdit   = (s: Subscription) => { setPrefill(undefined); setQuickAddSource(null); setEditing(s); setFormOpen(true); };
  const handleAddNew = () => { setEditing(undefined); setPrefill(undefined); setQuickAddSource(null); setFormOpen(true); };
  const handleQuickAdd = (item: IdentifiedItem) => {
    setEditing(undefined);
    setPrefill({
      name:   item.name,
      amount: item.amount,
      cardId: item.cardId ?? '',
    });
    setQuickAddSource(item);
    setFormOpen(true);
  };

  // Depois de criar a assinatura a partir de um item identificado, remove o
  // lançamento avulso original — senão o mesmo gasto conta duas vezes (uma
  // como lançamento solto, outra como assinatura recorrente).
  const handleFormSaved = async () => {
    await load();
    if (quickAddSource) {
      try {
        if (quickAddSource.expense) {
          await deleteExpense(quickAddSource.expense.id);
          refreshFinance();
        } else if (quickAddSource.fixedExpense) {
          await deleteFixedExpense(quickAddSource.fixedExpense.id);
          refreshFinance();
        } else if (quickAddSource.variableTx) {
          await deleteVariableTransaction(quickAddSource.variableTx.id);
          loadVariableTx();
        }
      } catch {
        toast.error('Assinatura criada, mas não consegui remover o lançamento original — remova manualmente pra não contar em dobro.');
      } finally {
        setQuickAddSource(null);
      }
    }
  };

  const handleEditIdentified = (item: IdentifiedItem) => {
    if (item.expense) setEditingCardExpense(item.expense);
    else if (item.fixedExpense) setEditingFixedExpense(item.fixedExpense);
    else if (item.variableTx) setEditingVarTx(item.variableTx);
  };

  const confirmDeleteIdentified = async () => {
    if (!deletingIdentified) return;
    setDeletingRoot(true);
    try {
      if (deletingIdentified.expense) {
        await deleteExpense(deletingIdentified.expense.id);
        refreshFinance();
      } else if (deletingIdentified.fixedExpense) {
        await deleteFixedExpense(deletingIdentified.fixedExpense.id);
        refreshFinance();
      } else if (deletingIdentified.variableTx) {
        await deleteVariableTransaction(deletingIdentified.variableTx.id);
        loadVariableTx();
      }
      toast.success('Lançamento removido');
    } catch {
      toast.error('Erro ao remover lançamento');
    } finally {
      setDeletingRoot(false);
      setDeletingIdentified(null);
    }
  };

  const handleTogglePaid = async (sub: Subscription) => {
    setLoadingId(sub.id);
    try {
      await toggleSubscriptionPaid(sub, month);
      setSubs(prev => prev.map(s =>
        s.id !== sub.id ? s : {
          ...s,
          paidMonths: s.paidMonths.includes(month)
            ? s.paidMonths.filter(m => m !== month)
            : [...s.paidMonths, month],
        },
      ));
      toast.success(sub.paidMonths.includes(month) ? 'Desmarcado' : `${sub.name} paga!`);
    } catch {
      toast.error('Erro ao atualizar');
      load();
    } finally {
      setLoadingId(null);
    }
  };

  const handleToggleActive = async (sub: Subscription) => {
    setLoadingId(sub.id);
    try {
      const newActive = !sub.active;
      await toggleSubscriptionActive(sub.id, newActive);
      setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, active: newActive } : s));
      toast.success(newActive ? `${sub.name} reativada` : `${sub.name} pausada`);
    } catch {
      toast.error('Erro ao atualizar');
      load();
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteSubscription(toDelete.id);
      setSubs(prev => prev.filter(s => s.id !== toDelete.id));
      toast.success(`${toDelete.name} removida`);
    } catch {
      toast.error('Erro ao remover');
    } finally {
      setToDelete(null);
    }
  };

  function renderCards(list: Subscription[]) {
    return list.map(sub => (
      <SubCard
        key={sub.id}
        sub={sub}
        month={month}
        cardName={sub.cardId ? cardMap.get(sub.cardId)?.name : undefined}
        onEdit={handleEdit}
        onDelete={setToDelete}
        onTogglePaid={handleTogglePaid}
        onToggleActive={handleToggleActive}
        loadingId={loadingId}
      />
    ));
  }

  return (
    <div className="min-h-dvh pb-24 md:pb-8 pt-6 px-4 md:px-8 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Repeat2 size={22} className="text-primary" />
            Assinaturas
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recorrências automáticas todo mês
          </p>
        </div>
        <Button
          onClick={handleAddNew}
          size="sm"
          className="gap-2 text-white"
          style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
        >
          <Plus size={16} />
          Nova
        </Button>
      </div>

      {/* Resumo */}
      {!loading && active.length > 0 && (
        <div className="stat-grid gap-3 mb-6">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Mensal</p>
            <p className="text-lg font-bold mt-1 tabular-nums">{formatCurrency(totalMonthly)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Anual</p>
            <p className="text-lg font-bold mt-1 tabular-nums">{formatCurrency(totalAnnual)}</p>
          </div>
          <div className={cn(
            'rounded-2xl p-4 border',
            paidThisMonth === active.length
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-card border-border',
          )}>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Pagas</p>
            <p className={cn(
              'text-lg font-bold mt-1',
              paidThisMonth === active.length ? 'text-emerald-400' : 'text-foreground',
            )}>
              {paidThisMonth}/{active.length}
            </p>
          </div>
        </div>
      )}

      {/* Alerta pendentes */}
      {!loading && unpaidAmount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
          <Circle size={16} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-300">
              {formatCurrency(unpaidAmount)} ainda a pagar este mês
            </p>
            <p className="text-xs text-muted-foreground">
              {active.filter(s => !s.paidMonths.includes(month)).length} assinatura(s) pendente(s)
            </p>
          </div>
        </div>
      )}

      {/* Lista ativa */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : active.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📦</div>
          <p className="text-muted-foreground font-medium">Nenhuma assinatura cadastrada</p>
          <p className="text-muted-foreground/60 text-sm mt-1">
            Adicione suas assinaturas recorrentes para controlá-las aqui
          </p>
          <Button
            onClick={handleAddNew}
            className="mt-4 gap-2 text-white"
            style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
          >
            <Plus size={16} /> Adicionar assinatura
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {renderCards(active)}
          </AnimatePresence>
        </div>
      )}

      {/* Identificados nos lançamentos (categoria Assinatura, fora do controle acima) */}
      {!loading && identified.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-1.5">
            <Tags size={14} className="text-muted-foreground" />
            <p className="text-sm font-semibold">Identificados nos lançamentos</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
              {identified.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Categorizados como "Assinatura" em Cartões, Fixos ou Lançamentos, mas ainda não cadastrados acima. Não entram nos totais.
          </p>
          <div className="space-y-2">
            {identified.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3.5 rounded-2xl border border-dashed border-border bg-secondary/30"
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                  <Tags size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.source}{item.detail ? ` · ${item.detail}` : ''}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(item.amount)}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleQuickAdd(item)}
                    title="Cadastrar como assinatura"
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => handleEditIdentified(item)}
                    title="Editar lançamento"
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeletingIdentified(item)}
                    title="Remover lançamento"
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pausadas */}
      {paused.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowPaused(v => !v)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            {showPaused ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {paused.length} assinatura{paused.length > 1 ? 's' : ''} pausada{paused.length > 1 ? 's' : ''}
          </button>
          <AnimatePresence>
            {showPaused && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2.5 overflow-hidden"
              >
                {renderCards(paused)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Form dialog */}
      <FormDialog
        open={formOpen}
        editing={editing}
        prefill={prefill}
        onClose={() => { setFormOpen(false); setEditing(undefined); setPrefill(undefined); setQuickAddSource(null); }}
        onSaved={handleFormSaved}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!toDelete} onOpenChange={o => { if (!o) setToDelete(null); }}>
        <AlertDialogContent className="bg-card border-border max-w-xs rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover assinatura</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover <strong>{toDelete?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleDelete}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Editar lançamento raiz (a partir de "Identificados nos lançamentos") */}
      {editingCardExpense && (
        <EditExpenseDialog
          expense={editingCardExpense}
          cards={cards}
          open={!!editingCardExpense}
          onClose={() => setEditingCardExpense(null)}
          onSaved={() => { setEditingCardExpense(null); refreshFinance(); }}
        />
      )}
      {editingFixedExpense && (
        <EditFixedExpenseDialog
          expense={editingFixedExpense}
          open={!!editingFixedExpense}
          onClose={() => setEditingFixedExpense(null)}
          onSaved={() => { setEditingFixedExpense(null); refreshFinance(); }}
        />
      )}
      {editingVarTx && (
        <EditVariableDialog
          transaction={editingVarTx}
          open={!!editingVarTx}
          onClose={() => setEditingVarTx(null)}
          onSaved={() => { setEditingVarTx(null); loadVariableTx(); }}
        />
      )}

      {/* Remover lançamento raiz */}
      <AlertDialog open={!!deletingIdentified} onOpenChange={o => { if (!o) setDeletingIdentified(null); }}>
        <AlertDialogContent className="bg-card border-border max-w-xs rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover <strong>{deletingIdentified?.name}</strong>
              {deletingIdentified?.source === 'Cartão' ? ' (todas as parcelas)' : ''}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRoot}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={confirmDeleteIdentified}
              disabled={deletingRoot}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}