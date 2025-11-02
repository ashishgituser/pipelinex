# services/llm_log_service.py
import os
import faiss
import numpy as np
from llama_cpp import Llama
from sentence_transformers import SentenceTransformer


MODEL_PATH = "/Users/ashishchaudhary/Persoanl/project/pipelinex/backend/models/mistral-7b-instruct-v0.1.Q4_K_M.gguf"
LLM_CTX = 4096  # context window
LLM = None
EMBEDDER = None


def load_llm():
    """Load the Mistral model once."""
    global LLM
    if LLM is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"LLM model not found at {MODEL_PATH}")
        LLM = Llama(model_path=MODEL_PATH, n_ctx=LLM_CTX, n_gpu_layers=-1, verbose=False)
    return LLM


def load_embedder():
    """Load sentence-transformer model for embeddings (cached)."""
    global EMBEDDER
    if EMBEDDER is None:
        EMBEDDER = SentenceTransformer("all-MiniLM-L6-v2")
    return EMBEDDER


def chunk_text(text: str, max_chunk_size: int = 1000, overlap: int = 200):
    """Chunk long logs safely."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + max_chunk_size
        chunks.append(text[start:end])
        start += max_chunk_size - overlap
    return chunks


def build_faiss_index(chunks, embedder):
    """Create FAISS index for semantic search."""
    embeddings = np.array(embedder.encode(chunks), dtype="float32")
    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings)
    return index, embeddings


def retrieve_relevant_chunks(query, chunks, embedder, index, top_k=5):
    """Find top-k relevant log chunks."""
    q_emb = np.array(embedder.encode([query]), dtype="float32")
    D, I = index.search(q_emb, top_k)
    return [chunks[i] for i in I[0]]


def summarize_logs_with_llm(log_text):
    """Full summarization pipeline with bytes-safe handling."""
    llm = load_llm()
    embedder = load_embedder()

    # Ensure text is str (GitLab may return bytes)
    if isinstance(log_text, bytes):
        try:
            log_text = log_text.decode("utf-8", errors="ignore")
        except Exception:
            log_text = log_text.decode("latin-1", errors="ignore")

    # Step 1: Chunk logs safely
    chunks = chunk_text(log_text)

    # Step 2: Build FAISS index
    index, _ = build_faiss_index(chunks, embedder)

    # Step 3: Retrieve relevant chunks
    top_chunks = retrieve_relevant_chunks("Summarize the job log", chunks, embedder, index, top_k=5)

    # Ensure all retrieved chunks are strings
    top_chunks = [c.decode("utf-8", errors="ignore") if isinstance(c, bytes) else c for c in top_chunks]
    summary_context = "\n".join(top_chunks)

    # Step 4: Prompt for LLM
    prompt = f"""
<s>[INST]
You are an expert DevOps assistant.
Summarize the following CI/CD job logs in a concise and human-readable way.
Include:
- What the job was doing
- Key steps
- Where it failed or succeeded
- Any warnings or errors

LOG SNIPPET:
{summary_context}
[/INST]
"""

    # Step 5: Generate summary
    response = llm(prompt, max_tokens=1024, temperature=0.5, stop=["</s>", "[INST]"])
    summary = response["choices"][0]["text"].strip()

    return {"summary": summary, "chunk_count": len(chunks)}
