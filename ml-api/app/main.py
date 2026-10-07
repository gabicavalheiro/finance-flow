"""API do classificador de gastos do FinanceFlow.

Sem estado: o app manda, junto com as transações, os exemplos do usuário (correções e histórico);
a API treina (base inicial + exemplos) e responde categoria + confiança. Modelos ficam em cache
por conjunto de exemplos, então chamadas repetidas ("reprocessar" sem novas correções) são instantâneas.
"""
from __future__ import annotations

import os

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .auth import require_user
from .forecast import SeriesResult, forecast_portfolio
from .model import Example, get_model

MAX_ITEMS = 5000
MAX_EXAMPLES = 20000

app = FastAPI(title="FinanceFlow ML API", version="1.1.0")

_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:8080,http://localhost:8081,http://localhost:5173,https://finance-flow-indol.vercel.app",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",") if o.strip()],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class ExampleIn(BaseModel):
    description: str = Field(max_length=300)
    category: str = Field(max_length=80)
    source: str = Field(default="user", pattern="^(user|history)$")


class ItemIn(BaseModel):
    id: str = Field(max_length=100)
    description: str = Field(max_length=300)


class ClassifyRequest(BaseModel):
    items: list[ItemIn] = Field(max_length=MAX_ITEMS)
    examples: list[ExampleIn] = Field(default_factory=list, max_length=MAX_EXAMPLES)


class Candidate(BaseModel):
    category: str
    confidence: float


class Prediction(BaseModel):
    id: str
    category: str
    confidence: float
    top: list[Candidate]


class ClassifyResponse(BaseModel):
    predictions: list[Prediction]
    classes: list[str]
    examples_used: int
    cached_model: bool


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest, _user: dict = Depends(require_user)) -> ClassifyResponse:
    examples = [Example(e.description, e.category, e.source) for e in req.examples]
    model, cached = get_model(examples)
    results = model.predict([i.description for i in req.items])
    return ClassifyResponse(
        predictions=[Prediction(id=i.id, **r) for i, r in zip(req.items, results)],
        classes=model.classes_,
        examples_used=len(examples),
        cached_model=cached,
    )


# ── Previsão de gastos ────────────────────────────────────────────────────────

MAX_SERIES = 40
MAX_MONTHS = 120


class ForecastRequest(BaseModel):
    """Séries mensais de gasto discricionário (meses COMPLETOS, em ordem), por categoria."""
    series: dict[str, list[float]]
    last_month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    horizon: int = Field(default=6, ge=1, le=12)


class ForecastPointOut(BaseModel):
    month: str
    mean: float
    lower: float
    upper: float


class BacktestOut(BaseModel):
    steps: int
    mae: float
    wape: float
    baseline_mae: float
    skill: float
    coverage: float | None


class CandidateOut(BaseModel):
    model: str
    mae: float


class SeriesForecastOut(BaseModel):
    model: str
    reliable: bool
    n: int
    points: list[ForecastPointOut]
    backtest: BacktestOut | None
    candidates: list[CandidateOut]


class ForecastResponse(BaseModel):
    engine: str = "api"
    total: SeriesForecastOut
    by_key: dict[str, SeriesForecastOut]


def _out(r: SeriesResult) -> SeriesForecastOut:
    return SeriesForecastOut(
        model=r.model, reliable=r.reliable, n=r.n, points=r.points,
        backtest=r.backtest, candidates=r.candidates,
    )


@app.post("/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest, _user: dict = Depends(require_user)) -> ForecastResponse:
    if len(req.series) > MAX_SERIES or any(len(v) > MAX_MONTHS for v in req.series.values()):
        raise HTTPException(status_code=422, detail="Séries demais ou longas demais")
    result = forecast_portfolio(req.series, req.last_month, req.horizon)
    return ForecastResponse(
        total=_out(result["total"]),
        by_key={k: _out(v) for k, v in result["by_key"].items()},
    )
