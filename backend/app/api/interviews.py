import uuid
from fastapi import APIRouter
from app.services import supabase_service

router = APIRouter(tags=["interviews"])


@router.post("/interviews")
async def create_interview():
    interview_id = str(uuid.uuid4())
    room_name = f"interview-{interview_id[:8]}"
    record = supabase_service.save_interview({
        "id": interview_id,
        "room_name": room_name,
        "status": "pending",
        "name": None,
        "department": None,
        "transcript": [],
        "summary": None,
    })
    return {"id": interview_id, "room_name": room_name}


@router.get("/interviews")
async def list_interviews():
    interviews = supabase_service.list_interviews()
    return {"interviews": interviews}


@router.get("/interviews/{interview_id}")
async def get_interview(interview_id: str):
    interview = supabase_service.get_interview(interview_id)
    if not interview:
        return {"error": "Interview not found"}
    return interview
