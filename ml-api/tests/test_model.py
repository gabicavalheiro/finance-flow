import random

from app.model import Example, TextClassifier, get_model, normalize, train
from app.seed_data import MERCHANTS, PREFIXES, SUFFIXES


def test_normalize_strips_accents_numbers_and_noise():
    assert normalize("COMPRA CARTAO  Farmácia São João 01/03") == "farmacia sao joao"
    assert normalize("UBER *TRIP HELP.UBER.COM") == "uber trip help uber com"


def test_known_merchants_from_the_brief():
    model, _ = get_model([])
    cases = {
        "UBER *TRIP": "transport",
        "NETFLIX.COM": "subscription",
        "IFOOD *PIZZARIA DO JOAO": "food",
        "ALUGUEL APTO 202": "home",
        "COMPRA CARTAO POSTO IPIRANGA PELOTAS": "transport",
    }
    for desc, expected in cases.items():
        pred = model.predict([desc])[0]
        assert pred["category"] == expected, (desc, pred)
        assert pred["confidence"] > 0.5


def test_confidence_is_a_probability_and_top_is_sorted():
    model, _ = get_model([])
    pred = model.predict(["ALGUMA COISA ESTRANHA 123"])[0]
    assert 0.0 <= pred["confidence"] <= 1.0
    confs = [t["confidence"] for t in pred["top"]]
    assert confs == sorted(confs, reverse=True) and len(confs) == 3
    assert pred["top"][0]["category"] == pred["category"]


def test_holdout_by_merchant_beats_chance_and_confidence_is_informative():
    """Marcas que o modelo nunca viu: acerto bem acima do acaso (11 classes ≈ 9%)
    e confiança maior quando acerta do que quando erra."""
    rng = random.Random(7)
    tr_t, tr_y, te_t, te_y = [], [], [], []
    for cat, ms in MERCHANTS.items():
        ms = ms[:]
        rng.shuffle(ms)
        k = max(1, int(len(ms) * 0.2))
        for i, m in enumerate(ms):
            bucket = (te_t, te_y) if i < k else (tr_t, tr_y)
            for _ in range(3):
                bucket[0].append(f"{rng.choice(PREFIXES)}{m}{rng.choice(SUFFIXES)}".strip())
                bucket[1].append(cat)
    preds = TextClassifier().fit(tr_t, tr_y).predict(te_t)
    acc = sum(p["category"] == y for p, y in zip(preds, te_y)) / len(te_y)
    right = [p["confidence"] for p, y in zip(preds, te_y) if p["category"] == y]
    wrong = [p["confidence"] for p, y in zip(preds, te_y) if p["category"] != y]
    assert acc > 0.40, acc
    assert sum(right) / len(right) > sum(wrong) / len(wrong) + 0.15


def test_user_corrections_change_the_prediction():
    desc = "MERCADINHO DO ZECA"
    before = train([]).predict([desc])[0]
    corrections = [Example("MERCADINHO DO ZECA", "home", "user"), Example("mercadinho do zeca 02/10", "home", "user")]
    after = train(corrections).predict([desc])[0]
    assert after["category"] == "home"
    assert after["confidence"] > before["confidence"] or before["category"] != "home"


def test_new_custom_category_is_learned():
    ex = [Example("SALAO DA PAULA", "beleza", "user"), Example("salao da paula centro", "beleza", "user")]
    model = train(ex)
    assert "beleza" in model.classes_
    assert model.predict(["SALAO DA PAULA"])[0]["category"] == "beleza"


def test_cache_is_hit_for_same_examples():
    ex = [Example("LOJA TESTE CACHE", "shopping", "user")]
    _, first = get_model(ex)
    _, second = get_model(ex)
    assert first is False and second is True
