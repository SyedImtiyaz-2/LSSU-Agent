import logging
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from app.services.rag_service import query_context
from app.config import OPENAI_API_KEY, OPENAI_MODEL

router = APIRouter(tags=["chat"])
logger = logging.getLogger("chat")

CHAT_SYSTEM_PROMPT = """You are an AI assistant for LSSU (Lake Superior State University). \
You help staff understand how AI can improve their workflows, answer questions about \
university processes, and provide guidance based on the knowledge base.

Guidelines:
- Be helpful, concise, and professional
- If the knowledge base context is provided, ground your answer in it
- If you don't know something, say so clearly
- Keep responses focused and actionable"""


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    history: List[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    session_id: Optional[str] = None
    rag_used: bool = False


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    # Pull relevant context from RAG
    context = query_context(req.message, top_k=3)
    rag_used = bool(context and context.strip() and context != "Empty Response")

    system = CHAT_SYSTEM_PROMPT
    if rag_used:
        system += f"\n\nKnowledge Base Context:\n{context}"

    messages = [{"role": "system", "content": system}]
    # Include last 10 messages of history for context
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
    reply = response.choices[0].message.content.strip()
    logger.info(f"Chat reply generated (rag_used={rag_used}): {reply[:80]}")

    return ChatResponse(reply=reply, session_id=req.session_id, rag_used=rag_used)
