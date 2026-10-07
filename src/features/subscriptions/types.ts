import { VariableTransaction, Expense, FixedExpense } from '@/lib/types';

// ─── Lançamentos categoria "Assinatura" fora do controle de assinaturas ──────
export interface IdentifiedItem {
  id:     string;
  name:   string;
  amount: number;
  source: 'Cartão' | 'Fixo' | 'Variável';
  detail?: string;
  cardId?: string;
  // Referência ao lançamento original, pra permitir editar/remover na raiz
  expense?:      Expense;
  fixedExpense?: FixedExpense;
  variableTx?:   VariableTransaction;
}
