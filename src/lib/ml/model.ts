// src/lib/ml/model.ts — monta o treino (base inicial + correções do usuário) e classifica.

import { TextClassifier, type Prediction } from './classifier';
import { normalize } from './text';
import { SEED_EXAMPLES } from './seedData';
import type { ExpenseCategory } from '@/lib/types';

/** Exemplo corrigido pelo usuário (vem do Firestore). */
export interface UserExample { text: string; label: ExpenseCategory }

/** Uma correção do usuário vale por 3 exemplos da base inicial. */
export const USER_EXAMPLE_WEIGHT = 3;

/** Abaixo disto o app pede revisão. Calibrado na validação cruzada (ver testes). */
export const REVIEW_THRESHOLD = 0.5;

/**
 * Treina com a base inicial + exemplos do usuário.
 * Se o usuário corrigiu um texto que também está na base inicial, a correção vence.
 */
export function trainClassifier(userExamples: UserExample[]): TextClassifier {
  const byText = new Map<string, { text: string; label: string; weight: number }>();
  for (const e of SEED_EXAMPLES) byText.set(normalize(e.text), { text: e.text, label: e.label, weight: 1 });
  for (const e of userExamples) byText.set(normalize(e.text), { text: e.text, label: e.label, weight: USER_EXAMPLE_WEIGHT });
  return TextClassifier.fit([...byText.values()], { C: 30, fallbackLabel: 'other' });
}

export interface Classification {
  category: ExpenseCategory;
  confidence: number;
  needsReview: boolean;
  prediction: Prediction;
}

export function classify(model: TextClassifier, text: string): Classification {
  const prediction = model.predict(text);
  return {
    category: prediction.label as ExpenseCategory,
    confidence: prediction.confidence,
    needsReview: prediction.confidence < REVIEW_THRESHOLD,
    prediction,
  };
}
