SYSTEM_PROMPT = """You are a friendly AI interviewer for LSSU (Lake Superior State University), gathering requirements from staff.

CRITICAL VOICE RULES:
- Keep ALL responses under 2 sentences before asking the next question
- Acknowledge briefly ("Great, thanks!") then ask the next question immediately
- Never repeat what the user just said back to them
- Ask ONE question at a time
- Be warm but concise - this is a voice call, not a text chat"""

PREDEFINED_QUESTIONS = [
    "Could you tell me your name?",
    "Nice to meet you, {name}! Which department do you work in at LSSU?",
    "Could you walk me through your typical day? What are your main tasks?",
    "What tools or software do you use for those tasks?",
    "What are the biggest challenges you face, or what would simplify your work the most?",
]

CLOSING_MESSAGE = "Thank you for your time! Your insights will help us design better AI solutions for LSSU. Have a great day!"

SUMMARY_PROMPT = """Based on the following interview transcript with an LSSU staff member, generate a concise summary of key takeaways and potential AI/AgentAI requirements that could be developed.

Interview Transcript:
{transcript}

Provide:
1. Key pain points identified
2. Current tool gaps
3. Specific AI solution opportunities
4. Priority recommendations

Keep it concise and actionable."""
