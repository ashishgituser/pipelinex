import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List

from langchain_ollama import OllamaEmbeddings, OllamaLLM
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document

# -----------------------------
# CONFIG - tune these
# -----------------------------
DB_DIR = "./chroma_log_db"
LLM_MODEL = "qwen2.5:1.5b-instruct"
EMBED_MODEL = "nomic-embed-text"

# chunk and concurrency params
CHUNK_SIZE = 1000            # characters per chunk (small -> faster)
MAX_WORKERS = min(6, (os.cpu_count() or 4) - 1)  # conservative parallelism
CALL_TIMEOUT = 12            # seconds per LLM call (avoid long waits)
BATCH_SIZE = 4               # how many chunks to merge into one LLM call if many chunks

# -----------------------------
# Initialize models & DB
# -----------------------------
embeddings = OllamaEmbeddings(model=EMBED_MODEL)

if not os.path.exists(DB_DIR):
    os.makedirs(DB_DIR)

vector_store = Chroma(
    collection_name="gitlab_logs",
    persist_directory=DB_DIR,
    embedding_function=embeddings
)

llm = OllamaLLM(model=LLM_MODEL)

# -----------------------------
# Prompts (very concise)
# -----------------------------
# Short prompt used for chunk-level quick summaries: ask for 1-2 sentences.
CHUNK_PROMPT = ChatPromptTemplate.from_template(
    "You are a concise DevOps assistant. Summarize the following log snippet in 1-2 short sentences, "
    "focusing only on errors, warnings, status, and timing issues. Do NOT include raw logs.\n\n{logs}\n\n"
    "Output (1-2 sentences):"
)

# Final prompt: make it a single clear paragraph with bullets (still concise).
FINAL_PROMPT = ChatPromptTemplate.from_template(
    "You are a senior DevOps AI assistant. Based on the combined short summaries below, produce ONE final, "
    "concise structured summary with: Job Overview (1 line), Main Issues (bulleted), One-line recommendation. "
    "Keep it short (3-6 lines).\n\n{logs}\n\nFinal summary:"
)

# Compose chain-like behavior using prompts and LLM
chunk_chain = CHUNK_PROMPT | llm
final_chain = FINAL_PROMPT | llm

# -----------------------------
# Utilities
# -----------------------------
def extract_relevant_lines(raw: str, keep_head_lines: int = 30, keyword_max: int = 200) -> str:
    """
    Reduce log size by:
    - always keeping the first `keep_head_lines` (to preserve job start info)
    - keeping lines that match important keywords (ERROR, WARN, FAIL, Exception, timeout, retry, slow)
    - limit the number of keyword lines to `keyword_max`
    """
    lines = raw.splitlines()
    head = lines[:keep_head_lines]

    # keyword selection (case-insensitive)
    keywords = re.compile(r"\b(error|err:|fail|exception|traceback|warn|warning|timeout|retry|segfault|killed|OOM)\b", re.I)
    relevant = [ln for ln in lines if keywords.search(ln)]

    # also include lines with durations (e.g., "took 12.34s" or "seconds")
    dur = re.compile(r"\b\d+(\.\d+)?s\b", re.I)
    relevant += [ln for ln in lines if dur.search(ln) and ln not in relevant]

    # dedupe while preserving order
    seen = set()
    filtered = []
    for ln in head + relevant:
        if ln not in seen:
            seen.add(ln)
            filtered.append(ln)
        if len(filtered) >= (keep_head_lines + keyword_max):
            break

    return "\n".join(filtered)


def chunk_text(text: str, max_size: int = CHUNK_SIZE) -> List[str]:
    # split safely on newlines when possible to keep chunks semantically nice
    if len(text) <= max_size:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = min(len(text), start + max_size)
        # try to break at last newline before end for nicer chunks
        if end < len(text):
            nl = text.rfind("\n", start, end)
            if nl > start + max_size // 3:  # break at a newline only if it's not too small
                end = nl + 1
        chunks.append(text[start:end])
        start = end
    return chunks


def summarize_chunk(chunk: str) -> str:
    """Call the chunk-level chain (wrapped to catch exceptions)."""
    try:
        # use invoke for sync call; put short content
        out = chunk_chain.invoke({"logs": chunk})
        # strip and ensure concise
        return out.strip().replace("\n", " ")
    except Exception as e:
        return f"[chunk-error: {str(e)}]"


# -----------------------------
# Highly-optimized summarization pipeline
# -----------------------------
def smart_fast_summarize(raw_logs: str, store_embeddings: bool = False) -> dict:
    """
    Fast summarizer that:
     - filters logs to relevant lines
     - chunks
     - summarizes chunks in parallel with timeouts
     - does a single final concise summary
    """
    t0 = time.time()

    # 1) Pre-filter logs drastically to reduce tokens
    filtered = extract_relevant_lines(raw_logs, keep_head_lines=20, keyword_max=300)

    # If filtering yields too little, fallback to small tail of logs
    if len(filtered.strip()) < 100:
        # take the head + last 2000 chars
        filtered = "\n".join(raw_logs.splitlines()[:20]) + "\n\n" + raw_logs[-2000:]

    # 2) Optional: store embeddings for the filtered snippet only (cheap)
    if store_embeddings:
        try:
            vector_store.add_documents([Document(page_content=filtered[:20000])])
        except Exception:
            pass  # do not block summarization on embedding errors

    # 3) Create chunks
    chunks = chunk_text(filtered, max_size=CHUNK_SIZE)

    # If too many chunks, group them into batches to avoid too many LLM calls.
    # Each batch will be the concatenation of up to BATCH_SIZE chunks.
    batched_chunks = []
    for i in range(0, len(chunks), BATCH_SIZE):
        batch = "\n\n".join(chunks[i : i + BATCH_SIZE])
        batched_chunks.append(batch)

    # 4) Summarize batches in parallel
    partial_summaries = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {ex.submit(summarize_chunk, b): idx for idx, b in enumerate(batched_chunks)}
        for fut in as_completed(futures, timeout=CALL_TIMEOUT * max(1, len(futures))):
            try:
                res = fut.result(timeout=CALL_TIMEOUT)
            except Exception as e:
                res = f"[batch-error: {str(e)}]"
            partial_summaries.append(res)

    if not partial_summaries:
        # fallback: single synchronous summarization on full filtered text
        try:
            final = final_chain.invoke({"logs": filtered})
            return {"summary": final, "took_s": time.time() - t0}
        except Exception as e:
            return {"error": f"all-failed: {str(e)}", "took_s": time.time() - t0}

    # keep order stable: sort by original batch index if needed
    # (partial_summaries may be unordered if as_completed was used; we can re-run ordered)
    # For simplicity, re-generate ordered results synchronously if len(batched_chunks) <= len(partial_summaries)
    # But to be deterministic, we create ordered list by re-calling sequentially only when small number.
    if len(batched_chunks) <= MAX_WORKERS:
        ordered_partials = []
        for b in batched_chunks:
            ordered_partials.append(summarize_chunk(b))
    else:
        ordered_partials = partial_summaries  # good-enough fallback

    # 5) Combine partials and do 1 final concise summary
    combined = "\n\n".join(ordered_partials)
    # final final summary - short and structured
    try:
        final = final_chain.invoke({"logs": combined})
    except Exception as e:
        final = f"[final-error: {str(e)}]"

    took = time.time() - t0
    return {"summary": final, "took_s": round(took, 2), "chunks": len(chunks), "batches": len(batched_chunks)}
