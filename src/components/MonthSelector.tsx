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

  // years to show in picker (5 years around current)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="relative">
      {/* Main bar */}
      <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-2 py-1.5">
        <button
          onClick={() => navigate(-1)}
          className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={18} />
        </button>

        <AnimatePresence mode="wait" initial={false}>
          <motion.button
            key={month}
            initial={{ opacity: 0, x: direction * 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -16 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={() => setShowPicker(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-secondary transition-colors"
          >
            <CalendarDays size={14} className="text-primary" />
            <span className="text-sm font-semibold capitalize">{label}</span>
          </motion.button>
        </AnimatePresence>

        <button
          onClick={() => navigate(1)}
          className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
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
            className="absolute z-50 top-full mt-2 left-0 right-0 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Year selector */}
            <div className="flex items-center gap-1 px-3 pt-3 pb-2 border-b border-border overflow-x-auto scrollbar-none">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => {
                    onChange(`${y}-${String(selMonth).padStart(2, '0')}`);
                  }}
                  className="shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
                  style={
                    y === selYear
                      ? { background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))', color: '#fff' }
                      : { background: 'transparent', color: 'hsl(240 5% 55%)' }
                  }
                >
                  {y}
                </button>
              ))}
            </div>

            {/* Month grid */}
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
                        ? { background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))', color: '#fff' }
                        : { background: 'transparent', color: isToday ? 'hsl(263 70% 68%)' : 'hsl(0 0% 85%)' }
                    }
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

      {/* Backdrop */}
      {showPicker && (
        <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
      )}
    </div>
  );
}