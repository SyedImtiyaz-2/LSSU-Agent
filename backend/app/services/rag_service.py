import os
import logging
from ..config import OPENAI_API_KEY, OPENAI_MODEL, UPLOAD_DIR

logger = logging.getLogger("rag-service")

# Set lazily to avoid crashing on import if env vars not yet available
_settings_initialized = False


def _init_settings():
    global _settings_initialized
    if _settings_initialized:
        return
    from llama_index.core import Settings
    from llama_index.llms.openai import OpenAI
    from llama_index.embeddings.openai import OpenAIEmbedding
    if OPENAI_API_KEY:
        os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY
        Settings.llm = OpenAI(model=OPENAI_MODEL, api_key=OPENAI_API_KEY)
        Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small", api_key=OPENAI_API_KEY)
    _settings_initialized = True

from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, Document

_index: VectorStoreIndex | None = None


def _fetch_documents_from_supabase() -> list[Document]:
    """Fetch document content from Supabase when local files aren't available.
    This is the primary path for the worker container which has no local uploads."""
    try:
        from .supabase_service import get_client
        sb = get_client()
        result = sb.table("documents").select("id, filename, content").execute()
        if not result.data:
            logger.info("No documents found in Supabase")
            return []

        documents = []
        for row in result.data:
            content = row.get("content", "")
            if not content or not content.strip():
                continue
            doc = Document(
                text=content,
                metadata={
                    "source": row.get("filename", "unknown"),
                    "doc_id": row.get("id", ""),
                },
            )
            documents.append(doc)

        logger.info(f"Fetched {len(documents)} documents from Supabase")
        return documents
    except Exception as e:
        logger.error(f"Failed to fetch documents from Supabase: {e}")
        return []


def build_index() -> VectorStoreIndex | None:
    _init_settings()
    """Build or rebuild the vector index from local files or Supabase content."""
    global _index

    # Try local files first (works on web service container)
    files = [
        os.path.join(UPLOAD_DIR, f)
        for f in os.listdir(UPLOAD_DIR)
        if f.endswith((".pdf", ".txt", ".docx", ".md", ".html", ".htm")) and not f.startswith(".")
    ]

    if files:
        logger.info(f"Building RAG index from {len(files)} local files")
        reader = SimpleDirectoryReader(input_files=files)
        documents = reader.load_data()
    else:
        # Fallback: fetch from Supabase (worker container path)
        logger.info("No local files found, fetching from Supabase")
        documents = _fetch_documents_from_supabase()

    if not documents:
        logger.info("No documents available from any source, index is empty")
        _index = None
        return None

    logger.info(f"Building RAG index from {len(documents)} document chunks")
    _index = VectorStoreIndex.from_documents(documents)
    logger.info("RAG index built successfully")
    return _index


def get_index() -> VectorStoreIndex | None:
    """Get the current index, building it if needed."""
    global _index
    if _index is None:
        build_index()
    return _index


def query_context(question: str, top_k: int = 3) -> str:
    """Query the RAG index for relevant context."""
    index = get_index()
    if index is None:
        return ""
    query_engine = index.as_query_engine(similarity_top_k=top_k)
    response = query_engine.query(question)
    return str(response)


def generate_followup_questions(interview_answers: dict, prior_sessions: list[dict] | None = None) -> list[str]:
    """Generate 3 follow-up questions using RAG context + interview answers."""

    # Always rebuild index fresh so we pick up any new documents
    # (important: agent runs as separate process from API server)
    build_index()
    index = _index

    summary = (
        f"Name: {interview_answers.get('name', 'Unknown')}\n"
        f"Department: {interview_answers.get('department', 'Unknown')}\n"
        f"Daily tasks: {interview_answers.get('daily_life', '')}\n"
        f"Tools used: {interview_answers.get('tools', '')}\n"
        f"Challenges: {interview_answers.get('challenges', '')}"
    )

    context = ""
    if index:
        try:
            query_engine = index.as_query_engine(similarity_top_k=5)

            # Query 1: department-specific context
            dept = interview_answers.get("department", "")
            dept_query = (
                f"What information do we have about the {dept} department at LSSU? "
                f"What are their goals, workflows, pain points, and technology needs?"
            )
            dept_response = query_engine.query(dept_query)
            dept_context = str(dept_response)

            # Query 2: challenge-specific context
            challenges = interview_answers.get("challenges", "")
            challenge_query = (
                f"What solutions, recommendations, or proposals do we have related to these challenges: {challenges}? "
                f"What AI or technology solutions have been proposed?"
            )
            challenge_response = query_engine.query(challenge_query)
            challenge_context = str(challenge_response)

            # Query 3: tools/workflow context
            tools = interview_answers.get("tools", "")
            tools_query = (
                f"What do we know about improving workflows that involve these tools: {tools}? "
                f"What integration or automation opportunities exist?"
            )
            tools_response = query_engine.query(tools_query)
            tools_context = str(tools_response)

            context = (
                f"Department Context:\n{dept_context}\n\n"
                f"Challenge-Related Context:\n{challenge_context}\n\n"
                f"Tools/Workflow Context:\n{tools_context}"
            )
            logger.info(f"RAG context retrieved ({len(context)} chars)")
        except Exception as e:
            logger.error(f"RAG query failed: {e}")
            context = ""
    else:
        logger.info("No RAG index available, generating follow-ups without context")

    from openai import OpenAI as OAI
    client = OAI(api_key=OPENAI_API_KEY)

    # Build prior session context block if available
    prior_context_block = ""
    if prior_sessions:
        parts = []
        for i, s in enumerate(prior_sessions[:2], 1):
            dept = s.get("department", "")
            summ = s.get("summary", "")
            if summ or dept:
                parts.append(f"Session {i} ({dept}):\n{summ or 'No summary available'}")
        if parts:
            prior_context_block = "\n\nPRIOR INTERVIEW SESSIONS FOR THIS PARTICIPANT:\n" + "\n\n".join(parts)
            logger.info(f"Injecting prior context from {len(prior_sessions)} prior session(s)")

    prompt = f"""You are helping conduct a requirements-gathering interview at LSSU (Lake Superior State University). Based on the interview answers so far AND our existing knowledge base about this department, generate exactly 3 follow-up questions.

Interview Answers So Far:
{summary}{prior_context_block}

Knowledge Base Context (from our proposal documents and research):
{context if context else "No additional context available from knowledge base."}

INSTRUCTIONS:
- Generate 3 follow-up questions that are SPECIFIC to this person's situation
- If knowledge base context is available, USE IT to ask informed questions that reference specific details from the documents (e.g. "I see from our research that your department handles X — can you tell me more about how that works day-to-day?")
- If prior session data is provided, DO NOT re-ask questions already answered in prior sessions; instead build on those answers and go deeper
- If knowledge base mentions specific pain points, solutions, or proposals relevant to this person, ask about those directly
- Questions should help us understand concrete requirements for AI/automation solutions
- Keep questions conversational and natural for a voice interview
- Each question should be 1-2 sentences max

Return ONLY the 3 questions, one per line, no numbering or bullet points."""

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )

    raw = response.choices[0].message.content.strip()
    questions = [q.strip() for q in raw.split("\n") if q.strip()]
    logger.info(f"Generated {len(questions)} follow-up questions")
    for i, q in enumerate(questions[:3]):
        logger.info(f"  Follow-up {i+1}: {q}")

    return questions[:3]
