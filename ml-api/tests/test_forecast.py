import os

os.environ["REQUIRE_AUTH"] = "false"

import numpy as np  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.forecast import add_months, forecast_panel, forecast_portfolio  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


def rng_series(seed, n, base=1000.0, noise=300.0):
    r = np.random.default_rng(seed)
    return list(np.clip(base + (r.random(n) - 0.5) * noise, 0, None))


def test_add_months_year_wrap():
    assert add_months("2026-11", 3) == "2027-02"
    assert add_months("2026-01", -1) == "2025-12"


def test_constant_series_predicts_constant():
    r = forecast_panel({"a": [800.0] * 10}, "2026-09", 3)["a"]
    assert r.reliable
    assert all(abs(p["mean"] - 800) < 1e-6 for p in r.points)
    assert r.points[0]["month"] == "2026-10"
    assert r.backtest["mae"] < 1e-6


def test_trend_series_beats_naive():
    y = [500.0 + 40 * i for i in range(14)]
    r = forecast_panel({"a": y}, "2026-09", 3)["a"]
    assert r.points[0]["mean"] > y[-1] - 1
    assert r.backtest["skill"] > 0


def test_outlier_does_not_contaminate_forecast():
    y = [900, 950, 880, 920, 4000, 910, 940, 900, 930]
    r = forecast_panel({"a": [float(v) for v in y]}, "2026-09", 1)["a"]
    assert r.points[0]["mean"] < 1500


def test_short_series_is_flagged_unreliable():
    r = forecast_panel({"a": [700.0, 900.0, 800.0]}, "2026-09", 2)["a"]
    assert not r.reliable and r.backtest is None and len(r.points) == 2


def test_interval_is_coherent_and_widens():
    r = forecast_panel({"a": rng_series(7, 18)}, "2026-09", 6)["a"]
    for p in r.points:
        assert p["lower"] >= 0
        assert p["lower"] <= p["mean"] + 1e-9 <= p["upper"] + 1e-9
    w = [p["upper"] - p["lower"] for p in r.points]
    assert w[-1] >= w[0]


def test_global_ridge_is_a_candidate_and_scored():
    series = {f"c{i}": rng_series(i, 16, base=400 + 150 * i) for i in range(5)}
    out = forecast_panel(series, "2026-09", 3)
    cands = {c["model"] for c in out["c0"].candidates}
    assert {"ridge_global", "ensemble", "ingenuo"} <= cands
    assert all(np.isfinite(c["mae"]) for c in out["c0"].candidates)


def test_pooled_ridge_never_sees_the_future():
    # O modelo treinado na origem t só pode depender de y[:t]: mudar y[t:] não altera os coeficientes.
    from app.forecast import _fit_pooled
    panel = {f"c{i}": np.array(rng_series(i, 14, base=500 + 100 * i)) for i in range(4)}
    t = 9
    a = _fit_pooled(panel, t)
    future_changed = {k: v.copy() for k, v in panel.items()}
    for v in future_changed.values():
        v[t:] *= 7
    b = _fit_pooled(future_changed, t)
    assert np.allclose(a.coef_, b.coef_) and np.isclose(a.intercept_, b.intercept_)


def test_portfolio_total_is_forecast_directly():
    series = {"a": [300.0 + (i % 2) * 20 for i in range(10)], "b": [500.0] * 10}
    r = forecast_portfolio(series, "2026-09", 2)
    assert 700 < r["total"].points[0]["mean"] < 900
    assert set(r["by_key"]) == {"a", "b"}


def test_endpoint_roundtrip():
    body = {"series": {"food": rng_series(1, 12), "transport": rng_series(2, 12, 300)},
            "last_month": "2026-09", "horizon": 4}
    r = client.post("/forecast", json=body)
    assert r.status_code == 200
    j = r.json()
    assert j["engine"] == "api"
    assert len(j["total"]["points"]) == 4
    assert set(j["by_key"]) == {"food", "transport"}
    assert j["total"]["backtest"]["baseline_mae"] >= 0


def test_endpoint_validation():
    bad = client.post("/forecast", json={"series": {"a": [1, 2, 3]}, "last_month": "2026-13", "horizon": 3})
    assert bad.status_code == 422
    bad2 = client.post("/forecast", json={"series": {"a": [1, 2, 3]}, "last_month": "2026-09", "horizon": 99})
    assert bad2.status_code == 422


def test_endpoint_requires_auth_when_enabled(monkeypatch):
    monkeypatch.setenv("REQUIRE_AUTH", "true")
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "demo")
    r = client.post("/forecast", json={"series": {"a": [1.0] * 8}, "last_month": "2026-09", "horizon": 2})
    assert r.status_code == 401
