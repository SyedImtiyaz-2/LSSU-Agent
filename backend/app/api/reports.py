import os
import logging
import traceback
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.services import supabase_service, report_service

router = APIRouter(tags=["reports"])
logger = logging.getLogger("reports")


@router.post("/reports/{interview_id}/generate")
async def generate_report(interview_id: str):
    interview = supabase_service.get_interview(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if interview.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Interview is not completed yet")

    transcript = interview.get("transcript")
    if not transcript or len(transcript) == 0:
        raise HTTPException(status_code=400, detail="No transcript data available")

    try:
        filepath = report_service.generate_pdf_report(interview)
        filename = os.path.basename(filepath)
        supabase_service.update_interview(interview_id, {"report_file": filename})
        return {"status": "generated", "filename": filename}
    except Exception as e:
        logger.error(f"Report generation failed for {interview_id}: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.get("/reports/{interview_id}/download")
async def download_report(interview_id: str):
    interview = supabase_service.get_interview(interview_id)
    if not interview or not interview.get("report_file"):
        raise HTTPException(status_code=404, detail="Report not found")

    filepath = os.path.join(
        os.path.dirname(__file__), "..", "..", "data", "reports", interview["report_file"]
    )
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Report file missing from disk")

    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename=interview["report_file"],
    )
