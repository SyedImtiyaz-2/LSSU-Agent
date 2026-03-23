import os
import sys
import json
import asyncio
import logging
from enum import Enum
from dotenv import load_dotenv

# Load env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))

from livekit import agents, rtc
from livekit.agents import AgentSession, Agent, llm
from livekit.plugins import openai, silero

# Add parent paths for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from app.agent.prompts import (
    SYSTEM_PROMPT,
    PREDEFINED_QUESTIONS,
    CLOSING_MESSAGE,
    SUMMARY_PROMPT,
)
from app.services.rag_service import generate_followup_questions
from app.services.report_service import generate_pdf_report
from app.services.supabase_service import update_interview, get_interview

logger = logging.getLogger("interview-agent")

FALLBACK_FOLLOWUPS = [
    "Could you describe a specific scenario where having an AI assistant would save you the most time?",
    "If you could automate one repetitive task in your day, what would it be?",
    "Is there anything else you'd like to share about how technology could better support your work?",
]


class InterviewState(Enum):
    GREETING = "greeting"
    Q1_NAME = "q1_name"
    Q2_DEPARTMENT = "q2_department"
    Q3_DAILY_LIFE = "q3_daily_life"
    Q4_TOOLS = "q4_tools"
    Q5_CHALLENGES = "q5_challenges"
    FOLLOWUP_Q1 = "followup_q1"
    FOLLOWUP_Q2 = "followup_q2"
    FOLLOWUP_Q3 = "followup_q3"
    CLOSING = "closing"
    DONE = "done"


STATE_ORDER = list(InterviewState)


class InterviewManager:
    """Manages interview state and captures answers."""

    def __init__(self, room_name: str):
        self.room_name = room_name
        self.state = InterviewState.GREETING
        self.answers = {}
        self.transcript = []
        self.followup_questions = []
        self.name = ""
        self.department = ""
        self._followups_ready = asyncio.Event()
        self._followups_generating = False

    def get_current_question(self) -> str | None:
        if self.state == InterviewState.Q1_NAME:
            return PREDEFINED_QUESTIONS[0]
        elif self.state == InterviewState.Q2_DEPARTMENT:
            return PREDEFINED_QUESTIONS[1].format(name=self.name)
        elif self.state == InterviewState.Q3_DAILY_LIFE:
            return PREDEFINED_QUESTIONS[2]
        elif self.state == InterviewState.Q4_TOOLS:
            return PREDEFINED_QUESTIONS[3]
        elif self.state == InterviewState.Q5_CHALLENGES:
            return PREDEFINED_QUESTIONS[4]
        elif self.state == InterviewState.FOLLOWUP_Q1 and len(self.followup_questions) > 0:
            return self.followup_questions[0]
        elif self.state == InterviewState.FOLLOWUP_Q2 and len(self.followup_questions) > 1:
            return self.followup_questions[1]
        elif self.state == InterviewState.FOLLOWUP_Q3 and len(self.followup_questions) > 2:
            return self.followup_questions[2]
        return None

    def record_answer(self, answer: str):
        question = self.get_current_question()
        if self.state == InterviewState.Q1_NAME:
            self.name = answer.strip().strip(".")
            self.answers["name"] = self.name
        elif self.state == InterviewState.Q2_DEPARTMENT:
            self.department = answer.strip().strip(".")
            self.answers["department"] = self.department
        elif self.state == InterviewState.Q3_DAILY_LIFE:
            self.answers["daily_life"] = answer
        elif self.state == InterviewState.Q4_TOOLS:
            self.answers["tools"] = answer
        elif self.state == InterviewState.Q5_CHALLENGES:
            self.answers["challenges"] = answer
        elif self.state == InterviewState.FOLLOWUP_Q1:
            self.answers["followup_1"] = answer
        elif self.state == InterviewState.FOLLOWUP_Q2:
            self.answers["followup_2"] = answer
        elif self.state == InterviewState.FOLLOWUP_Q3:
            self.answers["followup_3"] = answer

        if question:
            self.transcript.append({"question": question, "answer": answer})

    def advance(self):
        idx = STATE_ORDER.index(self.state)
        if idx + 1 < len(STATE_ORDER):
            self.state = STATE_ORDER[idx + 1]

    def start_followup_generation(self):
        """Start generating follow-ups in background (non-blocking)."""
        if self._followups_generating:
            return
        self._followups_generating = True
        asyncio.create_task(self._generate_followups_async())

    async def _generate_followups_async(self):
        """Generate follow-up questions in a thread to avoid blocking the agent."""
        try:
            logger.info(f"Generating follow-ups in background for: {self.answers.get('name', 'Unknown')}")
            loop = asyncio.get_event_loop()
            questions = await loop.run_in_executor(
                None, generate_followup_questions, self.answers
            )
            self.followup_questions = questions
            logger.info(f"Generated {len(self.followup_questions)} follow-up questions")
            while len(self.followup_questions) < 3:
                self.followup_questions.append(FALLBACK_FOLLOWUPS[len(self.followup_questions)])
        except Exception as e:
            logger.error(f"Error generating followup questions: {e}", exc_info=True)
            self.followup_questions = list(FALLBACK_FOLLOWUPS)
        finally:
            self._followups_ready.set()

    async def wait_for_followups(self, timeout: float = 30.0):
        """Wait for follow-ups to be ready, with timeout fallback."""
        if self.followup_questions:
            return
        try:
            await asyncio.wait_for(self._followups_ready.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning("Follow-up generation timed out, using fallbacks")
            self.followup_questions = list(FALLBACK_FOLLOWUPS)
            self._followups_ready.set()


# Global interview managers keyed by room name
_managers: dict[str, InterviewManager] = {}


def get_manager(room_name: str) -> InterviewManager:
    if room_name not in _managers:
        _managers[room_name] = InterviewManager(room_name)
    return _managers[room_name]


class InterviewAgent(Agent):
    def __init__(self, room_name: str):
        self.manager = get_manager(room_name)

        instructions = (
            f"{SYSTEM_PROMPT}\n\n"
            f"Greet them and ask: \"{PREDEFINED_QUESTIONS[0]}\"\n"
            f"Keep your response under 2 sentences."
        )
        super().__init__(instructions=instructions)

    async def on_user_turn_completed(
        self, turn_ctx: llm.ChatContext, new_message: llm.ChatMessage
    ):
        """Called when the user finishes speaking."""
        user_text = new_message.text_content or ""
        logger.info(f"User said: {user_text[:100]}")
        mgr = self.manager

        if mgr.state == InterviewState.GREETING:
            mgr.state = InterviewState.Q1_NAME
            mgr.record_answer(user_text)
            mgr.advance()  # Move to Q2
        elif mgr.state in (
            InterviewState.Q2_DEPARTMENT,
            InterviewState.Q3_DAILY_LIFE,
            InterviewState.Q4_TOOLS,
            InterviewState.Q5_CHALLENGES,
            InterviewState.FOLLOWUP_Q1,
            InterviewState.FOLLOWUP_Q2,
            InterviewState.FOLLOWUP_Q3,
        ):
            mgr.record_answer(user_text)

            # Start generating follow-ups in background after Q3 (non-blocking)
            if mgr.state == InterviewState.Q3_DAILY_LIFE:
                mgr.start_followup_generation()
            # Re-trigger with more data after Q5
            elif mgr.state == InterviewState.Q5_CHALLENGES:
                mgr._followups_ready.clear()
                mgr._followups_generating = False
                mgr.start_followup_generation()

            mgr.advance()
        elif mgr.state == InterviewState.CLOSING:
            mgr.state = InterviewState.DONE

        # Update agent instructions based on current state
        if mgr.state == InterviewState.CLOSING:
            await self.update_instructions(
                f"{SYSTEM_PROMPT}\n\n"
                f"Wrap up warmly. Say something like: \"{CLOSING_MESSAGE}\"\n"
                f"You can personalize slightly using their name ({mgr.name}) but keep it to 2 sentences max."
            )
            asyncio.create_task(self._save_results())
        elif mgr.state == InterviewState.FOLLOWUP_Q1:
            # Wait for follow-ups to be ready (should already be done from Q3/Q5)
            await mgr.wait_for_followups(timeout=15.0)
            next_q = mgr.get_current_question()
            if next_q:
                await self.update_instructions(
                    f"{SYSTEM_PROMPT}\n\n"
                    f"Transition naturally by saying something like 'I have a few more specific questions based on what you've shared' "
                    f"then ask: \"{next_q}\"\n"
                    f"Keep the transition to 1 sentence max before the question."
                )
        else:
            next_q = mgr.get_current_question()
            if next_q:
                await self.update_instructions(
                    f"{SYSTEM_PROMPT}\n\n"
                    f"Use a varied, natural acknowledgment (see examples above), then ask: \"{next_q}\"\n"
                    f"Do not repeat an acknowledgment you've already used in this conversation."
                )

    async def _save_results(self):
        """Save interview results to Supabase and generate PDF."""
        mgr = self.manager
        try:
            from openai import OpenAI
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

            transcript_text = "\n".join(
                f"Q: {qa['question']}\nA: {qa['answer']}" for qa in mgr.transcript
            )
            summary_response = client.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                messages=[
                    {"role": "user", "content": SUMMARY_PROMPT.format(transcript=transcript_text)}
                ],
            )
            summary = summary_response.choices[0].message.content

            from app.services.supabase_service import get_client
            sb = get_client()
            result = sb.table("interviews").select("*").eq("room_name", mgr.room_name).execute()
            if not result.data:
                logger.error(f"Interview not found for room {mgr.room_name}")
                return

            interview = result.data[0]
            interview_id = interview["id"]

            update_interview(interview_id, {
                "status": "completed",
                "name": mgr.name,
                "department": mgr.department,
                "transcript": mgr.transcript,
                "summary": summary,
            })

            report_data = {
                "id": interview_id,
                "name": mgr.name,
                "department": mgr.department,
                "transcript": mgr.transcript,
                "summary": summary,
            }
            filepath, report_text = generate_pdf_report(report_data)
            filename = os.path.basename(filepath)
            update_interview(interview_id, {"report_file": filename, "report_text": report_text})

            logger.info(f"Interview {interview_id} saved with report {filename}")

        except Exception as e:
            logger.error(f"Error saving interview results: {e}")
        finally:
            if mgr.room_name in _managers:
                del _managers[mgr.room_name]


async def entrypoint(ctx: agents.JobContext):
    await ctx.connect()
    room_name = ctx.room.name
    logger.info(f"Agent joining room: {room_name}")

    agent = InterviewAgent(room_name=room_name)

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=openai.STT(model="whisper-1", language="en"),
        llm=openai.LLM(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            temperature=0.6,
        ),
        tts=openai.TTS(
            model="tts-1",
            voice="alloy",
        ),
    )

    await session.start(
        room=ctx.room,
        agent=agent,
    )

    await session.generate_reply(
        instructions=(
            "Introduce yourself briefly as the LSSU AI Session Agent. "
            "Say you'll ask a few questions about their work. "
            f'Then ask: "{PREDEFINED_QUESTIONS[0]}" '
            "Keep it under 3 sentences total."
        )
    )


if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            api_key=os.getenv("LIVEKIT_API_KEY"),
            api_secret=os.getenv("LIVEKIT_API_SECRET"),
            ws_url=os.getenv("LIVEKIT_URL"),
            job_executor_type=agents.JobExecutorType.THREAD,
            job_memory_warn_mb=0,
        )
    )
