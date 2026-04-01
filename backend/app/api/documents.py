import os
import uuid
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from app.config import UPLOAD_DIR
from app.services import supabase_service, rag_service

router = APIRouter(tags=["documents"])
logger = logging.getLogger("documents")


def _extract_text(filepath: str, filename: str) -> str:
    """Extract text content from uploaded file for RAG storage."""
    try:
        ext = os.path.splitext(filename)[1].lower()
        if ext in (".txt", ".md"):
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        elif ext == ".pdf":
            from llama_index.core import SimpleDirectoryReader
            reader = SimpleDirectoryReader(input_files=[filepath])
            docs = reader.load_data()
            return "\n\n".join(doc.text for doc in docs)
        elif ext in (".html", ".htm"):
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                raw = f.read()
            # Strip HTML tags
            import re
            return re.sub(r"<[^>]+>", " ", raw).strip()
        elif ext == ".docx":
            from llama_index.core import SimpleDirectoryReader
            reader = SimpleDirectoryReader(input_files=[filepath])
            docs = reader.load_data()
            return "\n\n".join(doc.text for doc in docs)
        else:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
    except Exception as e:
        logger.error(f"Failed to extract text from {filename}: {e}")
        return ""


@router.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1]
    file_id = str(uuid.uuid4())
    safe_name = f"{file_id}{ext}"
    filepath = os.path.join(UPLOAD_DIR, safe_name)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    # Extract text content and store in DB (so agent worker can access via Supabase)
    text_content = _extract_text(filepath, file.filename)
    logger.info(f"Extracted {len(text_content)} chars from {file.filename}")

    record = supabase_service.save_document_record({
        "id": file_id,
        "filename": file.filename,
        "stored_name": safe_name,
        "file_size": len(content),
        "content": text_content,
        "status": "indexed",
    })

    # Rebuild RAG index with new document
    rag_service.build_index()

    return {"id": file_id, "filename": file.filename, "status": "indexed"}


class CrawlRequest(BaseModel):
    url: str


@router.post("/documents/crawl")
async def crawl_document(req: CrawlRequest):
    """Crawl a URL with crawl4ai, extract text, and add it to the knowledge base."""
    try:
        from crawl4ai import AsyncWebCrawler
        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url=req.url)
            text_content = result.markdown or result.cleaned_html or ""
    except Exception as e:
        logger.error(f"Crawl failed for {req.url}: {e}")
        raise HTTPException(status_code=422, detail=f"Failed to crawl URL: {e}")

    if not text_content.strip():
        raise HTTPException(status_code=422, detail="No content extracted from URL")

    # Derive a filename from the URL
    from urllib.parse import urlparse
    parsed = urlparse(req.url)
    slug = (parsed.netloc + parsed.path).strip("/").replace("/", "_")[:60] or "crawled"
    filename = f"{slug}.md"

    file_id = str(uuid.uuid4())
    safe_name = f"{file_id}.md"
    filepath = os.path.join(UPLOAD_DIR, safe_name)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(text_content)

    record = supabase_service.save_document_record({
        "id": file_id,
        "filename": filename,
        "stored_name": safe_name,
        "file_size": len(text_content.encode("utf-8")),
        "content": text_content,
        "status": "indexed",
    })

    rag_service.build_index()
    logger.info(f"Crawled {req.url} → {len(text_content)} chars, saved as {filename}")
    return {"id": file_id, "filename": filename, "status": "indexed", "url": req.url}


@router.get("/documents")
async def list_documents():
    docs = supabase_service.list_documents()
    return {"documents": docs}


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    docs = supabase_service.list_documents()
    doc = next((d for d in docs if d["id"] == doc_id), None)
    if not doc:
        return {"error": "Document not found"}

    stored = doc.get("stored_name") or doc.get("file_path") or ""
    if stored:
        filepath = os.path.join(UPLOAD_DIR, stored)
        if os.path.exists(filepath):
            os.remove(filepath)

    client = supabase_service.get_client()
    client.table("documents").delete().eq("id", doc_id).execute()

    rag_service.build_index()
    return {"status": "deleted"}
