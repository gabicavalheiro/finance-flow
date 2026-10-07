import os

os.environ["REQUIRE_AUTH"] = "false"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_classify_returns_category_and_confidence():
    r = client.post("/classify", json={"items": [{"id": "1", "description": "UBER *TRIP"}, {"id": "2", "description": "NETFLIX.COM"}]})
    assert r.status_code == 200
    body = r.json()
    assert [p["id"] for p in body["predictions"]] == ["1", "2"]
    assert body["predictions"][0]["category"] == "transport"
    assert body["predictions"][1]["category"] == "subscription"
    assert 0 <= body["predictions"][0]["confidence"] <= 1


def test_classify_uses_examples():
    payload = {
        "items": [{"id": "x", "description": "CASA DA TIA ROSA"}],
        "examples": [{"description": "CASA DA TIA ROSA", "category": "health", "source": "user"}] * 2,
    }
    r = client.post("/classify", json=payload)
    assert r.json()["predictions"][0]["category"] == "health"
    assert r.json()["examples_used"] == 2


def test_auth_is_enforced_when_enabled(monkeypatch):
    monkeypatch.setenv("REQUIRE_AUTH", "true")
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "demo")
    r = client.post("/classify", json={"items": [{"id": "1", "description": "UBER"}]})
    assert r.status_code == 401
    r = client.post("/classify", headers={"Authorization": "Bearer lixo"}, json={"items": [{"id": "1", "description": "UBER"}]})
    assert r.status_code == 401


def test_rejects_oversized_description():
    r = client.post("/classify", json={"items": [{"id": "1", "description": "a" * 400}]})
    assert r.status_code == 422
