import os
from datetime import datetime
from fpdf import FPDF
from openai import OpenAI
from app.config import REPORT_DIR, OPENAI_API_KEY, OPENAI_MODEL

LLM_REPORT_PROMPT = """You are a professional business analyst. Based on the following interview transcript from an LSSU (Lake Superior State University) staff member, generate a structured requirements report.

Interview Transcript:
{transcript}

Generate the report with these exact sections:

## Executive Summary
A 2-3 sentence overview of who was interviewed and the key findings.

## Person Profile
- Name, department, and a brief description of their role based on their daily activities.

## Current Workflow
Summarize their daily tasks and responsibilities in a clear, organized way.

## Tools & Technology
List and briefly describe each tool/software they currently use.

## Pain Points & Challenges
List each challenge as a bullet point with a brief explanation.

## AI Solution Opportunities
For each pain point, suggest a specific AgentAI solution that could help. Be concrete and actionable.

## Priority Recommendations
Rank the top 3 most impactful AI solutions from highest to lowest priority, with a brief justification for each.

Write in professional, clear language. Be specific and actionable."""


def _generate_llm_report(interview_data: dict) -> str:
    """Process interview through LLM to generate structured report text."""
    transcript_text = "\n".join(
        f"Q: {qa['question']}\nA: {qa['answer']}"
        for qa in interview_data.get("transcript", [])
    )

    if not transcript_text:
        return "No interview data available."

    client = OpenAI(api_key=OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "user", "content": LLM_REPORT_PROMPT.format(transcript=transcript_text)}
        ],
        temperature=0.4,
    )
    return response.choices[0].message.content


def generate_pdf_report(interview_data: dict) -> str:
    """Generate a clean PDF report: LLM processes data first, then renders to PDF."""
    # Step 1: LLM generates structured report
    report_text = _generate_llm_report(interview_data)

    # Sanitize Unicode characters that Helvetica can't render
    replacements = {
        "\u2022": "-",   # bullet
        "\u2013": "-",   # en dash
        "\u2014": "--",  # em dash
        "\u2018": "'",   # left single quote
        "\u2019": "'",   # right single quote
        "\u201c": '"',   # left double quote
        "\u201d": '"',   # right double quote
        "\u2026": "...", # ellipsis
        "\u00a0": " ",   # non-breaking space
    }
    for char, repl in replacements.items():
        report_text = report_text.replace(char, repl)

    # Step 2: Render to PDF
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # Header bar
    pdf.set_fill_color(0, 0, 0)
    pdf.rect(0, 0, 210, 28, "F")
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(255, 255, 255)
    pdf.set_xy(15, 8)
    pdf.cell(0, 12, "LSSU Requirements Report", new_x="LMARGIN", new_y="NEXT")

    # Metadata line
    pdf.set_y(35)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(120, 120, 120)
    name = interview_data.get("name", "N/A")
    dept = interview_data.get("department", "N/A")
    date_str = datetime.now().strftime("%B %d, %Y")
    pdf.cell(0, 5, f"{name}  |  {dept}  |  {date_str}  |  ID: {interview_data.get('id', 'N/A')[:8]}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # Thin separator
    pdf.set_draw_color(200, 200, 200)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(6)

    # Render the LLM report markdown-style
    pdf.set_text_color(30, 30, 30)
    usable_width = pdf.w - pdf.l_margin - pdf.r_margin

    for line in report_text.split("\n"):
        stripped = line.strip()
        if not stripped:
            pdf.ln(3)
            continue

        # Strip markdown bold markers for clean text
        clean = stripped.replace("**", "")

        if stripped.startswith("## "):
            # Section header
            pdf.ln(4)
            pdf.set_font("Helvetica", "B", 12)
            pdf.set_text_color(0, 0, 0)
            pdf.cell(0, 7, stripped[3:].replace("**", ""), new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(30, 30, 30)
        elif stripped.startswith("# "):
            # Top-level header
            pdf.ln(4)
            pdf.set_font("Helvetica", "B", 14)
            pdf.set_text_color(0, 0, 0)
            pdf.cell(0, 8, stripped[2:].replace("**", ""), new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(30, 30, 30)
        elif stripped.startswith("- ") or stripped.startswith("* "):
            # Bullet point
            pdf.set_font("Helvetica", "", 10)
            indent = 8
            pdf.set_x(pdf.l_margin + indent)
            pdf.cell(5, 6, "-")
            remaining = usable_width - indent - 5
            pdf.multi_cell(remaining, 6, clean[2:])
        elif len(stripped) > 2 and stripped[0].isdigit() and ". " in stripped[:4]:
            # Numbered list (e.g. "1. ", "2. ")
            pdf.set_font("Helvetica", "", 10)
            dot_idx = stripped.index(". ")
            num_label = stripped[: dot_idx + 2]
            text = clean[dot_idx + 2 :]
            indent = 8
            pdf.set_x(pdf.l_margin + indent)
            pdf.cell(10, 6, num_label)
            remaining = usable_width - indent - 10
            pdf.multi_cell(remaining, 6, text)
        elif stripped.startswith("**") and stripped.endswith("**"):
            # Full bold line
            pdf.set_font("Helvetica", "B", 10)
            pdf.multi_cell(usable_width, 6, clean)
            pdf.set_font("Helvetica", "", 10)
        else:
            pdf.set_font("Helvetica", "", 10)
            pdf.multi_cell(usable_width, 6, clean)

    # Footer
    pdf.ln(12)
    pdf.set_draw_color(200, 200, 200)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 5, f"Generated by LSSU AI Interview Agent  |  {date_str}", new_x="LMARGIN", new_y="NEXT", align="C")

    filename = f"report_{interview_data.get('id', 'unknown')[:8]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    filepath = os.path.join(REPORT_DIR, filename)
    pdf.output(filepath)
    return filepath
