import { useState } from 'react';
import { ListChecks, Pencil, X as XIcon } from 'lucide-react';
import { toast } from 'sonner';
import CategorySelect from '@/components/CategorySelect';
import EditExpenseDialog from '@/components/EditExpenseDialog';
import EditFixedExpenseDialog from '@/components/EditFixedExpenseDialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CategoryDetail } from '@/features/reports/calculations';
import { monthLabel } from '@/features/reports/format';
import { CategoryLineItem } from '@/features/reports/types';
import { formatCurrency } from '@/lib/helpers';
import { updateExpense, updateFixedExpense } from '@/lib/store';
import { CreditCard, Expense, ExpenseCategory, FixedExpense } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  /** label da categoria aberta (null = fechado) */
  category: string | null;
  details: Map<string, CategoryDetail>;
  month: string;
  cards: CreditCard[];
  onClose: () => void;
  /** chamado depois de salvar alterações, para recarregar os dados */
  onChanged: () => Promise<void> | void;
}

/** Popup com os lançamentos de uma categoria: seleção em lote, reclassificação e edição. */
export default function CategoryDrilldown({ category, details, month, cards, onClose, onChanged }: Props) {
  const selectedItems = category
    ? [...(details.get(category)?.items ?? [])].sort((a, b) => b.amount - a.amount)
    : [];

  // Seleção múltipla dentro do popup — permite reclassificar vários
  // lançamentos de uma vez (ex: mover tudo que caiu errado em "Outros").
  const [selectMode, setSelectMode]   = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [bulkSaving, setBulkSaving]     = useState(false);

  const closeCategoryPopup = () => {
    onClose();
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkCategory('');
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkApply = async () => {
    if (!bulkCategory || selectedIds.size === 0) return;
    const items = selectedItems.filter(i => selectedIds.has(i.id));
    setBulkSaving(true);
    try {
      await Promise.all(items.map(item => {
        if (item.expense) return updateExpense({ ...item.expense, category: bulkCategory as ExpenseCategory });
        if (item.fixedExpense) return updateFixedExpense(item.fixedExpense.id, { category: bulkCategory as ExpenseCategory });
        return Promise.resolve();
      }));
      toast.success(`${items.length} lançamento${items.length > 1 ? 's' : ''} atualizado${items.length > 1 ? 's' : ''}!`);
      await onChanged();
      setSelectMode(false);
      setSelectedIds(new Set());
      setBulkCategory('');
    } catch {
      toast.error('Erro ao atualizar os lançamentos selecionados');
    }
    setBulkSaving(false);
  };

  // Edição de um lançamento a partir do popup — fecha o popup e abre o
  // dialog de edição correspondente (gasto de cartão ou gasto fixo).
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingFixed, setEditingFixed]     = useState<FixedExpense | null>(null);

  const handleEditItem = (item: CategoryLineItem) => {
    closeCategoryPopup();
    if (item.expense) setEditingExpense(item.expense);
    else if (item.fixedExpense) setEditingFixed(item.fixedExpense);
  };

  return (
    <>
      {/* ── Popup de lançamentos da categoria ── */}
      <Dialog open={!!category} onOpenChange={(open) => !open && closeCategoryPopup()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pr-6">
              <DialogTitle>{category}</DialogTitle>
              {selectedItems.length > 1 && (
                <button
                  onClick={() => { setSelectMode(p => !p); setSelectedIds(new Set()); }}
                  className={cn(
                    'flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors shrink-0',
                    selectMode ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
                  )}
                >
                  {selectMode ? <XIcon size={12} /> : <ListChecks size={12} />}
                  {selectMode ? 'Cancelar' : 'Selecionar'}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {monthLabel(month, false)} · {formatCurrency(selectedItems.reduce((s, i) => s + i.amount, 0))}
            </p>
          </DialogHeader>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto -mx-1 px-1">
            {selectedItems.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum lançamento encontrado</p>
            ) : (
              selectedItems.map(item => {
                const editable = !!(item.expense || item.fixedExpense);
                return (
                  <div
                    key={item.id}
                    onClick={() => selectMode && editable && toggleSelected(item.id)}
                    className={cn(
                      'flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2.5',
                      selectMode && editable && 'cursor-pointer hover:bg-muted/70',
                    )}
                  >
                    {selectMode && (
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        disabled={!editable}
                        onCheckedChange={() => editable && toggleSelected(item.id)}
                        onClick={e => e.stopPropagation()}
                        className="shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {item.source}{item.detail ? ` · ${item.detail}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(item.amount)}</span>
                    {!selectMode && editable && (
                      <button
                        onClick={() => handleEditItem(item)}
                        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        aria-label="Editar lançamento"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {selectMode && selectedIds.size > 0 && (
            <div className="flex items-center gap-2 pt-1 border-t border-border -mx-6 px-6 mt-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
              </span>
              <div className="flex-1 min-w-0">
                <CategorySelect type="expense" value={bulkCategory} onChange={setBulkCategory} />
              </div>
              <Button size="sm" disabled={!bulkCategory || bulkSaving} onClick={handleBulkApply} className="shrink-0">
                {bulkSaving ? 'Aplicando...' : 'Aplicar'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {editingExpense && (
        <EditExpenseDialog
          expense={editingExpense}
          cards={cards}
          open={!!editingExpense}
          onClose={() => setEditingExpense(null)}
          onSaved={onChanged}
        />
      )}
      {editingFixed && (
        <EditFixedExpenseDialog
          expense={editingFixed}
          open={!!editingFixed}
          onClose={() => setEditingFixed(null)}
          onSaved={onChanged}
        />
      )}
    </>
  );
}
