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

ALLOWED = os.getenv("ALLOWED_ORIGIN", "http://localhost:3000")

app = FastAPI(title="Qamareth Agent System")
client = Anthropic()

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
    """Streaming character creation using the First Question agent.
    Takes all 20 answers and produces a complete, mechanically valid character sheet."""
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

    education = body.education or ""
    magic_training = body.magic_training or ""
    musical_tradition = body.musical_tradition or ""
    memory_sound = body.memory_sound or ""

    prompt = f"""{srd_context}

---

You are creating a COMPLETE, PLAYABLE Qamareth character sheet from the 20 Questions answers below.

## Character Sheet Requirements

Produce a JSON with ALL of these sections. Every field must be filled with specific, mechanically meaningful content derived from the narrative answers:

### 1. Identity
- **name**: Suggest a fitting Portuguese name
- **motivo_origem**: Poetic phrase capturing the character's essence (from Q20)
- **regiao**: Region of origin (from Q1)
- **ocupacao_familia**: Family occupation (from Q2)
- **infancia**: Childhood description (from Q3)
- **evento_juventude**: Defining youth event (from Q4)
- **som_memoria**: Strongest memory sound (from Q12)

### 2. Attributes — assign the {body.attribute_array or "balanced"} array (d10/d8/d6/d6/d6/d4 or d8/d8/d6/d6/d6/d6)
- **attributes**: Dict with exactly these 6 keys → die size strings (d4-d12)
  - Forca, Destreza, Ressonancia, Compostura, Agudeza, Firmeza
- Assign based on narrative: primary attribute from Q1 gets highest die, secondary from Q2 gets second-highest, Ressonancia from Q5, etc.
- **attribute_array**: Which array was used

### 3. Disciplines — 10 total starting disciplines
- **disciplines**: Dict of discipline name → dice count (1-5)
- Primary Discipline (from Q6/Q3 answer): 3 dice
- Secondary (thematically related): 2 dice  
- Tertiary: 1 die
- Also include 7 more at 1 die each to reach 10 total, distributed across categories (2 physical, 2 social, 2 mental, 2 magical, 2 academic)
- Include specialization note for the primary

### 4. Ressonância
- **rs**: Calculate from Q9 (0-2), Q10 (0-2), Q11 (+1 if applicable). Range 2-4.
- **theosis_stage**: "Praxis (Iniciante)" for RS 2-3, "Theoria (Aprendiz)" for RS 4-6
- **motif_capacity**: RS // 2 (floor division)

### 5. Scar Condition (from Q2 — "What did you survive?")
- **scar**: Dict with: name, trigger, condition_applied, heightened_access, resolution
- Must have BOTH a downside (condition) AND an upside (heightened access)
- The wound is also the teacher

### 6. Passions (all 8 tracked, 0-10 scale)
- **passions**: List of {{name, level}} for ALL 8 passions:
  Gula, Luxuria, Avareza, Ira, Tristeza, Acedia, Vainagloria, Soberba
- All start at 0. Elevate 2-3 of them to level 2-3 based on Q3 (childhood), Q17 (victory), Q18 (failure)
- Map childhood to a relevant passion, victory to a positive passion, failure to a negative one

### 7. Social Mechanics
- **honra**: 0-5, based on Q1 (inheritance), Q2 (family), Q15 (law broken), Q16 (faction)
- **ip_factions**: List of {{faction, ip}} — at least 1 IP with the faction from Q16
- **faction_standing**: "Aliado", "Observado", or "Marcado" based on Q4
- **grimoire_hook**: "Herdado", "Buscado", or "Negado" based on background

### 8. NPCs & Relationships
- **aliado**: Name and description of ally (from Q14)
- **rival**: Name and description of rival/antagonist (from Q13)
- **lei_quebrada**: Law broken (from Q15)

### 9. Partituras (starting magical scores, from Q7/Q10/Q11)
- **partituras**: List of {{name, mode, effect, rhythm}}
- Formal training (Academia/Templo): 3 partituras
- Fragmented/family: 2 partituras
- No training: 1 intuitive partitura
- Each should have a fitting name, mode (litúrgico, marcial, erudito, natural, popular), effect description, and rhythm

### 10. Combat Motifs
- **combat_motifs**: List of {{name, type, condition, effect}} — at least 1 starting motif
- Types: Offensive, Defensive, Movement, Coordination
- Should match the character's combat style based on their disciplines

### 11. Weapons & Equipment
- **weapons**: List of {{name, tempo, function, speed}}
- Derived from family occupation, region, mentor
- Tempo: "Ligeiro", "Médio", or "Pesado"
- Function: "Controle", "Impacto", or "Alcance"
- Speed: "1", "2", "3", or "4"

### 12. Background
- **motivacao**: Why they keep fighting (from Q19)
- **escola**: School of Formation (from Q5/Q6)
- **summary**: 2-3 paragraph narrative backstory weaving ALL 20 answers into a coherent life story

## Rules
- Derive EVERYTHING from the 20 answers — no random choices
- All mechanics must be internally consistent
- Use Portuguese names for attributes, passions, disciplines as defined in the SRD
- The character must be fully playable — every mechanical field filled

Return ONLY a JSON object. No markdown, no explanation."""

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
