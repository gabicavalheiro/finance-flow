import React from 'react';
import { Zap, Banknote, ArrowLeftRight, CreditCard as CreditCardIcon, FileText } from 'lucide-react';

// ─── Constantes ───────────────────────────────────────────────────────────────
export const PIE_COLORS = [
  'hsl(263 70% 58%)', 'hsl(220 70% 55%)', 'hsl(30 90% 55%)', 'hsl(152 69% 45%)',
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
export const CARD_BRAND_GRADIENTS: Record<string, string> = {
  visa:       'linear-gradient(135deg, #1e40af 0%, #0369a1 60%, #06b6d4 100%)',
  mastercard: 'linear-gradient(135deg, #9f1239 0%, #c2410c 60%, #ea580c 100%)',
  elo:        'linear-gradient(135deg, #92400e 0%, #b45309 60%, #d97706 100%)',
  amex:       'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  other:      'linear-gradient(135deg, #4c1d95 0%, #6d28d9 60%, #7c3aed 100%)',
};
