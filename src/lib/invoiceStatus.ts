// src/lib/invoiceStatus.ts
// Status de pagamento de uma fatura de cartão, compartilhado entre a tela
// inicial (BillsChecklist) e o módulo Faturas, para que os dois destaquem
// "pago parcial" / "pago a mais" exatamente do mesmo jeito.
//
// Dois valores distintos por fatura:
//  - FINAL: valor da fatura informado em Faturas (actualAmount); sem ele, o calculado.
//  - PAGO:  quanto já foi pago (paidAmount). Sem paidAmount, uma fatura com valor
//           informado conta como paga por inteiro (comportamento anterior).

export type InvoicePaymentStatus = 'pending' | 'paid' | 'partial' | 'over';

const EPS = 0.01;

interface InvoiceLike { actualAmount?: number; paidAmount?: number | null }

/** Valor final da fatura: o informado em Faturas ou, na falta dele, o calculado. */
export function invoiceFinalAmount(inv: InvoiceLike | undefined | null, calculated: number): number {
  return inv && (inv.actualAmount ?? 0) > 0 ? inv.actualAmount! : calculated;
}

/** Quanto já foi pago da fatura (0 = nada pago / pendente). */
export function invoicePaidAmount(inv: InvoiceLike | undefined | null): number {
  if (!inv) return 0;
  if (typeof inv.paidAmount === 'number') return Math.max(0, inv.paidAmount);
  return Math.max(0, inv.actualAmount ?? 0);
}

/**
 * @param paid  quanto foi pago; 0 = nada
 * @param final valor FINAL da fatura (informado em Faturas, ou o calculado)
 */
export function invoicePaymentStatus(paid: number, final: number): InvoicePaymentStatus {
  if (!(paid > 0)) return 'pending';
  const diff = paid - final;
  if (Math.abs(diff) < EPS) return 'paid';
  return diff < 0 ? 'partial' : 'over';
}

export const INVOICE_STATUS_LABEL: Record<InvoicePaymentStatus, string> = {
  pending: 'Pendente',
  paid:    'Pago',
  partial: 'Pago parcial',
  over:    'Pago a mais',
};
