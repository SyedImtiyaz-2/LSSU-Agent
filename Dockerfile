FROM python:3.11-slim AS backend
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM node:18-slim AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
COPY --from=backend /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend /usr/local/bin /usr/local/bin
COPY backend/ ./backend/
COPY --from=frontend /app/dist ./backend/static/
ENV PORT=8080
EXPOSE 8080
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT --app-dir backend
