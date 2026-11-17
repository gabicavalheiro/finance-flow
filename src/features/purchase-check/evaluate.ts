// src/features/purchase-check/evaluate.ts — "Posso comprar?" (função pura, sem Firebase)
//
// A pessoa diz o que quer comprar, quanto custa e se vai à vista ou parcelado.
// A função olha a sobra de cada mês afetado pela compra e devolve um veredito:
//
//   • 'go'      → Pode ir: depois da compra ainda sobra a reserva de segurança e o que vai pras metas.
//   • 'cost'    → Cabe, mas com custo: o dinheiro existe, mas a compra come a reserva,
//                 atrasa as metas ou estoura o orçamento da categoria.
//   • 'no'      → Não recomendo agora: em algum mês a compra deixa o saldo negativo.
//   • 'unknown' → Não dá pra avaliar (nenhum ganho cadastrado).
//
// Os meses chegam prontos (`MonthSnapshot`): o mês atual com o que já foi lançado
// e os próximos com compromissos conhecidos + gasto variável previsto pelo modelo de ML.

export type PurchaseVerdict = 'go' | 'cost' | 'no' | 'unknown';

export interface MonthSnapshot {
  /** YYYY-MM */
  month: string;
  /** Ganhos esperados no mês */
  income: number;
  /** Gastos esperados no mês (já lançados + previstos), SEM a compra */
  expense: number;
}

export interface PurchaseInput {
  /** Valor total da compra */
  price: number;
  /** 1 = à vista; 2+ = parcelado sem juros em N vezes */
  installments: number;
  /** Mês atual primeiro, depois os seguintes. Precisa cobrir as parcelas. */
  months: MonthSnapshot[];
  /** Quanto por mês está comprometido com metas (opcional) */
  goalsMonthly?: number;
  /** Orçamento mensal da categoria da compra e quanto já foi gasto nela no mês atual */
  categoryBudget?: { label: string; limit: number; spent: number };
  /** Parte da renda que deve sobrar como reserva de segurança (padrão 10%) */
  reserveRatio?: number;
}

export interface MonthImpact {
  month: string;
  /** Ganhos e gastos do mês (sem a compra), para mostrar a conta */
  income: number;
  expense: number;
  /** Sobra do mês sem a compra */
  freeBefore: number;
  /** Valor da compra que cai no mês */
  charge: number;
  /** Sobra depois da compra */
  freeAfter: number;
  /** Reserva + metas que deveriam continuar sobrando */
  cushion: number;
  status: 'ok' | 'tight' | 'negative';
}

export interface PurchaseEvaluation {
  verdict: PurchaseVerdict;
  installmentValue: number;
  impacts: MonthImpact[];
  /** Mês mais apertado (menor sobra depois da compra) */
  worst: MonthImpact | null;
  /** Motivos em linguagem simples, do mais importante ao menos */
  reasons: string[];
  /** Quanto falta no mês mais apertado para a compra não deixar saldo negativo */
  shortfall: number;
}

export const DEFAULT_RESERVE_RATIO = 0.1;

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const monthName = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long' });
};

const round2 = (v: number) => Math.round(v * 100) / 100;

export function evaluatePurchase(input: PurchaseInput): PurchaseEvaluation {
  const n = Math.max(1, Math.floor(input.installments || 1));
  const price = Math.max(0, input.price || 0);
  const installmentValue = round2(price / n);
  const goalsMonthly = Math.max(0, input.goalsMonthly ?? 0);
  const reserveRatio = input.reserveRatio ?? DEFAULT_RESERVE_RATIO;

  const empty: PurchaseEvaluation = {
    verdict: 'unknown', installmentValue, impacts: [], worst: null, reasons: [], shortfall: 0,
  };

  if (!(price > 0)) return { ...empty, reasons: ['Informe o valor da compra.'] };

  const affected = input.months.slice(0, n);
  if (affected.length === 0) return { ...empty, reasons: ['Não há meses para avaliar.'] };

  const hasIncome = affected.some(m => m.income > 0);
  if (!hasIncome) {
    return {
      ...empty,
      reasons: ['Cadastre seus ganhos (salário, freelas…) para eu saber quanto sobra no mês.'],
    };
  }

  // Última parcela absorve a diferença de arredondamento
  const charges = affected.map((_, i) =>
    i === affected.length - 1 ? round2(price - installmentValue * (affected.length - 1)) : installmentValue,
  );

  const impacts: MonthImpact[] = affected.map((m, i) => {
    const freeBefore = round2(m.income - m.expense);
    const charge = charges[i];
    const freeAfter = round2(freeBefore - charge);
    const cushion = round2(Math.max(0, m.income) * reserveRatio + goalsMonthly);
    const status: MonthImpact['status'] =
      freeAfter < 0 ? 'negative' : freeAfter < cushion ? 'tight' : 'ok';
    return { month: m.month, income: m.income, expense: m.expense, freeBefore, charge, freeAfter, cushion, status };
  });

  const worst = impacts.reduce((a, b) => (b.freeAfter < a.freeAfter ? b : a));
  const negatives = impacts.filter(i => i.status === 'negative');
  const tights = impacts.filter(i => i.status === 'tight');
  const reasons: string[] = [];
  const isInstallment = n > 1;
  const parcelaTxt = isInstallment ? `a parcela de ${brl(installmentValue)}` : `os ${brl(price)}`;

  // ── Não recomendo ─────────────────────────────────────────────────────────
  if (negatives.length > 0) {
    const shortfall = round2(-worst.freeAfter);
    if (worst.freeBefore <= 0) {
      reasons.push(`Em ${monthName(worst.month)} suas contas já passam dos ganhos, mesmo sem essa compra.`);
    } else {
      reasons.push(
        `Em ${monthName(worst.month)} sobram ${brl(worst.freeBefore)} e ${parcelaTxt} deixariam o mês ${brl(shortfall)} no vermelho.`,
      );
    }
    if (negatives.length > 1) {
      reasons.push(`${negatives.length} dos ${impacts.length} meses das parcelas ficariam negativos.`);
    }
    return { verdict: 'no', installmentValue, impacts, worst, reasons, shortfall };
  }

  // ── Cabe com custo ───────────────────────────────────────────────────────
  let verdict: PurchaseVerdict = 'go';

  if (tights.length > 0) {
    verdict = 'cost';
    const t = tights.reduce((a, b) => (b.freeAfter < a.freeAfter ? b : a));
    const base = `Cabe, mas em ${monthName(t.month)} sobrariam só ${brl(t.freeAfter)}`;
    if (goalsMonthly > 0 && t.freeAfter < goalsMonthly) {
      reasons.push(`${base} — menos do que você separa para as metas (${brl(goalsMonthly)}).`);
    } else if (goalsMonthly > 0) {
      reasons.push(`${base} — não fica o suficiente para a reserva de segurança e as metas (${brl(t.cushion)}).`);
    } else {
      reasons.push(`${base} e a sua reserva de segurança fica mais curta.`);
    }
  }

  const budget = input.categoryBudget;
  if (budget && budget.limit > 0) {
    const after = budget.spent + charges[0];
    if (after > budget.limit) {
      verdict = 'cost';
      reasons.push(
        `Passa do orçamento de ${budget.label}: ${brl(after)} de ${brl(budget.limit)} neste mês.`,
      );
    }
  }

  if (verdict === 'go') {
    reasons.push(
      isInstallment
        ? `Mesmo no mês mais apertado (${monthName(worst.month)}) ainda sobram ${brl(worst.freeAfter)} depois da parcela.`
        : `Depois da compra ainda sobram ${brl(worst.freeAfter)} em ${monthName(worst.month)}.`,
    );
    if (goalsMonthly > 0) reasons.push('Suas metas continuam no ritmo.');
  }

  return { verdict, installmentValue, impacts, worst, reasons, shortfall: 0 };
}

/**
 * Se à vista (ou no parcelamento escolhido) não cabe, procura o menor número de
 * parcelas (até `max`) que faria a compra caber. Útil para sugerir "em 4x sem juros cabe".
 */
export function suggestInstallments(
  input: PurchaseInput, max = 12,
): { installments: number; verdict: PurchaseVerdict } | null {
  const start = Math.max(1, input.installments) + 1;
  const limit = Math.min(max, input.months.length);
  for (let n = start; n <= limit; n++) {
    const r = evaluatePurchase({ ...input, installments: n });
    if (r.verdict === 'go' || r.verdict === 'cost') return { installments: n, verdict: r.verdict };
  }
  return null;
}
