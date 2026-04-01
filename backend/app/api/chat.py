import logging
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from app.services.rag_service import query_context
from app.config import OPENAI_API_KEY, OPENAI_MODEL

router = APIRouter(tags=["chat"])
logger = logging.getLogger("chat")

CAL_LINK = "https://cal.com/ceo-fastship/15min"
SUPABASE_SCHEMA = "issu"

CHAT_SYSTEM_PROMPT = """You are an AI assistant for LSSU (Lake Superior State University). \
You help staff understand how AI can improve their workflows, answer questions about \
university processes, and provide guidance based on the knowledge base.

Guidelines:
- Be helpful, concise, and professional
- If the knowledge base context is provided, ground your answer in it
- If you cannot confidently answer the question, say so honestly and end your reply \
with exactly this line on a new line: SUGGEST_CALL
- Keep responses focused and actionable
- Do NOT make up information you are not sure about"""


class LeadInfo(BaseModel):
    name: str
    phone: str
    email: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    history: List[ChatMessage] = []
    lead: Optional[LeadInfo] = None


class ChatResponse(BaseModel):
    reply: str
    session_id: Optional[str] = None
    rag_used: bool = False
    suggest_call: bool = False


def _get_sb():
    from app.services.supabase_service import get_client
    return get_client()


def _ensure_session(session_id: str, lead: Optional[LeadInfo]):
    try:
        sb = _get_sb()
        existing = sb.schema(SUPABASE_SCHEMA).table("chat_sessions").select("session_id").eq("session_id", session_id).execute()
        if not existing.data:
            row = {
                "session_id": session_id,
                "page_slug": "agent-chatbot",
                "icp_id": None,
                "icp_name": "Agent Chatbot",
                "referral_source": "agent",
            }
            if lead:
                row["name"] = lead.name
                row["phone"] = lead.phone
                row["email"] = lead.email
            sb.schema(SUPABASE_SCHEMA).table("chat_sessions").insert(row).execute()
        elif lead:
            # Update lead info if not yet saved
            sb.schema(SUPABASE_SCHEMA).table("chat_sessions").update({
                "name": lead.name,
                "phone": lead.phone,
                "email": lead.email,
            }).eq("session_id", session_id).execute()
    except Exception as e:
        logger.warning(f"Session upsert failed (non-critical): {e}")


def _log_message(session_id: str, role: str, content: str, rag_score: float = None):
    try:
        sb = _get_sb()
        sb.schema(SUPABASE_SCHEMA).table("chat_messages").insert({
            "session_id": session_id,
            "role": role,
            "content": content,
            "rag_score": rag_score,
        }).execute()
        # Increment message count
        existing = sb.schema(SUPABASE_SCHEMA).table("chat_sessions").select("message_count").eq("session_id", session_id).execute().data
        count = (existing[0].get("message_count") or 0) + 1 if existing else 1
        sb.schema(SUPABASE_SCHEMA).table("chat_sessions").update({"message_count": count}).eq("session_id", session_id).execute()
    except Exception as e:
        logger.warning(f"Message log failed (non-critical): {e}")


class LeadUpsertRequest(BaseModel):
    session_id: str
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


@router.post("/chat/lead")
def upsert_lead(req: LeadUpsertRequest):
    """Create or update session lead info — called after each lead question answered."""
    try:
        sb = _get_sb()
        existing = sb.schema(SUPABASE_SCHEMA).table("chat_sessions").select("session_id").eq("session_id", req.session_id).execute()
        row = {k: v for k, v in {"name": req.name, "phone": req.phone, "email": req.email}.items() if v is not None}
        if not existing.data:
            sb.schema(SUPABASE_SCHEMA).table("chat_sessions").insert({
                "session_id": req.session_id,
                "page_slug": "agent-chatbot",
                "icp_name": "Agent Chatbot",
                "referral_source": "agent",
                **row,
            }).execute()
        else:
            if row:
                sb.schema(SUPABASE_SCHEMA).table("chat_sessions").update(row).eq("session_id", req.session_id).execute()
    except Exception as e:
        logger.warning(f"Lead upsert failed: {e}")
    return {"status": "ok"}


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    session_id = req.session_id or f"agent-{__import__('uuid').uuid4()}"

    # Upsert session + lead info in Supabase
    _ensure_session(session_id, req.lead)

    # Log user message
    _log_message(session_id, "user", req.message)

    # RAG
    context = query_context(req.message, top_k=3)
    rag_used = bool(context and context.strip() and context != "Empty Response")

    system = CHAT_SYSTEM_PROMPT
    if rag_used:
        system += f"\n\nKnowledge Base Context:\n{context}"

    messages = [{"role": "system", "content": system}]
    for msg in req.history[-10:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": req.message})

    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=messages,
        temperature=0.7,
    )
    raw_reply = response.choices[0].message.content.strip()

    suggest_call = "SUGGEST_CALL" in raw_reply
    reply = raw_reply.replace("SUGGEST_CALL", "").strip()

    # Log assistant reply
    _log_message(session_id, "assistant", reply, rag_score=1.0 if rag_used else 0.0)

    logger.info(f"Chat reply (rag={rag_used}, suggest_call={suggest_call}): {reply[:80]}")

    return ChatResponse(
        reply=reply,
        session_id=session_id,
        rag_used=rag_used,
        suggest_call=suggest_call,
    )
