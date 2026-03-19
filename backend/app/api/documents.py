import os
import uuid
from fastapi import APIRouter, UploadFile, File
from app.config import UPLOAD_DIR
from app.services import supabase_service, rag_service

router = APIRouter(tags=["documents"])


@router.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1]
    file_id = str(uuid.uuid4())
    safe_name = f"{file_id}{ext}"
    filepath = os.path.join(UPLOAD_DIR, safe_name)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    record = supabase_service.save_document_record({
        "id": file_id,
        "filename": file.filename,
        "stored_name": safe_name,
        "file_size": len(content),
        "status": "indexed",
    })

    # Rebuild RAG index with new document
    rag_service.build_index()

    return {"id": file_id, "filename": file.filename, "status": "indexed"}


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
