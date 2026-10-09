// src/lib/loanPayments.ts
// Regras de pagamento de parcelas de empréstimo (sem dependência de UI/Firestore).
import type { Loan } from '@/lib/store_modules';

/** Conjunto de parcelas pagas. Empréstimos antigos (sem `paidNumbers`) são
 *  tratados como se as primeiras `paidInstallments` parcelas estivessem pagas. */
export function getPaidNumbers(loan: Loan): Set<number> {
  if (loan.paidNumbers) return new Set(loan.paidNumbers);
  const n = Math.max(0, Math.min(loan.paidInstallments, loan.installments));
  return new Set(Array.from({ length: n }, (_, i) => i + 1));
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Marca/desmarca a parcela `n` e ajusta o saldo restante pelo valor da parcela. */
export function togglePaidInstallment(loan: Loan, n: number): Loan {
  const paid = getPaidNumbers(loan);
  const wasPaid = paid.has(n);
  if (wasPaid) paid.delete(n); else paid.add(n);
  const delta = loan.monthlyPayment * (wasPaid ? 1 : -1);
  return {
    ...loan,
    paidNumbers: [...paid].sort((a, b) => a - b),
    paidInstallments: paid.size,
    remainingAmount: Math.max(0, round2(loan.remainingAmount + delta)),
  };
}

/** Registra um valor já pago (fora das parcelas marcadas) e abate do saldo. */
export function registerPaidAmount(loan: Loan, amount: number): Loan {
  return {
    ...loan,
    paidNumbers: [...getPaidNumbers(loan)].sort((a, b) => a - b),
    extraPaid: round2((loan.extraPaid ?? 0) + amount),
    remainingAmount: Math.max(0, round2(loan.remainingAmount - amount)),
  };
}

/** Total já pago = parcelas marcadas + valores avulsos informados. */
export function totalPaid(loan: Loan): number {
  return round2(getPaidNumbers(loan).size * loan.monthlyPayment + (loan.extraPaid ?? 0));
}

export function isLoanSettled(loan: Loan): boolean {
  return loan.remainingAmount <= 0.009 || getPaidNumbers(loan).size >= loan.installments;
}
