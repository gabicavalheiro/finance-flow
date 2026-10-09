FROM python:3.11-slim
WORKDIR /srv
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app ./app
# Não roda como root: se o processo for comprometido, o alcance dentro do container é menor
RUN useradd --system --no-create-home appuser
USER appuser
# FIREBASE_PROJECT_ID e ALLOWED_ORIGINS vêm do ambiente do serviço (veja o README)
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
