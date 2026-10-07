// src/lib/ml/forecast.ts — previsão de gastos discricionários (séries curtas, mensais)
//
// Por que não um modelo "grande"? Finanças pessoais dão séries de 3–24 pontos por categoria.
// Nesse regime, modelos simples e bem validados vencem os complexos. Em vez de escolher um
// modelo "no olho", o motor treina vários candidatos e escolhe pelo erro de BACKTEST
// (origem móvel, previsão 1 passo à frente) — e sempre compara com a previsão ingênua
// ("mês que vem = mês passado") para dizer se o modelo realmente agrega algo.
//
//   candidatos: ingênuo · média móvel (3) · mediana (6) · suavização exponencial ·
//               tendência amortecida (Holt)
//   seleção:    menor MAE no backtest (empate → modelo mais simples)
//   incerteza:  intervalo de 80% a partir do erro de backtest, alargado com o horizonte
//
// Sem dependências de React/Firebase: é função pura, testável com vitest.

export type ModelName =
  | 'ingenuo'
  | 'media_movel'
  | 'mediana_robusta'
  | 'suavizacao_exp'
  | 'tendencia_amortecida';

export const MODEL_LABELS: Record<ModelName, string> = {
  ingenuo: 'Ingênuo (último mês)',
  media_movel: 'Média móvel (3 meses)',
  mediana_robusta: 'Mediana (6 meses)',
  suavizacao_exp: 'Suavização exponencial',
  tendencia_amortecida: 'Tendência amortecida',
};

export interface ForecastPoint {
  month: string; // YYYY-MM
  mean: number;
  lower: number; // limite inferior do intervalo de 80%
  upper: number;
}

export interface CandidateScore {
  model: ModelName | string;
  mae: number;
}

export interface BacktestSummary {
  /** nº de previsões fora da amostra usadas na avaliação */
  steps: number;
  mae: number;
  /** erro absoluto ponderado: Σ|erro| / Σ|real| (robusto a meses com valor zero) */
  wape: number;
  /** MAE do modelo ingênuo no mesmo backtest — a barra a ser superada */
  baselineMae: number;
  /** 1 − MAE/MAE_ingênuo. > 0 = melhor que o ingênuo; ≤ 0 = não agrega nada */
  skill: number;
  /** fração dos valores reais que caiu dentro do intervalo de 80% (ideal ≈ 0,8) */
  coverage: number | null;
}

export interface SeriesForecast {
  model: ModelName | string;
  /** false quando há dados demais de menos para validar (< 5 meses) */
  reliable: boolean;
  points: ForecastPoint[];
  backtest: BacktestSummary | null;
  candidates: CandidateScore[];
  /** nº de meses de histórico usados */
  n: number;
}

export interface PortfolioForecast {
  /** soma das categorias (intervalo assume categorias independentes — otimista) */
  total: ForecastPoint[];
  byKey: Record<string, SeriesForecast>;
  reliable: boolean;
  /** backtest da série TOTAL prevista diretamente (mais confiável que somar categorias) */
  totalBacktest: BacktestSummary | null;
  /** modelo escolhido para a série total e a tabela de candidatos (para exibir na UI) */
  totalModel: ModelName | string;
  totalCandidates: CandidateScore[];
  /** meses de histórico da série total */
  n: number;
  engine: 'local' | 'api';
}

// ── utilidades ────────────────────────────────────────────────────────────────

const Z80 = 1.2816; // quantil da normal para intervalo central de 80%
const MIN_TRAIN = 3;
const MIN_RELIABLE = 5;

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Soma `h` meses a um YYYY-MM (sem depender de Date/fuso). */
export function addMonthsStr(month: string, h: number): string {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + h;
  const yy = Math.floor(idx / 12);
  const mm = (idx % 12) + 1;
  return `${yy}-${String(mm).padStart(2, '0')}`;
}

// ── modelos ───────────────────────────────────────────────────────────────────

/** Recebe o histórico e devolve a previsão de h passos (sempre ≥ 0). */
type Predictor = (y: number[], h: number) => number[];

const flat = (v: number, h: number) => Array.from({ length: h }, () => Math.max(0, v));

const naive: Predictor = (y, h) => flat(y[y.length - 1] ?? 0, h);
const movingAvg: Predictor = (y, h) => flat(mean(y.slice(-3)), h);
const medianRobust: Predictor = (y, h) => flat(median(y.slice(-6)), h);

function sesFit(y: number[], alpha: number) {
  let level = y[0];
  let sse = 0;
  for (let t = 1; t < y.length; t++) {
    const e = y[t] - level;
    sse += e * e;
    level += alpha * e;
  }
  return { level, sse };
}

const ses: Predictor = (y, h) => {
  if (y.length < 2) return flat(y[0] ?? 0, h);
  let best = { level: y[0], sse: Infinity };
  for (let a = 0.1; a <= 0.91; a += 0.1) {
    const f = sesFit(y, a);
    if (f.sse < best.sse) best = f;
  }
  return flat(best.level, h);
};

function holtFit(y: number[], alpha: number, beta: number, phi: number) {
  let level = y[0];
  let trend = y[1] - y[0];
  let sse = 0;
  for (let t = 1; t < y.length; t++) {
    const pred = level + phi * trend;
    const e = y[t] - pred;
    sse += e * e;
    const newLevel = pred + alpha * e;
    trend = phi * trend + alpha * beta * e;
    level = newLevel;
  }
  return { level, trend, sse };
}

const dampedHolt: Predictor = (y, h) => {
  if (y.length < 4) return ses(y, h);
  let best = { level: y[0], trend: 0, phi: 0.9, sse: Infinity };
  for (const alpha of [0.2, 0.4, 0.6, 0.8]) {
    for (const beta of [0.1, 0.2, 0.4]) {
      for (const phi of [0.8, 0.9, 0.98]) {
        const f = holtFit(y, alpha, beta, phi);
        if (f.sse < best.sse) best = { ...f, phi };
      }
    }
  }
  const out: number[] = [];
  let damp = 0;
  for (let i = 1; i <= h; i++) {
    damp += Math.pow(best.phi, i);
    out.push(Math.max(0, best.level + damp * best.trend));
  }
  return out;
};

/** Ordem importa: em empate de erro vence o mais simples (primeiro da lista). */
const MODELS: { name: ModelName; fn: Predictor }[] = [
  { name: 'ingenuo', fn: naive },
  { name: 'media_movel', fn: movingAvg },
  { name: 'mediana_robusta', fn: medianRobust },
  { name: 'suavizacao_exp', fn: ses },
  { name: 'tendencia_amortecida', fn: dampedHolt },
];

// ── backtest (origem móvel, 1 passo à frente) ─────────────────────────────────

interface ModelBacktest {
  name: ModelName;
  errors: number[]; // real − previsto, em ordem temporal
  actuals: number[];
  mae: number;
}

function backtestModel(y: number[], name: ModelName, fn: Predictor): ModelBacktest {
  const errors: number[] = [];
  const actuals: number[] = [];
  for (let t = MIN_TRAIN; t < y.length; t++) {
    const yhat = fn(y.slice(0, t), 1)[0];
    errors.push(y[t] - yhat);
    actuals.push(y[t]);
  }
  return { name, errors, actuals, mae: errors.length ? mean(errors.map(Math.abs)) : Infinity };
}

function summarize(chosen: ModelBacktest, baseline: ModelBacktest): BacktestSummary | null {
  const steps = chosen.errors.length;
  if (steps === 0) return null;
  const absErr = chosen.errors.map(Math.abs);
  const sumActual = chosen.actuals.reduce((s, v) => s + Math.abs(v), 0);

  // cobertura honesta: o sigma de cada passo usa SÓ os erros anteriores a ele
  let covered = 0;
  let counted = 0;
  for (let i = 2; i < steps; i++) {
    const prev = chosen.errors.slice(0, i);
    const sigma = Math.sqrt(mean(prev.map((e) => e * e)));
    counted++;
    if (Math.abs(chosen.errors[i]) <= Z80 * sigma) covered++;
  }

  return {
    steps,
    mae: mean(absErr),
    wape: sumActual > 0 ? absErr.reduce((s, v) => s + v, 0) / sumActual : 0,
    baselineMae: baseline.mae,
    skill: baseline.mae > 0 ? 1 - chosen.mae / baseline.mae : 0,
    coverage: counted >= 3 ? covered / counted : null,
  };
}

// ── API pública ───────────────────────────────────────────────────────────────

export interface ForecastOptions {
  /** mês (YYYY-MM) do ÚLTIMO ponto da série; a previsão começa no mês seguinte */
  lastMonth: string;
  horizon: number;
}

/** Previsão de uma série mensal. `y` deve conter só meses COMPLETOS. */
export function forecastSeries(y: number[], opts: ForecastOptions): SeriesForecast {
  const { lastMonth, horizon } = opts;
  const clean = y.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const n = clean.length;

  if (n === 0) {
    return {
      model: 'ingenuo', reliable: false, n, backtest: null, candidates: [],
      points: Array.from({ length: horizon }, (_, i) => ({
        month: addMonthsStr(lastMonth, i + 1), mean: 0, lower: 0, upper: 0,
      })),
    };
  }

  // Poucos dados: não dá para validar. Usa a mediana e avisa que não é confiável.
  if (n < MIN_RELIABLE) {
    const level = median(clean);
    const spread = n >= 2 ? Math.sqrt(mean(clean.map((v) => (v - mean(clean)) ** 2))) : level * 0.5;
    return {
      model: 'mediana_robusta', reliable: false, n, backtest: null, candidates: [],
      points: Array.from({ length: horizon }, (_, i) => ({
        month: addMonthsStr(lastMonth, i + 1),
        mean: level,
        lower: Math.max(0, level - Z80 * spread),
        upper: level + Z80 * spread,
      })),
    };
  }

  const results = MODELS.map((m) => backtestModel(clean, m.name, m.fn));
  const baseline = results[0];
  let best = results[0];
  for (const r of results) if (r.mae < best.mae - 1e-9) best = r; // empate → mais simples
  const fn = MODELS.find((m) => m.name === best.name)!.fn;

  const sigma = Math.sqrt(mean(best.errors.map((e) => e * e)));
  const means = fn(clean, horizon);
  const points = means.map((m, i) => {
    const sh = sigma * Math.sqrt(1 + 0.25 * i); // alarga com o horizonte (heurística documentada)
    return {
      month: addMonthsStr(lastMonth, i + 1),
      mean: m,
      lower: Math.max(0, m - Z80 * sh),
      upper: m + Z80 * sh,
    };
  });

  return {
    model: best.name,
    reliable: true,
    n,
    points,
    backtest: summarize(best, baseline),
    candidates: results.map((r) => ({ model: r.name, mae: r.mae })),
  };
}

/** Prevê várias categorias e o total. `series` deve ter todas as séries com o mesmo tamanho. */
export function forecastPortfolio(
  series: Record<string, number[]>,
  opts: ForecastOptions,
): PortfolioForecast {
  const keys = Object.keys(series);
  const byKey: Record<string, SeriesForecast> = {};
  for (const k of keys) byKey[k] = forecastSeries(series[k], opts);

  const len = Math.max(0, ...keys.map((k) => series[k].length));
  const totalSeries = Array.from({ length: len }, (_, i) =>
    keys.reduce((s, k) => s + (series[k][i] ?? 0), 0),
  );

  // Total = previsão direta da série somada (capta correlação entre categorias melhor
  // do que somar intervalos independentes).
  const direct = forecastSeries(totalSeries, opts);
  const total = direct.points;

  return {
    total,
    byKey,
    reliable: direct.reliable,
    totalBacktest: direct.backtest,
    totalModel: direct.model,
    totalCandidates: direct.candidates,
    n: direct.n,
    engine: 'local',
  };
}
