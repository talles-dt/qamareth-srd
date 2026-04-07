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
from registry.registry import update_registry, load_registry, format_registry_for_context
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


class CharacterCreateRequest(BaseModel):
    """Provenance answers for character creation."""
    concept: str = ""
    q1_inherit: str = ""      # What did you inherit?
    q2_survive: str = ""      # What did you survive?
    q3_master: str = ""       # What did you master?
    q4_denied: str = ""       # What were you denied?
    q5_carry: str = ""        # What do you carry?
    attribute_array: str = "" # "focused", "balanced", or "resilient"
    name: str = ""


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


# ─── Character Creation ───────────────────────────────────────────────────────

@app.post("/character/create/stream")
async def character_create_stream(body: CharacterCreateRequest):
    """Streaming character creation using the First Question agent."""
    system_prompt = build_system_prompt(AGENT_SKILLS["character-creation"])
    registry = load_registry()
    srd_context = format_registry_for_context(registry)

    # Build the character creation prompt from provenance answers
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

Please produce a complete character sheet with the following sections:
1. **Name** (if not provided, suggest one)
2. **Attributes** — die quality for each of the 6 attributes
3. **Disciplines** — Primary (3 dice), Secondary (2 dice), Tertiary (1 die)
4. **Scar Condition** — name, trigger, mechanical effect, heightened access, resolution
5. **Starting Position** — faction standing and grimoire hook
6. **Drive** — the narrative engine
7. **Summary** — 2-3 paragraph narrative backstory

Format the output as structured JSON with these keys:
- name, concept
- attributes (dict of 6 attributes → die type)
- disciplines (dict of discipline → dice count)
- scar_condition (dict with name, trigger, condition_applied, heightened_access, resolution)
- starting_position (dict with faction, standing, grimoire_hook)
- drive (string)
- summary (string)

Include both the JSON block AND the full narrative summary after it."""

    messages = [{"role": "user", "content": prompt}]

    async def stream():
        with client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=8192,
            system=system_prompt,
            messages=messages,
        ) as s:
            for text in s.text_stream:
                yield f"data: {json.dumps({'text': text})}\n\n"
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
- attributes (dict of 6 attribute names → die type string: "d4", "d6", "d8", "d10", or "d12")
- disciplines (dict of discipline names → integer dice count 1-5)
- scar_condition (dict with: name, trigger, condition_applied, heightened_access, resolution — all strings)
- starting_position (dict with: faction, standing, grimoire_hook — all strings)
- drive (string)
- summary (string, 2-3 paragraph narrative backstory)

No markdown, no explanation — just the JSON."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8192,
        system=system_prompt,
        messages=[{"role": "user", "content": prompt}],
    )

    content = response.content[0].text

    # Extract JSON from response (may have markdown code blocks)
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
        # Return raw text if parsing failed
        return {"status": "ok", "raw": content}
