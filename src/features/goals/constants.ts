import { Goal } from '@/lib/goals';

// ─── Constantes ───────────────────────────────────────────────────────────────
export const GOAL_COLORS = [
  { label: 'Verde',   value: '152 69% 45%' },
  { label: 'Azul',    value: '217 91% 60%' },
  { label: 'Roxo',    value: '270 70% 60%' },
  { label: 'Laranja', value: '25 95% 53%'  },
  { label: 'Rosa',    value: '330 80% 60%' },
  { label: 'Ciano',   value: '192 80% 50%' },
];

// Emojis testados — sem variantes complexas que quebram em alguns sistemas
export const GOAL_EMOJIS = [
  '🎯','🏠','🚗','✈️','💻','📱','🎓','💍',
  '🏖️','🎸','📷','💰','🛍️','🎮','🚀',
];

export const PRIORITY_LABELS: Record<number, string> = { 1: 'Alta', 2: 'Média', 3: 'Baixa' };

export const PRIORITY_COLORS: Record<number, string> = {
  1: 'hsl(0 84% 60%)',
  2: 'hsl(25 95% 53%)',
  3: 'hsl(152 69% 45%)',
};

// ─── Form vazio ───────────────────────────────────────────────────────────────
export function emptyForm(): Omit<Goal, 'id' | 'createdAt'> {
  return {
    name:           '',
    emoji:          '🎯',
    targetAmount:   0,
    currentSaved:   0,
    monthsDeadline: 12,
    startDate:      new Date().toISOString().slice(0, 10),
    color:          '152 69% 45%',
    priority:       2,
  };
}
