import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;           // internal: '300' | '300.50' | ''
  onChange: (raw: string) => void;
  className?: string;
}

/**
 * ATM-style currency input for pt-BR.
 * - Digits fill from the right (cents first).
 * - Always shows 2 decimal places separated by comma.
 * - Stores value as a plain numeric string (period as decimal, no formatting).
 */
export default function CurrencyInput({ value, onChange, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Convert internal value (e.g. "300.50") → cents integer (30050)
  const toCents = (v: string): number => {
    if (!v) return 0;
    const n = parseFloat(v.replace(',', '.'));
    return isNaN(n) ? 0 : Math.round(n * 100);
  };

  // Format cents → display string "R$ 300,50" style (without R$)
  const formatDisplay = (cents: number): string => {
    const abs = Math.abs(cents);
    const reais    = Math.floor(abs / 100);
    const centavos = abs % 100;
    return `${reais},${String(centavos).padStart(2, '0')}`;
  };

  // Internal cents state driven from props
  const [cents, setCents] = useState(() => toCents(value));

  // Sync when external value changes (e.g. reset after submit)
  const prevValue = useRef(value);
  if (value !== prevValue.current) {
    prevValue.current = value;
    const newCents = toCents(value);
    if (newCents !== cents) setCents(newCents);
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = Math.floor(cents / 10);
      setCents(next);
      onChange(next === 0 ? '' : String(next / 100));
      return;
    }
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      const digit = parseInt(e.key);
      const next = cents * 10 + digit;
      if (next > 9_999_999_99) return; // max ~99 million
      setCents(next);
      onChange(next === 0 ? '' : String(next / 100));
    }
  };

  return (
    <div className={cn(
      'flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2',
      'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
      'cursor-text select-none',
      className,
    )}
      onClick={() => inputRef.current?.focus()}
    >
      <span className="text-muted-foreground text-sm mr-1.5">R$</span>
      <span className="text-sm flex-1 text-foreground">
        {formatDisplay(cents)}
      </span>
      {/* Hidden real input to receive focus / keyboard events */}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        onKeyDown={handleKeyDown}
        readOnly
      />
    </div>
  );
}