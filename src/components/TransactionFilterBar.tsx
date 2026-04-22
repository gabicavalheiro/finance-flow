import { Search, X, SlidersHorizontal, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CreditCard } from '@/lib/types';
import { TransactionFilters } from '@/hooks/useTransactionFilter';
import { cn } from '@/lib/utils';

interface AvailableCategory { key: string; label: string; color: string }

interface Props {
  open: boolean;
  onToggle: () => void;
  filters: TransactionFilters;
  setFilters: (f: TransactionFilters) => void;
  activeCount: number;
  clearFilters: () => void;
  availableCategories: AvailableCategory[];
  cards: CreditCard[];
}

export default function TransactionFilterBar({
  open, onToggle, filters, setFilters,
  activeCount, clearFilters, availableCategories, cards,
}: Props) {
  const set = (patch: Partial<TransactionFilters>) => setFilters({ ...filters, ...patch });

  return (
    <>
      {/* ── Botão trigger ── */}
      <button
        onClick={onToggle}
        className={cn(
          'relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
          activeCount > 0
            ? 'text-primary border-primary/40 bg-primary/8'
            : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary hover:border-border',
        )}
      >
        <SlidersHorizontal size={12} />
        Filtros
        {activeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-primary text-[9px] text-white font-bold flex items-center justify-center px-1">
            {activeCount}
          </span>
        )}
      </button>

      {/* ── Dialog (mesmo componente que BulkEditCategoryDialog) ── */}
      <Dialog open={open} onOpenChange={v => !v && onToggle()}>
        <DialogContent className="bg-card border-border rounded-2xl w-[calc(100vw-2rem)] max-w-[420px] p-0 gap-0 flex flex-col max-h-[88vh]">

          {/* Header */}
          <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'hsl(263 70% 58% / 0.15)', color: 'hsl(263 70% 68%)' }}>
                <SlidersHorizontal size={15} />
              </div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold">Filtrar lançamentos</DialogTitle>
                {activeCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
                    {activeCount} ativo{activeCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Conteúdo scrollável */}
          <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-5">

            {/* Descrição */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Descrição</label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={filters.search}
                  onChange={e => set({ search: e.target.value })}
                  placeholder="Buscar por nome..."
                  className="pl-8 bg-secondary border-border"
                />
                {filters.search && (
                  <button onClick={() => set({ search: '' })}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Categoria */}
            {availableCategories.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={!filters.category} onClick={() => set({ category: '' })}>
                    Todas
                  </Chip>
                  {availableCategories.map(c => (
                    <Chip
                      key={c.key}
                      active={filters.category === c.key}
                      dot={c.color}
                      activeColor={c.color}
                      onClick={() => set({ category: filters.category === c.key ? '' : c.key })}
                    >
                      {c.label}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {/* Cartão */}
            {cards.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Cartão</label>
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={!filters.cardId} onClick={() => set({ cardId: '' })}>
                    Todos
                  </Chip>
                  {cards.map(c => (
                    <Chip
                      key={c.id}
                      active={filters.cardId === c.id}
                      dot={c.customGradient ?? '263 70% 58%'}
                      onClick={() => set({ cardId: filters.cardId === c.id ? '' : c.id })}
                    >
                      {c.name}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {/* Período */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Período</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { label: 'De',  key: 'dateFrom' as const },
                  { label: 'Até', key: 'dateTo'   as const },
                ] as const).map(({ label, key }) => (
                  <div key={key} className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                    <input
                      type="date"
                      value={filters[key]}
                      onChange={e => set({ [key]: e.target.value })}
                      className={cn(
                        'w-full h-9 rounded-lg border text-xs px-2.5 bg-secondary transition-colors',
                        'focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer',
                        filters[key]
                          ? 'border-primary/50 text-foreground'
                          : 'border-border text-muted-foreground',
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-2 pt-1">
              {activeCount > 0 && (
                <Button variant="outline" className="flex-1 border-border bg-secondary text-sm"
                  onClick={() => { clearFilters(); onToggle(); }}>
                  Limpar
                </Button>
              )}
              <Button
                onClick={onToggle}
                className="flex-1 text-white text-sm"
                style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
              >
                {activeCount > 0 ? 'Ver resultados' : 'Fechar'}
              </Button>
            </div>
          </div>

        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Chip reutilizável ─────────────────────────────────────────────────────────
function Chip({
  active, onClick, children, dot, activeColor,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dot?: string;
  activeColor?: string;
}) {
  const isHsl = dot && !dot.startsWith('#') && !dot.startsWith('hsl') && !dot.startsWith('rgb');
  const dotBg = dot ? (isHsl ? `hsl(${dot})` : dot) : undefined;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
        active && activeColor
          ? 'text-white border-transparent'
          : active
          ? 'bg-primary/15 text-primary border-primary/30'
          : 'bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-muted-foreground/40',
      )}
      style={active && activeColor ? { background: `hsl(${activeColor})` } : undefined}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotBg }} />}
      {children}
      {active && <Check size={10} className="shrink-0 opacity-80" />}
    </button>
  );
}