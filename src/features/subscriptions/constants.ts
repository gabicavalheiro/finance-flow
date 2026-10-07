import { BillingCycle } from '@/lib/subscriptions';

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Mensal',
  annual:  'Anual',
};

export const POPULAR_ICONS = [
  '🎬', '🎵', '☁️', '💻', '🎮', '📰', '🏋️', '📚', '🔒', '📺',
  '🎧', '🛡️', '📦', '🌐', '✉️', '🗺️', '🔑', '🎙️', '📱', '⚡',
];

// ─── Form types ───────────────────────────────────────────────────────────────

export interface FormState {
  name:         string;
  amount:       number;
  billingCycle: BillingCycle;
  billingDay:   number;
  category:     string;
  icon:         string;
  url:          string;
  notes:        string;
  cardId:       string;
}

export const EMPTY_FORM: FormState = {
  name: '', amount: 0, billingCycle: 'monthly',
  billingDay: 1, category: 'streaming', icon: '📦',
  url: '', notes: '', cardId: '',
};

// ─── FormDialog ───────────────────────────────────────────────────────────────
