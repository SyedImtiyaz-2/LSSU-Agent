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
    FOLLOWUP_INTRO,
    CLOSING_MESSAGE,
    SUMMARY_PROMPT,
)
from app.services.rag_service import generate_followup_questions
from app.services.report_service import generate_pdf_report
from app.services.supabase_service import update_interview, get_interview

logger = logging.getLogger("interview-agent")


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

    def generate_followups(self):
        try:
            logger.info(f"Generating follow-up questions with RAG for: {self.answers.get('name', 'Unknown')}")
            logger.info(f"  Department: {self.answers.get('department', 'Unknown')}")
            logger.info(f"  Challenges: {self.answers.get('challenges', '')[:100]}")
            self.followup_questions = generate_followup_questions(self.answers)
            logger.info(f"Generated {len(self.followup_questions)} follow-up questions successfully")
            while len(self.followup_questions) < 3:
                self.followup_questions.append(
                    "Is there anything else you'd like to share about how AI could help in your role?"
                )
        except Exception as e:
            logger.error(f"Error generating followup questions: {e}", exc_info=True)
            self.followup_questions = [
                "Could you describe a specific scenario where having an AI assistant would save you the most time?",
                "If you could automate one repetitive task in your day, what would it be?",
                "Is there anything else you'd like to share about how technology could better support your work?",
            ]


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
            f"CURRENT STATE: You are about to start the interview.\n"
            f"Your first action: Greet the participant warmly and ask the first question:\n"
            f'"{PREDEFINED_QUESTIONS[0]}"\n\n'
            f"After each answer, acknowledge it briefly, then ask the next question in sequence.\n"
            f"IMPORTANT: Only ask ONE question at a time. Wait for the response."
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

            if mgr.state == InterviewState.Q5_CHALLENGES:
                mgr.generate_followups()

            mgr.advance()
        elif mgr.state == InterviewState.CLOSING:
            mgr.state = InterviewState.DONE

        # Update agent instructions based on current state
        next_q = mgr.get_current_question()
        if mgr.state == InterviewState.CLOSING:
            await self.update_instructions(
                f"{SYSTEM_PROMPT}\n\n"
                f"The interview is now complete. Say the closing message:\n"
                f'"{CLOSING_MESSAGE}"\n'
                f"Thank them and end the conversation."
            )
            asyncio.create_task(self._save_results())
        elif mgr.state == InterviewState.FOLLOWUP_Q1 and next_q:
            await self.update_instructions(
                f"{SYSTEM_PROMPT}\n\n"
                f"You just finished the 5 main questions. Now transition to follow-up questions.\n"
                f"Say something like: \"{FOLLOWUP_INTRO}\"\n"
                f"Then ask: \"{next_q}\"\n"
                f"Only ask this ONE question."
            )
        elif next_q:
            await self.update_instructions(
                f"{SYSTEM_PROMPT}\n\n"
                f"Acknowledge the user's previous answer briefly, then ask the next question:\n"
                f'"{next_q}"\n'
                f"Only ask this ONE question. Do not skip ahead."
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
            filepath = generate_pdf_report(report_data)
            filename = os.path.basename(filepath)
            update_interview(interview_id, {"report_file": filename})

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
        stt=openai.STT(),
        llm=openai.LLM(model=os.getenv("OPENAI_MODEL", "gpt-4o-mini")),
        tts=openai.TTS(voice="alloy"),
    )

    RoomOptions = agents.room_io.RoomOptions
    await session.start(
        room=ctx.room,
        agent=agent,
        room_options=RoomOptions(audio_input=True, text_input=True, audio_output=True),
    )

    await session.generate_reply(
        instructions=(
            "Greet the participant warmly. Introduce yourself as the LSSU AI Interview Agent. "
            "Explain that you'll be asking a few questions to understand their work and how AI can help. "
            f'Then ask the first question: "{PREDEFINED_QUESTIONS[0]}"'
        )
    )


if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            api_key=os.getenv("LIVEKIT_API_KEY"),
            api_secret=os.getenv("LIVEKIT_API_SECRET"),
            ws_url=os.getenv("LIVEKIT_URL"),
            num_idle_processes=1,
            job_memory_warn_mb=0,
        )
    )
