import os
from langchain_ollama import OllamaEmbeddings, OllamaLLM
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document

# ==============================================
# CONFIG
# ==============================================
DB_DIR = "./chroma_log_db"
MODEL_NAME = "qwen2.5:1.5b-instruct"

# ==============================================
# Initialize Embeddings
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
# LLM
# ==============================================
llm = OllamaLLM(model=MODEL_NAME)

# ==============================================
# PROMPT
# ==============================================
prompt = ChatPromptTemplate.from_template("""
You are a senior DevOps AI assistant.  
Summarize the following CI/CD logs into a **single clear, structured summary**.

Logs:
{logs}

Provide:
- Job overview  
- Execution summary  
- Issues & warnings  
- Performance notes  
- Recommendations  
- One-line executive summary  

The output should be concise, clean, and not repeat the logs.
""")

chain = prompt | llm


# ==============================================
# CHUNKING FUNCTION
# ==============================================
def chunk_text(text, max_size=1500):
    return [text[i:i + max_size] for i in range(0, len(text), max_size)]


# ==============================================
# CLEAN SUMMARIZATION (NO PARTIAL OUTPUT)
# ==============================================
def summarize_logs_with_llm(raw_logs: str) -> dict:
    try:
        # Store only a small portion in vector DB (optional)
        vector_store.add_documents([Document(page_content=raw_logs[:20000])])

        # 1. Chunk logs
        chunks = chunk_text(raw_logs)

        # 2. Summarize each chunk internally
        partial = []
        for ch in chunks:
            result = chain.invoke({"logs": ch})
            partial.append(result)

        # 3. Merge partial summaries
        merged_text = "\n\n".join(partial)

        # 4. Create ONE final summary (user sees ONLY this)
        final_summary = chain.invoke({"logs": merged_text})

        return {
            "summary": final_summary
        }

    except Exception as e:
        return {"error": str(e)}


# ==============================================
# STREAMING VERSION (STREAM ONLY THE FINAL SUMMARY)
# ==============================================
def stream_summarize_logs_with_llm(raw_logs: str):
    try:
        # Internal chunk summarization
        chunks = chunk_text(raw_logs)
        partial_summaries = []

        for ch in chunks:
            summary = llm.invoke(prompt.format(logs=ch))
            partial_summaries.append(summary)

        combined = "\n\n".join(partial_summaries)

        # Stream **only the final combined summary**
        for token in llm.stream(prompt.format(logs=combined)):
            yield token

    except Exception as e:
        yield f"[Error] {str(e)}"
