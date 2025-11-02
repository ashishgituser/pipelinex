from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import gitlab_routes

app = FastAPI(title="GitLab DevOps Tool")

# ✅ Allow requests from your Angular frontend
origins = [
    "http://localhost:4200",
    "http://127.0.0.1:4200"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # You can set ["*"] to allow all origins (not recommended for prod)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Include your router as before
app.include_router(gitlab_routes.router)


@app.get("/")
def root():
    return {"message": "GitLab DevOps Tool Backend Running!"}
