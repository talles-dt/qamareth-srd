import os, json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health():
    return {
        "status": "ok",
        "nvidia": len(os.getenv("NVIDIA_API_KEY", "")),
        "redis": bool(os.getenv("REDIS_URL")),
    }
