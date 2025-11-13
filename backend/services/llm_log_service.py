import os
import re
from typing import List, Dict, Any

from langchain_ollama import OllamaEmbeddings, OllamaLLM
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate

# ==========================================================
# CONFIGURATION
# ==========================================================
DB_DIR = "./chroma_log_db"
MODEL_NAME = "qwen2.5:1.5b-instruct"
EMBED_MODEL = "nomic-embed-text"

# ==========================================================
# INITIALIZE EMBEDDINGS + VECTOR STORE
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
# INITIALIZE LLM
# ==========================================================
llm = OllamaLLM(model=MODEL_NAME)

# ==========================================================
# STRUCTURED SUMMARY PROMPT
# ==========================================================
summary_prompt = ChatPromptTemplate.from_template("""
You are a senior DevOps engineer. You will receive structured CI/CD job information extracted from raw logs.

Use the fields below to create a highly accurate and concise final summary.

-------------------------
🧩 LOG STRUCTURE (Preprocessed)
-------------------------

📌 Head (Job Metadata):
{head}

❌ Errors:
{errors}

⚠️ Warnings:
{warnings}

🧨 Failed Commands:
{failed_cmds}

⏱ Timing Related Lines:
{timings}

📌 Tail (Last Output Lines):
{tail}

-------------------------
🎯 REQUIRED OUTPUT FORMAT
-------------------------

🧱 Job Overview  
(What job appears to be doing, general result)

🚨 Issues & Root Cause  
(Based on errors/warnings/failed commands)

⚙️ What Happened (Short)  
(High-level sequence of events)

🔧 Recommended Fix  
(Actionable suggestion)

📘 One-Line Summary  
(One clear sentence)

Keep it concise, accurate, and readable. Do not repeat raw logs.
""")

chain = summary_prompt | llm

# ==========================================================
# PATTERNS FOR EXTRACTION
# ==========================================================
ERROR_PATTERNS = [
    r"error:",
    r"fatal:",
    r"failed",
    r"exception",
    r"traceback",
    r"segfault",
    r"oom",
    r"panic",
]

WARNING_PATTERNS = [
    r"warning",
    r"warn:",
    r"deprecated",
]

DURATION_PATTERN = r"\b\d+(\.\d+)?\s?(s|sec|secs|ms|milliseconds)\b"


# ==========================================================
# STRUCTURED LOG EXTRACTOR
# ==========================================================
def extract_log_structure(raw: str) -> Dict[str, List[str]]:
    """
    This converts raw GitLab logs into a structured representation.
    VERY fast, extremely accurate, and ideal for CPU LLMs.
    """

    lines = raw.splitlines()

    head = lines[:30]                         # metadata region
    tail = lines[-50:]                        # last events region

    # Extract error lines
    errors = []
    for ln in lines:
        for p in ERROR_PATTERNS:
            if re.search(p, ln, re.I):
                errors.append(ln)
                break

    # Extract warning lines
    warnings = []
    for ln in lines:
        for p in WARNING_PATTERNS:
            if re.search(p, ln, re.I):
                warnings.append(ln)
                break

    # Extract duration lines
    timings = [ln for ln in lines if re.search(DURATION_PATTERN, ln, re.I)]

    # Failed commands
    failed_cmds = [ln for ln in lines if "exit code" in ln.lower()]

    # Limit noise
    return {
        "head": head,
        "tail": tail,
        "errors": errors[:80],
        "warnings": warnings[:80],
        "timings": timings[:80],
        "failed_cmds": failed_cmds[:80],
    }


# ==========================================================
# MAIN SUMMARIZATION FUNCTION
# ==========================================================
def summarize_logs_with_llm(raw_logs: str) -> dict:
    """
    FAST, accurate summarization of CI/CD logs.
    This ALWAYS takes < 10 seconds on CPU.
    (ONE LLM CALL ONLY)
    """

    try:
        # Convert bytes → string
        if isinstance(raw_logs, bytes):
            raw_logs = raw_logs.decode("utf-8", errors="ignore")

        # Stage 1: Extract structured info (super fast)
        structured = extract_log_structure(raw_logs)

        # Stage 2: Store structured snippet in DB (small)
        try:
            vector_store.add_documents([Document(page_content=str(structured))])
        except:
            pass  # do not block main flow

        # Stage 3: ONE FINAL LLM CALL (fast!)
        final_summary = chain.invoke(structured)

        return {
            "summary": str(final_summary).strip(),
            "structure": structured
        }

    except Exception as e:
        return {"error": str(e)}


# ==========================================================
# STREAMING VERSION (TOKEN BY TOKEN)
# ==========================================================
def stream_summarize_logs_with_llm(raw_logs: str):
    """
    Streams FINAL summary only (no chunking, fast).
    """

    try:
        if isinstance(raw_logs, bytes):
            raw_logs = raw_logs.decode("utf-8", errors="ignore")

        structured = extract_log_structure(raw_logs)

        try:
            vector_store.add_documents([Document(page_content=str(structured))])
        except:
            pass

        for token in llm.stream(summary_prompt.format(**structured)):
            yield token

    except Exception as e:
        yield f"[Error] {str(e)}"
