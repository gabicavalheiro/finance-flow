"""Classificador de transações: TF-IDF (palavras + n-gramas de caracteres) + Regressão Logística.

Escolhi LogisticRegression (e não LinearSVC) porque ela devolve probabilidade de verdade
(predict_proba), que é o que alimenta a "confiança" mostrada na interface. O LinearSVC só
daria uma distância à margem, e calibrar isso exige dados que o usuário ainda não tem.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
from collections import OrderedDict
from dataclasses import dataclass
from threading import Lock

import numpy as np
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

from .seed_data import build_seed

# Ruído de extrato que não diz nada sobre a categoria
_NOISE = re.compile(
    r"\b(compra|cartao|debito|credito|pagto|pagamento|pag|deb|autom|transf|em|no|na|de|do|da|s a|ltda|me|epp|matriz|bra|br)\b"
)
_STANDALONE_NUMBER = re.compile(r"\b\d+\b")
_NON_ALNUM = re.compile(r"[^a-z0-9\s]")
_SPACES = re.compile(r"\s+")

USER_WEIGHT = 3.0      # correções do usuário pesam mais que a base inicial
HISTORY_WEIGHT = 1.5   # histórico já categorizado no app pesa um pouco mais que a base
SEED_WEIGHT = 1.0


def normalize(text: str) -> str:
    """minúsculas, sem acento, sem números soltos (datas/parcelas) e sem ruído de extrato."""
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii").lower()
    text = _NON_ALNUM.sub(" ", text)
    text = _STANDALONE_NUMBER.sub(" ", text)
    text = _NOISE.sub(" ", text)
    return _SPACES.sub(" ", text).strip()


@dataclass(frozen=True)
class Example:
    description: str
    category: str
    source: str = "user"  # "user" | "history"


class TextClassifier:
    def __init__(self, c: float = 20.0):
        self._word = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=1)
        self._char = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True, min_df=1)
        self._clf = LogisticRegression(C=c, max_iter=2000, class_weight="balanced")
        self.classes_: list[str] = []

    def _features(self, texts: list[str], fit: bool = False):
        if fit:
            w = self._word.fit_transform(texts)
            c = self._char.fit_transform(texts)
        else:
            w = self._word.transform(texts)
            c = self._char.transform(texts)
        return hstack([w, c]).tocsr()

    def fit(self, texts: list[str], labels: list[str], weights: list[float] | None = None) -> "TextClassifier":
        norm = [normalize(t) or "vazio" for t in texts]
        X = self._features(norm, fit=True)
        self._clf.fit(X, labels, sample_weight=np.asarray(weights) if weights is not None else None)
        self.classes_ = list(self._clf.classes_)
        return self

    def predict(self, texts: list[str], top_k: int = 3) -> list[dict]:
        norm = [normalize(t) or "vazio" for t in texts]
        proba = self._clf.predict_proba(self._features(norm))
        out = []
        for row in proba:
            order = np.argsort(row)[::-1][:top_k]
            out.append({
                "category": self.classes_[order[0]],
                "confidence": round(float(row[order[0]]), 4),
                "top": [{"category": self.classes_[i], "confidence": round(float(row[i]), 4)} for i in order],
            })
        return out


def train(examples: list[Example]) -> TextClassifier:
    """Treina com a base inicial + exemplos do usuário (estes com mais peso)."""
    texts, labels, weights = [], [], []
    for desc, cat in build_seed():
        texts.append(desc); labels.append(cat); weights.append(SEED_WEIGHT)
    for ex in examples:
        if not ex.description.strip() or not ex.category.strip():
            continue
        texts.append(ex.description); labels.append(ex.category)
        weights.append(USER_WEIGHT if ex.source == "user" else HISTORY_WEIGHT)
    return TextClassifier().fit(texts, labels, weights)


# ── Cache de modelos por conjunto de exemplos (a API não guarda estado em disco) ──
_CACHE: "OrderedDict[str, TextClassifier]" = OrderedDict()
_CACHE_MAX = 16
_LOCK = Lock()


def _key(examples: list[Example]) -> str:
    h = hashlib.sha256()
    for ex in sorted(examples, key=lambda e: (e.category, e.description, e.source)):
        h.update(f"{ex.source}|{ex.category}|{ex.description}\n".encode("utf-8"))
    return h.hexdigest()


def get_model(examples: list[Example]) -> tuple[TextClassifier, bool]:
    """Devolve (modelo, veio_do_cache)."""
    key = _key(examples)
    with _LOCK:
        if key in _CACHE:
            _CACHE.move_to_end(key)
            return _CACHE[key], True
    model = train(examples)
    with _LOCK:
        _CACHE[key] = model
        _CACHE.move_to_end(key)
        while len(_CACHE) > _CACHE_MAX:
            _CACHE.popitem(last=False)
    return model, False
