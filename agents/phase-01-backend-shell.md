# Phase 1 — Backend Shell

## What you're building
A FastAPI app on Python 3.11+ that:
- Loads agent skill files from a `/skills` directory
- Streams responses from the Anthropic API via SSE
- Injects an SRD registry snapshot into every agent call
- Has one working endpoint: `POST /chat/stream`

No LangGraph yet. No Redis yet. Just streaming + skill loading.

## Repo to create
`qamareth-agents/`

## Folder structure to create
```
qamareth-agents/
├── main.py
├── requirements.txt
├── railway.toml
├── .env
├── .gitignore
├── graph/
│   ├── __init__.py        ← empty
│   └── nodes.py
├── registry/
│   ├── registry.py
│   └── srd_registry.json
└── skills/
    └── (copy all .md skill files here — see note below)
```

---

## Files to create

### requirements.txt
```
fastapi==0.115.0
uvicorn[standard]==0.30.6
anthropic==0.34.2
python-dotenv==1.0.1
pydantic==2.8.2
```

### .env
```
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
ALLOWED_ORIGIN=http://localhost:3000
```

### .gitignore
```
__pycache__/
*.pyc
.env
.venv/
venv/
```

### railway.toml
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1"
restartPolicyType = "on-failure"
```

---

### registry/srd_registry.json
```json
{
  "_meta": {
    "version": "1.0",
    "last_updated": "2026-01-01T00:00:00Z"
  },
  "rules": [],
  "conditions": [
    {"name": "Desritmado", "subsystem": "combat", "effect": "Next action costs +1 beat", "trigger": "Interrupted action"},
    {"name": "Exposto", "subsystem": "combat", "effect": "Next hit is undefended", "trigger": "Lost reaction or flanked"},
    {"name": "Atordoado", "subsystem": "combat", "effect": "Skip next compasso reaction", "trigger": "Decisive strike"},
    {"name": "Sangrando", "subsystem": "combat", "effect": "Resilience thresholds lower by 1", "trigger": "Specific weapon condition"},
    {"name": "Imobilizado", "subsystem": "combat", "effect": "Cannot change zones", "trigger": "Grapple, terrain, magic"},
    {"name": "Dominado", "subsystem": "combat", "effect": "Opponent has beat 0 option against you", "trigger": "Opponent achieved Dominante"},
    {"name": "Pesado", "subsystem": "combat", "effect": "Beat +1 on all movement", "trigger": "Armor cost or heavy blow"},
    {"name": "Dissonância", "subsystem": "magic", "effect": "+2 beat cost on next execution", "trigger": "Interruption or failure"},
    {"name": "Harmônico", "subsystem": "magic", "effect": "Next collective execution: +1 scale tier", "trigger": "Perfect execution or Transcendência"},
    {"name": "Saturado", "subsystem": "magic", "effect": "Same-discipline executions cost +1 beat until cleared", "trigger": "Rapid successive executions"},
    {"name": "Ressonante", "subsystem": "magic", "effect": "All executions in scene have raised threshold; Transcendências doubled", "trigger": "Scene-wide collective effect"},
    {"name": "Silenciado", "subsystem": "magic+social", "effect": "Cannot use Voice/Instrument disciplines; cannot speak in social scene", "trigger": "Medium destroyed or suppressed; social Broken state"}
  ],
  "disciplines": [
    {"name": "Lâmina", "category": "combat"},
    {"name": "Impacto", "category": "combat"},
    {"name": "Alcance", "category": "combat"},
    {"name": "Defesa", "category": "combat"},
    {"name": "Movimento", "category": "combat"},
    {"name": "Voz", "category": "magic"},
    {"name": "Instrumento", "category": "magic"},
    {"name": "Escrita", "category": "magic"},
    {"name": "Gesto", "category": "magic"},
    {"name": "Coletivo", "category": "magic"},
    {"name": "Retórica", "category": "social"},
    {"name": "Negociação", "category": "social"},
    {"name": "Reputação", "category": "social"},
    {"name": "Intimidação", "category": "social"},
    {"name": "Leitura", "category": "social"},
    {"name": "Grimório", "category": "knowledge"},
    {"name": "Tática", "category": "knowledge"},
    {"name": "História Harmônica", "category": "knowledge"},
    {"name": "Magi-tech", "category": "knowledge"}
  ],
  "attributes": [
    {"name": "Força", "english": "Brawn"},
    {"name": "Destreza", "english": "Finesse"},
    {"name": "Ressonância", "english": "Resonance"},
    {"name": "Compostura", "english": "Composure"},
    {"name": "Agudeza", "english": "Acuity"},
    {"name": "Firmeza", "english": "Grit"}
  ],
  "resilience_states": [
    {"name": "Claro", "english": "Clear"},
    {"name": "Pressionado", "english": "Pressured"},
    {"name": "Comprometido", "english": "Compromised"},
    {"name": "Quebrado", "english": "Broken"}
  ],
  "lore_entities": [],
  "grimoires": [],
  "creatures": [],
  "items": [],
  "factions": [],
  "traditions": []
}
```

---

### registry/registry.py
```python
import json
from pathlib import Path
from datetime import datetime

REGISTRY_PATH = Path(__file__).parent / "srd_registry.json"


def load_registry() -> dict:
    with open(REGISTRY_PATH) as f:
        return json.load(f)


def format_registry_for_context(registry: dict) -> str:
    lines = ["## CURRENT SRD STATE\n"]

    lines.append("\n### Active Conditions")
    for c in registry["conditions"]:
        lines.append(f"- **{c['name']}** ({c['subsystem']}): {c['effect']}")

    lines.append("\n### Disciplines")
    by_cat: dict = {}
    for d in registry["disciplines"]:
        by_cat.setdefault(d["category"], []).append(d["name"])
    for cat, names in by_cat.items():
        lines.append(f"- {cat.title()}: {', '.join(names)}")

    lines.append("\n### Attributes")
    for a in registry["attributes"]:
        lines.append(f"- {a['name']} ({a['english']})")

    if registry["rules"]:
        lines.append("\n### Committed Rules")
        for r in registry["rules"]:
            lines.append(f"- **{r['name']}** [{r['subsystem']}]")

    if registry["lore_entities"]:
        lines.append("\n### Named Lore Entities")
        for e in registry["lore_entities"]:
            lines.append(f"- [{e['type']}] {e['name']}")

    if registry["factions"]:
        lines.append("\n### Factions")
        for f in registry["factions"]:
            lines.append(f"- {f['name']}")

    if registry["grimoires"]:
        lines.append("\n### Grimoires")
        for g in registry["grimoires"]:
            lines.append(f"- {g['name']} [{g['type']}]")

    if registry["creatures"]:
        lines.append("\n### Creatures")
        for c in registry["creatures"]:
            lines.append(f"- {c['name']} [{c['type']}]")

    if registry["items"]:
        lines.append("\n### Items")
        for i in registry["items"]:
            lines.append(f"- {i['name']} [{i['category']}]")

    return "\n".join(lines)


def update_registry(entry_type: str, entry: dict):
    registry = load_registry()
    registry[entry_type].append(entry)
    registry["_meta"]["last_updated"] = datetime.utcnow().isoformat() + "Z"
    with open(REGISTRY_PATH, "w") as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)
```

---

### graph/nodes.py
```python
from pathlib import Path
from anthropic import Anthropic
from registry.registry import load_registry, format_registry_for_context

SKILLS_DIR = Path(__file__).parent.parent / "skills"
client = Anthropic()

SHARED_PROTOCOL = (SKILLS_DIR / "00-shared-protocol.md").read_text()

AGENT_SKILLS = {
    "master-architect":    "00-master-architect.md",
    "lore-master":         "01-lore-master.md",
    "srd-architect":       "02-srd-architect.md",
    "combat-rules":        "03-combat-rules.md",
    "magic-rules":         "04-magic-rules.md",
    "music-grimoires":     "05-music-grimoires.md",
    "character-creation":  "06-character-creation.md",
    "social-systems":      "07-social-systems.md",
    "npc":                 "08-npc.md",
    "monsters":            "09-monsters.md",
    "items":               "10-items.md",
    "uiux":                "11-uiux.md",
    "frontend":            "12-frontend.md",
    "lore-archivist":      "13-lore-archivist.md",
    "theological-auditor": "14-theological-auditor.md",
}


def build_system_prompt(skill_file: str) -> str:
    skill = (SKILLS_DIR / skill_file).read_text()
    return f"{SHARED_PROTOCOL}\n\n---\n\n{skill}"


def inject_registry(messages: list[dict]) -> list[dict]:
    """Prepend SRD state to the first user message."""
    registry = load_registry()
    srd_context = format_registry_for_context(registry)
    if not messages:
        return messages
    messages = list(messages)
    first = messages[0].copy()
    first["content"] = f"{srd_context}\n\n---\n\n{first['content']}"
    return [first] + messages[1:]
```

---

### main.py
```python
import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from anthropic import Anthropic
from graph.nodes import AGENT_SKILLS, build_system_prompt, inject_registry
from registry.registry import update_registry

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

    system_prompt = build_system_prompt(AGENT_SKILLS[body.agent])
    messages = inject_registry(body.messages)

    async def stream():
        with client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=system_prompt,
            messages=messages
        ) as s:
            for text in s.text_stream:
                yield f"data: {json.dumps({'text': text})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
```

---

## Skills files
Copy all `.md` files from the `qamareth-skills/` folder into `qamareth-agents/skills/`.
They must be named exactly:
```
00-shared-protocol.md
00-master-architect.md
01-lore-master.md
02-srd-architect.md
03-combat-rules.md
04-magic-rules.md
05-music-grimoires.md
06-character-creation.md
07-social-systems.md
08-npc.md
09-monsters.md
10-items.md
11-uiux.md
12-frontend.md
13-lore-archivist.md
14-theological-auditor.md
```

---

## How to run locally
```bash
cd qamareth-agents
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Verify it works
```bash
curl -X POST http://localhost:8000/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"agent":"master-architect","messages":[{"role":"user","content":"Hello, what is your role?"}],"orchestrated":false}'
```
You should see `data: {"text": "..."}` lines streaming in the terminal.

## Done when
- `GET /agents` returns all 15 agents
- `POST /chat/stream` streams tokens for any agent
- No errors on startup (all skill files load correctly)
