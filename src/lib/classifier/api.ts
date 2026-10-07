// src/lib/classifier/api.ts — cliente da API de ML (ml-api/, FastAPI + scikit-learn)
import { auth } from '@/lib/firebase';

export interface TrainingExample {
  description: string;
  category: string;
  source: 'user' | 'history';
}

export interface Candidate { category: string; confidence: number }
export interface Prediction { id: string; category: string; confidence: number; top: Candidate[] }
export interface ClassifyResponse {
  predictions: Prediction[];
  classes: string[];
  examples_used: number;
  cached_model: boolean;
}

const API_URL = (import.meta.env.VITE_ML_API_URL as string | undefined)?.replace(/\/$/, '');

export const isClassifierApiConfigured = () => Boolean(API_URL);

export async function classifyTransactions(
  items: { id: string; description: string }[],
  examples: TrainingExample[],
): Promise<ClassifyResponse> {
  if (!API_URL) {
    throw new Error('A URL da API de classificação não está configurada (VITE_ML_API_URL).');
  }
  const user = auth.currentUser;
  if (!user) throw new Error('Você precisa estar logada para classificar.');
  const token = await user.getIdToken();

  // A API pode estar "dormindo" no plano gratuito — damos até 90 s para acordar.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch(`${API_URL}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items, examples }),
      signal: ctrl.signal,
    });
    if (res.status === 401) throw new Error('Sessão não autorizada na API. Saia e entre de novo.');
    if (res.status === 422) throw new Error('Algum dado do arquivo é grande ou inválido demais para a API (descrição com mais de 300 caracteres?).');
    if (!res.ok) throw new Error(`A API respondeu com erro (${res.status}).`);
    return (await res.json()) as ClassifyResponse;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('A API demorou demais para responder. Tente de novo em instantes.');
    }
    if (err instanceof TypeError) {
      throw new Error('Não consegui falar com a API de classificação. Verifique se ela está no ar.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
