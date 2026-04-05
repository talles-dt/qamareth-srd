import os
import json
import asyncio
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from anthropic import Anthropic
from graph.nodes import AGENT_SKILLS, build_system_prompt, inject_registry
from registry.registry import update_registry
from jobs import submit_job, get_job, update_job, list_jobs

load_dotenv()

app = FastAPI(title="Qamareth Agent System")
client = Anthropic()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("ALLOWED_ORIGIN", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    agent: str
    messages: list[dict]
    orchestrated: bool = False


@app.get("/agents")
def get_agents():
    return [
        {"id": k, "label": k.replace("-", " ").title(), "skill_file": v}
        for k, v in AGENT_SKILLS.items()
    ]


@app.get("/registry")
def get_registry_endpoint():
    from registry.registry import load_registry
    return load_registry()


@app.post("/registry/{entry_type}")
def add_registry_entry(entry_type: str, entry: dict):
    valid = ["rules", "conditions", "lore_entities", "grimoires",
             "creatures", "items", "factions", "traditions"]
    if entry_type not in valid:
        raise HTTPException(400, f"Invalid entry type: {entry_type}")
    update_registry(entry_type, entry)
    return {"status": "ok"}


@app.post("/chat/stream")
async def chat_stream(body: ChatRequest):
    if body.agent not in AGENT_SKILLS:
        raise HTTPException(400, f"Unknown agent: {body.agent}")

    if body.orchestrated:
        from graph.builder import qamareth_graph
        from graph.state import QamarethState

        async def graph_stream():
            initial: QamarethState = {
                "messages":         body.messages,
                "active_agent":     "master_architect",
                "task_type":        "chat",
                "work_product":     "",
                "mechanical_flags": [],
                "lore_flags":       [],
                "audit_flags":      [],
                "validated":        False,
                "iteration_count":  0,
                "error":            None,
            }
            result = await asyncio.get_event_loop().run_in_executor(
                None, lambda: qamareth_graph.invoke(initial)
            )
            # Extract text from last message (could be LangChain object or dict)
            last_msg = result["messages"][-1]
            final = last_msg.content if hasattr(last_msg, "content") else last_msg["content"]
            for word in final.split(" "):
                yield f"data: {json.dumps({'text': word + ' '})}\n\n"
                await asyncio.sleep(0.01)
            yield "data: [DONE]\n\n"

        return StreamingResponse(graph_stream(), media_type="text/event-stream")

    else:
        system_prompt = build_system_prompt(AGENT_SKILLS[body.agent])
        messages = inject_registry(body.messages)

        async def direct_stream():
            with client.messages.stream(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                system=system_prompt,
                messages=messages,
            ) as s:
                for text in s.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(direct_stream(), media_type="text/event-stream")


# ─── Task endpoints ───────────────────────────────────────────────────────────

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
