import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Search, Tag, CreditCard as CardIcon, Zap, CheckSquare, Square,
  Loader2, Trash2, Pencil,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Expense, CreditCard, MonthlyInstallment, VariableTransaction,
  CATEGORY_CONFIG, INCOME_CATEGORY_CONFIG,
} from '@/lib/types';
import {
  updateExpense, updateVariableTransaction,
  deleteExpense, deleteVariableTransaction,
} from '@/lib/store';
import { resolveCategoryInfo } from '@/lib/customCategories';
import CategorySelect from '@/components/CategorySelect';
import CategoryIcon from '@/components/CategoryIcon';
import { formatCurrency } from '@/lib/helpers';
import { cn } from '@/lib/utils';

// ─── Tipos internos ──────────────────────────────────────────────────────────

interface BulkItem {
  key: string;
  id: string;
  source: 'card' | 'variable';
  type: 'expense' | 'income';
  name: string;
  amount: number;
  category: string;
  subtitle: string;
  originalExpense?: Expense;
  originalVar?: VariableTransaction;
}

interface Props {
  open: boolean;
  onClose: () => void;
  month: string;
  installments: MonthlyInstallment[];
  expenses: Expense[];
  varTxs: VariableTransaction[];
  cards: CreditCard[];
  onSaved: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function categoryLabel(key: string): string {
  return resolveCategoryInfo(key).label;
}

function categoryColor(key: string): string {
  return resolveCategoryInfo(key).color;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BulkEditCategoryDialog({
  open, onClose, installments, expenses, varTxs, cards, onSaved,
}: Props) {
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState<'all' | 'expense' | 'income'>('all');
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [newCategory, setNewCat]    = useState<string>('other');
  const [saving, setSaving]         = useState(false);
  const [mode, setMode]             = useState<'edit' | 'delete'>('edit');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cardMap     = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards]);
  const expenseMap  = useMemo(() => new Map(expenses.map(e => [e.id, e])), [expenses]);

  // Deduplica installments por expenseId
  const cardItems = useMemo<BulkItem[]>(() => {
    const seen = new Set<string>();
    const items: BulkItem[] = [];
    for (const inst of installments) {
      if (seen.has(inst.expenseId)) continue;
      seen.add(inst.expenseId);
      const exp  = expenseMap.get(inst.expenseId);
      const card = cardMap.get(inst.cardId);
      if (!exp) continue;
      items.push({
        key:             `card-${inst.expenseId}`,
        id:              inst.expenseId,
        source:          'card',
        type:            'expense',
        name:            inst.expenseName,
        amount:          exp.totalAmount / exp.installments,
        category:        inst.category,
        subtitle:        `${card?.name ?? 'Cartão'} · ${inst.installmentNumber}/${inst.totalInstallments}`,
        originalExpense: exp,
      });
    }
    return items;
  }, [installments, expenseMap, cardMap]);

  const varItems = useMemo<BulkItem[]>(() =>
    varTxs.map(tx => ({
      key:         `var-${tx.id}`,
      id:          tx.id,
      source:      'variable',
      type:        tx.type,
      name:        tx.name,
      amount:      tx.amount,
      category:    tx.category,
      subtitle:    tx.type === 'expense' ? 'Variável · Gasto' : 'Variável · Ganho',
      originalVar: tx,
    })),
  [varTxs]);

  const allItems = useMemo(() => [...cardItems, ...varItems], [cardItems, varItems]);

  const filtered = useMemo(() => {
    let items = allItems;
    if (filter !== 'all') items = items.filter(i => i.type === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        categoryLabel(i.category).toLowerCase().includes(q)
      );
    }
    return items;
  }, [allItems, filter, search]);

  // ── Seleção ──────────────────────────────────────────────────────────────
  const allFilteredKeys = filtered.map(i => i.key);
  const allSelected     = allFilteredKeys.length > 0 && allFilteredKeys.every(k => selected.has(k));
  const someSelected    = allFilteredKeys.some(k => selected.has(k)) && !allSelected;

  const toggleItem = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        allFilteredKeys.forEach(k => next.delete(k));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        allFilteredKeys.forEach(k => next.add(k));
        return next;
      });
    }
  }, [allSelected, allFilteredKeys]);

  const selectedCount = allItems.filter(i => selected.has(i.key)).length;

  // ── Editar categorias ────────────────────────────────────────────────────
  const handleApply = async () => {
    if (selected.size === 0) { toast.error('Selecione ao menos um lançamento'); return; }
    if (!newCategory)        { toast.error('Escolha a nova categoria');           return; }

    setSaving(true);
    try {
      const toUpdate = allItems.filter(i => selected.has(i.key));

      await Promise.all(toUpdate.map(item => {
        if (item.source === 'card' && item.originalExpense) {
          return updateExpense({ ...item.originalExpense, category: newCategory as Expense['category'] });
        }
        if (item.source === 'variable') {
          return updateVariableTransaction(item.id, { category: newCategory as VariableTransaction['category'] });
        }
        return Promise.resolve();
      }));

      toast.success(
        `${toUpdate.length} lançamento${toUpdate.length > 1 ? 's' : ''} atualizado${toUpdate.length > 1 ? 's' : ''}!`
      );
      setSelected(new Set());
      onSaved();
      onClose();
    } catch {
      toast.error('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  // ── Excluir em massa ─────────────────────────────────────────────────────
  const handleDeleteConfirmed = async () => {
    setSaving(true);
    try {
      const toDelete = allItems.filter(i => selected.has(i.key));

      await Promise.all(toDelete.map(item => {
        if (item.source === 'card') {
          return deleteExpense(item.id);
        }
        if (item.source === 'variable') {
          return deleteVariableTransaction(item.id);
        }
        return Promise.resolve();
      }));

      toast.success(
        `${toDelete.length} lançamento${toDelete.length > 1 ? 's' : ''} excluído${toDelete.length > 1 ? 's' : ''}!`
      );
      setSelected(new Set());
      setConfirmDelete(false);
      onSaved();
      onClose();
    } catch {
      toast.error('Erro ao excluir lançamentos');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSearch('');
    setSelected(new Set());
    setFilter('all');
    setMode('edit');
    onClose();
  };

  // tipo predominante da seleção (para o CategorySelect)
  const selectionType: 'expense' | 'income' = useMemo(() => {
    const sel = allItems.filter(i => selected.has(i.key));
    const hasIncome  = sel.some(i => i.type === 'income');
    const hasExpense = sel.some(i => i.type === 'expense');
    return hasIncome && !hasExpense ? 'income' : 'expense';
  }, [allItems, selected]);

  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && handleClose()}>
        <DialogContent className="bg-card border-border rounded-3xl max-w-lg w-[95vw] p-0 gap-0 flex flex-col max-h-[90vh]">

          {/* ── Cabeçalho ── */}
          <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  background: mode === 'delete'
                    ? 'hsl(0 72% 51% / 0.15)'
                    : 'hsl(263 70% 58% / 0.15)',
                  color: mode === 'delete'
                    ? 'hsl(0 72% 61%)'
                    : 'hsl(263 70% 68%)',
                }}
              >
                {mode === 'delete' ? <Trash2 size={15} /> : <Tag size={15} />}
              </div>
              <DialogTitle className="text-base font-semibold">
                {mode === 'delete' ? 'Excluir em massa' : 'Editar categorias em massa'}
              </DialogTitle>
            </div>
          </DialogHeader>

          {/* ── Toggle de modo ── */}
          <div className="px-5 pb-3 shrink-0">
            <div className="flex gap-1 p-1 rounded-xl bg-secondary">
              <button
                onClick={() => setMode('edit')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  mode === 'edit'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Pencil size={12} />
                Editar categoria
              </button>
              <button
                onClick={() => setMode('delete')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  mode === 'delete'
                    ? 'bg-destructive/15 text-destructive shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Trash2 size={12} />
                Excluir
              </button>
            </div>
          </div>

          {/* ── Filtros e busca ── */}
          <div className="px-5 pb-3 space-y-2.5 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar lançamento..."
                className="pl-9 bg-secondary border-border text-sm h-9"
              />
            </div>

            {/* Abas tipo */}
            <div className="flex gap-1.5">
              {([
                { key: 'all',     label: 'Todos'  },
                { key: 'expense', label: 'Gastos' },
                { key: 'income',  label: 'Ganhos' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium transition-all border',
                    filter === tab.key
                      ? 'text-white border-transparent'
                      : 'bg-secondary border-border text-muted-foreground hover:text-foreground',
                  )}
                  style={filter === tab.key
                    ? { background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }
                    : undefined}
                >
                  {tab.label}
                </button>
              ))}
              <span className="ml-auto text-xs text-muted-foreground self-center">
                {filtered.length} lançamento{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Selecionar todos */}
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {allSelected
                ? <CheckSquare size={14} className="text-primary" />
                : someSelected
                ? <CheckSquare size={14} className="text-primary/50" />
                : <Square size={14} />
              }
              {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          </div>

          {/* ── Lista ── */}
          <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-1.5 min-h-0">
            <AnimatePresence initial={false}>
              {filtered.map(item => {
                const isSelected = selected.has(item.key);
                const catColor   = categoryColor(item.category); // ainda usado no badge de categoria
                return (
                  <motion.button
                    key={item.key}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => toggleItem(item.key)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                      isSelected
                        ? mode === 'delete'
                          ? 'bg-destructive/10 border-destructive/40'
                          : 'bg-primary/8 border-primary/30'
                        : 'bg-secondary border-transparent hover:border-border',
                    )}
                  >
                    {/* Checkbox */}
                    <div
                      className={cn(
                        'w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all',
                        isSelected
                          ? mode === 'delete'
                            ? 'bg-destructive border-destructive'
                            : 'bg-primary border-primary'
                          : 'border-border bg-background',
                      )}
                    >
                      {isSelected && (
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    {/* Ícone categoria */}
                    <CategoryIcon category={item.category} size={14} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {item.source === 'card'
                          ? <CardIcon size={10} className="text-muted-foreground shrink-0" />
                          : <Zap size={10} className="text-muted-foreground shrink-0" />
                        }
                        <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                      </div>
                    </div>

                    {/* Valores */}
                    <div className="text-right shrink-0">
                      <p className={cn(
                        'text-sm font-semibold',
                        item.type === 'income' ? 'text-green-500' : '',
                      )}>
                        {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                      </p>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: `${catColor}22`, color: catColor }}
                      >
                        {categoryLabel(item.category)}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>

            {filtered.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Nenhum lançamento encontrado
              </div>
            )}
          </div>

          {/* ── Rodapé ── */}
          <div className="px-5 pb-5 pt-3 border-t border-border shrink-0 space-y-3">

            {/* Contador de selecionados */}
            <div className="flex items-center justify-between text-xs">
              <span className={cn(
                'font-medium',
                selectedCount > 0
                  ? mode === 'delete' ? 'text-destructive' : 'text-primary'
                  : 'text-muted-foreground',
              )}>
                {selectedCount === 0
                  ? 'Nenhum selecionado'
                  : `${selectedCount} selecionado${selectedCount > 1 ? 's' : ''}`}
              </span>
              {selectedCount > 0 && (
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Seletor de nova categoria (só no modo editar) */}
            {mode === 'edit' && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Nova categoria para os selecionados</p>
                <CategorySelect
                  type={selectionType}
                  value={newCategory}
                  onChange={setNewCat}
                />
              </div>
            )}

            {/* Aviso no modo excluir */}
            {mode === 'delete' && selectedCount > 0 && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20">
                <Trash2 size={13} className="text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-destructive leading-relaxed">
                  <strong>{selectedCount} lançamento{selectedCount > 1 ? 's' : ''}</strong> será{selectedCount > 1 ? 'ão' : ''} excluído{selectedCount > 1 ? 's' : ''} permanentemente. Esta ação não pode ser desfeita.
                </p>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 bg-secondary border-border"
                disabled={saving}
              >
                Cancelar
              </Button>

              {mode === 'edit' ? (
                <Button
                  onClick={handleApply}
                  disabled={saving || selectedCount === 0}
                  className="flex-1 text-white"
                  style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
                >
                  {saving
                    ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Salvando...</>
                    : `Aplicar${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (selectedCount === 0) { toast.error('Selecione ao menos um lançamento'); return; }
                    setConfirmDelete(true);
                  }}
                  disabled={saving || selectedCount === 0}
                  className="flex-1 bg-destructive hover:bg-destructive/90 text-white"
                >
                  {saving
                    ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Excluindo...</>
                    : <><Trash2 size={14} className="mr-1.5" /> Excluir{selectedCount > 0 ? ` (${selectedCount})` : ''}</>}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirmação de exclusão ── */}
      <AlertDialog open={confirmDelete} onOpenChange={v => !v && setConfirmDelete(false)}>
        <AlertDialogContent className="bg-card border-border max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedCount} lançamento{selectedCount > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e não pode ser desfeita. Os lançamentos selecionados serão removidos do seu histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-secondary border-border"
              onClick={() => setConfirmDelete(false)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              className="bg-destructive hover:bg-destructive/90"
              disabled={saving}
            >
              {saving
                ? 'Excluindo...'
                : `Excluir ${selectedCount > 1 ? 'todos' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}