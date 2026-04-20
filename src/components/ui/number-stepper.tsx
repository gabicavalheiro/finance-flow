import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NumberStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  className?: string;
}

export default function NumberStepper({
  value,
  min = 1,
  max = Infinity,
  onChange,
  className,
}: NumberStepperProps) {
  const dec = () => { if (value > min) onChange(value - 1); };
  const inc = () => { if (value < max) onChange(value + 1); };

  return (
    <div
      className={cn(
        'flex items-center gap-0 h-8 rounded-xl border border-border/60 bg-secondary overflow-hidden',
        className,
      )}
    >
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        className={cn(
          'flex items-center justify-center w-8 h-full',
          'text-muted-foreground hover:text-foreground hover:bg-white/6',
          'transition-colors duration-100',
          'disabled:opacity-30 disabled:cursor-not-allowed',
        )}
      >
        <Minus size={13} strokeWidth={2.5} />
      </button>

      {/* Divider */}
      <div className="w-px h-4 bg-border/60" />

      <span className="w-8 text-center text-sm font-semibold tabular-nums text-foreground select-none">
        {value}
      </span>

      {/* Divider */}
      <div className="w-px h-4 bg-border/60" />

      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        className={cn(
          'flex items-center justify-center w-8 h-full',
          'text-muted-foreground hover:text-foreground hover:bg-white/6',
          'transition-colors duration-100',
          'disabled:opacity-30 disabled:cursor-not-allowed',
        )}
      >
        <Plus size={13} strokeWidth={2.5} />
      </button>
    </div>
  );
}
