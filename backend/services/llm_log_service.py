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

retriever = vector_store.as_retriever(search_kwargs={"k": 5})

# ==============================================
# Initialize LLM
# ==============================================
llm = OllamaLLM(model=MODEL_NAME)

# ==============================================
# PROMPT
# ==============================================
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
- A single-sentence executive summary.

Be concise, accurate, and visually structured using emojis and bullet points.
Focus on actionable insights, not just repetition of logs.
""")

chain = prompt | llm


# ==============================================
# CHUNKING FUNCTION
# ==============================================
def chunk_text(text, max_size=1500):
    """Split logs into small chunks for faster summarization."""
    return [text[i:i + max_size] for i in range(0, len(text), max_size)]


# ==============================================
# MAIN FAST SUMMARIZATION PIPELINE
# ==============================================
def summarize_logs_with_llm(raw_logs: str) -> dict:
    try:
        # Store only first part in vector DB
        doc = Document(page_content=raw_logs[:20000])
        vector_store.add_documents([doc])

        # Step 1: Chunk logs into small parts
        chunks = chunk_text(raw_logs)

        partial_summaries = []

        # Step 2: Summarize each chunk (1–2 sec each)
        for ch in chunks:
            result = chain.invoke({"logs": ch})
            partial_summaries.append(result)

        # Step 3: Merge all summaries
        merged_text = "\n\n".join(partial_summaries)

        # Step 4: Final summary
        final_summary = chain.invoke({"logs": merged_text})

        return {
            "summary": final_summary,
            "partial_summaries": partial_summaries
        }

    except Exception as e:
        return {"error": str(e)}


# ==============================================
# STREAMING VERSION
# ==============================================
def stream_summarize_logs_with_llm(raw_logs: str):
    try:
        chunks = chunk_text(raw_logs)

        for ch in chunks:
            for token in llm.stream(prompt.format(logs=ch)):
                yield token
            yield "\n---- Next Chunk ----\n"

        merged = "\n\n".join(chunks)
        for token in llm.stream(prompt.format(logs=merged)):
            yield token

    except Exception as e:
        yield f"[Error] {str(e)}"
