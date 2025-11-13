import re
from langchain_ollama import OllamaLLM
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate

# Your existing configuration ------------------------------

vector_store = Chroma(
    collection_name="gitlab_logs",
    persist_directory="./chroma_log_db",
    embedding_function=None
)

llm = OllamaLLM(model="qwen2.5:1.5b-instruct")

prompt = ChatPromptTemplate.from_template("""
You are a senior DevOps engineer. Based on the extracted log events below,
produce a clean and accurate summary:

EXTRACTED EVENTS:
{events}

Provide:
- Job Overview
- Errors & Warnings Summary
- What Happened (short)
- Root Cause
- Recommended Fix
- One-line Summary
""")

chain = prompt | llm


# ----------------------------------------------------------
# 🔥 FAST “KEY EVENT EXTRACTOR” (Critical to speed)
# ----------------------------------------------------------

def extract_key_events(raw: str) -> str:
    # Always convert bytes → str
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="ignore")

    lines = raw.splitlines()

    key = []

    # 1. First ~20 lines (metadata)
    key.extend(lines[:20])

    # 2. All error lines
    for ln in lines:
        if re.search(r"(error|failed|exception|fatal|traceback|oom|panic)", ln, re.I):
            key.append(ln)

    # 3. All warnings
    for ln in lines:
        if re.search(r"(warning|warn:)", ln, re.I):
            key.append(ln)

    # 4. Timing and slow steps
    for ln in lines:
        if re.search(r"\b\d+(\.\d+)?(s|ms|sec)\b", ln, re.I):
            key.append(ln)

    # 5. Last ~30 lines (end of job)
    key.extend(lines[-30:])

    # Keep only first 120 important lines max
    key = key[:120]

    extracted = "\n".join(key)

    # LIMIT input to 2000 chars MAX → critical for speed
    return extracted[:2000]


# ----------------------------------------------------------
# 🚀 MAIN FUNCTION — FASTEST POSSIBLE
# ----------------------------------------------------------

def summarize_logs_with_llm(raw_logs: str) -> dict:
    try:
        events = extract_key_events(raw_logs)

        # Save small piece in vector db
        try:
            vector_store.add_documents([Document(page_content=events)])
        except:
            pass

        final = chain.invoke({"events": events})

        return {"summary": final}

    except Exception as e:
        return {"error": str(e)}


# ----------------------------------------------------------
# 🚀 STREAM VERSION — ONLY FINAL SUMMARY
# ----------------------------------------------------------

def stream_summarize_logs_with_llm(raw_logs: str):
    try:
        events = extract_key_events(raw_logs)

        for t in llm.stream(prompt.format(events=events)):
            yield t

    except Exception as e:
        yield f"[Error] {str(e)}"
