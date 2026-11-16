// Aba "Extrato" — lista todos os lançamentos do mês com busca por nome, e imprime/salva em PDF
// via diálogo nativo do navegador (ver #extrato-print-area + regra @media print em index.css).

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Printer, Scale, Search, TrendingDown, TrendingUp, X } from 'lucide-react';
import MonthSelector from '@/components/MonthSelector';
import CategoryIcon from '@/components/CategoryIcon';
import { formatCurrency, getMonthLabel } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { filterExtractItems, summarizeExtract, type ExtractItem } from '@/features/reports/extract';

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
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => filterExtractItems(items, query), [items, query]);
  const summary  = useMemo(() => summarizeExtract(filtered), [filtered]);
  const monthLabel = getMonthLabel(month);

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
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar lançamento pelo nome..."
            aria-label="Buscar lançamento pelo nome"
            className="w-full h-full rounded-2xl border border-border bg-card pl-9 pr-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium shrink-0 hover:opacity-90 transition-opacity"
        >
          <Printer size={14} /> Imprimir / Salvar PDF
        </button>
      </div>

      {/* Tudo a partir daqui entra no PDF/impressão */}
      <div id="extrato-print-area" className="space-y-4">
        <div className="hidden print:block mb-2">
          <h2 className="text-lg font-bold">Extrato — {monthLabel}</h2>
          {query && <p className="text-xs text-muted-foreground">Filtro: "{query}"</p>}
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
              Lançamentos {query ? `(${filtered.length} de ${items.length})` : `(${items.length})`}
            </p>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {query ? 'Nenhum lançamento encontrado com esse nome.' : 'Nenhum lançamento neste mês.'}
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
