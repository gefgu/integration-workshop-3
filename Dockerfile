# TedTronics: the teacher website and the API in one service (Render, Railway, Fly, any Docker host).
#   docker build -t tedtronics .
#   docker run -p 8000:8000 -e TEDTRONICS_DATABASE_URL=postgresql://… -e TEDTRONICS_BENCH_SECRET=… tedtronics
# The bench (Raspberry Pi) and the phone app are not part of this image.

# 1) build the website (teacher_authoring_app → dist)
FROM node:22-slim AS site
WORKDIR /src
COPY protocol ./protocol
COPY teacher_authoring_app/package.json teacher_authoring_app/package-lock.json ./teacher_authoring_app/
RUN cd teacher_authoring_app && npm ci --no-audit --no-fund
COPY teacher_authoring_app ./teacher_authoring_app
RUN cd teacher_authoring_app && npm run build

# 2) the API, serving the built site
FROM python:3.11-slim
WORKDIR /app
COPY graph_validator ./graph_validator
RUN pip install --no-cache-dir ./graph_validator
COPY --from=site /src/teacher_authoring_app/dist ./site
ENV TEDTRONICS_SITE_DIR=/app/site \
    TEDTRONICS_TTS=off \
    PORT=8000
WORKDIR /app/graph_validator
EXPOSE 8000
# migrations first (idempotent), then the server on the port the host gives
CMD ["sh", "-c", "alembic upgrade head && uvicorn graph_validator.service.web:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
