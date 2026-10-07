import React from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/helpers';
import { cn } from '@/lib/utils';

// ─── SUMMARY CARD (Saldo / Pendente / A Receber) ──────────────────────────────
export function SummaryCard({
  label, value, sub, icon, gradient, accentColor, delay = 0, onClick, hidden,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
  gradient: string;
  accentColor?: string;
  delay?: number;
  onClick?: () => void;
  hidden?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.45, ease: 'easeOut' }}
      onClick={onClick}
      className={cn('relative rounded-3xl overflow-hidden text-white group', onClick && 'cursor-pointer')}
      style={{ background: gradient }}
      whileHover={onClick ? { scale: 1.015 } : undefined}
      whileTap={onClick ? { scale: 0.985 } : undefined}
    >

      {/* Linha de brilho diagonal */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 55%)' }} />
      {/* Borda glass sutil */}
      <div className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{ border: '1px solid rgba(255,255,255,0.15)' }} />

      <div className="relative z-10 p-4 md:p-5">
        {/* Ícone em pill glass */}
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-2xl mb-4"
          style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
          {icon}
        </div>

        {/* Label */}
        <p className="text-white/55 text-[11px] font-medium uppercase tracking-wide mb-1">{label}</p>

        {/* Valor */}
        <p className={cn(
          'font-bold tracking-tight tabular-nums leading-none',
          hidden ? 'text-white/30 tracking-[0.4em] text-sm mt-2' : 'text-white text-2xl',
        )}>
          {hidden ? '• • • • •' : formatCurrency(value)}
        </p>

        {/* Sub */}
        {sub && !hidden && (
          <p className="text-white/40 text-[10px] mt-2 leading-tight">{sub}</p>
        )}

        {/* Linha decorativa no fundo */}
        {accentColor && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
            style={{ background: accentColor }} />
        )}
      </div>
    </motion.div>
  );
}
