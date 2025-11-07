import os
from langchain_ollama import OllamaEmbeddings, OllamaLLM
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document

# Directory to persist embeddings
DB_DIR = "./chroma_log_db"
MODEL_NAME = "llama3.2"  # or "gemma2:2b" if available locally

# Initialize embeddings
embeddings = OllamaEmbeddings(model="mxbai-embed-large")

# Initialize Chroma vector store
if not os.path.exists(DB_DIR):
    os.makedirs(DB_DIR)

vector_store = Chroma(
    collection_name="gitlab_logs",
    persist_directory=DB_DIR,
    embedding_function=embeddings
)

retriever = vector_store.as_retriever(search_kwargs={"k": 5})

# Define LLM
llm = OllamaLLM(model=MODEL_NAME)

from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_template("""
You are a **senior DevOps AI assistant** specializing in CI/CD pipelines and observability.
Analyze the following job logs and produce a **clear, structured, and visually appealing summary**.

Your goal:
- Give the engineer a full understanding of what happened **without opening the raw logs**.
- Include timing insights, status, warnings, errors, and suggestions.
- Keep it concise, professional, and formatted beautifully.

---

🧩 **Log Summary Context**
{logs}

---

🎯 **Your Output Format**

🧱 **Job Overview**
- **Pipeline Stage:** (name or inferred)
- **Job Name:** (if available)
- **Overall Status:** ✅ Success / ❌ Failed / ⚠️ Partial
- **Duration:** (Extract if available or estimate from timestamps)
- **Start → End Time:** (if available)

⚙️ **Execution Summary**
- (Summarize what the job was doing step by step — build, test, deploy, etc.)
- (Highlight major stages, commands, or actions performed)

🚨 **Issues & Warnings**
- (List any errors, warnings, or failed commands)
- (Include error snippets or failure reasons)
- (If successful, write “No errors or warnings detected.”)

📊 **Performance & Resource Notes**
- (Summarize any timing info, retries, parallel jobs, or slow steps)

💡 **Recommendations**
- (If errors found, suggest next actions or probable fixes)
- (If success, suggest possible improvements or optimizations)

📘 **One-Line Summary**
- A single-sentence executive summary (e.g., “The deployment succeeded after one retry due to a missing dependency.”)

---

Be concise, accurate, and visually structured using emojis and bullet points.
Focus on actionable insights, not just repetition of logs.
""")

chain = prompt | llm


def summarize_logs_with_llm(raw_logs: str) -> dict:
    """Summarize logs using LLM and store embeddings."""
    try:
        # Store logs in vector DB
        doc = Document(page_content=raw_logs[:20000])  # Truncate large logs
        vector_store.add_documents([doc])

        # Generate summary
        result = chain.invoke({"logs": raw_logs[:20000]})
        return {"summary": result}
    except Exception as e:
        return {"error": str(e)}


def stream_summarize_logs_with_llm(raw_logs: str):
    """Stream summarization output token-by-token."""
    try:
        for token in llm.stream(prompt.format(logs=raw_logs[:20000])):
            yield token
    except Exception as e:
        yield f"[Error] {str(e)}"
