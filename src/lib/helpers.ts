export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  const date = new Date(parseInt(year), parseInt(m) - 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export function addMonths(month: string, delta: number): string {
  const [year, m] = month.split('-');
  const date = new Date(parseInt(year), parseInt(m) - 1 + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

// ─── Fatura: mês de vencimento (lógica única, usada em todo o app) ───────────
//
// Uma compra entra em uma fatura considerando dois passos:
//   1) Fechamento: se o dia da compra é > closingDay, ela cai na fatura que
//      fecha no mês seguinte (não deu tempo de entrar na que já fechou).
//   2) Vencimento: essa fatura vence no mesmo mês em que fechou (se dueDay >=
//      closingDay) ou no mês seguinte (se dueDay < closingDay — o vencimento
//      "vira o mês" em relação ao fechamento).
//
// O resultado final é sempre o mês em que a fatura efetivamente é PAGA
// (mês de vencimento), que é o que o MonthSelector do app representa.

interface CardCycle {
  closingDay: number;
  dueDay: number;
}

/** Dado o mês em que uma fatura FECHA, retorna o mês em que ela VENCE. */
function closeMonthToDueMonth(closeMonth: string, card: CardCycle): string {
  return card.dueDay < card.closingDay ? addMonths(closeMonth, 1) : closeMonth;
}

/** Dado o mês em que uma fatura VENCE, retorna o mês em que ela FECHOU. */
function dueMonthToCloseMonth(dueMonth: string, card: CardCycle): string {
  return card.dueDay < card.closingDay ? addMonths(dueMonth, -1) : dueMonth;
}

/**
 * Data de compra (YYYY-MM-DD) → mês de vencimento da fatura (YYYY-MM).
 * Única fonte de verdade para "em qual mês essa compra vai aparecer".
 */
export function getInvoiceMonth(purchaseDate: string, card: CardCycle): string {
  const [y, m, d] = purchaseDate.split('-').map(Number);
  const purchaseMonth = `${y}-${String(m).padStart(2, '0')}`;
  const closeMonth = d > card.closingDay ? addMonths(purchaseMonth, 1) : purchaseMonth;
  return closeMonthToDueMonth(closeMonth, card);
}

/**
 * Inverso de getInvoiceMonth: dado o mês de vencimento desejado, retorna uma
 * data de compra "segura" (dia 1, que nunca dispara o shift de fechamento)
 * que cai exatamente nessa fatura. Usada pelos formulários que perguntam
 * "qual parcela cai neste mês?" para reconstruir a data original da compra.
 */
export function getPurchaseDateForInvoiceMonth(invoiceMonth: string, card: CardCycle): string {
  const closeMonth = dueMonthToCloseMonth(invoiceMonth, card);
  const [y, m] = closeMonth.split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-01`;
}
