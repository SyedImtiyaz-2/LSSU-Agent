from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
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


class AuthRequest(BaseModel):
    email: str
    password: str


@router.post("/auth/signup")
async def signup(req: AuthRequest):
    try:
        admin = get_admin_client()
        result = admin.auth.admin.create_user({
            "email": req.email,
            "password": req.password,
            "email_confirm": True,
        })
        if result.user is None:
            raise HTTPException(status_code=400, detail="Signup failed")

        session = get_auth_client().auth.sign_in_with_password(
            {"email": req.email, "password": req.password}
        )
        try:
            admin.table("users").upsert({"id": result.user.id, "email": result.user.email}).execute()
        except Exception:
            pass
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
        result = get_auth_client().auth.sign_in_with_password(
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
