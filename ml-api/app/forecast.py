"""Previsão de gastos discricionários — versão "completa" (Python), espelho do motor em TypeScript.

O app roda um motor leve no navegador (src/lib/ml/forecast.ts). Esta API roda os MESMOS cinco
candidatos e acrescenta dois que só fazem sentido com scikit-learn:

  * ridge_global — regressão Ridge treinada com TODAS as categorias juntas (cada série dividida
                   pela própria escala). Com 6–18 meses por categoria não dá para aprender muito
                   de cada uma sozinha; o modelo global "empresta força" entre categorias.
  * ensemble     — média de suavização exp., tendência amortecida, mediana e ridge_global.
                   Composição FIXA (não escolhida pelos dados) para não vazar informação do backtest.

Seleção, intervalo e métricas seguem a mesma regra do TS: menor MAE em backtest de origem móvel
(1 passo à frente); em empate vence o modelo mais simples; sempre comparado com o ingênuo.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
from sklearn.linear_model import Ridge

Z80 = 1.2816          # quantil da normal para intervalo central de 80%
MIN_TRAIN = 3         # menor histórico usado para treinar no backtest
MIN_RELIABLE = 5      # abaixo disso não dá para validar o modelo
LAGS = 3
MIN_POOLED_ROWS = 8   # menos linhas que isso e o ridge cai para a média móvel
RIDGE_ALPHA = 1.0

# Ordem = desempate (mais simples primeiro)
MODEL_ORDER = [
    "ingenuo", "media_movel", "mediana_robusta", "suavizacao_exp",
    "tendencia_amortecida", "ridge_global", "ensemble",
]


def add_months(month: str, h: int) -> str:
    y, m = (int(p) for p in month.split("-"))
    idx = y * 12 + (m - 1) + h
    return f"{idx // 12}-{idx % 12 + 1:02d}"


# ── modelos univariados ──────────────────────────────────────────────────────

def _flat(v: float, h: int) -> np.ndarray:
    return np.full(h, max(0.0, float(v)))


def naive(y: np.ndarray, h: int) -> np.ndarray:
    return _flat(y[-1] if len(y) else 0.0, h)


def moving_avg(y: np.ndarray, h: int) -> np.ndarray:
    return _flat(float(np.mean(y[-3:])) if len(y) else 0.0, h)


def median_robust(y: np.ndarray, h: int) -> np.ndarray:
    return _flat(float(np.median(y[-6:])) if len(y) else 0.0, h)


def ses(y: np.ndarray, h: int) -> np.ndarray:
    if len(y) < 2:
        return _flat(y[0] if len(y) else 0.0, h)
    best_level, best_sse = float(y[0]), math.inf
    for alpha in np.arange(0.1, 0.91, 0.1):
        level, sse = float(y[0]), 0.0
        for v in y[1:]:
            e = v - level
            sse += e * e
            level += alpha * e
        if sse < best_sse:
            best_level, best_sse = level, sse
    return _flat(best_level, h)


def damped_holt(y: np.ndarray, h: int) -> np.ndarray:
    if len(y) < 4:
        return ses(y, h)
    best = (math.inf, float(y[0]), 0.0, 0.9)  # sse, level, trend, phi
    for alpha in (0.2, 0.4, 0.6, 0.8):
        for beta in (0.1, 0.2, 0.4):
            for phi in (0.8, 0.9, 0.98):
                level, trend, sse = float(y[0]), float(y[1] - y[0]), 0.0
                for v in y[1:]:
                    pred = level + phi * trend
                    e = v - pred
                    sse += e * e
                    level = pred + alpha * e
                    trend = phi * trend + alpha * beta * e
                if sse < best[0]:
                    best = (sse, level, trend, phi)
    _, level, trend, phi = best
    out, damp = [], 0.0
    for i in range(1, h + 1):
        damp += phi ** i
        out.append(max(0.0, level + damp * trend))
    return np.array(out)


UNIVARIATE = {
    "ingenuo": naive,
    "media_movel": moving_avg,
    "mediana_robusta": median_robust,
    "suavizacao_exp": ses,
    "tendencia_amortecida": damped_holt,
}


# ── modelo global (Ridge com todas as categorias) ────────────────────────────

def _scale(y_known: np.ndarray) -> float:
    m = float(np.mean(y_known)) if len(y_known) else 0.0
    return m if m > 0 else 1.0


def _features(window: np.ndarray, s: float) -> list[float]:
    a, b, c = window[-1] / s, window[-2] / s, window[-3] / s
    return [a, b, c, (a + b + c) / 3]


def _fit_pooled(panel: dict[str, np.ndarray], t: int) -> Ridge | None:
    """Treina com linhas cujo alvo está antes de t (nada do futuro entra)."""
    X, Y = [], []
    for y in panel.values():
        s = _scale(y[:t])
        for i in range(LAGS, t):
            X.append(_features(y[i - LAGS:i], s))
            Y.append(y[i] / s)
    if len(X) < MIN_POOLED_ROWS:
        return None
    return Ridge(alpha=RIDGE_ALPHA).fit(np.array(X), np.array(Y))


def _ridge_predict(model: Ridge | None, y_known: np.ndarray, h: int) -> np.ndarray:
    if model is None or len(y_known) < LAGS:
        return moving_avg(y_known, h)  # sem linhas suficientes: recua para a média móvel
    s = _scale(y_known)
    hist = list(y_known / s)
    out = []
    for _ in range(h):
        x = np.array([_features(np.array(hist[-LAGS:]), 1.0)])
        nxt = max(0.0, float(model.predict(x)[0]))
        hist.append(nxt)
        out.append(nxt * s)
    return np.array(out)


# ── resultado ────────────────────────────────────────────────────────────────

@dataclass
class SeriesResult:
    model: str
    reliable: bool
    n: int
    points: list[dict]
    backtest: dict | None
    candidates: list[dict] = field(default_factory=list)


def _points(means: np.ndarray, sigma: float, last_month: str) -> list[dict]:
    pts = []
    for i, m in enumerate(means):
        sh = sigma * math.sqrt(1 + 0.25 * i)
        pts.append({
            "month": add_months(last_month, i + 1),
            "mean": float(m),
            "lower": float(max(0.0, m - Z80 * sh)),
            "upper": float(m + Z80 * sh),
        })
    return pts


def _unreliable(y: np.ndarray, last_month: str, horizon: int) -> SeriesResult:
    n = len(y)
    if n == 0:
        pts = _points(np.zeros(horizon), 0.0, last_month)
        return SeriesResult("ingenuo", False, 0, pts, None)
    level = float(np.median(y))
    spread = float(np.std(y)) if n >= 2 else level * 0.5
    pts = [{
        "month": add_months(last_month, i + 1), "mean": level,
        "lower": max(0.0, level - Z80 * spread), "upper": level + Z80 * spread,
    } for i in range(horizon)]
    return SeriesResult("mediana_robusta", False, n, pts, None)


def _summary(errors: np.ndarray, actuals: np.ndarray, baseline_mae: float) -> dict | None:
    steps = len(errors)
    if steps == 0:
        return None
    mae = float(np.mean(np.abs(errors)))
    sum_actual = float(np.sum(np.abs(actuals)))
    covered = counted = 0
    for i in range(2, steps):  # sigma de cada passo usa só os erros anteriores
        sigma = math.sqrt(float(np.mean(errors[:i] ** 2)))
        counted += 1
        covered += abs(errors[i]) <= Z80 * sigma
    return {
        "steps": steps,
        "mae": mae,
        "wape": float(np.sum(np.abs(errors)) / sum_actual) if sum_actual > 0 else 0.0,
        "baseline_mae": baseline_mae,
        "skill": (1 - mae / baseline_mae) if baseline_mae > 0 else 0.0,
        "coverage": (covered / counted) if counted >= 3 else None,
    }


def forecast_panel(series: dict[str, list[float]], last_month: str, horizon: int) -> dict[str, SeriesResult]:
    clean = {
        k: np.array([v if (math.isfinite(v) and v > 0) else 0.0 for v in vals], dtype=float)
        for k, vals in series.items()
    }
    reliable = {k: y for k, y in clean.items() if len(y) >= MIN_RELIABLE}
    out: dict[str, SeriesResult] = {
        k: _unreliable(y, last_month, horizon) for k, y in clean.items() if k not in reliable
    }
    if not reliable:
        return out

    n_max = max(len(y) for y in reliable.values())
    # Painel retangular para o ridge: só séries com o mesmo tamanho entram no treino pooled.
    pooled = {k: y for k, y in reliable.items() if len(y) == n_max}

    # previsões 1 passo do ridge, por origem t (modelo único por origem, treinado com todas as séries)
    ridge_bt: dict[str, dict[int, float]] = {k: {} for k in reliable}
    for t in range(MIN_TRAIN, n_max):
        m = _fit_pooled({k: y for k, y in pooled.items()}, t)
        for k, y in reliable.items():
            if t < len(y):
                ridge_bt[k][t] = float(_ridge_predict(m, y[:t], 1)[0])
    final_ridge = _fit_pooled(pooled, n_max)

    for k, y in reliable.items():
        n = len(y)
        steps = list(range(MIN_TRAIN, n))
        actuals = y[steps]
        preds: dict[str, np.ndarray] = {}
        for name, fn in UNIVARIATE.items():
            preds[name] = np.array([fn(y[:t], 1)[0] for t in steps])
        preds["ridge_global"] = np.array([ridge_bt[k][t] for t in steps])
        preds["ensemble"] = np.mean(
            [preds["suavizacao_exp"], preds["tendencia_amortecida"],
             preds["mediana_robusta"], preds["ridge_global"]], axis=0)

        maes = {m: float(np.mean(np.abs(actuals - preds[m]))) for m in MODEL_ORDER}
        best = MODEL_ORDER[0]
        for m in MODEL_ORDER:
            if maes[m] < maes[best] - 1e-9:
                best = m

        # previsão final
        final = {name: fn(y, horizon) for name, fn in UNIVARIATE.items()}
        final["ridge_global"] = (
            _ridge_predict(final_ridge, y, horizon) if len(y) == n_max else moving_avg(y, horizon)
        )
        final["ensemble"] = np.mean(
            [final["suavizacao_exp"], final["tendencia_amortecida"],
             final["mediana_robusta"], final["ridge_global"]], axis=0)

        errors = actuals - preds[best]
        sigma = math.sqrt(float(np.mean(errors ** 2)))
        out[k] = SeriesResult(
            model=best, reliable=True, n=n,
            points=_points(final[best], sigma, last_month),
            backtest=_summary(errors, actuals, maes["ingenuo"]),
            candidates=[{"model": m, "mae": maes[m]} for m in MODEL_ORDER],
        )
    return out


def forecast_portfolio(series: dict[str, list[float]], last_month: str, horizon: int) -> dict:
    by_key = forecast_panel(series, last_month, horizon)
    n = max((len(v) for v in series.values()), default=0)
    total_series = [
        sum(series[k][i] if i < len(series[k]) else 0.0 for k in series) for i in range(n)
    ]
    total = forecast_panel({"__total__": total_series}, last_month, horizon)["__total__"]
    return {"by_key": by_key, "total": total}
