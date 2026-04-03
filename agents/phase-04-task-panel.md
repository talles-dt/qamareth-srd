# Phase 4 — Task Panel & Batch Jobs

## What you're building
- Redis-backed job queue on the backend
- `POST /task/submit` and `GET /task/:id` endpoints
- A task list page and task detail page on the frontend
- The lore ingestion batch task (four-pass Archivist pipeline)

## Prerequisite
Phases 1–3 complete and working.

## Install new dependencies

### Backend
```bash
pip install redis==5.0.8 python-multipart==0.0.12
```
Add both to `requirements.txt`.

---

## Backend files

### jobs.py
Create at root of `qamareth-agents/`:
```python
import redis
import uuid
import json
import os
from datetime import datetime

r = redis.from_url(os.environ["REDIS_URL"], decode_responses=True)


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
```

---

### tasks/__init__.py
Empty file.

### tasks/lore_ingest.py
```python
import asyncio
from anthropic import Anthropic
from graph.nodes import build_system_prompt, inject_registry
from registry.registry import load_registry, format_registry_for_context

client = Anthropic()

CHUNK_SIZE = 8000  # chars per pass-1 chunk; 200-page doc needs batching


async def run_lore_ingest(payload: dict) -> dict:
    """
    Runs the four-pass Lore Archivist protocol.
    For large documents, only processes the first CHUNK_SIZE chars.
    Full document batching is a future enhancement.
    """
    file_content = payload.get("file_content", "")
    chunk = file_content[:CHUNK_SIZE]
    filename = payload.get("filename", "unknown")

    system_prompt = build_system_prompt("13-lore-archivist.md")
    registry = load_registry()
    srd_context = format_registry_for_context(registry)

    passes = [
        (
            "Pass 1: Document Survey",
            f"{srd_context}\n\n---\n\nFile: {filename}\n\n"
            f"Document excerpt (first {CHUNK_SIZE} chars):\n\n{chunk}\n\n"
            "Run Pass 1 only: produce the Document Survey."
        ),
        (
            "Pass 2: Entity Extraction",
            "Continue with Pass 2: extract all discrete lore entities. "
            "Produce raw extraction records."
        ),
        (
            "Pass 3: Classification and Visibility",
            "Continue with Pass 3: apply taxonomy and Visibility Tiers. "
            "Log any internal contradictions."
        ),
        (
            "Pass 4: MDX Stub Production",
            "Continue with Pass 4: generate MDX stubs for all PUBLIC and "
            "PLAYER-CONTEXTUAL entities. Include ARCHIVIST NOTES comment blocks. "
            "List any MECHANICAL FLAGS at the end."
        ),
    ]

    messages: list[dict] = []
    results: dict[str, str] = {}

    for pass_name, prompt in passes:
        messages.append({"role": "user", "content": prompt})
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
        )
        content = response.content[0].text
        messages.append({"role": "assistant", "content": content})
        results[pass_name] = content
        await asyncio.sleep(0.5)

    return {
        "filename": filename,
        "chunk_processed": f"0–{min(CHUNK_SIZE, len(file_content))} chars",
        "total_chars": len(file_content),
        "passes": results,
    }
```

---

### tasks/audit.py
```python
import asyncio
from anthropic import Anthropic
from graph.nodes import build_system_prompt
from registry.registry import load_registry, format_registry_for_context

client = Anthropic()


async def run_audit(payload: dict) -> dict:
    """Runs the Theological Auditor against a given element."""
    element_name = payload.get("element_name", "unspecified")
    element_text = payload.get("element_text", "")
    system_prompt = build_system_prompt("14-theological-auditor.md")

    registry = load_registry()
    srd_context = format_registry_for_context(registry)

    prompt = (
        f"{srd_context}\n\n---\n\n"
        f"Please audit the following Qamareth system element.\n\n"
        f"**Element:** {element_name}\n\n"
        f"{element_text}\n\n"
        "Produce a full Audit Record covering all relevant axes."
    )

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": prompt}],
    )

    return {
        "element": element_name,
        "audit": response.content[0].text,
    }
```

---

## Update main.py — add task endpoints

Add these imports at the top:
```python
import asyncio
from fastapi import UploadFile, File, Form
from jobs import submit_job, get_job, update_job, list_jobs
```

Add these endpoints:

```python
@app.post("/task/submit")
async def task_submit(
    task_type: str = Form(...),
    file: UploadFile = File(None),
    payload_json: str = Form("{}"),
):
    payload = json.loads(payload_json)
    if file:
        content = await file.read()
        payload["file_content"] = content.decode("utf-8", errors="replace")
        payload["filename"] = file.filename

    job_id = submit_job(task_type, payload)
    asyncio.create_task(_process_job(job_id, task_type, payload))
    return {"job_id": job_id, "status": "queued"}


async def _process_job(job_id: str, task_type: str, payload: dict):
    try:
        update_job(job_id, status="running")

        if task_type == "lore_ingest":
            from tasks.lore_ingest import run_lore_ingest
            result = await run_lore_ingest(payload)
        elif task_type == "audit":
            from tasks.audit import run_audit
            result = await run_audit(payload)
        else:
            result = {"error": f"Unknown task type: {task_type}"}

        update_job(job_id, status="complete", result=json.dumps(result, ensure_ascii=False))
    except Exception as e:
        update_job(job_id, status="failed", error=str(e))


@app.get("/task/{job_id}")
def task_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@app.get("/tasks")
def task_list():
    return list_jobs()
```

## Local Redis for development
```bash
# macOS
brew install redis && brew services start redis

# or Docker
docker run -d -p 6379:6379 redis:7-alpine
```

Add to `.env`:
```
REDIS_URL=redis://localhost:6379
```

---

## Frontend files

### Add to lib/types.ts
```typescript
export interface Job {
  id: string
  status: "queued" | "running" | "complete" | "failed"
  task_type: string
  created_at: string
  result?: string   // JSON string
  error?: string
}

export type TaskType = "lore_ingest" | "audit"
```

### Add to lib/api.ts
```typescript
export async function submitTask(
  taskType: TaskType,
  file?: File,
  payload: Record<string, unknown> = {}
): Promise<{ job_id: string }> {
  const form = new FormData()
  form.append("task_type", taskType)
  form.append("payload_json", JSON.stringify(payload))
  if (file) form.append("file", file)
  const res = await fetch(`${PROXY}/task/submit`, { method: "POST", body: form })
  return res.json()
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await fetch(`${PROXY}/task/${jobId}`)
  return res.json()
}

export async function listJobs(): Promise<Job[]> {
  const res = await fetch(`${PROXY}/tasks`)
  return res.json()
}

export async function commitToRegistry(
  entryType: string,
  entry: Record<string, unknown>
): Promise<void> {
  await fetch(`${PROXY}/registry/${entryType}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  })
}
```

---

### app/tasks/page.tsx
```tsx
"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { submitTask, listJobs } from "@/lib/api"
import type { Job, TaskType } from "@/lib/types"

export default function TasksPage() {
  const [jobs, setJobs]         = useState<Job[]>([])
  const [taskType, setTaskType] = useState<TaskType>("lore_ingest")
  const [file, setFile]         = useState<File | null>(null)
  const [auditText, setAuditText] = useState("")
  const [auditName, setAuditName] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setJobs(await listJobs())
  }

  useEffect(() => { load() }, [])

  async function submit() {
    setSubmitting(true)
    if (taskType === "lore_ingest" && file) {
      await submitTask("lore_ingest", file)
    } else if (taskType === "audit") {
      await submitTask("audit", undefined,
        { element_name: auditName, element_text: auditText })
    }
    await load()
    setSubmitting(false)
    setFile(null)
    setAuditText("")
    setAuditName("")
  }

  const statusColor = (s: string) => ({
    queued:   "text-marginalia",
    running:  "text-brass",
    complete: "text-grove",
    failed:   "text-crimson",
  }[s] ?? "text-parchment-dim")

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl text-parchment mb-8 tracking-wide">
        Batch Tasks
      </h1>

      {/* Submit form */}
      <div className="bg-surface border border-border p-6 mb-8 space-y-4">
        <div className="flex gap-4">
          {(["lore_ingest", "audit"] as TaskType[]).map(t => (
            <button
              key={t}
              onClick={() => setTaskType(t)}
              className={`font-mono text-xs px-4 py-2 border transition-colors
                ${taskType === t
                  ? "border-steel text-steel"
                  : "border-border text-marginalia hover:border-parchment-dim"
                }`}
            >
              {t.replace("_", " ").toUpperCase()}
            </button>
          ))}
        </div>

        {taskType === "lore_ingest" && (
          <div>
            <label className="font-mono text-xs text-marginalia block mb-2">
              LORE DOCUMENT (.txt or .md)
            </label>
            <input
              type="file"
              accept=".txt,.md,.pdf"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="font-mono text-xs text-parchment-dim file:bg-surface-alt
                         file:border file:border-border file:text-parchment
                         file:font-mono file:text-xs file:px-3 file:py-1 file:mr-4"
            />
          </div>
        )}

        {taskType === "audit" && (
          <div className="space-y-3">
            <div>
              <label className="font-mono text-xs text-marginalia block mb-1">
                ELEMENT NAME
              </label>
              <input
                value={auditName}
                onChange={e => setAuditName(e.target.value)}
                placeholder="e.g. Collective Amplification mechanic"
                className="w-full bg-surface-alt border border-border text-parchment
                           font-body text-sm px-3 py-2 focus:outline-none focus:border-steel
                           placeholder:text-marginalia"
              />
            </div>
            <div>
              <label className="font-mono text-xs text-marginalia block mb-1">
                ELEMENT TEXT
              </label>
              <textarea
                value={auditText}
                onChange={e => setAuditText(e.target.value)}
                rows={6}
                placeholder="Paste the rule text, lore entry, or mechanic to audit..."
                className="w-full bg-surface-alt border border-border text-parchment
                           font-body text-sm px-3 py-2 resize-none focus:outline-none
                           focus:border-steel placeholder:text-marginalia"
              />
            </div>
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting || (taskType === "lore_ingest" && !file)}
          className="px-6 py-2 bg-steel text-ink font-mono text-xs tracking-widest
                     uppercase disabled:opacity-40 disabled:cursor-not-allowed
                     hover:bg-parchment transition-colors"
        >
          {submitting ? "SUBMITTING…" : "SUBMIT TASK"}
        </button>
      </div>

      {/* Job list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-xs text-marginalia tracking-widest">RECENT JOBS</h2>
          <button onClick={load}
            className="font-mono text-xs text-steel hover:text-parchment">
            REFRESH
          </button>
        </div>
        {jobs.map(job => (
          <Link key={job.id} href={`/tasks/${job.id}`}
            className="block bg-surface border border-border px-4 py-3
                       hover:border-steel transition-colors group">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-parchment-dim">
                {job.task_type.replace("_", " ").toUpperCase()}
              </span>
              <span className={`font-mono text-xs uppercase ${statusColor(job.status)}`}>
                {job.status}
              </span>
            </div>
            <div className="font-mono text-xs text-marginalia mt-1">
              {job.id.slice(0, 8)}… · {new Date(job.created_at).toLocaleString()}
            </div>
          </Link>
        ))}
        {jobs.length === 0 && (
          <p className="font-mono text-xs text-marginalia text-center py-8">
            No jobs yet.
          </p>
        )}
      </div>
    </div>
  )
}
```

---

### app/tasks/[id]/page.tsx
```tsx
"use client"
import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { getJob } from "@/lib/api"
import type { Job } from "@/lib/types"

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<Job | null>(null)

  const load = useCallback(async () => {
    setJob(await getJob(id))
  }, [id])

  useEffect(() => {
    load()
    // Poll while running
    const interval = setInterval(async () => {
      const j = await getJob(id)
      setJob(j)
      if (j.status === "complete" || j.status === "failed") {
        clearInterval(interval)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [id, load])

  if (!job) return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="font-mono text-xs text-marginalia animate-pulse">LOADING…</span>
    </div>
  )

  let resultObj: Record<string, unknown> | null = null
  if (job.result) {
    try { resultObj = JSON.parse(job.result) } catch {}
  }

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <Link href="/tasks"
        className="font-mono text-xs text-steel hover:text-parchment mb-6 block">
        ← BACK TO TASKS
      </Link>

      <div className="bg-surface border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs text-parchment-dim uppercase">
            {job.task_type.replace("_", " ")}
          </span>
          <span className={`font-mono text-xs uppercase
            ${job.status === "complete" ? "text-grove"
            : job.status === "failed"   ? "text-crimson"
            : job.status === "running"  ? "text-brass animate-pulse"
            : "text-marginalia"}`}>
            {job.status}
          </span>
        </div>
        <div className="font-mono text-xs text-marginalia">
          {job.id} · {new Date(job.created_at).toLocaleString()}
        </div>
      </div>

      {job.status === "failed" && job.error && (
        <div className="bg-surface border border-crimson p-4 mb-6">
          <p className="font-mono text-xs text-crimson">{job.error}</p>
        </div>
      )}

      {resultObj && (
        <div className="space-y-4">
          {/* Lore ingest: show each pass */}
          {resultObj.passes && typeof resultObj.passes === "object" &&
            Object.entries(resultObj.passes as Record<string, string>).map(([name, content]) => (
              <div key={name} className="bg-surface border border-border">
                <div className="px-4 py-2 border-b border-border">
                  <span className="font-mono text-xs text-steel uppercase tracking-widest">
                    {name}
                  </span>
                </div>
                <pre className="px-4 py-4 text-xs text-parchment-dim font-mono
                                whitespace-pre-wrap overflow-x-auto leading-relaxed">
                  {content}
                </pre>
              </div>
            ))
          }

          {/* Audit: show audit text */}
          {resultObj.audit && (
            <div className="bg-surface border border-border">
              <div className="px-4 py-2 border-b border-border">
                <span className="font-mono text-xs text-steel uppercase tracking-widest">
                  AUDIT RECORD — {String(resultObj.element)}
                </span>
              </div>
              <pre className="px-4 py-4 text-xs text-parchment-dim font-mono
                              whitespace-pre-wrap overflow-x-auto leading-relaxed">
                {String(resultObj.audit)}
              </pre>
            </div>
          )}
        </div>
      )}

      {job.status === "running" && (
        <div className="text-center py-12">
          <span className="font-mono text-xs text-brass animate-pulse tracking-widest">
            PROCESSING…
          </span>
        </div>
      )}
    </div>
  )
}
```

---

## Add navigation to layout

Update `app/layout.tsx` body to include a top nav:
```tsx
<body className="bg-ink text-parchment font-body antialiased">
  <nav className="flex gap-6 px-6 py-3 border-b border-border bg-surface">
    <a href="/chat"  className="font-mono text-xs text-parchment-dim hover:text-parchment tracking-widest">CHAT</a>
    <a href="/tasks" className="font-mono text-xs text-parchment-dim hover:text-parchment tracking-widest">TASKS</a>
  </nav>
  {children}
</body>
```

---

## Done when
- `GET /tasks` returns an empty array without errors
- Submitting a lore_ingest task with a small `.txt` file creates a job
- Job status updates from `queued` → `running` → `complete`
- Task detail page shows the four pass outputs
- Submitting an audit task returns an Audit Record
