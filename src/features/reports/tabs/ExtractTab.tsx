// Aba "Extrato" — lista todos os lançamentos do mês com busca por nome, filtro de categoria e
// período, e imprime/salva em PDF via diálogo nativo do navegador (ver #extrato-print-area +
// regra @media print em index.css).

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check, Printer, Scale, Search, SlidersHorizontal, TrendingDown, TrendingUp, X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import MonthSelector from '@/components/MonthSelector';
import CategoryIcon from '@/components/CategoryIcon';
import { formatCurrency, getMonthLabel } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import {
  applyExtractFilters, availableExtractCategories, EMPTY_EXTRACT_FILTERS, summarizeExtract,
  type ExtractFilters, type ExtractItem,
} from '@/features/reports/extract';
import { daysInMonth } from '@/features/reports/format';

interface Props {
  month: string;
  setMonth: (m: string) => void;
  items: ExtractItem[];
}

const SOURCE_BADGE: Record<ExtractItem['source'], string> = {
  'Cartão':     'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'Fixo':       'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  'Assinatura': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'Renda':      'bg-success/10 text-success',
  'Variável':   'bg-muted text-muted-foreground',
};

function fmtDate(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function ExtractTab({ month, setMonth, items }: Props) {
  const [filters, setFilters] = useState<ExtractFilters>(EMPTY_EXTRACT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  // Troca de mês invalida um intervalo de data de outro mês (categoria/busca seguem valendo).
  useEffect(() => { setFilters(f => ({ ...f, dateFrom: '', dateTo: '' })); }, [month]);

  const categories = useMemo(() => availableExtractCategories(items), [items]);
  const filtered   = useMemo(() => applyExtractFilters(items, filters), [items, filters]);
  const summary    = useMemo(() => summarizeExtract(filtered), [filtered]);
  const monthLabel = getMonthLabel(month);
  const monthStart = `${month}-01`;
  const monthEnd   = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;

  const extraActiveCount = [filters.category, filters.dateFrom, filters.dateTo].filter(Boolean).length;
  const activeCount      = extraActiveCount + (filters.search ? 1 : 0);

  const set = (patch: Partial<ExtractFilters>) => setFilters(f => ({ ...f, ...patch }));
  const clearExtra = () => setFilters(f => ({ ...f, category: '', dateFrom: '', dateTo: '' }));

  const filterSummaryParts = [
    filters.search ? `"${filters.search}"` : null,
    filters.category ? categories.find(c => c.key === filters.category)?.label : null,
    (filters.dateFrom || filters.dateTo)
      ? `${filters.dateFrom ? fmtDate(filters.dateFrom) : 'início'} a ${filters.dateTo ? fmtDate(filters.dateTo) : 'fim'}`
      : null,
  ].filter(Boolean);

  return (
    <motion.div
      key="extrato"
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="px-4 md:px-8 space-y-4"
    >
      {/* Barra de controles — não aparece na impressão */}
      <div className="flex flex-col sm:flex-row gap-2 print:hidden">
        <div className="flex-1"><MonthSelector month={month} onChange={setMonth} /></div>
        <div className="relative flex-1 min-w-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.search}
            onChange={e => set({ search: e.target.value })}
            placeholder="Buscar lançamento pelo nome..."
            aria-label="Buscar lançamento pelo nome"
            className="w-full h-full rounded-2xl border border-border bg-card pl-9 pr-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => set({ search: '' })}
              aria-label="Limpar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className={cn(
            'relative flex items-center justify-center gap-1.5 rounded-2xl border px-4 py-2.5 text-sm font-medium shrink-0 transition-colors',
            extraActiveCount > 0
              ? 'text-primary border-primary/40 bg-primary/8'
              : 'text-muted-foreground border-border bg-card hover:text-foreground',
          )}
        >
          <SlidersHorizontal size={14} /> Filtros
          {extraActiveCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-primary text-[9px] text-primary-foreground font-bold flex items-center justify-center px-1">
              {extraActiveCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium shrink-0 hover-ring"
        >
          <Printer size={14} /> Imprimir / Salvar PDF
        </button>
      </div>

      {/* ── Diálogo de filtros: categoria + período ── */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="bg-card border-border rounded-2xl w-[calc(100vw-2rem)] max-w-[420px] p-0 gap-0 flex flex-col max-h-[88dvh]">
          <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'hsl(0 0% 60% / 0.15)', color: 'hsl(0 0% 75%)' }}>
                <SlidersHorizontal size={15} />
              </div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold">Filtrar extrato</DialogTitle>
                {extraActiveCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
                    {extraActiveCount} ativo{extraActiveCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-5">
            {categories.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={!filters.category} onClick={() => set({ category: '' })}>Todas</Chip>
                  {categories.map(c => (
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

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Período (dentro de {monthLabel})</label>
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
                      min={monthStart}
                      max={monthEnd}
                      onChange={e => set({ [key]: e.target.value })}
                      className={cn(
                        'w-full h-9 rounded-lg border text-xs px-2.5 bg-secondary transition-colors',
                        'focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer',
                        filters[key] ? 'border-primary/50 text-foreground' : 'border-border text-muted-foreground',
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              {extraActiveCount > 0 && (
                <Button variant="outline" className="flex-1 border-border bg-secondary text-sm" onClick={clearExtra}>
                  Limpar
                </Button>
              )}
              <Button onClick={() => setFilterOpen(false)} className="flex-1 text-sm">
                Ver resultados
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tudo a partir daqui entra no PDF/impressão */}
      <div id="extrato-print-area" className="space-y-4">
        <div className="hidden print:block mb-2">
          <h2 className="text-lg font-bold">Extrato — {monthLabel}</h2>
          {filterSummaryParts.length > 0 && (
            <p className="text-xs text-muted-foreground">Filtro: {filterSummaryParts.join(' · ')}</p>
          )}
          <p className="text-[10px] text-muted-foreground">Gerado em {new Date().toLocaleDateString('pt-BR')}</p>
        </div>

        <div className="stat-grid gap-3">
          <div className="bg-card rounded-2xl p-4 border border-border">
            <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingUp size={10} className="text-success" /> Receitas
            </p>
            <p className="text-lg font-bold text-success tabular-nums">{formatCurrency(summary.income)}</p>
          </div>
          <div className="bg-card rounded-2xl p-4 border border-border">
            <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingDown size={10} className="text-destructive" /> Gastos
            </p>
            <p className="text-lg font-bold text-destructive tabular-nums">{formatCurrency(summary.expense)}</p>
          </div>
          <div className="bg-card rounded-2xl p-4 border border-border">
            <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
              <Scale size={10} /> Saldo
            </p>
            <p className="text-lg font-bold tabular-nums" style={{ color: summary.balance >= 0 ? 'hsl(152 69% 45%)' : 'hsl(0 84% 60%)' }}>
              {formatCurrency(summary.balance)}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Lançamentos {activeCount > 0 ? `(${filtered.length} de ${items.length})` : `(${items.length})`}
            </p>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {activeCount > 0 ? 'Nenhum lançamento encontrado com esse filtro.' : 'Nenhum lançamento neste mês.'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map(item => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `hsl(${item.categoryColor} / 0.12)`, color: `hsl(${item.categoryColor})` }}
                  >
                    <CategoryIcon category={item.categoryKey} size={16} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', SOURCE_BADGE[item.source])}>
                        {item.source}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {item.categoryLabel}{item.detail ? ` · ${item.detail}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className={cn('text-sm font-semibold tabular-nums', item.type === 'income' ? 'text-success' : 'text-destructive')}>
                      {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{fmtDate(item.date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Chip reutilizável (mesmo visual do TransactionFilterBar) ──────────────────
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
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
        active && activeColor
          ? 'text-white border-transparent'
          : active
          ? 'bg-primary text-primary-foreground border-primary'
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
