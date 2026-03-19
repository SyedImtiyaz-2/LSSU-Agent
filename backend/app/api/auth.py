from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.config import SUPABASE_URL, SUPABASE_ANON_KEY
from supabase import create_client

router = APIRouter(tags=["auth"])

_auth_client = None


def get_auth_client():
    global _auth_client
    if _auth_client is None:
        _auth_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _auth_client


class AuthRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    user_id: str
    email: str


@router.post("/auth/signup")
async def signup(req: AuthRequest):
    try:
        client = get_auth_client()
        result = client.auth.sign_up({"email": req.email, "password": req.password})
        if result.user is None:
            raise HTTPException(status_code=400, detail="Signup failed")
        return {
            "access_token": result.session.access_token if result.session else "",
            "user_id": result.user.id,
            "email": result.user.email,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auth/login")
async def login(req: AuthRequest):
    try:
        client = get_auth_client()
        result = client.auth.sign_in_with_password(
            {"email": req.email, "password": req.password}
        )
        if result.user is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return {
            "access_token": result.session.access_token,
            "user_id": result.user.id,
            "email": result.user.email,
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/auth/logout")
async def logout():
    return {"status": "ok"}
