import os
import json
import asyncio
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI
from graph.nodes import AGENT_SKILLS, build_system_prompt, inject_registry
from registry.registry import update_registry, load_registry, format_registry_for_context
from jobs import submit_job, get_job, update_job, list_jobs

load_dotenv()

ALLOWED = os.getenv("ALLOWED_ORIGIN", "http://localhost:3000")
NVIDIA_KEY = "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"

if not NVIDIA_KEY:
    raise RuntimeError("NVAPI_KEY environment variable is not set")

app = FastAPI(title="Qamareth Agent System")
client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=NVIDIA_KEY,
)

MODEL = "meta/llama-3.3-70b-instruct"

@app.middleware("http")
async def add_cors_headers(request, call_next):
    """Ensure CORS headers on every response, including OPTIONS preflight."""
    if request.method == "OPTIONS":
        from fastapi.responses import Response
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": ALLOWED,
                "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Max-Age": "86400",
            },
        )
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = ALLOWED
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    agent: str
    messages: list[dict]
    orchestrated: bool = False


class CharacterCreateRequest(BaseModel):
    """Full 20-question answers for complete character generation."""
    concept: str = ""
    q1_inherit: str = ""
    q2_survive: str = ""
    q3_master: str = ""
    q4_denied: str = ""
    q5_carry: str = ""
    attribute_array: str = ""
    name: str = ""
    # Additional 20-question fields
    answers_all: str = ""
    education: str = ""
    magic_training: str = ""
    musical_tradition: str = ""
    memory_sound: str = ""


@app.get("/health")
def health_check():
    """Minimal health check — no heavy imports required."""
    return {
        "status": "ok",
        "model": MODEL,
        "nvidia_key_set": bool(NVIDIA_KEY),
        "nvidia_key_len": len(NVIDIA_KEY),
        "allowed_origin": ALLOWED,
    }



@app.post("/test-chat")
def test_chat():
    try:
        system_prompt = build_system_prompt(AGENT_SKILLS["master-architect"])
        messages = inject_registry([{"role": "user", "content": "Hello"}])
        openai_msgs = _prep_messages(system_prompt, messages)
        r = client.chat.completions.create(
            model=MODEL,
            messages=openai_msgs,
            max_tokens=50,
        )
        return {"ok": True, "text": r.choices[0].message.content[:200]}
    except Exception as e:
        return {"ok": False, "error": str(e), "type": type(e).__name__}

@app.get("/test-llm")
def test_llm():
    try:
        r = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": "Say hello."}],
            max_tokens=10,
        )
        return {"ok": True, "text": r.choices[0].message.content}
    except Exception as e:
        return {"ok": False, "error": str(e), "type": type(e).__name__}

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


def _prep_messages(system_prompt: str, messages: list[dict]) -> list[dict]:
    """Convert messages to OpenAI format with system prompt."""
    return [{"role": "system", "content": system_prompt}] + messages


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
        openai_msgs = _prep_messages(system_prompt, messages)

        async def direct_stream():
            stream = client.chat.completions.create(
                model=MODEL,
                messages=openai_msgs,
                max_tokens=4096,
                stream=True,
            )
            for chunk in stream:
                content = chunk.choices[0].delta.content
                if content:
                    yield f"data: {json.dumps({'text': content})}\n\n"
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


# ─── Character Creation ───────────────────────────────────────────────────────

@app.post("/character/create/stream")
async def character_create_stream(body: CharacterCreateRequest):
    """Streaming character creation using the First Question agent."""
    system_prompt = build_system_prompt(AGENT_SKILLS["character-creation"])
    registry = load_registry()
    srd_context = format_registry_for_context(registry)

    answers_block = body.answers_all or "\n".join([
        f"**Q1 — What did you inherit?**\n{body.q1_inherit}",
        f"**Q2 — What did you survive?**\n{body.q2_survive}",
        f"**Q3 — What did you master?**\n{body.q3_master}",
        f"**Q4 — What were you denied?**\n{body.q4_denied}",
        f"**Q5 — What do you carry?**\n{body.q5_carry}",
    ])

    prompt = f"""{srd_context}

---

You are creating a COMPLETE, PLAYABLE Qamareth character sheet from the 20 Questions answers below.

## Provenance Answers

{answers_block}

## Character Sheet Requirements

Produce ONLY a JSON object with ALL of these fields:
- name, motivo_origem, regiao, ocupacao_familia, infancia, evento_juventude, som_memoria
- attributes: dict with Forca, Destreza, Ressonancia, Compostura, Agudeza, Firmeza → die size strings
- disciplines: dict of discipline name → dice count (1-5), total 10 disciplines
- rs: integer (2-6)
- theosis_stage: string
- motif_capacity: integer
- scar: dict with name, trigger, condition_applied, heightened_access, resolution
- passions: list of {{name, level}} for ALL 8 passions (Gula, Luxuria, Avareza, Ira, Tristeza, Acedia, Vainagloria, Soberba)
- honra: integer (0-5)
- ip_factions: list of {{faction, ip}}
- faction_standing, grimoire_hook: strings
- aliado, rival, lei_quebrada: strings
- partituras: list of {{name, mode, effect, rhythm}}
- combat_motifs: list of {{name, type, condition, effect}}
- weapons: list of {{name, tempo, function, speed}}
- motivacao, escola: strings
- summary: 2-3 paragraph backstory

Derive EVERYTHING from the answers. Use Portuguese names. Return ONLY JSON."""

    openai_msgs = [{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}]

    async def stream():
        s = client.chat.completions.create(
            model=MODEL,
            messages=openai_msgs,
            max_tokens=8192,
            stream=True,
        )
        for chunk in s:
            content = chunk.choices[0].delta.content
            if content:
                yield f"data: {json.dumps({'text': content})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/character/create")
async def character_create(body: CharacterCreateRequest):
    """Non-streaming character creation. Returns structured JSON."""
    system_prompt = build_system_prompt(AGENT_SKILLS["character-creation"])
    registry = load_registry()
    srd_context = format_registry_for_context(registry)

    answers = []
    if body.q1_inherit:
        answers.append(f"**Q1 — What did you inherit?**\n{body.q1_inherit}")
    if body.q2_survive:
        answers.append(f"**Q2 — What did you survive?**\n{body.q2_survive}")
    if body.q3_master:
        answers.append(f"**Q3 — What did you master?**\n{body.q3_master}")
    if body.q4_denied:
        answers.append(f"**Q4 — What were you denied?**\n{body.q4_denied}")
    if body.q5_carry:
        answers.append(f"**Q5 — What do you carry?**\n{body.q5_carry}")

    if not answers:
        raise HTTPException(400, "At least one provenance answer is required")

    array_pref = f"\n\nPreferred attribute array: {body.attribute_array}" if body.attribute_array else ""
    char_name = f"\nCharacter name: {body.name}" if body.name else ""
    char_concept = f"\nConcept: {body.concept}" if body.concept else ""

    prompt = f"""{srd_context}

---

Create a complete Qamareth character sheet based on the following provenance answers.

{char_concept}{char_name}{array_pref}

## Provenance Answers

{"\n\n".join(answers)}

---

Produce ONLY a JSON object with these keys:
- name (string)
- concept (string)
- attributes (dict of 6 attribute names → die type string)
- disciplines (dict of discipline names → integer dice count 1-5)
- scar_condition (dict with: name, trigger, condition_applied, heightened_access, resolution)
- starting_position (dict with: faction, standing, grimoire_hook)
- drive (string)
- summary (string, 2-3 paragraph narrative backstory)

No markdown, no explanation — just the JSON."""

    openai_msgs = [{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}]

    response = client.chat.completions.create(
        model=MODEL,
        messages=openai_msgs,
        max_tokens=8192,
    )

    content = response.choices[0].message.content

    # Extract JSON from response
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

    try:
        character = json.loads(content)
        return {"status": "ok", "character": character}
    except json.JSONDecodeError:
        return {"status": "ok", "raw": content}
