# Qamareth Agent System — Build Instructions

**Version:** 1.0  
**Stack:** Next.js (Vercel) · FastAPI + LangGraph (Railway) · Redis (Railway) · n8n · Astro SRD (Cloudflare Pages)  
**Audience:** Solo developer (Timon); assumes comfort with Next.js, basic Python, CLI tools

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Repository Setup](#3-repository-setup)
4. [Backend — FastAPI + LangGraph](#4-backend--fastapi--langgraph)
5. [SRD Registry — The Consistency Layer](#5-srd-registry--the-consistency-layer)
6. [Frontend — Next.js UI](#6-frontend--nextjs-ui)
7. [Railway Deployment](#7-railway-deployment)
8. [Vercel Deployment](#8-vercel-deployment)
9. [n8n Lore Ingestion Pipeline](#9-n8n-lore-ingestion-pipeline)
10. [Astro SRD Integration](#10-astro-srd-integration)
11. [Environment Variables Reference](#11-environment-variables-reference)
12. [Build Order](#12-build-order)
13. [File Listing — Complete](#13-file-listing--complete)

---

## 1. Overview

The Qamareth system has four distinct runtime components:

```
qamareth-agents/          Python backend — FastAPI + LangGraph (Railway)
qamareth-agent-ui/        Next.js frontend — chat + task UI (Vercel)
qamareth-srd/             Astro SRD web app (Cloudflare Pages) [existing]
n8n instance              Lore ingestion pipeline (Railway or existing)
```

**Data flow:**

```
You (browser)
  → Next.js UI
    → /api/proxy/* (thin Next.js route handler)
      → FastAPI on Railway
        → LangGraph (agents with skill files)
          → Anthropic API
        → Redis (job queue for batch tasks)
  
n8n (batch jobs)
  → FastAPI /task/* endpoint
  → Commits MDX stubs → qamareth-srd GitHub repo
  → Cloudflare Pages rebuilds SRD automatically

SRD Registry (srd_registry.json)
  → Lives in qamareth-agents/
  → Read by all agents at start of every task
  → Updated after validated output is committed
```

---

## 2. Prerequisites

Install these before starting:

```bash
# Python 3.11+
python --version

# Node.js 20+
node --version

# Railway CLI
npm install -g @railway/cli
railway login

# Vercel CLI
npm install -g vercel
vercel login

# Git
git --version
```

Accounts needed:
- **Anthropic** — API key with access to claude-sonnet-4-20250514
- **Railway** — railway.app (free tier works; $5/month for persistent Redis)
- **Vercel** — vercel.com (free tier sufficient for personal tool)
- **GitHub** — for both repos + Cloudflare Pages integration

---

## 3. Repository Setup

### 3.1 Create both repos

```bash
# Backend
mkdir qamareth-agents && cd qamareth-agents
git init
gh repo create qamareth-agents --private

# Frontend
mkdir qamareth-agent-ui && cd qamareth-agent-ui
git init
gh repo create qamareth-agent-ui --private
```

### 3.2 Backend folder structure

Create this structure inside `qamareth-agents/`:

```
qamareth-agents/
├── main.py
├── requirements.txt
├── railway.toml
├── .env.example
├── .gitignore
├── graph/
│   ├── __init__.py
│   ├── state.py
│   ├── nodes.py
│   ├── routing.py
│   └── builder.py
├── skills/
│   ├── 00-shared-protocol.md
│   ├── 00-master-architect.md
│   ├── 01-lore-master.md
│   ├── 02-srd-architect.md
│   ├── 03-combat-rules.md
│   ├── 04-magic-rules.md
│   ├── 05-music-grimoires.md
│   ├── 06-character-creation.md
│   ├── 07-social-systems.md
│   ├── 08-npc.md
│   ├── 09-monsters.md
│   ├── 10-items.md
│   ├── 11-uiux.md
│   ├── 12-frontend.md
│   ├── 13-lore-archivist.md
│   └── 14-theological-auditor.md
├── registry/
│   ├── srd_registry.json
│   └── registry.py
├── tasks/
│   ├── __init__.py
│   ├── lore_ingest.py
│   └── audit.py
└── jobs.py
```

### 3.3 Frontend folder structure

Create this inside `qamareth-agent-ui/`:

```
qamareth-agent-ui/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env.local.example
├── .gitignore
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    ← redirects to /chat
│   ├── chat/
│   │   └── page.tsx
│   ├── tasks/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   └── api/
│       └── proxy/
│           └── [...path]/
│               └── route.ts        ← catches all /api/proxy/* requests
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── AgentSelector.tsx
│   │   └── StreamingMessage.tsx
│   ├── tasks/
│   │   ├── TaskForm.tsx
│   │   ├── TaskCard.tsx
│   │   └── TaskResult.tsx
│   └── shared/
│       ├── AgentBadge.tsx
│       ├── Sidebar.tsx
│       └── MDXPreview.tsx
└── lib/
    ├── api.ts
    └── types.ts
```

---

## 4. Backend — FastAPI + LangGraph

### 4.1 requirements.txt

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
langgraph==0.2.28
langchain-anthropic==0.2.4
anthropic==0.34.2
redis==5.0.8
python-multipart==0.0.12
python-dotenv==1.0.1
pydantic==2.8.2
httpx==0.27.2
```

### 4.2 graph/state.py

```python
from typing import TypedDict, Annotated, Optional
from langgraph.graph.message import add_messages


class QamarethState(TypedDict):
    # Conversation history — LangGraph manages appending
    messages: Annotated[list, add_messages]

    # Routing
    active_agent: str          # current agent node name
    task_type: str             # "chat" | "lore_ingest" | "audit" | "rule_design"

    # Work product
    work_product: str          # MDX/rule text being built up
    work_product_type: str     # "rule" | "lore" | "creature" | "item" | "grimoire"

    # Cross-agent flags
    mechanical_flags: list[str]
    lore_flags: list[str]
    audit_flags: list[str]
    routing_flags: list[str]   # raw routing instructions from agent output

    # Registry
    srd_context: str           # formatted registry snapshot injected at start

    # Control
    validated: bool            # Master Architect sign-off
    iteration_count: int       # prevent infinite loops
    error: Optional[str]
```

### 4.3 registry/srd_registry.json

This is the seed file. It starts mostly empty and grows as content is committed.

```json
{
  "_meta": {
    "version": "1.0",
    "last_updated": "2026-01-01T00:00:00Z",
    "description": "Live index of committed Qamareth SRD content"
  },
  "rules": [],
  "conditions": [
    {
      "name": "Desritmado",
      "subsystem": "combat",
      "effect": "Next action costs +1 beat",
      "trigger": "Interrupted action"
    },
    {
      "name": "Exposto",
      "subsystem": "combat",
      "effect": "Next hit is undefended",
      "trigger": "Lost reaction, flanked"
    },
    {
      "name": "Atordoado",
      "subsystem": "combat",
      "effect": "Skip next compasso reaction",
      "trigger": "Decisive strike"
    },
    {
      "name": "Sangrando",
      "subsystem": "combat",
      "effect": "Resilience thresholds lower by 1",
      "trigger": "Specific weapon condition"
    },
    {
      "name": "Imobilizado",
      "subsystem": "combat",
      "effect": "Cannot change zones",
      "trigger": "Grapple, terrain, magic"
    },
    {
      "name": "Dominado",
      "subsystem": "combat",
      "effect": "Opponent has beat 0 option against you",
      "trigger": "Opponent achieved Dominante state"
    },
    {
      "name": "Pesado",
      "subsystem": "combat",
      "effect": "Beat +1 on all movement",
      "trigger": "Armor cost, heavy blow landed"
    },
    {
      "name": "Dissonância",
      "subsystem": "magic",
      "effect": "+2 beat cost on next execution",
      "trigger": "Interruption or execution failure"
    },
    {
      "name": "Harmônico",
      "subsystem": "magic",
      "effect": "Next collective execution: +1 scale tier",
      "trigger": "Perfect execution or Transcendência"
    },
    {
      "name": "Saturado",
      "subsystem": "magic",
      "effect": "Same-discipline executions cost +1 beat until cleared",
      "trigger": "Too many executions in rapid succession"
    },
    {
      "name": "Ressonante",
      "subsystem": "magic",
      "effect": "All executions in scene have raised threshold; Transcendências doubled",
      "trigger": "Scene-wide collective effect ongoing"
    },
    {
      "name": "Silenciado",
      "subsystem": "magic+social",
      "effect": "Cannot use Voice or Instrument disciplines; cannot speak in social scene",
      "trigger": "Medium destroyed or suppressed; social Broken state"
    }
  ],
  "disciplines": [
    {"name": "Lâmina", "category": "combat", "governs": "bladed weapons technique"},
    {"name": "Impacto", "category": "combat", "governs": "blunt, heavy, percussive weapons"},
    {"name": "Alcance", "category": "combat", "governs": "ranged and zone-control"},
    {"name": "Defesa", "category": "combat", "governs": "active defense, reaction economy"},
    {"name": "Movimento", "category": "combat", "governs": "repositioning, zone manipulation"},
    {"name": "Voz", "category": "magic", "governs": "voice-based magical execution"},
    {"name": "Instrumento", "category": "magic", "governs": "instrument-based execution"},
    {"name": "Escrita", "category": "magic", "governs": "notation-based execution"},
    {"name": "Gesto", "category": "magic", "governs": "somatic execution"},
    {"name": "Coletivo", "category": "magic", "governs": "collective amplification"},
    {"name": "Retórica", "category": "social", "governs": "argument, persuasion, public performance"},
    {"name": "Negociação", "category": "social", "governs": "deal-making, leverage"},
    {"name": "Reputação", "category": "social", "governs": "faction standing mechanics"},
    {"name": "Intimidação", "category": "social", "governs": "pressure, dominance"},
    {"name": "Leitura", "category": "social", "governs": "reading a person, situation, or room"},
    {"name": "Grimório", "category": "knowledge", "governs": "grimoire reading and reconstruction"},
    {"name": "Tática", "category": "knowledge", "governs": "battlefield and strategic analysis"},
    {"name": "História Harmônica", "category": "knowledge", "governs": "lost traditions, political history of music"},
    {"name": "Magi-tech", "category": "knowledge", "governs": "operating magi-tech devices"}
  ],
  "attributes": [
    {"name": "Força", "english": "Brawn", "governs": "physical power, endurance"},
    {"name": "Destreza", "english": "Finesse", "governs": "speed, precision"},
    {"name": "Ressonância", "english": "Resonance", "governs": "harmonic sensitivity, magical capacity"},
    {"name": "Compostura", "english": "Composure", "governs": "social presence, performance under pressure"},
    {"name": "Agudeza", "english": "Acuity", "governs": "analysis, pattern recognition"},
    {"name": "Firmeza", "english": "Grit", "governs": "resistance to conditions, persistence"}
  ],
  "resilience_states": [
    {"name": "Claro", "english": "Clear", "effect": "Full action set"},
    {"name": "Pressionado", "english": "Pressured", "effect": "1-2 conditions; heavy actions +1 beat"},
    {"name": "Comprometido", "english": "Compromised", "effect": "3+ conditions; reaction reduced to 0"},
    {"name": "Quebrado", "english": "Broken", "effect": "Scene-ending; cannot continue without break"}
  ],
  "lore_entities": [],
  "grimoires": [],
  "creatures": [],
  "items": [],
  "factions": [],
  "traditions": []
}
```

### 4.4 registry/registry.py

```python
import json
from pathlib import Path
from datetime import datetime

REGISTRY_PATH = Path(__file__).parent / "srd_registry.json"


def load_registry() -> dict:
    with open(REGISTRY_PATH) as f:
        return json.load(f)


def format_registry_for_context(registry: dict) -> str:
    """
    Formats registry as a compact, readable string for injection
    into agent system prompts. Keeps it under ~2000 tokens.
    """
    lines = ["## CURRENT SRD STATE\n"]
    lines.append(f"*Last updated: {registry['_meta']['last_updated']}*\n")

    # Conditions (most important for consistency)
    lines.append("\n### Active Conditions")
    for c in registry["conditions"]:
        lines.append(f"- **{c['name']}** ({c['subsystem']}): {c['effect']}")

    # Disciplines
    lines.append("\n### Disciplines")
    by_cat = {}
    for d in registry["disciplines"]:
        by_cat.setdefault(d["category"], []).append(d["name"])
    for cat, names in by_cat.items():
        lines.append(f"- {cat.title()}: {', '.join(names)}")

    # Attributes
    lines.append("\n### Attributes")
    for a in registry["attributes"]:
        lines.append(f"- {a['name']} ({a['english']}): {a['governs']}")

    # Rules (if any)
    if registry["rules"]:
        lines.append("\n### Committed Rules")
        for r in registry["rules"]:
            lines.append(
                f"- **{r['name']}** [{r['subsystem']}]: "
                f"beat cost {r.get('beat_cost','?')}, "
                f"conditions: {', '.join(r.get('conditions_created', []))}"
            )

    # Lore entities summary
    if registry["lore_entities"]:
        lines.append("\n### Lore Entities (named)")
        for e in registry["lore_entities"]:
            lines.append(f"- [{e['type']}] {e['name']}")

    # Factions
    if registry["factions"]:
        lines.append("\n### Factions")
        for f in registry["factions"]:
            lines.append(f"- {f['name']} ({f['status']})")

    # Grimoires
    if registry["grimoires"]:
        lines.append("\n### Grimoires")
        for g in registry["grimoires"]:
            lines.append(f"- {g['name']} [{g['type']}] — {g['tradition']}")

    # Creatures
    if registry["creatures"]:
        lines.append("\n### Creatures")
        for c in registry["creatures"]:
            lines.append(f"- {c['name']} [{c['type']}]")

    # Items
    if registry["items"]:
        lines.append("\n### Items")
        for i in registry["items"]:
            lines.append(f"- {i['name']} [{i['category']}]")

    return "\n".join(lines)


def update_registry(entry_type: str, entry: dict):
    """Append a validated entry to the registry."""
    registry = load_registry()
    registry[entry_type].append(entry)
    registry["_meta"]["last_updated"] = datetime.utcnow().isoformat() + "Z"
    with open(REGISTRY_PATH, "w") as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)
```

### 4.5 graph/nodes.py

```python
from pathlib import Path
from anthropic import Anthropic
from graph.state import QamarethState
from registry.registry import load_registry, format_registry_for_context

SKILLS_DIR = Path(__file__).parent.parent / "skills"
client = Anthropic()

SHARED_PROTOCOL = (SKILLS_DIR / "00-shared-protocol.md").read_text()


def load_skill(filename: str) -> str:
    return (SKILLS_DIR / filename).read_text()


def build_system_prompt(skill_file: str) -> str:
    """Prepend shared protocol to every agent's skill file."""
    skill = load_skill(skill_file)
    return f"{SHARED_PROTOCOL}\n\n---\n\n{skill}"


def make_agent_node(skill_file: str):
    """
    Factory function. Returns a LangGraph node that:
    1. Injects current SRD registry into context
    2. Runs the agent with shared protocol + skill file
    3. Returns updated state
    """
    system_prompt = build_system_prompt(skill_file)

    def node(state: QamarethState) -> dict:
        # Always inject fresh registry context
        registry = load_registry()
        srd_context = format_registry_for_context(registry)

        # Build messages: inject registry as first user message context
        messages = state["messages"]
        if messages and messages[0]["role"] == "user":
            # Prepend registry to the first user message content
            first = messages[0].copy()
            first["content"] = f"{srd_context}\n\n---\n\n{first['content']}"
            messages = [first] + list(messages[1:])

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=system_prompt,
            messages=messages
        )

        content = response.content[0].text

        return {
            "messages": [{"role": "assistant", "content": content}],
            "iteration_count": state.get("iteration_count", 0) + 1
        }

    return node


# Instantiate all agent nodes
master_architect_node   = make_agent_node("00-master-architect.md")
lore_master_node        = make_agent_node("01-lore-master.md")
srd_architect_node      = make_agent_node("02-srd-architect.md")
combat_rules_node       = make_agent_node("03-combat-rules.md")
magic_rules_node        = make_agent_node("04-magic-rules.md")
music_grimoires_node    = make_agent_node("05-music-grimoires.md")
character_creation_node = make_agent_node("06-character-creation.md")
social_systems_node     = make_agent_node("07-social-systems.md")
npc_node                = make_agent_node("08-npc.md")
monsters_node           = make_agent_node("09-monsters.md")
items_node              = make_agent_node("10-items.md")
uiux_node               = make_agent_node("11-uiux.md")
frontend_node           = make_agent_node("12-frontend.md")
lore_archivist_node     = make_agent_node("13-lore-archivist.md")
theological_auditor_node = make_agent_node("14-theological-auditor.md")
```

### 4.6 graph/routing.py

```python
from langgraph.graph import END
from graph.state import QamarethState

MAX_ITERATIONS = 10

# Map agent names (as decided by Master Architect) to node names
AGENT_MAP = {
    "lore-master":          "lore_master",
    "srd-architect":        "srd_architect",
    "combat-rules":         "combat_rules",
    "magic-rules":          "magic_rules",
    "music-grimoires":      "music_grimoires",
    "character-creation":   "character_creation",
    "social-systems":       "social_systems",
    "npc":                  "npc",
    "monsters":             "monsters",
    "items":                "items",
    "uiux":                 "uiux",
    "frontend":             "frontend",
    "lore-archivist":       "lore_archivist",
    "theological-auditor":  "theological_auditor",
}


def route_from_architect(state: QamarethState) -> str:
    """
    Reads the Master Architect's last message and routes to the
    appropriate sub-agent, or ends if validated.
    """
    if state.get("validated"):
        return END

    if state.get("iteration_count", 0) >= MAX_ITERATIONS:
        return END

    last_message = state["messages"][-1]["content"]

    # Simple routing: look for routing flags in architect output
    for agent_key, node_name in AGENT_MAP.items():
        if f"→ {agent_key}" in last_message.lower() or \
           agent_key in last_message.lower():
            return node_name

    # No routing flag found — architect is responding directly (chat mode)
    return END


def route_from_subagent(state: QamarethState) -> str:
    """
    After a sub-agent runs, always return to Master Architect
    for validation, unless iteration limit hit.
    """
    if state.get("iteration_count", 0) >= MAX_ITERATIONS:
        return END
    return "master_architect"
```

### 4.7 graph/builder.py

```python
from langgraph.graph import StateGraph, END
from graph.state import QamarethState
from graph.nodes import (
    master_architect_node, lore_master_node, srd_architect_node,
    combat_rules_node, magic_rules_node, music_grimoires_node,
    character_creation_node, social_systems_node, npc_node,
    monsters_node, items_node, uiux_node, frontend_node,
    lore_archivist_node, theological_auditor_node
)
from graph.routing import route_from_architect, route_from_subagent


def build_graph():
    g = StateGraph(QamarethState)

    # Register all nodes
    g.add_node("master_architect",    master_architect_node)
    g.add_node("lore_master",         lore_master_node)
    g.add_node("srd_architect",       srd_architect_node)
    g.add_node("combat_rules",        combat_rules_node)
    g.add_node("magic_rules",         magic_rules_node)
    g.add_node("music_grimoires",     music_grimoires_node)
    g.add_node("character_creation",  character_creation_node)
    g.add_node("social_systems",      social_systems_node)
    g.add_node("npc",                 npc_node)
    g.add_node("monsters",            monsters_node)
    g.add_node("items",               items_node)
    g.add_node("uiux",                uiux_node)
    g.add_node("frontend",            frontend_node)
    g.add_node("lore_archivist",      lore_archivist_node)
    g.add_node("theological_auditor", theological_auditor_node)

    # Entry point
    g.set_entry_point("master_architect")

    # Architect routes to sub-agents conditionally
    g.add_conditional_edges("master_architect", route_from_architect, {
        "lore_master":         "lore_master",
        "srd_architect":       "srd_architect",
        "combat_rules":        "combat_rules",
        "magic_rules":         "magic_rules",
        "music_grimoires":     "music_grimoires",
        "character_creation":  "character_creation",
        "social_systems":      "social_systems",
        "npc":                 "npc",
        "monsters":            "monsters",
        "items":               "items",
        "uiux":                "uiux",
        "frontend":            "frontend",
        "lore_archivist":      "lore_archivist",
        "theological_auditor": "theological_auditor",
        END:                   END,
    })

    # All sub-agents return to architect
    sub_agents = [
        "lore_master", "srd_architect", "combat_rules", "magic_rules",
        "music_grimoires", "character_creation", "social_systems",
        "npc", "monsters", "items", "uiux", "frontend",
        "lore_archivist", "theological_auditor"
    ]
    for agent in sub_agents:
        g.add_conditional_edges(agent, route_from_subagent, {
            "master_architect": "master_architect",
            END: END
        })

    return g.compile()


# Singleton — import this in main.py
qamareth_graph = build_graph()
```

### 4.8 jobs.py

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
        "status":     "queued",
        "task_type":  task_type,
        "payload":    json.dumps(payload),
        "created_at": datetime.utcnow().isoformat(),
        "result":     "",
        "error":      ""
    })
    r.lpush("job_queue", job_id)
    return job_id


def get_job(job_id: str) -> dict:
    return r.hgetall(f"job:{job_id}")


def update_job(job_id: str, **kwargs):
    r.hset(f"job:{job_id}", mapping=kwargs)


def list_jobs(limit: int = 20) -> list[dict]:
    keys = r.keys("job:*")
    jobs = []
    for key in keys[:limit]:
        job = r.hgetall(key)
        job["id"] = key.split(":")[1]
        jobs.append(job)
    return sorted(jobs, key=lambda j: j.get("created_at", ""), reverse=True)
```

### 4.9 main.py

```python
import os
import json
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from anthropic import Anthropic

from graph.builder import qamareth_graph
from graph.nodes import build_system_prompt, SKILLS_DIR
from registry.registry import load_registry, format_registry_for_context, update_registry
from jobs import submit_job, get_job, update_job, list_jobs

load_dotenv()

client = Anthropic()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    print("Qamareth Agent System starting...")
    yield
    print("Shutting down.")


app = FastAPI(title="Qamareth Agent System", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("ALLOWED_ORIGIN", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Agent → skill file map (for direct single-agent chat)
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


# ─── Models ────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    agent: str
    messages: list[dict]
    orchestrated: bool = False   # if True, run full LangGraph; if False, direct call


# ─── Chat endpoints ─────────────────────────────────────────────────────────

@app.post("/chat/stream")
async def chat_stream(body: ChatRequest):
    """
    SSE streaming endpoint.
    orchestrated=False → direct single-agent call (faster, simpler)
    orchestrated=True  → full LangGraph (Master Architect routes)
    """
    if body.agent not in AGENT_SKILLS and not body.orchestrated:
        raise HTTPException(400, f"Unknown agent: {body.agent}")

    registry = load_registry()
    srd_context = format_registry_for_context(registry)

    if body.orchestrated:
        # LangGraph path — stream final output
        async def graph_stream():
            initial_state = {
                "messages": body.messages,
                "active_agent": "master_architect",
                "task_type": "chat",
                "work_product": "",
                "work_product_type": "",
                "mechanical_flags": [],
                "lore_flags": [],
                "audit_flags": [],
                "routing_flags": [],
                "srd_context": srd_context,
                "validated": False,
                "iteration_count": 0,
                "error": None
            }
            result = await asyncio.get_event_loop().run_in_executor(
                None, lambda: qamareth_graph.invoke(initial_state)
            )
            final = result["messages"][-1]["content"]
            # Stream word by word (graph result is complete, simulate streaming)
            for word in final.split(" "):
                yield f"data: {json.dumps({'text': word + ' '})}\n\n"
                await asyncio.sleep(0.01)
            yield "data: [DONE]\n\n"

        return StreamingResponse(graph_stream(), media_type="text/event-stream")

    else:
        # Direct single-agent path — true streaming via Anthropic SDK
        skill_file = AGENT_SKILLS[body.agent]
        system_prompt = build_system_prompt(skill_file)

        # Inject SRD context into first user message
        messages = list(body.messages)
        if messages and messages[0]["role"] == "user":
            first = messages[0].copy()
            first["content"] = f"{srd_context}\n\n---\n\n{first['content']}"
            messages = [first] + messages[1:]

        async def direct_stream():
            with client.messages.stream(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                system=system_prompt,
                messages=messages
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(direct_stream(), media_type="text/event-stream")


# ─── Task endpoints ──────────────────────────────────────────────────────────

@app.post("/task/submit")
async def task_submit(
    task_type: str = Form(...),
    file: UploadFile = File(None),
    payload_json: str = Form("{}")
):
    payload = json.loads(payload_json)
    if file:
        content = await file.read()
        payload["file_content"] = content.decode("utf-8", errors="replace")
        payload["filename"] = file.filename

    job_id = submit_job(task_type, payload)

    # Kick off async background processing
    asyncio.create_task(process_job(job_id, task_type, payload))

    return {"job_id": job_id, "status": "queued"}


async def process_job(job_id: str, task_type: str, payload: dict):
    """Background job processor."""
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

        update_job(job_id, status="complete", result=json.dumps(result))
    except Exception as e:
        update_job(job_id, status="failed", error=str(e))


@app.get("/task/{job_id}")
async def task_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@app.get("/tasks")
async def task_list():
    return list_jobs()


# ─── Registry endpoints ──────────────────────────────────────────────────────

@app.get("/registry")
async def get_registry():
    return load_registry()


@app.post("/registry/{entry_type}")
async def add_registry_entry(entry_type: str, entry: dict):
    """Add a validated entry to the SRD registry."""
    valid_types = [
        "rules", "conditions", "lore_entities", "grimoires",
        "creatures", "items", "factions", "traditions"
    ]
    if entry_type not in valid_types:
        raise HTTPException(400, f"Invalid entry type: {entry_type}")
    update_registry(entry_type, entry)
    return {"status": "ok", "entry_type": entry_type}


# ─── Agent manifest ──────────────────────────────────────────────────────────

@app.get("/agents")
async def get_agents():
    return [
        {"id": k, "skill_file": v, "label": k.replace("-", " ").title()}
        for k, v in AGENT_SKILLS.items()
    ]
```

---

## 5. SRD Registry — The Consistency Layer

### How it works

Every agent node calls `load_registry()` at the start of its execution and receives a formatted snapshot of all committed SRD content. This snapshot is injected into the agent's context alongside the user's message, *before* the agent produces any output.

The shared protocol (prepended to every agent's system prompt) instructs agents to:
1. Run a consistency check against the registry
2. Declare conflicts before proceeding
3. Never redefine an existing condition, discipline, or attribute

### Updating the registry

After you review and approve an agent's output in the UI, click **"Commit to Registry"** (implemented in the Task Result component). This calls `POST /registry/{entry_type}` and adds the entry to `srd_registry.json`.

The registry file lives in the repo. Commit it to git periodically so the history is preserved.

### Registry entry shapes (quick reference)

```json
// Rule
{"name": "Deflection Reaction", "subsystem": "combat",
 "beat_cost": "0", "conditions_created": ["Exposto"], "conditions_required": []}

// Lore entity
{"name": "The Restored Choir", "type": "faction", "visibility": "public"}

// Grimoire
{"name": "Cantos do Vazio", "type": "fragmento",
 "tradition": "Pre-Consolidation vocal tradition", "imperial_status": "banned"}

// Creature
{"name": "Eco Corrompido", "type": "corrompido",
 "rhythm_disruption": "Harmonic Interference"}

// Item
{"name": "Lâmina do Compasso", "category": "weapon",
 "tempo_class": "medio", "tradition_origin": "Restored Choir"}
```

---

## 6. Frontend — Next.js UI

### 6.1 package.json

```json
{
  "name": "qamareth-agent-ui",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-markdown": "^9.0.1",
    "@tailwindcss/typography": "^0.5.15"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^19",
    "tailwindcss": "^3.4.0",
    "postcss": "^8",
    "autoprefixer": "^10"
  }
}
```

### 6.2 lib/types.ts

```typescript
export type AgentId =
  | "master-architect" | "lore-master" | "srd-architect"
  | "combat-rules" | "magic-rules" | "music-grimoires"
  | "character-creation" | "social-systems" | "npc"
  | "monsters" | "items" | "uiux" | "frontend"
  | "lore-archivist" | "theological-auditor"

export interface Agent {
  id: AgentId
  label: string
  skill_file: string
}

export interface Message {
  role: "user" | "assistant"
  content: string
  agent?: AgentId
  timestamp?: string
}

export interface Job {
  id: string
  status: "queued" | "running" | "complete" | "failed"
  task_type: string
  created_at: string
  result?: string
  error?: string
}

export type TaskType = "lore_ingest" | "audit"
```

### 6.3 lib/api.ts

```typescript
const API_BASE = "/api/proxy"

export async function streamChat(
  agent: string,
  messages: Message[],
  orchestrated: boolean,
  onChunk: (text: string) => void,
  onDone: () => void
) {
  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent, messages, orchestrated })
  })

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value)
    for (const line of chunk.split("\n\n")) {
      if (!line.startsWith("data:")) continue
      const data = line.slice(5).trim()
      if (data === "[DONE]") { onDone(); return }
      try {
        const { text } = JSON.parse(data)
        onChunk(text)
      } catch {}
    }
  }
  onDone()
}

export async function submitTask(
  taskType: TaskType,
  file?: File,
  payload: Record<string, unknown> = {}
): Promise<{ job_id: string }> {
  const form = new FormData()
  form.append("task_type", taskType)
  form.append("payload_json", JSON.stringify(payload))
  if (file) form.append("file", file)

  const res = await fetch(`${API_BASE}/task/submit`, {
    method: "POST",
    body: form
  })
  return res.json()
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await fetch(`${API_BASE}/task/${jobId}`)
  return res.json()
}

export async function listJobs(): Promise<Job[]> {
  const res = await fetch(`${API_BASE}/tasks`)
  return res.json()
}

export async function commitToRegistry(
  entryType: string,
  entry: Record<string, unknown>
) {
  const res = await fetch(`${API_BASE}/registry/${entryType}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry)
  })
  return res.json()
}
```

### 6.4 app/api/proxy/[...path]/route.ts

```typescript
import { NextRequest } from "next/server"

const BACKEND = process.env.BACKEND_URL!

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join("/")
  const url = `${BACKEND}/${path}${req.nextUrl.search}`
  const res = await fetch(url)
  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" }
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join("/")
  const url = `${BACKEND}/${path}`
  const contentType = req.headers.get("content-type") || ""
  const body = contentType.includes("multipart")
    ? await req.formData()
    : await req.text()

  const res = await fetch(url, {
    method: "POST",
    headers: contentType.includes("multipart")
      ? {}
      : { "Content-Type": contentType },
    body: body as BodyInit
  })

  // Pass SSE through unchanged
  if (res.headers.get("content-type")?.includes("text/event-stream")) {
    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    })
  }

  return new Response(res.body, { status: res.status })
}
```

### 6.5 app/chat/page.tsx

```typescript
"use client"
import { useState, useRef, useEffect } from "react"
import { streamChat } from "@/lib/api"
import type { Message, AgentId } from "@/lib/types"

const AGENTS = [
  { id: "master-architect",    label: "Master Architect"    },
  { id: "lore-master",         label: "Lore Master"         },
  { id: "lore-archivist",      label: "Lore Archivist"      },
  { id: "srd-architect",       label: "SRD Architect"       },
  { id: "combat-rules",        label: "Combat Rules"        },
  { id: "magic-rules",         label: "Magic Rules"         },
  { id: "music-grimoires",     label: "Music Grimoires"     },
  { id: "character-creation",  label: "Character Creation"  },
  { id: "social-systems",      label: "Social Systems"      },
  { id: "npc",                 label: "NPC"                 },
  { id: "monsters",            label: "Monsters"            },
  { id: "items",               label: "Items"               },
  { id: "uiux",                label: "UI/UX"               },
  { id: "frontend",            label: "Frontend"            },
  { id: "theological-auditor", label: "Theological Auditor" },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [agent, setAgent] = useState<AgentId>("master-architect")
  const [orchestrated, setOrchestrated] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamBuffer])

  async function send() {
    if (!input.trim() || streaming) return
    const userMsg: Message = { role: "user", content: input, timestamp: new Date().toISOString() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput("")
    setStreaming(true)
    setStreamBuffer("")

    let buffer = ""
    await streamChat(
      agent,
      next.map(m => ({ role: m.role, content: m.content })),
      orchestrated,
      (chunk) => { buffer += chunk; setStreamBuffer(buffer) },
      () => {
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: buffer, agent, timestamp: new Date().toISOString() }
        ])
        setStreamBuffer("")
        setStreaming(false)
      }
    )
  }

  return (
    <div className="flex flex-col h-screen bg-ink text-parchment">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border">
        <span className="font-mono text-xs text-marginalia">AGENT</span>
        <select
          value={agent}
          onChange={e => setAgent(e.target.value as AgentId)}
          className="bg-surface-alt border border-border text-parchment font-mono text-sm px-3 py-1"
        >
          {AGENTS.map(a => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs font-mono text-marginalia ml-auto">
          <input
            type="checkbox"
            checked={orchestrated}
            onChange={e => setOrchestrated(e.target.checked)}
            className="accent-steel"
          />
          ORCHESTRATED
        </label>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-3xl px-4 py-3 text-sm leading-relaxed font-body
              ${m.role === "user"
                ? "bg-surface-alt border border-border text-parchment"
                : "bg-surface border-l-2 border-steel text-parchment"
              }`}>
              {m.role === "assistant" && m.agent && (
                <div className="text-xs font-mono text-steel mb-2 uppercase tracking-wider">
                  {m.agent}
                </div>
              )}
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          </div>
        ))}

        {/* Streaming message */}
        {streaming && streamBuffer && (
          <div className="flex justify-start">
            <div className="max-w-3xl px-4 py-3 text-sm bg-surface border-l-2 border-steel">
              <div className="text-xs font-mono text-steel mb-2 uppercase tracking-wider">
                {agent} <span className="animate-pulse">▋</span>
              </div>
              <div className="whitespace-pre-wrap">{streamBuffer}</div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-6 py-4 flex gap-3">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Design, ask, or task an agent..."
          rows={3}
          className="flex-1 bg-surface-alt border border-border text-parchment
                     font-body text-sm px-4 py-2 resize-none focus:outline-none
                     focus:border-steel placeholder:text-marginalia"
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="px-6 py-2 bg-steel text-ink font-mono text-sm
                     disabled:opacity-40 disabled:cursor-not-allowed
                     hover:bg-parchment transition-colors"
        >
          SEND
        </button>
      </div>
    </div>
  )
}
```

---

## 7. Railway Deployment

### 7.1 railway.toml

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1"
restartPolicyType = "on-failure"
restartPolicyMaxRetries = 3
```

### 7.2 Deploy steps

```bash
cd qamareth-agents

# Initialize Railway project
railway init

# Add Redis service in Railway dashboard:
# New Service → Database → Redis
# Railway auto-injects REDIS_URL

# Set environment variables
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set ALLOWED_ORIGIN=https://your-vercel-url.vercel.app

# Deploy
railway up

# Get your deployment URL
railway domain
# → https://qamareth-agents-production.up.railway.app
```

### 7.3 .gitignore (backend)

```
__pycache__/
*.pyc
.env
.venv/
venv/
*.egg-info/
dist/
```

---

## 8. Vercel Deployment

```bash
cd qamareth-agent-ui

# Set environment variable
# In Vercel dashboard → Project Settings → Environment Variables:
# BACKEND_URL = https://your-railway-url.up.railway.app

vercel deploy --prod
```

### next.config.ts

```typescript
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // No rewrites needed — proxy is handled by /api/proxy route handler
}

export default nextConfig
```

### tailwind.config.ts

```typescript
import type { Config } from "tailwindcss"

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink:            "#0D0F14",
        surface:        "#141820",
        "surface-alt":  "#1C2230",
        border:         "#2A3348",
        brass:          "#C8973A",
        steel:          "#7B9DB4",
        crimson:        "#8B3A3A",
        grove:          "#4A7C59",
        parchment:      "#E8DCC8",
        "parchment-dim":"#9A8E7C",
        marginalia:     "#5A5248",
      },
      fontFamily: {
        display: ["Cormorant Garamond", "serif"],
        body:    ["IBM Plex Serif", "serif"],
        mono:    ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config
```

---

## 9. n8n Lore Ingestion Pipeline

### Workflow structure

```
Manual Trigger / Schedule
  → HTTP Request: POST /task/submit (multipart, task_type=lore_ingest, file=lore.pdf)
  → Set: job_id from response
  → Wait 5s
  → Loop:
      HTTP Request: GET /task/{job_id}
      IF status == "complete" → continue
      IF status == "failed"   → Slack/notify
      ELSE wait 10s, loop
  → Code node: parse result JSON, extract MDX stubs
  → Loop over stubs:
      GitHub node: Create/update file in qamareth-srd/src/content/[type]/[slug].mdx
  → HTTP Request: POST /registry/lore_entities (for each extracted entity)
```

### tasks/lore_ingest.py (backend handler)

```python
import asyncio
from anthropic import Anthropic
from graph.nodes import build_system_prompt
from registry.registry import load_registry, format_registry_for_context

client = Anthropic()


async def run_lore_ingest(payload: dict) -> dict:
    """
    Runs the four-pass Lore Archivist protocol on the provided document.
    Returns structured MDX stubs and mechanical flags.
    """
    file_content = payload.get("file_content", "")
    system_prompt = build_system_prompt("13-lore-archivist.md")

    registry = load_registry()
    srd_context = format_registry_for_context(registry)

    passes = [
        ("Pass 1: Document Survey",
         f"{srd_context}\n\n---\n\nDocument to process:\n\n{file_content[:8000]}\n\n"
         "Run Pass 1: produce the Document Survey only."),
        ("Pass 2: Entity Extraction",
         "Continue with Pass 2: extract all discrete lore entities from the document. "
         "Produce raw extraction records."),
        ("Pass 3: Classification and Visibility",
         "Continue with Pass 3: apply taxonomy and Visibility Tiers to each entity. "
         "Log any contradictions."),
        ("Pass 4: MDX Stub Production",
         "Continue with Pass 4: generate MDX stubs for all PUBLIC and PLAYER-CONTEXTUAL "
         "entities. Include ARCHIVIST NOTES comment blocks. Route any mechanical flags."),
    ]

    messages = []
    results = {}

    for pass_name, prompt in passes:
        messages.append({"role": "user", "content": prompt})
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=system_prompt,
            messages=messages
        )
        content = response.content[0].text
        messages.append({"role": "assistant", "content": content})
        results[pass_name] = content
        await asyncio.sleep(1)  # rate limit courtesy

    return {
        "passes": results,
        "full_conversation": messages,
        "status": "complete"
    }
```

---

## 10. Astro SRD Integration

The Astro SRD repo receives MDX stubs from the n8n pipeline via GitHub commits. No changes needed to the Astro app itself — Cloudflare Pages rebuilds automatically on push.

### What the n8n pipeline writes

```
qamareth-srd/src/content/
├── rules/          ← from SRD Architect, Combat, Magic, Social agents
├── bestiary/       ← from Monsters agent
├── grimoires/      ← from Music Grimoires agent
├── arsenal/        ← from Items agent
└── characters/     ← from Character Creation agent
```

Stubs written by the Archivist pipeline are **drafts** — they contain `ARCHIVIST NOTES` comment blocks and placeholder text. Before a stub is published, you (or the Lore Master agent in a subsequent chat session) must:

1. Open the stub in the chat UI → Lore Master agent → "Voice this stub"
2. Review the output
3. Merge to main → Cloudflare Pages rebuilds

---

## 11. Environment Variables Reference

### Backend (Railway)

| Variable | Value | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Required |
| `REDIS_URL` | Injected by Railway | Auto-set when Redis service added |
| `ALLOWED_ORIGIN` | `https://your-ui.vercel.app` | CORS |
| `PORT` | Injected by Railway | Auto-set |

### Frontend (Vercel)

| Variable | Value | Notes |
|---|---|---|
| `BACKEND_URL` | `https://your-backend.up.railway.app` | No trailing slash |

---

## 12. Build Order

Follow this exactly. Skipping steps creates hard-to-debug problems.

**Phase 1 — Backend shell (Day 1)**
1. Create `qamareth-agents/` repo with structure from §3.2
2. Copy all 16 skill files into `skills/`
3. Write `registry/srd_registry.json` (seed from §4.3)
4. Write `registry/registry.py`
5. Write `graph/state.py`
6. Write `main.py` — **only the `/chat/stream` direct (non-orchestrated) endpoint and `/agents`**
7. Write `graph/nodes.py` — just `make_agent_node` and the Master Architect instance
8. `pip install -r requirements.txt && uvicorn main:app --reload`
9. Test: `curl -X POST localhost:8000/chat/stream -d '{"agent":"master-architect","messages":[{"role":"user","content":"Hello"}],"orchestrated":false}'`
10. Verify SSE stream returns tokens ✓

**Phase 2 — Frontend shell (Day 1–2)**
1. Create `qamareth-agent-ui/` with `npx create-next-app@latest`
2. Install dependencies from §6.1
3. Configure Tailwind with Qamareth tokens from §6.8
4. Write proxy route handler from §6.4
5. Write `lib/types.ts` and `lib/api.ts`
6. Write `app/chat/page.tsx` (the full chat interface)
7. Set `BACKEND_URL=http://localhost:8000` in `.env.local`
8. `npm run dev` → test streaming in browser
9. Verify tokens render live ✓

**Phase 3 — All agents in chat (Day 2)**
1. Add all 15 agent instances to `graph/nodes.py`
2. Verify all skill files load without error
3. Test each agent via the AgentSelector dropdown
4. Verify SRD registry context appears in agent responses ✓

**Phase 4 — LangGraph orchestration (Day 3)**
1. Write `graph/routing.py`
2. Write `graph/builder.py`
3. Add orchestrated path to `/chat/stream` endpoint
4. Test: enable "ORCHESTRATED" toggle in UI, send a task that requires routing
5. Verify Master Architect routes to correct sub-agent ✓

**Phase 5 — Task panel and batch jobs (Day 3–4)**
1. Write `jobs.py`
2. Write `tasks/lore_ingest.py`
3. Add `/task/*` endpoints to `main.py`
4. Write `app/tasks/page.tsx` and `app/tasks/[id]/page.tsx`
5. Test: upload a small lore document, watch four-pass pipeline run ✓

**Phase 6 — Railway + Vercel deploy (Day 4)**
1. Follow §7 and §8
2. Set environment variables
3. Verify production streaming works end-to-end ✓

**Phase 7 — n8n pipeline (Day 5)**
1. Build n8n workflow from §9
2. Connect to Railway backend
3. Connect GitHub node to `qamareth-srd` repo
4. Test full pipeline: document → stubs → committed to SRD repo ✓

---

## 13. File Listing — Complete

All files you need to create, in order:

**qamareth-agents/**
```
requirements.txt              §4.1
graph/__init__.py             (empty)
graph/state.py                §4.2
registry/srd_registry.json    §4.3
registry/registry.py          §4.4
graph/nodes.py                §4.5
graph/routing.py              §4.6
graph/builder.py              §4.7
jobs.py                       §4.8
main.py                       §4.9
tasks/__init__.py             (empty)
tasks/lore_ingest.py          §9 (tasks handler)
tasks/audit.py                (follow same pattern as lore_ingest)
railway.toml                  §7.1
.gitignore                    §7.3
skills/00-shared-protocol.md  (from skill files)
skills/00-master-architect.md
skills/01-lore-master.md
... (all 16 skill files)
```

**qamareth-agent-ui/**
```
package.json                              §6.1
lib/types.ts                              §6.2
lib/api.ts                                §6.3
app/api/proxy/[...path]/route.ts          §6.4
app/chat/page.tsx                         §6.5
app/tasks/page.tsx                        (implement using listJobs from api.ts)
app/tasks/[id]/page.tsx                   (implement using getJob + polling)
app/layout.tsx                            (standard Next.js layout, import fonts)
app/page.tsx                              (redirect to /chat)
next.config.ts                            §8
tailwind.config.ts                        §8
tsconfig.json                             (standard Next.js tsconfig)
.env.local.example                        BACKEND_URL=http://localhost:8000
.gitignore                                (standard Next.js gitignore)
```
