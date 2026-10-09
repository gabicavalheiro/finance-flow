import type { MonthlyInstallment } from '@/lib/types';

interface InvoiceLike { cardId: string; actualAmount: number }

/**
 * Alinha os lançamentos de cartão ao valor FINAL informado em Faturas.
 *
 * Para cada cartão com fatura informada (actualAmount > 0), os valores dos
 * lançamentos são redistribuídos proporcionalmente para que a soma seja
 * exatamente o valor da fatura. Assim, categorias, orçamentos e vencimentos
 * da tela inicial batem com o total que o usuário confirmou.
 *
 * - Sem fatura informada: lançamentos ficam como calculados.
 * - Fatura informada mas sem lançamentos calculados: cria um item "Fatura".
 */
export function alignInstallmentsToInvoices(
  installments: MonthlyInstallment[],
  invoices: InvoiceLike[],
  month = '',
): MonthlyInstallment[] {
  const confirmed = new Map(
    invoices.filter(i => i.actualAmount > 0).map(i => [i.cardId, i.actualAmount]),
  );
  if (confirmed.size === 0) return installments;

  const calcByCard = new Map<string, number>();
  for (const i of installments) calcByCard.set(i.cardId, (calcByCard.get(i.cardId) ?? 0) + i.amount);

  const out: MonthlyInstallment[] = installments.map(i => {
    const actual = confirmed.get(i.cardId);
    const calc   = calcByCard.get(i.cardId) ?? 0;
    if (actual == null || calc <= 0) return i;
    return { ...i, amount: (i.amount / calc) * actual };
  });

  for (const [cardId, actual] of confirmed) {
    if ((calcByCard.get(cardId) ?? 0) > 0) continue;
    out.push({
      expenseId: `invoice-${cardId}`,
      expenseName: 'Fatura',
      cardId,
      amount: actual,
      installmentNumber: 1,
      totalInstallments: 1,
      category: 'other',
      month,
    });
  }
  return out;
}
