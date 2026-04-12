import redis
import uuid
import json
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

_r = None

def _get_redis():
    global _r
    if _r is None:
        url = os.environ.get("REDIS_URL")
        if not url:
            raise RuntimeError("REDIS_URL environment variable is not set")
        _r = redis.from_url(url, decode_responses=True)
    return _r


def submit_job(task_type: str, payload: dict) -> str:
    r = _get_redis()
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
    return _get_redis().hgetall(f"job:{job_id}")


def update_job(job_id: str, **kwargs):
    _get_redis().hset(f"job:{job_id}", mapping=kwargs)


def list_jobs(limit: int = 30) -> list[dict]:
    r = _get_redis()
    keys = r.keys("job:*")
    jobs = [r.hgetall(k) for k in keys]
    return sorted(jobs, key=lambda j: j.get("created_at", ""), reverse=True)[:limit]
