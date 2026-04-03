FROM python:3.11-slim AS backend
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    python -m playwright install chromium --with-deps

FROM node:18-slim AS frontend
ARG VITE_SKIP_AUTH=false
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN VITE_SKIP_AUTH=${VITE_SKIP_AUTH} npm run build

FROM python:3.11-slim
WORKDIR /app

# Chromium runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libpangocairo-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=backend /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend /usr/local/bin /usr/local/bin
# Copy playwright browsers installed in backend stage
COPY --from=backend /root/.cache/ms-playwright /root/.cache/ms-playwright
COPY backend/ ./backend/
COPY --from=frontend /app/dist ./backend/static/
ENV PORT=8080
EXPOSE 8080
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT --app-dir backend
