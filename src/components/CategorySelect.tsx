import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CATEGORY_CONFIG, INCOME_CATEGORY_CONFIG, ExpenseCategory, IncomeCategory } from '@/lib/types';
import {
  getCustomCategoriesForType, resolveCategoryInfo, CustomCategory,
} from '@/lib/customCategories';
import CreateCategoryDialog from '@/components/CreateCategoryDialog';
import { cn } from '@/lib/utils';

interface Props {
  type: 'expense' | 'income';
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export default function CategorySelect({ type, value, onChange, className }: Props) {
  const [open, setOpen]           = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [customCats, setCustomCats] = useState<CustomCategory[]>(() => getCustomCategoriesForType(type));
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Recarrega custom cats quando o tipo muda
  useEffect(() => {
    setCustomCats(getCustomCategoriesForType(type));
  }, [type]);

  // Scroll para o item selecionado ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => selectedRef.current?.scrollIntoView({ block: 'nearest' }), 50);
    }
  }, [open]);

  const standardEntries = type === 'expense'
    ? Object.entries(CATEGORY_CONFIG) as [string, { label: string; color: string }][]
    : Object.entries(INCOME_CATEGORY_CONFIG) as [string, { label: string; color: string }][];

  const allItems = [
    ...standardEntries.map(([id, cfg]) => ({ id, label: cfg.label, color: cfg.color })),
    ...customCats.map(c => ({ id: c.id, label: c.label, color: c.color })),
  ];

  const selectedLabel = resolveCategoryInfo(value).label;
  const selectedColor = resolveCategoryInfo(value).color;

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const handleCreateClick = () => {
    setOpen(false);
    setCreateOpen(true);
  };

  const handleCategoryCreated = (cat: CustomCategory) => {
    setCustomCats(getCustomCategoriesForType(type));
    onChange(cat.id);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-xl border border-border/60 bg-secondary px-3 py-2 text-sm',
              'hover:border-border transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring/40',
              open && 'border-primary/60 ring-2 ring-ring/30',
              className,
            )}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: `hsl(${selectedColor})` }}
              />
              <span className="truncate">{selectedLabel}</span>
            </span>
            <ChevronDown size={14} className="text-muted-foreground shrink-0 ml-1" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)] bg-[hsl(240_8%_15%)] border border-white/8 rounded-2xl shadow-2xl overflow-hidden"
          align="start"
          sideOffset={4}
          avoidCollisions
        >
          {/* Lista scrollável */}
          <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 220 }}>
            {allItems.map(item => (
              <button
                key={item.id}
                ref={item.id === value ? selectedRef : undefined}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={cn(
                  'flex items-center gap-2.5 w-full px-3 py-2.5 text-sm transition-colors text-left',
                  item.id === value
                    ? 'bg-white/8 text-foreground font-medium'
                    : 'text-foreground/80 hover:bg-white/5'
                )}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: `hsl(${item.color})` }}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {item.id === value && (
                  <Check size={13} className="shrink-0 text-primary" />
                )}
              </button>
            ))}
          </div>

          {/* Botão fixo "Criar nova categoria" */}
          <div className="border-t border-white/8 p-1">
            <button
              type="button"
              onClick={handleCreateClick}
              className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
              style={{ color: 'hsl(263 70% 68%)' }}
            >
              <Plus size={14} />
              Criar nova categoria
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <CreateCategoryDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultType={type}
        onCreated={handleCategoryCreated}
      />
    </>
  );
}