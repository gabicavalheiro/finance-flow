// src/features/purchase-check/plan.ts — transforma uma compra em meta de economia
//
// Ideia: em vez de comprar agora (ou parcelar), juntar o dinheiro e comprar à vista.
// O plano olha quanto costuma sobrar por mês DEPOIS da reserva de segurança e das metas
// que já existem, e sugere em quantos meses dá para juntar o valor.

import { DEFAULT_RESERVE_RATIO, type MonthSnapshot } from './evaluate';

export interface GoalPlanInput {
  price: number;
  /** Meses a partir do atual (mesma sobra do Início) */
  months: MonthSnapshot[];
  goalsMonthly?: number;
  reserveRatio?: number;
  /** Prazo máximo que o plano sugere (padrão 36 meses) */
  maxMonths?: number;
}

export interface GoalPlan {
  /** Quanto, em média, dá para guardar por mês no prazo sugerido, sem mexer na reserva nem nas outras metas */
  available: number;
  /** Prazo sugerido em meses */
  months: number;
  /** Quanto guardar por mês nesse prazo */
  monthly: number;
  /** false = com a sobra atual não dá para juntar o valor no prazo máximo */
  feasible: boolean;
}

/** Prazo usado quando não há sobra para calcular um */
const FALLBACK_MONTHS = 12;

/**
 * Simula mês a mês: em cada mês guarda só o que sobra DEPOIS das contas, da reserva e das
 * outras metas (mês negativo guarda zero — não dá para guardar o que não sobrou). O prazo é o
 * primeiro mês em que o acumulado chega no valor. Depois dos meses conhecidos, repete a média
 * dos últimos três.
 */
export function planPurchaseGoal(input: GoalPlanInput): GoalPlan {
  const price = Math.max(0, input.price || 0);
  const reserveRatio = input.reserveRatio ?? DEFAULT_RESERVE_RATIO;
  const goalsMonthly = Math.max(0, input.goalsMonthly ?? 0);
  const maxMonths = input.maxMonths ?? 36;

  const leftover = input.months.map(m =>
    Math.max(0, m.income - m.expense - Math.max(0, m.income) * reserveRatio - goalsMonthly));
  const tail = leftover.slice(-3);
  const tailAvg = tail.length ? tail.reduce((s, v) => s + v, 0) / tail.length : 0;
  const leftoverAt = (i: number) => (i < leftover.length ? leftover[i] : tailAvg);

  const round2 = (v: number) => Math.round(v * 100) / 100;

  if (!(price > 0)) return { available: 0, months: 1, monthly: 0, feasible: false };

  let saved = 0;
  for (let i = 0; i < maxMonths; i++) {
    saved += leftoverAt(i);
    if (saved >= price) {
      const months = i + 1;
      // média do que dá para guardar nesse período
      const available = round2(saved / months);
      return { available, months, monthly: price / months, feasible: true };
    }
  }

  const available = round2(saved / maxMonths);
  if (available <= 0) {
    return { available: 0, months: FALLBACK_MONTHS, monthly: price / FALLBACK_MONTHS, feasible: false };
  }
  return { available, months: maxMonths, monthly: price / maxMonths, feasible: false };
}
