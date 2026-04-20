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
  | 'loan'
  | 'pix_credit'
  | 'other';

export interface Expense {
  id: string;
  cardId: string;
  name: string;
  totalAmount: number;
  category: ExpenseCategory;
  date: string;
  installments: number;
  currentInstallment?: number;
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  paidMonths: string[];
  /** Forma de pagamento do gasto fixo (PIX, débito, boleto…) */
  paymentMethod: PaymentMethod;
}

export interface MonthlyInstallment {
  expenseId: string;
  expenseName: string;
  cardId: string;
  amount: number;
  installmentNumber: number;
  totalInstallments: number;
  category: ExpenseCategory;
  month: string;
}

export type IncomeCategory =
  | 'salary'
  | 'freelance'
  | 'rental'
  | 'investment'
  | 'bonus'
  | 'other_income';

export interface FixedIncome {
  id: string;
  name: string;
  amount: number;
  category: IncomeCategory;
  receiveDay?: number;
  receivedMonths: string[];
}

export const INCOME_CATEGORY_CONFIG: Record<IncomeCategory, { label: string; icon: string; color: string }> = {
  salary:       { label: 'Salário',       icon: 'Briefcase',        color: '152 69% 45%'  },
  freelance:    { label: 'Freelance',      icon: 'Laptop',           color: '210 70% 55%'  },
  rental:       { label: 'Aluguel',        icon: 'Building2',        color: '45 90% 50%'   },
  investment:   { label: 'Investimento',   icon: 'TrendingUp',       color: '263 70% 58%'  },
  bonus:        { label: 'Bônus',          icon: 'Gift',             color: '320 70% 55%'  },
  other_income: { label: 'Outros ganhos',  icon: 'CircleDollarSign', color: '240 5% 55%'   },
};

export const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; icon: string; color: string }> = {
  food:         { label: 'Alimentação', icon: 'UtensilsCrossed', color: '30 90% 55%'  },
  transport:    { label: 'Transporte',  icon: 'Car',             color: '200 80% 50%' },
  entertainment:{ label: 'Lazer',       icon: 'Gamepad2',        color: '280 70% 58%' },
  health:       { label: 'Saúde',       icon: 'Heart',           color: '0 72% 51%'   },
  education:    { label: 'Educação',    icon: 'GraduationCap',   color: '210 70% 55%' },
  shopping:     { label: 'Compras',     icon: 'ShoppingBag',     color: '320 70% 55%' },
  home:         { label: 'Casa',        icon: 'Home',            color: '152 69% 45%' },
  travel:       { label: 'Viagem',      icon: 'Plane',           color: '45 90% 50%'  },
  subscription: { label: 'Assinatura',  icon: 'Repeat',          color: '263 70% 58%' },
  loan:         { label: 'Empréstimo',  icon: 'Landmark',        color: '38 92% 50%'  },
  pix_credit:   { label: 'PIX Crédito', icon: 'Zap',             color: '155 70% 42%' },
  other:        { label: 'Outros',      icon: 'MoreHorizontal',  color: '240 5% 55%'  },
};

export const BRAND_GRADIENTS: Record<CardBrand, string> = {
  visa:       'gradient-card-visa',
  mastercard: 'gradient-card-mastercard',
  elo:        'gradient-card-elo',
  amex:       'gradient-card-amex',
  other:      'gradient-card-default',
};

export type PaymentMethod = 'pix' | 'cash' | 'transfer' | 'debit' | 'boleto' | 'other';

export interface VariableTransaction {
  id: string;
  name: string;
  amount: number;
  type: 'income' | 'expense';
  paymentMethod: PaymentMethod;
  category: ExpenseCategory | IncomeCategory;
  date: string; // YYYY-MM-DD
}

export const PAYMENT_METHOD_CONFIG: Record<PaymentMethod, { label: string; icon: string }> = {
  pix:      { label: 'PIX',           icon: 'Zap'           },
  cash:     { label: 'Dinheiro',      icon: 'Banknote'      },
  transfer: { label: 'Transferência', icon: 'ArrowLeftRight' },
  debit:    { label: 'Débito',        icon: 'CreditCard'    },
  boleto:   { label: 'Boleto',        icon: 'FileText'      },
  other:    { label: 'Outro',         icon: 'MoreHorizontal' },
};