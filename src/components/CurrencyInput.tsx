import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;           // e.g. "300.50" or ""
  onChange: (raw: string) => void;
  className?: string;
}

/**
 * ATM-style currency input — digits preenchem da direita (centavos primeiro).
 * Funciona com teclado físico (desktop) e teclado virtual (mobile).
 */
export default function CurrencyInput({ value, onChange, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // ── helpers ────────────────────────────────────────────────────────────────
  const toCents = (v: string): number => {
    if (!v) return 0;
    const n = parseFloat(v.replace(',', '.'));
    return isNaN(n) ? 0 : Math.round(n * 100);
  };

  const formatDisplay = (c: number): string => {
    const abs = Math.abs(c);
    const reais    = Math.floor(abs / 100);
    const centavos = abs % 100;
    return `${reais},${String(centavos).padStart(2, '0')}`;
  };

  // ── state ──────────────────────────────────────────────────────────────────
  const [cents, setCents] = useState(() => toCents(value));

  // Sync quando o pai reseta o valor (ex: após submit)
  const prevValue = useRef(value);
  if (value !== prevValue.current) {
    prevValue.current = value;
    const next = toCents(value);
    if (next !== cents) setCents(next);
  }

  // ── handlers ───────────────────────────────────────────────────────────────

  /**
   * Desktop: captura teclas individuais antes do browser alterar o input.
   * Backspace e dígitos fazem o comportamento ATM (preenchimento da direita).
   */
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
      const next = cents * 10 + parseInt(e.key);
      if (next > 9_999_999_99) return;
      setCents(next);
      onChange(next === 0 ? '' : String(next / 100));
    }
  };

  /**
   * Mobile: o teclado virtual dispara onChange com o conteúdo composto.
   * Extrai só os dígitos do que o browser colocou no input e recalcula.
   * No desktop isso não dispara porque onKeyDown chama preventDefault().
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) {
      setCents(0);
      onChange('');
      return;
    }
    // Limita a 10 dígitos para não vazar a máscara
    const next = Math.min(parseInt(digits.slice(-10), 10), 9_999_999_99);
    setCents(next);
    onChange(next === 0 ? '' : String(next / 100));
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        'flex h-10 w-full items-center rounded-md border border-input bg-background',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        'cursor-text',
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      <span className="pl-3 text-muted-foreground text-sm pointer-events-none select-none">R$</span>

      {/*
        Input real — visível para o sistema operacional (mobile abre teclado),
        mas visualmente transparente; a formatação fica no value controlado.
        NÃO é readOnly para que o iOS/Android reconheça e mostre o teclado.
      */}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatDisplay(cents)}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        className={cn(
          'flex-1 bg-transparent px-2 py-2 text-sm text-foreground outline-none',
          'caret-transparent', // esconde o cursor piscante (visual limpo)
        )}
      />
    </div>
  );
}