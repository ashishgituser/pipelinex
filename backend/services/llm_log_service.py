import os
import re
from typing import List
from langchain_ollama import OllamaEmbeddings, OllamaLLM
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate


# ==========================================================
# CONFIGURATION
# ==========================================================
DB_DIR = "./chroma_log_db"
EMBED_MODEL = "nomic-embed-text"
LLM_MODEL = "qwen2.5:1.5b-instruct"
CHUNK_SIZE = 800        # Best size for logs in Chroma
TOP_K = 6               # Retrieve only 6 best chunks → FAST


# ==========================================================
# INITIALIZE EMBEDDINGS
# ==========================================================
embeddings = OllamaEmbeddings(model=EMBED_MODEL)


# ==========================================================
# INITIALIZE CHROMA VECTOR STORE
# ==========================================================
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
llm = OllamaLLM(model=LLM_MODEL)


# ==========================================================
# SUMMARIZATION PROMPT
# ==========================================================
prompt = ChatPromptTemplate.from_template("""
You are a senior DevOps engineer. Summarize the CI/CD job using the retrieved relevant log chunks.

Relevant Context:
{context}

Create a concise summary with:

🧱 Job Overview  
🚨 Errors & Root Cause  
⚙️ What Happened (Short)  
🔧 Recommended Fix  
📘 One-Line Summary  

Keep the summary clean, accurate, and **do not repeat raw logs**.
""")

chain = prompt | llm


# ==========================================================
# CHUNKING FOR INGESTION INTO CHROMA
# ==========================================================
def _chunk_logs(raw: str, size: int = CHUNK_SIZE) -> List[Document]:
    docs = []
    lines = raw.splitlines()
    buffer = []

    current_len = 0
    for line in lines:
        buffer.append(line)
        current_len += len(line)

        if current_len >= size:
            docs.append(Document(page_content="\n".join(buffer)))
            buffer = []
            current_len = 0

    if buffer:
        docs.append(Document(page_content="\n".join(buffer)))

    return docs


# ==========================================================
# INGEST LOGS INTO CHROMA
# ==========================================================
def _ingest_logs(raw_logs: str):
    """Store logs into Chroma DB in chunks."""
    if isinstance(raw_logs, bytes):
        raw_logs = raw_logs.decode("utf-8", errors="ignore")

    docs = _chunk_logs(raw_logs, CHUNK_SIZE)
    if docs:
        vector_store.add_documents(docs)


# ==========================================================
# RETRIEVE RELEVANT CONTEXT FROM CHROMA
# ==========================================================
def _retrieve_context() -> str:
    """Semantic search retrieves ONLY relevant meaningful chunks."""
    results = vector_store.similarity_search("summarize logs", k=TOP_K)
    if not results:
        return "No context retrieved."
    return "\n\n".join([doc.page_content for doc in results])


# ==========================================================
# MAIN SUMMARIZATION FUNCTION (KEEP SIGNATURE)
# ==========================================================
def summarize_logs_with_llm(raw_logs: str) -> dict:
    """
    Your original function name.
    Now implemented as a FAST RAG summarizer.
    """

    try:
        # 1. Ingest into Chroma
        _ingest_logs(raw_logs)

        # 2. Retrieve semantic context
        context = _retrieve_context()

        # 3. ONE fast LLM call
        final = chain.invoke({"context": context})

        return {
            "summary": str(final).strip(),
            "context_size": len(context),
            "chunks_used": TOP_K
        }

    except Exception as e:
        return {"error": str(e)}


# ==========================================================
# STREAMING VERSION (KEEP SIGNATURE)
# ==========================================================
def stream_summarize_logs_with_llm(raw_logs: str):
    """
    Streaming version of your original function.
    Streams ONLY the final summary.
    """

    try:
        _ingest_logs(raw_logs)
        context = _retrieve_context()

        for token in llm.stream(prompt.format(context=context)):
            yield token

    except Exception as e:
        yield f"[Error] {str(e)}"
