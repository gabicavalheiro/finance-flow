// Categorias: lista padrão + personalizadas com o uso de cada uma, edição, exclusão segura
// e unificação (manual ou a partir de sugestões de nomes parecidos).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shapes, Plus, Search, Pencil, Trash2, Merge, Sparkles, X, AlertTriangle, CheckSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LoadingState, ErrorState } from '@/components/states/StateViews';
import CategoryIcon from '@/components/CategoryIcon';
import CreateCategoryDialog from '@/components/CreateCategoryDialog';
import { useCustomCategories } from '@/contexts/CustomCategoryContext';
import { useFinanceData } from '@/contexts/FinanceDataContext';
import { deleteCustomCategory, type CustomCategory } from '@/lib/customCategories';
import { loadCategoryData } from '@/lib/categoryAdmin';
import { formatCurrency } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import {
  buildCategoryList, computeUsage, findDuplicateGroups, fitsKind, normalizeLabel, usageOf,
  type CategoryData, type CategoryItem, type CategoryKind,
} from '@/features/categories/logic';
import MergeDialog, { type MergeRequest } from '@/features/categories/components/MergeDialog';

const DISMISSED_KEY = 'ff-dismissed-category-duplicates';
const groupKey = (ids: string[]) => [...ids].sort().join('|');

function readDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')); } catch { return new Set(); }
}

export default function CategoriesPage() {
  const { customCategories, reload } = useCustomCategories();
  const { hardRefresh } = useFinanceData();

  const [data, setData]         = useState<CategoryData | null>(null);
  const [error, setError]       = useState(false);
  const [kind, setKind]         = useState<CategoryKind>('expense');
  const [search, setSearch]     = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [merge, setMerge]       = useState<MergeRequest | null>(null);
  const [editing, setEditing]   = useState<CustomCategory | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CategoryItem | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissed);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [d] = await Promise.all([loadCategoryData(), reload()]);
      setData(d);
    } catch (err) {
      console.error('CategoriesPage.load:', err);
      setError(true);
    }
  }, [reload]);

  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => buildCategoryList(customCategories, data ?? undefined), [customCategories, data]);
  const usage = useMemo(() => (data ? computeUsage(data) : new Map()), [data]);

  const visible = useMemo(() => {
    const q = normalizeLabel(search);
    return items
      .filter(i => fitsKind(i.scope, kind))
      .filter(i => !q || normalizeLabel(i.label).includes(q));
  }, [items, kind, search]);

  const orphans  = visible.filter(i => i.origin === 'orphan');
  const customs  = visible.filter(i => i.origin === 'custom').sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  const standard = visible.filter(i => i.origin === 'standard');

  const duplicates = useMemo(() => {
    const byId = new Map(items.map(i => [i.id, i]));
    return findDuplicateGroups(items, usage)
      .filter(g => !dismissed.has(groupKey(g.ids)))
      .filter(g => g.ids.some(id => fitsKind(byId.get(id)!.scope, kind)));
  }, [items, usage, kind, dismissed]);

  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const afterChange = async () => {
    setMerge(null);
    setSelected(new Set());
    setSelecting(false);
    await load();
    hardRefresh();
  };

  const dismiss = (ids: string[]) => {
    const next = new Set(dismissed).add(groupKey(ids));
    setDismissed(next);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next])); } catch { /* sem storage */ }
  };

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const askDelete = (item: CategoryItem) => {
    const u = usageOf(usage, item.id);
    if (u.count > 0 || u.budget !== null) setMerge({ sourceIds: [item.id], mode: 'delete' });
    else setConfirmDelete(item);
  };

  const deleteUnused = async () => {
    if (!confirmDelete) return;
    try {
      await deleteCustomCategory(confirmDelete.id);
      toast.success(`Categoria "${confirmDelete.label}" excluída`);
      setConfirmDelete(null);
      await afterChange();
    } catch {
      toast.error('Erro ao excluir categoria');
    }
  };

  const Row = ({ item }: { item: CategoryItem }) => {
    const u = usageOf(usage, item.id);
    const isSel = selected.has(item.id);
    const custom = item.origin === 'custom' ? customCategories.find(c => c.id === item.id) : undefined;

    return (
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 transition-colors',
          selecting && 'cursor-pointer hover:bg-secondary/50',
          isSel && 'bg-primary/5',
        )}
        onClick={selecting ? () => toggle(item.id) : undefined}
      >
        {selecting && (
          <Checkbox checked={isSel} onCheckedChange={() => toggle(item.id)} onClick={e => e.stopPropagation()}
            aria-label={`Selecionar ${item.label}`} />
        )}
        <CategoryIcon category={item.id} size={15} />
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-medium truncate', item.origin === 'orphan' && 'italic')}>
            {item.label}
            {item.scope === 'both' && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">gastos e ganhos</span>}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {u.count === 0 ? 'Sem lançamentos' : `${u.count} ${u.count === 1 ? 'lançamento' : 'lançamentos'}`}
            {u.budget !== null && ` · orçamento ${formatCurrency(u.budget)}`}
          </p>
        </div>

        {!selecting && (
          <div className="flex items-center gap-0.5 shrink-0">
            {custom && (
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar ${item.label}`}
                onClick={() => setEditing(custom)}>
                <Pencil size={14} />
              </Button>
            )}
            {(u.count > 0 || u.budget !== null || item.origin === 'custom') && (
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Unificar ${item.label} com outra categoria`}
                onClick={() => setMerge({ sourceIds: [item.id], mode: 'merge' })}>
                <Merge size={14} />
              </Button>
            )}
            {custom && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label={`Excluir ${item.label}`} onClick={() => askDelete(item)}>
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  const Section = ({ title, hint, list }: { title: string; hint?: string; list: CategoryItem[] }) =>
    list.length === 0 ? null : (
      <section className="space-y-1.5">
        <div className="px-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{title} · {list.length}</p>
          {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
          {list.map(i => <Row key={i.id} item={i} />)}
        </div>
      </section>
    );

  return (
    <div className="pb-28 md:pb-10 max-w-2xl mx-auto">
      <header className="px-4 md:px-8 pt-5 md:pt-8 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shapes size={16} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Categorias</h1>
              <p className="text-xs text-muted-foreground">Organize e unifique suas categorias</p>
            </div>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Nova
          </Button>
        </div>
      </header>

      <div className="px-4 md:px-8 space-y-4">
        {/* Gastos / Ganhos + busca */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex rounded-xl bg-secondary p-1 shrink-0" role="tablist">
            {(['expense', 'income'] as const).map(k => (
              <button key={k} role="tab" aria-selected={kind === k}
                onClick={() => { setKind(k); setSelected(new Set()); }}
                className={cn(
                  'flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  kind === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}>
                {k === 'expense' ? 'Gastos' : 'Ganhos'}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar categoria"
              className="pl-8 h-9 bg-secondary border-border text-sm" />
          </div>
          <Button variant={selecting ? 'secondary' : 'outline'} size="sm" className="h-9 gap-1.5"
            onClick={() => { setSelecting(v => !v); setSelected(new Set()); }}>
            {selecting ? <X size={14} /> : <CheckSquare size={14} />}
            {selecting ? 'Cancelar' : 'Selecionar'}
          </Button>
        </div>

        {error && <ErrorState message="Não foi possível carregar as categorias." onRetry={load} />}
        {!data && !error && <LoadingState rows={4} />}

        {data && (
          <>
            {/* Sugestões de duplicadas */}
            {duplicates.length > 0 && !selecting && !search && (
              <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-primary/25 bg-primary/5 p-3 space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Sparkles size={13} className="text-primary" /> Parecem repetidas
                </p>
                {duplicates.map(g => {
                  const target = byId.get(g.suggestedTargetId)!;
                  return (
                    <div key={groupKey(g.ids)} className="flex items-center gap-2 rounded-xl bg-card border border-border px-2.5 py-2">
                      <p className="flex-1 min-w-0 text-xs leading-relaxed">
                        {g.ids.map(id => byId.get(id)!.label).join(' · ')}
                        <span className="text-muted-foreground"> → {target.label}</span>
                      </p>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground"
                        onClick={() => dismiss(g.ids)}>Ignorar</Button>
                      <Button size="sm" className="h-7 px-2.5 text-xs"
                        onClick={() => setMerge({ sourceIds: g.ids, mode: 'merge', initialTargetId: g.suggestedTargetId })}>
                        Unificar
                      </Button>
                    </div>
                  );
                })}
              </motion.section>
            )}

            {orphans.length > 0 && (
              <div className="flex gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle size={14} className="shrink-0 mt-px" />
                <p>Alguns lançamentos usam categorias que foram excluídas e aparecem como "Outros". Unifique-as numa categoria existente.</p>
              </div>
            )}

            <Section title="Categorias excluídas com lançamentos" list={orphans} />
            <Section title="Suas categorias" list={customs} />
            <Section title="Padrão do app" hint="Não podem ser excluídas, mas podem ser unificadas em outra." list={standard} />

            {visible.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-10">Nenhuma categoria encontrada</p>
            )}
          </>
        )}
      </div>

      {/* Barra de seleção */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-20 md:bottom-6 md:pl-64 z-30 px-4 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto flex items-center gap-3 rounded-2xl border border-border bg-card/95 backdrop-blur px-4 py-3 shadow-lg">
            <p className="flex-1 text-sm">
              {selected.size === 0 ? 'Toque nas categorias para selecionar' : `${selected.size} selecionada${selected.size > 1 ? 's' : ''}`}
            </p>
            <Button size="sm" className="gap-1.5" disabled={selected.size < 1}
              onClick={() => setMerge({ sourceIds: [...selected], mode: 'merge' })}>
              <Merge size={14} /> Unificar
            </Button>
          </div>
        </div>
      )}

      {data && (
        <MergeDialog
          request={merge}
          kind={kind}
          items={items}
          usage={usage}
          data={data}
          onClose={() => setMerge(null)}
          onDone={afterChange}
        />
      )}

      <CreateCategoryDialog
        open={createOpen || !!editing}
        editing={editing}
        defaultType={kind}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onCreated={async () => { await reload(); }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={v => !v && setConfirmDelete(null)}>
        <AlertDialogContent className="bg-card border-border rounded-2xl max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{confirmDelete?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>Nenhum lançamento usa essa categoria.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteUnused} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
