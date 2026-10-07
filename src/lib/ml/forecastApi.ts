// src/lib/ml/forecastApi.ts — camada "completa" da previsão (API Python), com fallback local.
//
// Estratégia em camadas: o navegador SEMPRE calcula uma previsão local (instantânea, offline).
// Se a API estiver configurada e responder, o resultado dela (que inclui Ridge global e ensemble)
// substitui o local. Se falhar (API dormindo, offline, sessão expirada), o local continua valendo
// — a tela nunca fica sem previsão por causa do servidor.

import { auth } from '@/lib/firebase';
import type {
  BacktestSummary, CandidateScore, ForecastPoint, PortfolioForecast, SeriesForecast,
} from './forecast';

const API_URL = (import.meta.env.VITE_ML_API_URL as string | undefined)?.replace(/\/$/, '');

export const isForecastApiConfigured = () => Boolean(API_URL);

// ── contrato da API (snake_case) ──────────────────────────────────────────────
interface ApiBacktest {
  steps: number; mae: number; wape: number; baseline_mae: number; skill: number; coverage: number | null;
}
interface ApiSeries {
  model: string; reliable: boolean; n: number;
  points: ForecastPoint[]; backtest: ApiBacktest | null; candidates: CandidateScore[];
}
interface ApiResponse { engine: string; total: ApiSeries; by_key: Record<string, ApiSeries> }

const mapBacktest = (b: ApiBacktest | null): BacktestSummary | null =>
  b && {
    steps: b.steps, mae: b.mae, wape: b.wape,
    baselineMae: b.baseline_mae, skill: b.skill, coverage: b.coverage,
  };

const mapSeries = (s: ApiSeries): SeriesForecast => ({
  model: s.model, reliable: s.reliable, n: s.n, points: s.points,
  backtest: mapBacktest(s.backtest), candidates: s.candidates,
});

export async function fetchForecastFromApi(
  series: Record<string, number[]>,
  opts: { lastMonth: string; horizon: number },
  signal?: AbortSignal,
): Promise<PortfolioForecast> {
  if (!API_URL) throw new Error('API de previsão não configurada (VITE_ML_API_URL).');
  const user = auth.currentUser;
  if (!user) throw new Error('Sem sessão para chamar a API.');
  const token = await user.getIdToken();

  // A API pode estar "dormindo" no plano gratuito; como já existe previsão local na tela,
  // damos tempo para ela acordar sem travar nada.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  signal?.addEventListener('abort', () => ctrl.abort());
  try {
    const res = await fetch(`${API_URL}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ series, last_month: opts.lastMonth, horizon: opts.horizon }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`A API de previsão respondeu ${res.status}.`);
    const j = (await res.json()) as ApiResponse;
    return {
      total: j.total.points,
      byKey: Object.fromEntries(Object.entries(j.by_key).map(([k, v]) => [k, mapSeries(v)])),
      reliable: j.total.reliable,
      totalBacktest: mapBacktest(j.total.backtest),
      totalModel: j.total.model,
      totalCandidates: j.total.candidates,
      n: j.total.n,
      engine: 'api',
    };
  } finally {
    clearTimeout(timer);
  }
}
