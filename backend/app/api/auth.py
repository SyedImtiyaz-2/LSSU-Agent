from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.config import (
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    MOCK_AUTH_ENABLED,
    MOCK_AUTH_EMAIL,
    MOCK_AUTH_PASSWORD,
)
from supabase import create_client

router = APIRouter(tags=["auth"])

_auth_client = None
_admin_client = None


def get_auth_client():
    global _auth_client
    if _auth_client is None:
        _auth_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _auth_client


def get_admin_client():
    global _admin_client
    if _admin_client is None:
        _admin_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _admin_client


def _mock_user_login(email: str, password: str):
    if not MOCK_AUTH_ENABLED:
        return None
    if email.strip().lower() == MOCK_AUTH_EMAIL.lower() and password == MOCK_AUTH_PASSWORD:
        return {
            "access_token": "mock-access-token",
            "user_id": "mock-user",
            "email": MOCK_AUTH_EMAIL,
        }
    return None


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
        mock_user = _mock_user_login(req.email, req.password)
        if mock_user:
            return mock_user

        # Use admin client to create user with email auto-confirmed
        admin = get_admin_client()
        result = admin.auth.admin.create_user({
            "email": req.email,
            "password": req.password,
            "email_confirm": True,
        })
        if result.user is None:
            raise HTTPException(status_code=400, detail="Signup failed")

        # Sign in immediately to get a valid session token
        anon = get_auth_client()
        session = anon.auth.sign_in_with_password({"email": req.email, "password": req.password})
        return {
            "access_token": session.session.access_token,
            "user_id": result.user.id,
            "email": result.user.email,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auth/login")
async def login(req: AuthRequest):
    try:
        mock_user = _mock_user_login(req.email, req.password)
        if mock_user:
            return mock_user

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
