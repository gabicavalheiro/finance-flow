import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Search, Tag, CreditCard as CardIcon, Zap, CheckSquare, Square, Loader2 } from 'lucide-react';
import {
  Expense, CreditCard, MonthlyInstallment, VariableTransaction,
  CATEGORY_CONFIG, INCOME_CATEGORY_CONFIG,
} from '@/lib/types';
import { updateExpense, updateVariableTransaction } from '@/lib/store';
import { resolveCategoryInfo } from '@/lib/customCategories';
import CategorySelect from '@/components/CategorySelect';
import CategoryIcon from '@/components/CategoryIcon';
import { formatCurrency } from '@/lib/helpers';
import { cn } from '@/lib/utils';

// ─── Tipos internos ──────────────────────────────────────────────────────────

interface BulkItem {
  /** id único para o item na lista */
  key: string;
  /** expense.id (para cartão) ou variableTransaction.id */
  id: string;
  source: 'card' | 'variable';
  type: 'expense' | 'income';
  name: string;
  amount: number;
  category: string;
  /** ex: "Nubank · 2/3" */
  subtitle: string;
  /** referência ao objeto original (para fazer update) */
  originalExpense?: Expense;
  originalVar?: VariableTransaction;
}

interface Props {
  open: boolean;
  onClose: () => void;
  month: string;
  /** Todas as parcelas do mês */
  installments: MonthlyInstallment[];
  /** Todos os gastos originais (para recuperar o Expense completo) */
  expenses: Expense[];
  /** Transações variáveis do mês */
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
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState<'all' | 'expense' | 'income'>('all');
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [newCategory, setNewCat]  = useState<string>('other');
  const [saving, setSaving]       = useState(false);

  const cardMap     = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards]);
  const expenseMap  = useMemo(() => new Map(expenses.map(e => [e.id, e])), [expenses]);

  // Deduplica installments por expenseId (uma linha por expense, não por parcela)
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

  // ── Salvar ───────────────────────────────────────────────────────────────
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

  const handleClose = () => {
    setSearch('');
    setSelected(new Set());
    setFilter('all');
    onClose();
  };

  // tipo predominante da seleção (para o CategorySelect)
  const selectionType: 'expense' | 'income' = useMemo(() => {
    const sel = allItems.filter(i => selected.has(i.key));
    const hasIncome = sel.some(i => i.type === 'income');
    const hasExpense = sel.some(i => i.type === 'expense');
    // se misto ou nenhum → expense como padrão
    return hasIncome && !hasExpense ? 'income' : 'expense';
  }, [allItems, selected]);

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="bg-card border-border rounded-3xl max-w-lg w-[95vw] p-0 gap-0 flex flex-col max-h-[90vh]">

        {/* ── Cabeçalho ── */}
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'hsl(263 70% 58% / 0.15)', color: 'hsl(263 70% 68%)' }}>
              <Tag size={15} />
            </div>
            <DialogTitle className="text-base font-semibold">Editar categorias em massa</DialogTitle>
          </div>
        </DialogHeader>

        {/* ── Filtros e busca ── */}
        <div className="px-5 pb-3 space-y-2.5 shrink-0">
          {/* Busca */}
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
        <div className="overflow-y-auto flex-1 px-3 pb-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">
              Nenhum lançamento encontrado
            </p>
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map((item, idx) => {
                const isSelected = selected.has(item.key);
                return (
                  <motion.div
                    key={item.key}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => toggleItem(item.key)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all mb-1',
                      isSelected
                        ? 'bg-primary/10 border border-primary/25'
                        : 'hover:bg-secondary/60 border border-transparent',
                    )}
                  >
                    {/* Checkbox */}
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleItem(item.key)}
                      className="border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary shrink-0"
                      onClick={e => e.stopPropagation()}
                    />

                    {/* Ícone */}
                    <CategoryIcon category={item.category} size={14} />

                    {/* Nome + subtítulo */}
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

                    {/* Categoria atual + valor */}
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold"
                        style={{ color: item.type === 'income' ? 'hsl(152 69% 45%)' : undefined }}>
                        {item.type === 'income' ? '+' : ''}{formatCurrency(item.amount)}
                      </p>
                      <span
                        className="inline-block text-[10px] px-1.5 py-0.5 rounded-md mt-0.5"
                        style={{
                          background: `hsl(${categoryColor(item.category)} / 0.12)`,
                          color: `hsl(${categoryColor(item.category)})`,
                        }}
                      >
                        {categoryLabel(item.category)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* ── Rodapé ── */}
        <div className="px-5 pt-3 pb-5 border-t border-border shrink-0 space-y-3">
          {/* Info selecionados */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
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

          {/* Seletor de nova categoria */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Nova categoria para os selecionados</p>
            <CategorySelect
              type={selectionType}
              value={newCategory}
              onChange={setNewCat}
            />
          </div>

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
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
