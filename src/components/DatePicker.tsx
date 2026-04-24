import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface Props {
  value: string;       // 'YYYY-MM-DD'
  onChange: (v: string) => void;
  className?: string;
}

function parseDate(str: string): Date | undefined {
  if (!str) return undefined;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? undefined : date;
}

function formatDisplay(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function DatePicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const selected = parseDate(value);

  const handleSelect = (day: Date | undefined) => {
    if (!day) return;
    onChange(toIso(day));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input px-3 py-2 text-sm',
            'bg-secondary border-border text-left',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'hover:bg-secondary/80 transition-colors',
            className,
          )}
        >
          <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
            {selected ? formatDisplay(selected) : 'Selecione uma data'}
          </span>
          <CalendarIcon size={15} className="text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-0 bg-popover border-border shadow-2xl rounded-2xl overflow-hidden"
        align="start"
        sideOffset={6}
      >
        <style>{`
          .dp-custom .rdp-day_selected,
          .dp-custom .rdp-day_selected:hover {
            background: linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%)) !important;
            color: white !important;
            font-weight: 600;
          }
          .dp-custom .rdp-day {
            border-radius: 10px !important;
          }
          .dp-custom .rdp-day:hover:not(.rdp-day_selected) {
            background: hsl(var(--secondary)) !important;
            color: hsl(var(--foreground));
          }
          .dp-custom .rdp-day_today:not(.rdp-day_selected) {
            background: hsl(var(--secondary));
            color: hsl(var(--primary));
            font-weight: 600;
          }
          .dp-custom .rdp-caption_label {
            font-size: 0.875rem;
            font-weight: 600;
            text-transform: capitalize;
            color: hsl(var(--foreground));
          }
          .dp-custom .rdp-head_cell {
            font-size: 0.7rem;
            font-weight: 500;
            color: hsl(var(--muted-foreground));
            text-transform: uppercase;
          }
          .dp-custom .rdp-nav_button {
            border-radius: 10px;
            color: hsl(var(--muted-foreground));
          }
          .dp-custom .rdp-nav_button:hover {
            background: hsl(var(--secondary)) !important;
            color: hsl(var(--foreground));
          }
          .dp-custom .rdp-day {
            color: hsl(var(--foreground));
          }
          .dp-custom .rdp-day_outside {
            color: hsl(var(--muted-foreground));
            opacity: 0.5;
          }
        `}</style>
        <div className="dp-custom">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected}
            className="p-3"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}