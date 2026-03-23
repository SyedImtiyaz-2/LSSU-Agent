import os
import logging
import resend

logger = logging.getLogger("email-service")

resend.api_key = os.getenv("RESEND_API_KEY", "")

FROM_EMAIL = os.getenv("FROM_EMAIL", "LSSU AI Agent <onboarding@resend.dev>")


def send_invitation_email(to_email: str, invite_name: str, invite_url: str, custom_message: str = "") -> dict:
    """Send an interview invitation email via Resend."""
    subject = "You're invited to an LSSU AI Session"

    message_block = ""
    if custom_message:
        message_block = f"<p style='font-size:15px;color:#555;line-height:1.6;margin:0 0 24px 0;'>{custom_message}</p>"

    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;">
        <div style="background:#000;border-radius:12px;padding:32px;text-align:center;">
            <h1 style="color:#fff;font-size:22px;margin:0 0 8px 0;">LSSU AI Session Agent</h1>
            <p style="color:#999;font-size:13px;margin:0;">Lake Superior State University</p>
        </div>
        <div style="padding:32px 0;">
            <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 16px 0;">
                Hi{' ' + invite_name if invite_name else ''},
            </p>
            <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 16px 0;">
                You've been invited to a brief voice session with our AI agent. The session takes about
                5-10 minutes and helps us understand your work and how AI can support your team.
            </p>
            {message_block}
            <div style="text-align:center;margin:32px 0;">
                <a href="{invite_url}"
                   style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;">
                    Start Your Session
                </a>
            </div>
            <p style="font-size:13px;color:#999;line-height:1.5;margin:0;">
                This link is unique to you. Simply click the button, allow microphone access, and the AI agent will guide you through the session.
            </p>
        </div>
        <div style="border-top:1px solid #eee;padding-top:16px;text-align:center;">
            <p style="font-size:12px;color:#bbb;margin:0;">LSSU AI Requirements Gathering Platform</p>
        </div>
    </div>
    """

    try:
        result = resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
        logger.info(f"Invitation email sent to {to_email}: {result}")
        return {"success": True, "id": result.get("id", "")}
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return {"success": False, "error": str(e)}
