/**
 * DayPicker — Mostra as duas opções lado a lado:
 *   • Data fixa   (dia 1–31 do mês)
 *   • Dia útil    (Nth dia útil do mês)
 *
 * Convenção de valor (sem alterar schema do banco):
 *   1–31   → dia fixo  (ex: 5 = dia 5)
 *   101+   → dia útil  (ex: 105 = 5º dia útil)
 */
import { cn } from '@/lib/utils';
import { CalendarDays, Briefcase } from 'lucide-react';

// ─── Helpers exportados (usados no FixedPage p/ exibir) ──────────────────────
export function isBusinessDayValue(v: number): boolean { return v > 100; }
export function getBusinessDayN(v: number): number     { return v - 100; }
export function formatReceiveDay(v: number | undefined): string {
  if (!v) return '';
  if (isBusinessDayValue(v)) return `${getBusinessDayN(v)}º dia útil`;
  return `Dia ${v}`;
}

// ─── Component ───────────────────────────────────────────────────────────────
interface Props {
  value: number;
  onChange: (v: number) => void;
}

export default function DayPicker({ value, onChange }: Props) {
  const isBusinessDay = isBusinessDayValue(value);

  const fixedN    = isBusinessDay ? 5 : value || 5;
  const businessN = isBusinessDay ? getBusinessDayN(value) : 5;

  const selectFixed    = () => onChange(fixedN);
  const selectBusiness = () => onChange(100 + businessN);

  const handleFixedInput = (raw: string) => {
    const n = Math.min(Math.max(parseInt(raw) || 1, 1), 31);
    onChange(n);
  };
  const handleBusinessInput = (raw: string) => {
    const n = Math.min(Math.max(parseInt(raw) || 1, 1), 15);
    onChange(100 + n);
  };

  return (
    <div className="grid grid-cols-2 gap-2">

      {/* ── Card: Data fixa ─────────────────────────────── */}
      <button
        type="button"
        onClick={selectFixed}
        className={cn(
          'flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all',
          !isBusinessDay
            ? 'border-primary/60 bg-primary/8 ring-1 ring-primary/30'
            : 'border-border bg-secondary/40 hover:border-border/80 hover:bg-secondary/60',
        )}
      >
        <div className="flex items-center gap-1.5 w-full">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={!isBusinessDay
              ? { background: 'hsl(263 70% 58% / 0.15)', color: 'hsl(263 70% 68%)' }
              : { background: 'hsl(240 5% 20%)', color: 'hsl(240 5% 55%)' }}
          >
            <CalendarDays size={13} />
          </div>
          <span className={cn('text-xs font-semibold', !isBusinessDay ? 'text-foreground' : 'text-muted-foreground')}>
            Data fixa
          </span>
        </div>

        <div className="flex items-baseline gap-1 w-full" onClick={e => e.stopPropagation()}>
          <span className="text-[10px] text-muted-foreground">Dia</span>
          <input
            type="number"
            min={1}
            max={31}
            value={!isBusinessDay ? (value || '') : fixedN}
            onChange={e => handleFixedInput(e.target.value)}
            onFocus={selectFixed}
            placeholder="5"
            className={cn(
              'w-12 h-7 rounded-lg border text-sm font-bold text-center bg-background transition-colors focus:outline-none focus:ring-1',
              !isBusinessDay
                ? 'border-primary/40 text-foreground focus:ring-primary/40'
                : 'border-border text-muted-foreground focus:ring-border',
            )}
          />
          <span className="text-[10px] text-muted-foreground">do mês</span>
        </div>

        <p className="text-[10px] text-muted-foreground leading-tight">
          {!isBusinessDay && value ? `Todo dia ${value}` : 'ex: dia 10, 15, 25…'}
        </p>
      </button>

      {/* ── Card: Dia útil ──────────────────────────────── */}
      <button
        type="button"
        onClick={selectBusiness}
        className={cn(
          'flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all',
          isBusinessDay
            ? 'border-emerald-500/50 bg-emerald-500/8 ring-1 ring-emerald-500/20'
            : 'border-border bg-secondary/40 hover:border-border/80 hover:bg-secondary/60',
        )}
      >
        <div className="flex items-center gap-1.5 w-full">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={isBusinessDay
              ? { background: 'hsl(152 69% 45% / 0.15)', color: 'hsl(152 69% 55%)' }
              : { background: 'hsl(240 5% 20%)', color: 'hsl(240 5% 55%)' }}
          >
            <Briefcase size={12} />
          </div>
          <span className={cn('text-xs font-semibold', isBusinessDay ? 'text-foreground' : 'text-muted-foreground')}>
            Dia útil
          </span>
        </div>

        <div className="flex items-baseline gap-1 w-full" onClick={e => e.stopPropagation()}>
          <input
            type="number"
            min={1}
            max={15}
            value={isBusinessDay ? businessN : businessN}
            onChange={e => handleBusinessInput(e.target.value)}
            onFocus={selectBusiness}
            placeholder="5"
            className={cn(
              'w-10 h-7 rounded-lg border text-sm font-bold text-center bg-background transition-colors focus:outline-none focus:ring-1',
              isBusinessDay
                ? 'border-emerald-500/40 text-foreground focus:ring-emerald-500/30'
                : 'border-border text-muted-foreground focus:ring-border',
            )}
          />
          <span className="text-[10px] text-muted-foreground">º dia útil</span>
        </div>

        <p className="text-[10px] text-muted-foreground leading-tight">
          {isBusinessDay ? `${businessN}º útil do mês` : 'ex: 5º útil (CLT)'}
        </p>
      </button>

    </div>
  );
}