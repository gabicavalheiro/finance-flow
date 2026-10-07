import { motion } from 'framer-motion';
import { Flame, PartyPopper, Sparkles, TrendingDown } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import MonthSelector from '@/components/MonthSelector';
import { CategoryRow } from '@/features/reports/calculations';
import { monthLabel } from '@/features/reports/format';
import { Insight } from '@/features/reports/types';
import { formatCurrency } from '@/lib/helpers';
import { cn } from '@/lib/utils';

interface Props {
  month: string;
  setMonth: (m: string) => void;
  categoryList: CategoryRow[];
  insights: Insight[];
  totalHist: number;
  onOpenCategory: (label: string) => void;
}

export default function CategoriesTab({ month, setMonth, categoryList, insights, totalHist, onOpenCategory }: Props) {
  return (
    <motion.div
      key="categorias"
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="px-4 md:px-8 space-y-4"
    >
      <MonthSelector month={month} onChange={setMonth} />

      <div className="bg-card rounded-2xl p-4 border border-border">
        <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
          <TrendingDown size={10} className="text-destructive" /> Total gasto — {monthLabel(month, false)}
        </p>
        <p className="text-lg font-bold text-destructive tabular-nums">{formatCurrency(totalHist)}</p>
      </div>

      {insights.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
            Resumo do mês
          </p>
          {insights.map((ins, i) => {
            const style = ins.icon === 'flame'
              ? { Icon: Flame,       cls: 'text-warning bg-warning/12 border-warning/25' }
              : ins.icon === 'party'
              ? { Icon: PartyPopper, cls: 'text-success bg-success/12 border-success/25' }
              : { Icon: Sparkles,    cls: 'text-primary bg-primary/12 border-primary/25' };
            return (
              <div key={i} className={cn('flex items-start gap-2 rounded-xl px-3 py-2.5 border text-xs leading-relaxed', style.cls)}>
                <style.Icon size={14} className="mt-0.5 shrink-0" />
                <span className="text-foreground/90">{ins.text}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          Gastos por categoria — {monthLabel(month, false)}
        </p>
        <p className="text-[10px] text-muted-foreground mb-4">Toque numa categoria pra ver os lançamentos</p>
        {categoryList.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Sem gastos neste mês</p>
        ) : (
          <div className="space-y-3">
            {categoryList.map(cat => (
              <button
                key={cat.label}
                onClick={() => onOpenCategory(cat.label)}
                className="w-full text-left group"
              >
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="flex items-center gap-2 min-w-0">
                    <CategoryIcon category={cat.sampleKey} size={14} />
                    <span className="font-medium group-hover:text-primary transition-colors truncate">{cat.label}</span>
                  </span>
                  <span className="font-semibold tabular-nums shrink-0 ml-2">
                    {formatCurrency(cat.value)}
                    <span className="text-muted-foreground font-normal ml-1">
                      ({totalHist > 0 ? Math.round((cat.value / totalHist) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `hsl(${cat.color})` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${totalHist > 0 ? (cat.value / totalHist) * 100 : 0}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
