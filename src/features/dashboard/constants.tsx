import React from 'react';
import { Zap, Banknote, ArrowLeftRight, CreditCard as CreditCardIcon, FileText } from 'lucide-react';

// ─── Constantes ───────────────────────────────────────────────────────────────
export const PIE_COLORS = [
  'hsl(300 55% 66%)', 'hsl(220 70% 58%)', 'hsl(30 90% 55%)', 'hsl(152 69% 45%)',
  'hsl(0 72% 51%)',   'hsl(280 70% 58%)', 'hsl(320 70% 55%)', 'hsl(45 90% 50%)',
];

export const METHOD_ICONS: Record<string, React.ReactNode> = {
  pix:      <Zap size={11} />,
  cash:     <Banknote size={11} />,
  transfer: <ArrowLeftRight size={11} />,
  debit:    <CreditCardIcon size={11} />,
  boleto:   <FileText size={11} />,
};

// ─── CARROSSEL DE CARTÕES ─────────────────────────────────────────────────────
