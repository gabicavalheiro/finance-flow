import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CATEGORY_CONFIG, INCOME_CATEGORY_CONFIG, ExpenseCategory, IncomeCategory } from '@/lib/types';
import { CustomCategory, isCustomCategory } from '@/lib/customCategories';
import { useCustomCategories } from '@/contexts/CustomCategoryContext';
import CreateCategoryDialog from '@/components/CreateCategoryDialog';

interface Props {
  value: string;
  onChange: (value: string) => void;
  type: 'expense' | 'income';
  className?: string;
}

export default function CategorySelect({ value, onChange, type, className }: Props) {
  const { customCategories, reload } = useCustomCategories();
  const [open, setOpen]               = useState(false);
  const [createOpen, setCreateOpen]   = useState(false);
  const listRef                        = useRef<HTMLDivElement>(null);

  const filtered = customCategories.filter(
    c => c.categoryType === 'both' || c.categoryType === type
  );

  const standardEntries = type === 'expense'
    ? Object.entries(CATEGORY_CONFIG) as [ExpenseCategory, { label: string }][]
    : Object.entries(INCOME_CATEGORY_CONFIG) as [IncomeCategory, { label: string }][];

  const getDisplayLabel = () => {
    if (isCustomCategory(value)) {
      return customCategories.find(c => c.id === value)?.label ?? value;
    }
    if (type === 'expense') return CATEGORY_CONFIG[value as ExpenseCategory]?.label ?? value;
    return INCOME_CATEGORY_CONFIG[value as IncomeCategory]?.label ?? value;
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  const handleCreateClick = () => {
    setOpen(false);
    setTimeout(() => setCreateOpen(true), 120);
  };

  const handleCategoryCreated = async (cat: CustomCategory) => {
    await reload();
    onChange(cat.id);
  };

  // Scroll o item selecionado para a view quando abrir
  useEffect(() => {
    if (open && listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null;
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [open]);

  const itemClass = (itemValue: string) =>
    `flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors
     ${value === itemValue
       ? 'bg-primary/10 text-primary font-medium'
       : 'hover:bg-accent text-foreground'}`;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`
              flex items-center justify-between w-full px-3 h-10 mt-1
              bg-secondary border border-border rounded-md text-sm
              hover:bg-secondary/80 transition-colors focus:outline-none
              focus:ring-2 focus:ring-ring focus:ring-offset-1
              ${className ?? ''}
            `}
          >
            <span className="truncate">{getDisplayLabel()}</span>
            <ChevronDown size={14} className="text-muted-foreground shrink-0 ml-2" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
          align="start"
          sideOffset={4}
          avoidCollisions
        >
          {/* Lista scrollável */}
          <div
            ref={listRef}
            className="overflow-y-auto overscroll-contain p-1"
            style={{ maxHeight: 220 }}
          >
            {standardEntries.map(([key, cfg]) => (
              <div
                key={key}
                data-selected={value === key}
                className={itemClass(key)}
                onClick={() => handleSelect(key)}
              >
                <span>{cfg.label}</span>
                {value === key && <Check size={13} className="text-primary shrink-0" />}
              </div>
            ))}

            {filtered.length > 0 && (
              <>
                <div className="px-2 pt-2 pb-1 text-[10px] text-muted-foreground uppercase tracking-wide font-medium border-t border-border mt-1">
                  Personalizadas
                </div>
                {filtered.map(cat => (
                  <div
                    key={cat.id}
                    data-selected={value === cat.id}
                    className={itemClass(cat.id)}
                    onClick={() => handleSelect(cat.id)}
                  >
                    <span>{cat.label}</span>
                    {value === cat.id && <Check size={13} className="text-primary shrink-0" />}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Botão fixo fora do scroll */}
          <div className="border-t border-border p-1">
            <button
              type="button"
              onClick={handleCreateClick}
              className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-accent"
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