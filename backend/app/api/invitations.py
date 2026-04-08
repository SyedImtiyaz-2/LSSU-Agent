import os
import uuid
import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from ..services.supabase_service import get_client
from ..services.email_service import send_invitation_email

router = APIRouter(tags=["invitations"])
logger = logging.getLogger("invitations")


class InvitationRequest(BaseModel):
    emails: list[str]
    message: str = ""


class InviteSessionRequest(BaseModel):
    name: str = ""


@router.post("/invitations/send")
async def send_invitations(req: InvitationRequest, request: Request):
    """Send invitation emails to a list of recipients."""
    sb = get_client()
    base_url = str(request.base_url).rstrip("/")
    results = []

    for email in req.emails:
        email = email.strip()
        if not email:
            continue

        token = str(uuid.uuid4())
        invite_url = f"{base_url}/invite/{token}"

        # Save invitation record
        record = {
            "email": email,
            "token": token,
            "message": req.message,
            "status": "sent",
        }
        try:
            sb.table("invitations").insert(record).execute()
        except Exception as e:
            logger.error(f"Failed to save invitation for {email}: {e}")
            results.append({"email": email, "status": "error", "error": str(e)})
            continue

        # Send email
        email_result = send_invitation_email(
            to_email=email,
            invite_name="",
            invite_url=invite_url,
            custom_message=req.message,
        )

        if email_result["success"]:
            results.append({"email": email, "status": "sent"})
        else:
            results.append({"email": email, "status": "error", "error": email_result.get("error", "")})

    return {"results": results, "total_sent": sum(1 for r in results if r["status"] == "sent")}


@router.get("/invitations")
async def list_invitations():
    """List all sent invitations."""
    try:
        sb = get_client()
        result = sb.table("invitations").select("*").order("sent_at", desc=True).execute()
        return {"invitations": result.data or []}
    except Exception as e:
        logger.error(f"Failed to list invitations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/invitations/{token}")
async def get_invitation(token: str):
    """Get invitation details by token (public, no auth needed)."""
    sb = get_client()
    result = sb.table("invitations").select("*").eq("token", token).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Invitation not found or expired")

    invite = result.data[0]

    # Mark as opened if first time
    if invite["status"] == "sent":
        sb.table("invitations").update({"status": "opened"}).eq("token", token).execute()

    return {
        "email": invite["email"],
        "message": invite.get("message", ""),
        "status": invite["status"],
        "interview_id": invite.get("interview_id"),
    }


@router.post("/invitations/{token}/start")
async def start_invite_session(token: str, req: InviteSessionRequest):
    """Create an interview session from an invitation (public, no auth)."""
    sb = get_client()
    result = sb.table("invitations").select("*").eq("token", token).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Invitation not found")

    invite = result.data[0]

    # If already has an interview, return it
    if invite.get("interview_id"):
        interview = sb.table("interviews").select("*").eq("id", invite["interview_id"]).execute()
        if interview.data:
            return {"id": interview.data[0]["id"], "room_name": interview.data[0]["room_name"]}

    # Create new interview
    room_name = f"interview-{uuid.uuid4().hex[:8]}"
    interview_data = {
        "room_name": room_name,
        "status": "pending",
        "name": req.name or invite["email"].split("@")[0],
    }
    interview_result = sb.table("interviews").insert(interview_data).execute()
    if not interview_result.data:
        raise HTTPException(status_code=500, detail="Failed to create session")

    interview_id = interview_result.data[0]["id"]

    # Link invitation to interview
    sb.table("invitations").update({
        "status": "started",
        "interview_id": interview_id,
    }).eq("token", token).execute()

    return {"id": interview_id, "room_name": room_name}
