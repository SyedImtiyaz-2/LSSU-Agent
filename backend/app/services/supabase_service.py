from supabase import create_client, Client
from ..config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _client


def save_interview(data: dict) -> dict:
    client = get_client()
    result = client.table("interviews").insert(data).execute()
    return result.data[0] if result.data else {}


def update_interview(interview_id: str, data: dict) -> dict:
    client = get_client()
    result = client.table("interviews").update(data).eq("id", interview_id).execute()
    return result.data[0] if result.data else {}


def get_interview(interview_id: str) -> dict | None:
    client = get_client()
    result = client.table("interviews").select("*").eq("id", interview_id).execute()
    return result.data[0] if result.data else None


def get_prior_interviews(name: str, exclude_id: str | None = None, limit: int = 3) -> list[dict]:
    """
    Return the most recent completed interviews for this participant name.
    Used to inject prior context into follow-up question generation.
    """
    client = get_client()
    q = (
        client.table("interviews")
        .select("id,name,department,summary,transcript,created_at")
        .ilike("name", f"%{name.strip()}%")
        .eq("status", "completed")
        .order("created_at", desc=True)
        .limit(limit)
    )
    result = q.execute()
    rows = result.data or []
    if exclude_id:
        rows = [r for r in rows if r.get("id") != exclude_id]
    return rows


def list_interviews() -> list[dict]:
    client = get_client()
    result = client.table("interviews").select("*").order("created_at", desc=True).execute()
    return result.data or []


def save_document_record(data: dict) -> dict:
    client = get_client()
    result = client.table("documents").insert(data).execute()
    return result.data[0] if result.data else {}


def list_documents() -> list[dict]:
    client = get_client()
    result = client.table("documents").select("*").order("created_at", desc=True).execute()
    return result.data or []
