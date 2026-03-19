import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api import auth, token, documents, interviews, reports
from app.config import REPORT_DIR

app = FastAPI(title="LSSU Interview Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(token.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(interviews.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

app.mount("/reports", StaticFiles(directory=REPORT_DIR), name="reports")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve frontend static files in production
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="frontend-assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(request: Request, full_path: str):
        """Serve frontend for all non-API routes (SPA fallback)."""
        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
