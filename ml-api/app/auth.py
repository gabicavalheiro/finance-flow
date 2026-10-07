"""Verificação do token de login do Firebase (ID token) — sem segredos: só precisa do project id."""
from __future__ import annotations

import os

from fastapi import Header, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

_REQUEST = google_requests.Request()


def require_user(authorization: str | None = Header(default=None)) -> dict:
    """Dependência do FastAPI: exige `Authorization: Bearer <Firebase ID token>`.

    REQUIRE_AUTH=false desliga a checagem (só para desenvolvimento local).
    """
    if os.getenv("REQUIRE_AUTH", "true").lower() == "false":
        return {"uid": "local-dev"}

    project_id = os.getenv("FIREBASE_PROJECT_ID")
    if not project_id:
        raise HTTPException(status_code=500, detail="Servidor sem FIREBASE_PROJECT_ID configurado")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Token ausente")
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = id_token.verify_firebase_token(token, _REQUEST, audience=project_id)
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
    if not claims:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
    return {"uid": claims.get("user_id") or claims.get("sub")}
