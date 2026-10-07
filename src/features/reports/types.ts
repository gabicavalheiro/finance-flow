import { Expense, FixedExpense } from '@/lib/types';

export interface MonthForecast {
  month: string; label: string;
  cardExpenses: number; fixedExpenses: number;
  totalExpense: number; totalIncome: number; balance: number;
  isPast: boolean; isCurrent: boolean; isFuture: boolean;
  cardBreakdown: { cardId: string; cardName: string; amount: number }[];
  installmentDetail: {
    name: string; amount: number;
    installmentNumber: number; totalInstallments: number; cardName: string;
  }[];
}

export interface CategoryLineItem {
  id: string;
  name: string;
  amount: number;
  source: 'Cartão' | 'Fixo' | 'Assinatura';
  detail?: string;
  expense?: Expense;
  fixedExpense?: FixedExpense;
}

export interface Insight {
  icon: 'flame' | 'party' | 'sparkle';
  text: string;
}
