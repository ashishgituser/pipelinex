import os
import faiss
import numpy as np
from llama_cpp import Llama
from sentence_transformers import SentenceTransformer

# ---------------------------------------------------------
# MODEL CONFIG
# ---------------------------------------------------------
# Assuming the user's path structure is correct
MODEL_PATH = '/Users/ashishchaudhary/Persoanl/project/pipelinex/backend/models/mistral-7b-instruct-v0.1.Q4_K_M.gguf'
LLM_CTX = 8192  # ample for long logs, smaller = faster
LLM = None
EMBEDDER = None

# --- OPTIMIZATION PARAMETERS ---
# 1. Further reduced chunk size for faster embedding time per chunk, better for log lines
OPTIMIZED_CHUNK_SIZE = 512
OPTIMIZED_OVERLAP = 64
# 2. Increased batch size to 256 to maximize throughput on the RTX 2000 Ada GPU
OPTIMIZED_EMBEDDING_BATCH_SIZE = 256
# 3. Max tokens remains low to ensure fast generation
OPTIMIZED_MAX_TOKENS = 256
# 4. CPU workers are now only used for the LLM to avoid CUDA conflicts during embedding
OPTIMIZED_LLM_THREADS = 8
# -------------------------------

# ---------------------------------------------------------
# LLM LOADER (No change needed here as caching is correct)
# ---------------------------------------------------------
def load_llm():
    """Load the Llama 3.2 model only once and keep it in memory."""
    global LLM
    if LLM is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model not found: {MODEL_PATH}")
        print(f"🔹 Loading Llama model from {MODEL_PATH} ...")

        # Configuration remains good for GPU offload
        LLM = Llama(
            model_path=MODEL_PATH,
            n_ctx=LLM_CTX,
            n_gpu_layers=-1,      # Offload entire model to GPU
            n_threads=OPTIMIZED_LLM_THREADS, # Use optimized thread count for LLM
            n_batch=1024,         # Batch size for prompt processing
            verbose=False
        )
        print("✅ Llama model loaded successfully.")
    return LLM

# ---------------------------------------------------------
# EMBEDDER LOADER (No change needed here as caching is correct)
# ---------------------------------------------------------
def load_embedder():
    """Load and cache the sentence transformer model."""
    global EMBEDDER
    if EMBEDDER is None:
        print("🔹 Loading sentence-transformer embedder (all-MiniLM-L6-v2)...")
        # Ensure 'device="cuda"' is set for GPU usage
        EMBEDDER = SentenceTransformer("all-MiniLM-L6-v2", device="cuda")
        print("✅ Embedder loaded successfully.")
    return EMBEDDER

# ---------------------------------------------------------
# TEXT CHUNKING (Optimized parameters applied)
# ---------------------------------------------------------
def chunk_text(text: str, max_chunk_size: int = OPTIMIZED_CHUNK_SIZE, overlap: int = OPTIMIZED_OVERLAP):
    """
    Chunk logs into smaller parts for semantic search.
    Using smaller chunks (512) is generally more efficient for log analysis.
    """
    chunks = []
    start = 0
    while start < len(text):
        end = start + max_chunk_size
        chunks.append(text[start:end])
        # Move forward by chunk size minus overlap
        start += max_chunk_size - overlap
    return chunks

# ---------------------------------------------------------
# FAISS INDEX CREATION (Fix: Removed num_workers from GPU encoding)
# ---------------------------------------------------------
def build_faiss_index(chunks, embedder):
    """Create FAISS GPU-accelerated index."""
    import faiss.contrib.torch_utils  # enables GPU support in FAISS
    
    # Increased batch size (256). The 'num_workers' parameter has been removed 
    # to fix the crash. Using num_workers with device='cuda' often leads to 
    # multiprocessing/CUDA context issues in 'sentence-transformers'.
    embeddings = np.array(
        embedder.encode(
            chunks, 
            batch_size=OPTIMIZED_EMBEDDING_BATCH_SIZE, 
            show_progress_bar=False,
            # num_workers=OPTIMIZED_EMBEDDING_WORKERS REMOVED TO PREVENT CUDA CONFLICTS
        ), 
        dtype="float32"
    )
    
    # FAISS index creation
    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings)
    return index, embeddings

# ---------------------------------------------------------
# CHUNK RETRIEVAL (Fix: Removed num_workers from GPU encoding)
# ---------------------------------------------------------
def retrieve_relevant_chunks(query, chunks, embedder, index, top_k=5):
    """Retrieve top-k most relevant chunks."""
    # num_workers is also removed here for consistency and safety with GPU usage.
    q_emb = np.array(embedder.encode([query], show_progress_bar=False), dtype="float32")
    D, I = index.search(q_emb, top_k)
    return [chunks[i] for i in I[0]]

# ---------------------------------------------------------
# MAIN SUMMARIZATION FUNCTION (Optimized max_tokens)
# ---------------------------------------------------------
def summarize_logs_with_llm(log_text):
    """Summarize raw GitLab job logs using local Llama model."""
    llm = load_llm()
    embedder = load_embedder()

    # Ensure proper decoding of raw log bytes
    if isinstance(log_text, bytes):
        log_text = log_text.decode("utf-8", errors="ignore")

    # Step 1: Chunk text (uses optimized defaults)
    chunks = chunk_text(log_text)

    # Step 2: Build FAISS index (uses optimized batch size and workers)
    index, _ = build_faiss_index(chunks, embedder)

    # Step 3: Retrieve top relevant chunks
    top_chunks = retrieve_relevant_chunks("Summarize the CI/CD job log", chunks, embedder, index, top_k=5)
    summary_context = "\n\n".join(top_chunks)

    # Step 4: Prepare concise prompt
    prompt = f"""
<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are an expert DevOps AI assistant. Summarize CI/CD pipeline job logs clearly and concisely.
Include:
- What the job was doing
- Key steps or stages
- Success/failure summary
- Warnings or errors (if any)
Keep it short and easy to read.<|eot_id|>
<|start_header_id|>user<|end_header_id|>
{summary_context}
<|eot_id|><|start_header_id|>assistant<|end_header_id|>
"""

    # Step 5: Generate response (max_tokens reduced to 256 for speed)
    response = llm.create_completion(
        prompt,
        max_tokens=OPTIMIZED_MAX_TOKENS,  # Reduced from 512
        temperature=0.4,
        top_p=0.9,
        repeat_penalty=1.1
    )

    summary = response["choices"][0]["text"].strip()
    return {"summary": summary, "chunk_count": len(chunks)}


def stream_summarize_logs_with_llm(log_text):
    """Stream the log summarization token by token."""
    llm = load_llm()
    embedder = load_embedder()

    # Ensure proper decoding of raw log bytes
    if isinstance(log_text, bytes):
        log_text = log_text.decode("utf-8", errors="ignore")

    # Step 1: Chunk text (uses optimized defaults)
    chunks = chunk_text(log_text)

    # Step 2: Build FAISS index (uses optimized batch size and workers)
    index, _ = build_faiss_index(chunks, embedder)

    # Step 3: Retrieve top relevant chunks
    top_chunks = retrieve_relevant_chunks("Summarize the CI/CD job log", chunks, embedder, index, top_k=5)
    summary_context = "\n\n".join(top_chunks)

    # Step 4: Prepare concise prompt
    prompt = f"""
<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are an expert DevOps AI assistant. Summarize CI/CD pipeline job logs clearly and concisely.
Include:
- What the job was doing
- Key steps or stages
- Success/failure summary
- Warnings or errors (if any)
Keep it short and easy to read.<|eot_id|>
<|start_header_id|>user<|end_header_id|>
{summary_context}
<|eot_id|><|start_header_id|>assistant<|end_header_id|>
"""

    # Step 5: Stream the response token by token (max_tokens reduced to 256 for speed)
    stream = llm.create_completion(
        prompt,
        max_tokens=OPTIMIZED_MAX_TOKENS, # Reduced from 512
        temperature=0.4,
        top_p=0.9,
        repeat_penalty=1.1,
        stream=True  # Enable streaming
    )

    for output in stream:
        token = output["choices"][0]["text"]
        if token:  # Only yield non-empty tokens
            yield token
