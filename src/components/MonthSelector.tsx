// src/components/MonthSelector.tsx
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { getMonthLabel, addMonths } from '@/lib/helpers';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef } from 'react';

interface Props {
  month: string;
  onChange: (m: string) => void;
}

const SHORT_MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function MonthSelector({ month, onChange }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [direction, setDirection]   = useState<1 | -1>(1);
  const prevMonth = useRef(month);

  const navigate = (delta: -1 | 1) => {
    setDirection(delta);
    prevMonth.current = month;
    onChange(addMonths(month, delta));
  };

  const [selYear, selMonth] = month.split('-').map(Number);
  const label = getMonthLabel(month);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="relative">
      {/* Barra principal */}
      <div
        className="flex items-center justify-between rounded-2xl px-2 py-1.5"
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          backdropFilter: 'blur(8px)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="h-8 w-8 flex items-center justify-center rounded-xl transition-colors"
          style={{ color: 'hsl(var(--muted-foreground))' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'hsl(var(--secondary))';
            (e.currentTarget as HTMLElement).style.color = 'hsl(var(--foreground))';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'hsl(var(--muted-foreground))';
          }}
        >
          <ChevronLeft size={18} />
        </button>

        <AnimatePresence mode="wait" initial={false}>
          <motion.button
            key={month}
            initial={{ opacity: 0, x: direction * 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -14 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onClick={() => setShowPicker(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors"
            style={{ color: 'hsl(var(--foreground))' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'hsl(var(--secondary))'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <CalendarDays size={14} className="text-violet-400" />
            <span className="text-sm font-semibold capitalize">{label}</span>
          </motion.button>
        </AnimatePresence>

        <button
          onClick={() => navigate(1)}
          className="h-8 w-8 flex items-center justify-center rounded-xl transition-colors"
          style={{ color: 'hsl(var(--muted-foreground))' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'hsl(var(--secondary))';
            (e.currentTarget as HTMLElement).style.color = 'hsl(var(--foreground))';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'hsl(var(--muted-foreground))';
          }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Dropdown picker */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full mt-2 left-0 right-0 rounded-2xl shadow-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, hsl(0 0% 12%) 0%, hsl(0 0% 8%) 100%)',
              border: '1px solid hsl(var(--border))',
            }}
          >
            {/* Seletor de ano */}
            <div className="flex items-center gap-1 px-3 pt-3 pb-2 overflow-x-auto scrollbar-hide"
              style={{ borderBottom: '1px solid hsl(var(--border))' }}>
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => onChange(`${y}-${String(selMonth).padStart(2, '0')}`)}
                  className="shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={
                    y === selYear
                      ? { background: 'linear-gradient(135deg, hsl(0 0% 32%), hsl(0 0% 12%))', color: '#fff' }
                      : { background: 'transparent', color: 'hsl(var(--muted-foreground))' }
                  }
                >
                  {y}
                </button>
              ))}
            </div>

            {/* Grid de meses */}
            <div className="grid grid-cols-4 gap-1.5 p-3">
              {SHORT_MONTHS.map((m, i) => {
                const isActive = i + 1 === selMonth;
                const isToday  = i + 1 === new Date().getMonth() + 1 && selYear === currentYear;
                return (
                  <button
                    key={m}
                    onClick={() => {
                      const newMonth = `${selYear}-${String(i + 1).padStart(2, '0')}`;
                      setDirection(newMonth > month ? 1 : -1);
                      onChange(newMonth);
                      setShowPicker(false);
                    }}
                    className="relative py-2 rounded-xl text-xs font-medium transition-all"
                    style={
                      isActive
                        ? { background: 'linear-gradient(135deg, hsl(0 0% 32%), hsl(0 0% 12%))', color: '#fff' }
                        : { background: 'hsl(var(--secondary))', color: isToday ? 'hsl(0 0% 85%)' : 'hsl(var(--muted-foreground))' }
                    }
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'hsl(var(--secondary))'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'hsl(var(--secondary))'; }}
                  >
                    {m}
                    {isToday && !isActive && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showPicker && (
        <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
      )}
    </div>
  );
}