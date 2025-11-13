import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List

# --- keep your existing imports for langchain_ollama, Chroma, Document, prompt, chain, llm etc.
# from langchain_ollama import OllamaEmbeddings, OllamaLLM
# from langchain_chroma import Chroma
# from langchain_core.prompts import ChatPromptTemplate
# from langchain_core.documents import Document
# (assumes `vector_store`, `prompt`, `chain`, and `llm` are already created exactly as in your code)

# Tunable parameters (conservative defaults for your 8-core, 32GB CPU-only machine)
_CHUNK_SIZE = 1000         # characters per chunk (small -> faster)
_BATCH_SIZE = 3            # how many chunks to merge into one LLM call
_MAX_WORKERS = max(1, min(6, (os.cpu_count() or 4) - 1))  # parallelism for summarization
_CALL_TIMEOUT = 10         # seconds timeout per LLM call (protects pipeline)


# ---------------------------
# Helper utilities (internal)
# ---------------------------
def _extract_relevant_lines(raw: str, keep_head_lines: int = 20, keyword_max: int = 300) -> str:
    """
    Aggressively reduce log size by:
      - keeping the top head lines (job start metadata)
      - including lines with keywords (error/warn/exception/timeout/retry)
      - including lines with durations (e.g., '12.34s')
    """
    lines = raw.splitlines()
    head = lines[:keep_head_lines]

    # keywords likely to indicate problems
    keywords = re.compile(
        r"\b(error|err:|fail|exception|traceback|warn|warning|timeout|retry|segfault|killed|OOM|fatal)\b",
        re.I,
    )
    relevant = [ln for ln in lines if keywords.search(ln)]

    # durations like "12s" or "12.33s" or "123 ms"
    dur = re.compile(r"\b\d+(\.\d+)?\s?(s|ms|milliseconds|sec|secs)\b", re.I)
    relevant += [ln for ln in lines if dur.search(ln) and ln not in relevant]

    # Deduplicate and keep order, limit total kept lines
    seen = set()
    filtered = []
    for ln in (head + relevant):
        if ln not in seen:
            seen.add(ln)
            filtered.append(ln)
        if len(filtered) >= (keep_head_lines + keyword_max):
            break

    # If nothing relevant found, fallback to head + last tail chunk
    if not filtered:
        tail = lines[-(keep_head_lines * 2):] if len(lines) > keep_head_lines * 2 else lines
        filtered = head + tail

    return "\n".join(filtered)


def _chunk_text(text: str, max_size: int = _CHUNK_SIZE) -> List[str]:
    """Create semantically nicer chunks by preferring newline splits when possible."""
    if not text:
        return []
    if len(text) <= max_size:
        return [text]
    chunks = []
    start = 0
    L = len(text)
    while start < L:
        end = min(L, start + max_size)
        if end < L:
            nl = text.rfind("\n", start, end)
            # prefer breaking at newline but avoid too small chunks
            if nl and nl > start + max_size // 3:
                end = nl + 1
        chunks.append(text[start:end])
        start = end
    return chunks


def _summarize_with_chain(text: str) -> str:
    """Sync wrapper for the chain.invoke; returns stripped string or error note."""
    try:
        out = chain.invoke({"logs": text})
        if out is None:
            return "[empty]"
        return str(out).strip().replace("\n", " ")
    except Exception as e:
        return f"[chunk-error: {str(e)}]"


# ---------------------------
# Original function name/signature preserved
# ---------------------------
def summarize_logs_with_llm(raw_logs: str) -> dict:
    """
    Fast summarization returning a dict with key 'summary'.
    This function preserves the original name and signature.
    """
    try:
        start_t = time.time()

        # 1) Pre-filter logs to relevant portion (drastically reduces tokens)
        filtered = _extract_relevant_lines(raw_logs, keep_head_lines=20, keyword_max=300)

        # If filtered is very short, use a small tail + head to preserve context
        if len(filtered.strip()) < 120:
            filtered = "\n".join(raw_logs.splitlines()[:20]) + "\n\n" + raw_logs[-3000:]

        # Optionally keep one stored doc in DB (similar to your previous behavior)
        try:
            vector_store.add_documents([Document(page_content=filtered[:20000])])
        except Exception:
            # embedding/storage must not block summarization speed
            pass

        # 2) Chunk filtered text
        chunks = _chunk_text(filtered, max_size=_CHUNK_SIZE)
        if not chunks:
            return {"summary": "", "took_s": round(time.time() - start_t, 2)}

        # 3) Batch chunks to reduce number of LLM calls
        batched = []
        for i in range(0, len(chunks), _BATCH_SIZE):
            batched.append("\n\n".join(chunks[i : i + _BATCH_SIZE]))

        # 4) Summarize batches in parallel (bounded workers)
        partials = [None] * len(batched)
        with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as ex:
            future_to_idx = {ex.submit(_summarize_with_chain, b): idx for idx, b in enumerate(batched)}
            # collect with timeouts to avoid long waits
            for fut in as_completed(future_to_idx, timeout=max(1, _CALL_TIMEOUT * len(future_to_idx))):
                idx = future_to_idx[fut]
                try:
                    partials[idx] = fut.result(timeout=_CALL_TIMEOUT)
                except Exception as e:
                    partials[idx] = f"[batch-error: {str(e)}]"

        # Ensure ordered partials; fill any None by calling sync (fallback)
        for i in range(len(partials)):
            if partials[i] is None:
                try:
                    partials[i] = _summarize_with_chain(batched[i])
                except Exception as e:
                    partials[i] = f"[fallback-error: {str(e)}]"

        # 5) Combine partials (ordered) and create one final concise summary
        combined = "\n\n".join(partials)

        try:
            final = chain.invoke({"logs": combined})
            final_text = str(final).strip()
        except Exception as e:
            # fallback: try direct llm call with prompt.format if chain fails
            try:
                final_text = llm.invoke(prompt.format(logs=combined))
            except Exception as e2:
                final_text = f"[final-error: {str(e2)}]"

        took = round(time.time() - start_t, 2)
        return {"summary": final_text, "took_s": took, "chunks": len(chunks), "batches": len(batched)}
    except Exception as e:
        return {"error": str(e)}


# ---------------------------
# Streaming function preserved signature
# ---------------------------
def stream_summarize_logs_with_llm(raw_logs: str):
    """
    Streams only the final summary tokens. Internally performs fast parallel partial summarization,
    then streams the final polished summary token-by-token from the model.
    """
    try:
        # Pre-filter and chunk (same as sync function)
        filtered = _extract_relevant_lines(raw_logs, keep_head_lines=20, keyword_max=300)
        if len(filtered.strip()) < 120:
            filtered = "\n".join(raw_logs.splitlines()[:20]) + "\n\n" + raw_logs[-3000:]

        # optional store document (non-blocking on errors)
        try:
            vector_store.add_documents([Document(page_content=filtered[:20000])])
        except Exception:
            pass

        chunks = _chunk_text(filtered, max_size=_CHUNK_SIZE)
        if not chunks:
            # nothing to stream
            yield ""
            return

        # batch and create partials (synchronously here to keep worker handling simpler for streaming)
        batched = []
        for i in range(0, len(chunks), _BATCH_SIZE):
            batched.append("\n\n".join(chunks[i : i + _BATCH_SIZE]))

        # parallel partial summarization
        partials = []
        with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as ex:
            futures = [ex.submit(_summarize_with_chain, b) for b in batched]
            for fut in as_completed(futures, timeout=max(1, _CALL_TIMEOUT * len(futures))):
                try:
                    res = fut.result(timeout=_CALL_TIMEOUT)
                except Exception as e:
                    res = f"[batch-error: {str(e)}]"
                partials.append(res)

        # ensure ordered partials: prefer sequential recompute if ordering matters and batch count small
        if len(batched) <= _MAX_WORKERS:
            ordered_partials = [_summarize_with_chain(b) for b in batched]
        else:
            ordered_partials = partials  # best-effort order

        combined = "\n\n".join(ordered_partials)

        # Stream final summary token-by-token using llm.stream with formatted prompt
        # Use prompt.format(logs=combined) to match chain prompt template
        stream_iter = llm.stream(prompt.format(logs=combined))
        for token in stream_iter:
            yield token

    except Exception as e:
        yield f"[Error] {str(e)}"
