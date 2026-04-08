"""
POST /api/utils/extract-name
Uses the LLM to extract a person's name from a free-form message.
Returns { "name": "Aman" } or { "name": null } if no clear name is found.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from openai import OpenAI
from ..config import OPENAI_API_KEY, OPENAI_MODEL

router = APIRouter(prefix="/utils", tags=["utils"])
_client = OpenAI(api_key=OPENAI_API_KEY)


class ExtractNameRequest(BaseModel):
    text: str


class ExtractNameResponse(BaseModel):
    name: str | None


_SYSTEM = (
    "You extract a person's first name (or full name) from a chat message. "
    "Return ONLY the name, properly capitalised. "
    "If there is no clear name, return the single word: null. "
    "Never add explanation, punctuation, or extra words."
)

_EXAMPLES = [
    {"role": "user",      "content": "my name is aman"},
    {"role": "assistant", "content": "Aman"},
    {"role": "user",      "content": "just aman here"},
    {"role": "assistant", "content": "Aman"},
    {"role": "user",      "content": "i'm Sarah Khan"},
    {"role": "assistant", "content": "Sarah Khan"},
    {"role": "user",      "content": "what is the cost?"},
    {"role": "assistant", "content": "null"},
    {"role": "user",      "content": "hello there"},
    {"role": "assistant", "content": "null"},
    {"role": "user",      "content": "464654"},
    {"role": "assistant", "content": "null"},
]


@router.post("/extract-name", response_model=ExtractNameResponse)
async def extract_name(req: ExtractNameRequest):
    text = req.text.strip()
    if not text:
        return ExtractNameResponse(name=None)

    messages = _EXAMPLES + [{"role": "user", "content": text}]
    response = _client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role": "system", "content": _SYSTEM}] + messages,
        max_tokens=20,
        temperature=0,
    )
    raw = response.choices[0].message.content.strip()
    name = None if raw.lower() == "null" or not raw else raw
    return ExtractNameResponse(name=name)
