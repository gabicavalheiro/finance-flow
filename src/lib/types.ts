export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'amex' | 'other';

export interface CreditCard {
  id: string;
  name: string;
  brand: CardBrand;
  lastDigits: string;
  limit: number;
  closingDay: number;
  customGradient?: string;
}

export type ExpenseCategory =
  | 'food'
  | 'transport'
  | 'entertainment'
  | 'health'
  | 'education'
  | 'shopping'
  | 'home'
  | 'travel'
  | 'subscription'
  | 'other';

export interface Expense {
  id: string;
  cardId: string;
  name: string;
  totalAmount: number;
  category: ExpenseCategory;
  date: string; // ISO
  installments: number; // 1 = à vista
  currentInstallment?: number;
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  paidMonths: string[]; // ['2026-04', '2026-03']
}

export interface MonthlyInstallment {
  expenseId: string;
  expenseName: string;
  cardId: string;
  amount: number;
  installmentNumber: number;
  totalInstallments: number;
  category: ExpenseCategory;
  month: string; // 'YYYY-MM'
}

export const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; icon: string; color: string }> = {
  food: { label: 'Alimentação', icon: 'UtensilsCrossed', color: '30 90% 55%' },
  transport: { label: 'Transporte', icon: 'Car', color: '200 80% 50%' },
  entertainment: { label: 'Lazer', icon: 'Gamepad2', color: '280 70% 58%' },
  health: { label: 'Saúde', icon: 'Heart', color: '0 72% 51%' },
  education: { label: 'Educação', icon: 'GraduationCap', color: '210 70% 55%' },
  shopping: { label: 'Compras', icon: 'ShoppingBag', color: '320 70% 55%' },
  home: { label: 'Casa', icon: 'Home', color: '152 69% 45%' },
  travel: { label: 'Viagem', icon: 'Plane', color: '45 90% 50%' },
  subscription: { label: 'Assinatura', icon: 'Repeat', color: '263 70% 58%' },
  other: { label: 'Outros', icon: 'MoreHorizontal', color: '240 5% 55%' },
};

export const BRAND_GRADIENTS: Record<CardBrand, string> = {
  visa: 'gradient-card-visa',
  mastercard: 'gradient-card-mastercard',
  elo: 'gradient-card-elo',
  amex: 'gradient-card-amex',
  other: 'gradient-card-default',
};
