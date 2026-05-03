// src/components/CategorySelect.tsx
import { useRef, useEffect, useState, useCallback } from 'react';
import { Check, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { CATEGORY_CONFIG, INCOME_CATEGORY_CONFIG } from '@/lib/types';
import { resolveCategoryInfo, CustomCategory, deleteCustomCategory } from '@/lib/customCategories';
import { useCustomCategories } from '@/contexts/CustomCategoryContext';
import CreateCategoryDialog from '@/components/CreateCategoryDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  type: 'expense' | 'income';
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export default function CategorySelect({ type, value, onChange, className }: Props) {
  const [open, setOpen]             = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef  = useRef<HTMLButtonElement>(null);

  const { customCategories, reload } = useCustomCategories();

  const customCats = customCategories.filter(
    c => c.categoryType === 'both' || c.categoryType === type
  );

  const standardEntries = type === 'expense'
    ? Object.entries(CATEGORY_CONFIG)        as [string, { label: string; color: string }][]
    : Object.entries(INCOME_CATEGORY_CONFIG) as [string, { label: string; color: string }][];

  const standardItems = standardEntries.map(([id, cfg]) => ({
    id, label: cfg.label, color: cfg.color, isCustom: false,
  }));

  const customItems = customCats.map(c => ({
    id: c.id, label: c.label, color: c.color, isCustom: true,
  }));

  const allStandard = standardItems;
  const allCustom   = customItems;

  const selectedInfo = resolveCategoryInfo(value);

  // Fecha ao clicar/tocar fora
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close, { passive: true });
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  // Scroll até item selecionado ao abrir
  useEffect(() => {
    if (open) setTimeout(() => selectedRef.current?.scrollIntoView({ block: 'nearest' }), 60);
  }, [open]);

  const handleSelect = useCallback((id: string) => {
    onChange(id);
    setOpen(false);
  }, [onChange]);

  const handleDelete = async (e: React.MouseEvent | React.TouchEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setDeletingId(id);
    try {
      await deleteCustomCategory(id);
      await reload();
      if (value === id) onChange(type === 'expense' ? 'other' : 'other_income');
      toast.success('Categoria removida');
    } catch {
      toast.error('Erro ao remover');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreated = async (cat: CustomCategory) => {
    await reload();
    onChange(cat.id);
    setOpen(false);
  };

  return (
    <>
      <div ref={containerRef} className="relative w-full">

        {/* ── Trigger ── */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-xl border border-border/60 bg-secondary px-3 py-2 text-sm',
            'hover:border-border transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40',
            open && 'border-primary/60 ring-2 ring-ring/30',
            className,
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: `hsl(${selectedInfo.color})` }} />
            <span className="truncate">{selectedInfo.label}</span>
          </span>
          <ChevronDown size={14} className={cn('text-muted-foreground shrink-0 ml-1 transition-transform duration-200', open && 'rotate-180')} />
        </button>

        {/* ── Dropdown sem Radix — scroll nativo ── */}
        {open && (
          <div className="absolute left-0 right-0 z-[9999] mt-1 flex flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">

            {/* Lista */}
            <div style={{ overflowY: 'scroll', maxHeight: 216, WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <style>{`.__cs::-webkit-scrollbar{display:none}`}</style>
              <div className="__cs p-1.5 space-y-0.5">

                {/* Padrão */}
                {allCustom.length > 0 && (
                  <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Padrão</p>
                )}
                {allStandard.map(item => (
                  <button
                    key={item.id}
                    ref={item.id === value ? selectedRef : undefined}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); handleSelect(item.id); }}
                    onTouchEnd={e => { e.preventDefault(); handleSelect(item.id); }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                      item.id === value ? 'bg-primary/10 font-medium text-foreground' : 'text-foreground/80 hover:bg-secondary/60 active:bg-secondary',
                    )}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: `hsl(${item.color})` }} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.id === value && <Check size={13} className="shrink-0 text-primary" />}
                  </button>
                ))}

                {/* Personalizadas */}
                {allCustom.length > 0 && (
                  <>
                    <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Personalizadas</p>
                    {allCustom.map(item => (
                      <div
                        key={item.id}
                        className={cn(
                          'flex w-full items-center gap-1 rounded-xl px-3 py-2 text-sm transition-colors group',
                          item.id === value ? 'bg-primary/10' : 'hover:bg-secondary/60',
                        )}
                      >
                        <button
                          ref={item.id === value ? selectedRef : undefined}
                          type="button"
                          onMouseDown={e => { e.preventDefault(); handleSelect(item.id); }}
                          onTouchEnd={e => { e.preventDefault(); handleSelect(item.id); }}
                          className="flex flex-1 min-w-0 items-center gap-2.5 text-left"
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: `hsl(${item.color})` }} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.id === value && <Check size={13} className="shrink-0 text-primary" />}
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onMouseDown={e => handleDelete(e, item.id)}
                          onTouchEnd={e => handleDelete(e, item.id)}
                          className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-40"
                        >
                          {deletingId === item.id
                            ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            : <Trash2 size={12} />}
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* ── Criar nova — sempre visível, funciona para expense E income ── */}
            <div className="shrink-0 border-t border-border p-1">
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); setOpen(false); setCreateOpen(true); }}
                onTouchEnd={e => { e.preventDefault(); setOpen(false); setCreateOpen(true); }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-secondary/60 active:bg-secondary"
              >
                <Plus size={14} />
                Criar nova categoria
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateCategoryDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultType={type}
        onCreated={handleCreated}
      />
    </>
  );
}