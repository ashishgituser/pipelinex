import os
import re
from langchain_ollama import OllamaEmbeddings, OllamaLLM
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate

# ==========================================================
# 🔧 CONFIGURATION
# ==========================================================
DB_DIR = "./chroma_log_db"
MODEL_NAME = "qwen2.5:1.5b-instruct"
EMBED_MODEL = "nomic-embed-text"

# ==========================================================
# 🔧 INITIALIZE EMBEDDINGS + VECTOR STORE
# ==========================================================
embeddings = OllamaEmbeddings(model=EMBED_MODEL)

if not os.path.exists(DB_DIR):
    os.makedirs(DB_DIR)

vector_store = Chroma(
    collection_name="gitlab_logs",
    persist_directory=DB_DIR,
    embedding_function=embeddings
)

# ==========================================================
# 🔧 LLM + PROMPT
# ==========================================================
llm = OllamaLLM(model=MODEL_NAME)

prompt = ChatPromptTemplate.from_template("""
You are a senior DevOps AI assistant. Summarize the following CI/CD logs:

{logs}

Produce a clean and concise summary with:
- Job Overview
- Execution Summary
- Issues & Warnings
- Recommendations
- One-line final result

Keep it short, structured, and helpful.
""")

chain = prompt | llm


# ==========================================================
# 🔥 LOG PRE-FILTERING (KEY FOR SPEED)
# ==========================================================
def _extract_relevant_lines(raw: str) -> str:
    """
    Reduce logs to ONLY useful lines so LLM call stays < 10 seconds.
    """

    lines = raw.splitlines()

    # Always keep first 20 lines (ci metadata)
    head = lines[:20]

    # Collect errors/warnings
    keywords = re.compile(
        r"(error|failed|exception|traceback|warn|warning|timeout|retry|fatal|oom|segfault)",
        re.I
    )
    relevant = [ln for ln in lines if keywords.search(ln)]

    # Collect performance/duration lines
    dur = re.compile(r"\b\d+(\.\d+)?\s?(s|sec|secs|ms|milliseconds)\b", re.I)
    relevant += [ln for ln in lines if dur.search(ln) and ln not in relevant]

    # If nothing relevant, add last 40 lines
    if len(relevant) < 10:
        relevant += lines[-40:]

    # Merge + dedupe + limit max lines
    merged = head + relevant
    merged = list(dict.fromkeys(merged))   # remove duplicates but preserve order
    merged = merged[:350]                  # safe limit

    return "\n".join(merged)


# ==========================================================
# 🚀 MAIN SUMMARIZATION (SUPER-FAST)
# SAME SIGNATURE AS YOUR EXISTING FUNCTION
# ==========================================================
def summarize_logs_with_llm(raw_logs: str) -> dict:
    """
    Summarize logs in under 10 seconds.
    Uses ONE LLM CALL ONLY.
    """

    try:
        # FIX 1: Convert bytes → string
        if isinstance(raw_logs, bytes):
            raw_logs = raw_logs.decode("utf-8", errors="ignore")

        # FIX 2: Pre-filter logs (most important optimization)
        filtered = _extract_relevant_lines(raw_logs)

        # FIX 3: Store only small part in vector DB
        try:
            vector_store.add_documents([Document(page_content=filtered[:8000])])
        except:
            pass  # do not block

        # ⚡ FASTEST: ONE LLM CALL ONLY
        final_summary = chain.invoke({"logs": filtered})

        return {
            "summary": str(final_summary).strip(),
            "filtered_length": len(filtered),
        }

    except Exception as e:
        return {"error": str(e)}


# ==========================================================
# 🚀 STREAMING VERSION (ONLY FINAL SUMMARY)
# SAME SIGNATURE AS YOUR ORIGINAL
# ==========================================================
def stream_summarize_logs_with_llm(raw_logs: str):
    """
    Stream the final summary token-by-token.
    Internally still uses ONE LLM CALL ONLY.
    """

    try:
        # FIX: Convert bytes → string
        if isinstance(raw_logs, bytes):
            raw_logs = raw_logs.decode("utf-8", errors="ignore")

        filtered = _extract_relevant_lines(raw_logs)

        try:
            vector_store.add_documents([Document(page_content=filtered[:8000])])
        except:
            pass

        # Stream one final summary only
        for token in llm.stream(prompt.format(logs=filtered)):
            yield token

    except Exception as e:
        yield f"[Error] {str(e)}"
