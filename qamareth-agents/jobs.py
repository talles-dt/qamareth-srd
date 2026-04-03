import redis
import uuid
import json
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

r = redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379"), decode_responses=True)


def submit_job(task_type: str, payload: dict) -> str:
    job_id = str(uuid.uuid4())
    r.hset(f"job:{job_id}", mapping={
        "id":         job_id,
        "status":     "queued",
        "task_type":  task_type,
        "payload":    json.dumps(payload, ensure_ascii=False),
        "created_at": datetime.utcnow().isoformat(),
        "result":     "",
        "error":      "",
    })
    return job_id


def get_job(job_id: str) -> dict:
    return r.hgetall(f"job:{job_id}")


def update_job(job_id: str, **kwargs):
    r.hset(f"job:{job_id}", mapping=kwargs)


def list_jobs(limit: int = 30) -> list[dict]:
    keys = r.keys("job:*")
    jobs = [r.hgetall(k) for k in keys]
    return sorted(jobs, key=lambda j: j.get("created_at", ""), reverse=True)[:limit]
