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
        filepath, report_text = report_service.generate_pdf_report(interview)
        filename = os.path.basename(filepath)
        supabase_service.update_interview(interview_id, {
            "report_file": filename,
            "report_text": report_text,
        })
        return {"status": "generated", "filename": filename}
    except Exception as e:
        logger.error(f"Report generation failed for {interview_id}: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.get("/reports/{interview_id}/download")
async def download_report(interview_id: str):
    interview = supabase_service.get_interview(interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Report not found")

    if not interview.get("report_file"):
        raise HTTPException(status_code=404, detail="Report not generated yet")

    filepath = os.path.join(
        os.path.dirname(__file__), "..", "..", "data", "reports", interview["report_file"]
    )

    # If file missing (Render ephemeral filesystem), regenerate from stored report text
    if not os.path.exists(filepath):
        report_text = interview.get("report_text")
        if report_text:
            logger.info(f"Regenerating PDF from stored report text for {interview_id}")
            filepath = report_service.render_pdf_from_text(interview, report_text)
        else:
            logger.info(f"No stored report text, regenerating full report for {interview_id}")
            filepath, report_text = report_service.generate_pdf_report(interview)
            supabase_service.update_interview(interview_id, {"report_text": report_text})

    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename=interview.get("report_file", "report.pdf"),
    )
