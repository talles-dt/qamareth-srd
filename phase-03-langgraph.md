# Phase 3 — LangGraph Orchestration

## What you're building
Wire all 15 agents into a LangGraph graph so the Master Architect can
route to sub-agents and validate their output. The `orchestrated: true`
path in `/chat/stream` starts working.

## Prerequisite
Phases 1 and 2 complete. Direct (non-orchestrated) streaming already works.

## Install new dependency
```bash
cd qamareth-agents
pip install langgraph==0.2.28 langchain-anthropic==0.2.4
```
Add both to `requirements.txt`.

---

## Files to create

### graph/state.py
```python
from typing import TypedDict, Annotated, Optional
from langgraph.graph.message import add_messages


class QamarethState(TypedDict):
    messages:         Annotated[list, add_messages]
    active_agent:     str
    task_type:        str
    work_product:     str
    mechanical_flags: list[str]
    lore_flags:       list[str]
    audit_flags:      list[str]
    validated:        bool
    iteration_count:  int
    error:            Optional[str]
```

---

### graph/nodes.py
Replace the existing file entirely:
```python
from pathlib import Path
from anthropic import Anthropic
from graph.state import QamarethState
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
    registry = load_registry()
    srd_context = format_registry_for_context(registry)
    if not messages:
        return messages
    messages = list(messages)
    first = messages[0].copy()
    first["content"] = f"{srd_context}\n\n---\n\n{first['content']}"
    return [first] + messages[1:]


def make_agent_node(skill_file: str):
    system_prompt = build_system_prompt(skill_file)

    def node(state: QamarethState) -> dict:
        messages = inject_registry(state["messages"])
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
        )
        content = response.content[0].text
        return {
            "messages": [{"role": "assistant", "content": content}],
            "iteration_count": state.get("iteration_count", 0) + 1,
        }

    return node


# All agent nodes
master_architect_node    = make_agent_node("00-master-architect.md")
lore_master_node         = make_agent_node("01-lore-master.md")
srd_architect_node       = make_agent_node("02-srd-architect.md")
combat_rules_node        = make_agent_node("03-combat-rules.md")
magic_rules_node         = make_agent_node("04-magic-rules.md")
music_grimoires_node     = make_agent_node("05-music-grimoires.md")
character_creation_node  = make_agent_node("06-character-creation.md")
social_systems_node      = make_agent_node("07-social-systems.md")
npc_node                 = make_agent_node("08-npc.md")
monsters_node            = make_agent_node("09-monsters.md")
items_node               = make_agent_node("10-items.md")
uiux_node                = make_agent_node("11-uiux.md")
frontend_node            = make_agent_node("12-frontend.md")
lore_archivist_node      = make_agent_node("13-lore-archivist.md")
theological_auditor_node = make_agent_node("14-theological-auditor.md")
```

---

### graph/routing.py
```python
from langgraph.graph import END
from graph.state import QamarethState

MAX_ITERATIONS = 10

ROUTE_MAP = {
    "lore-master":         "lore_master",
    "srd-architect":       "srd_architect",
    "combat-rules":        "combat_rules",
    "magic-rules":         "magic_rules",
    "music-grimoires":     "music_grimoires",
    "character-creation":  "character_creation",
    "social-systems":      "social_systems",
    "npc":                 "npc",
    "monsters":            "monsters",
    "items":               "items",
    "uiux":                "uiux",
    "frontend":            "frontend",
    "lore-archivist":      "lore_archivist",
    "theological-auditor": "theological_auditor",
}


def route_from_architect(state: QamarethState) -> str:
    if state.get("validated"):
        return END
    if state.get("iteration_count", 0) >= MAX_ITERATIONS:
        return END

    last = state["messages"][-1]["content"].lower()

    # Look for routing flags written by the Architect:
    # e.g.  "→ combat-rules: ..."  or  "route to lore-master"
    for key, node in ROUTE_MAP.items():
        if f"→ {key}" in last or f"route to {key}" in last:
            return node

    return END


def route_from_subagent(state: QamarethState) -> str:
    if state.get("iteration_count", 0) >= MAX_ITERATIONS:
        return END
    return "master_architect"
```

---

### graph/builder.py
```python
from langgraph.graph import StateGraph, END
from graph.state import QamarethState
from graph.nodes import (
    master_architect_node, lore_master_node, srd_architect_node,
    combat_rules_node, magic_rules_node, music_grimoires_node,
    character_creation_node, social_systems_node, npc_node,
    monsters_node, items_node, uiux_node, frontend_node,
    lore_archivist_node, theological_auditor_node,
)
from graph.routing import route_from_architect, route_from_subagent


def build_graph():
    g = StateGraph(QamarethState)

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

    g.set_entry_point("master_architect")

    sub_agents = [
        "lore_master", "srd_architect", "combat_rules", "magic_rules",
        "music_grimoires", "character_creation", "social_systems",
        "npc", "monsters", "items", "uiux", "frontend",
        "lore_archivist", "theological_auditor",
    ]

    destination_map = {n: n for n in sub_agents}
    destination_map[END] = END

    g.add_conditional_edges("master_architect", route_from_architect, destination_map)

    for agent in sub_agents:
        g.add_conditional_edges(agent, route_from_subagent, {
            "master_architect": "master_architect",
            END: END,
        })

    return g.compile()


qamareth_graph = build_graph()
```

---

## Update main.py — add the orchestrated path

Find the `chat_stream` endpoint and replace it with this version:

```python
@app.post("/chat/stream")
async def chat_stream(body: ChatRequest):
    if body.agent not in AGENT_SKILLS:
        raise HTTPException(400, f"Unknown agent: {body.agent}")

    if body.orchestrated:
        # LangGraph path
        from graph.builder import qamareth_graph
        from graph.state import QamarethState
        import asyncio

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
            final = result["messages"][-1]["content"]
            for word in final.split(" "):
                yield f"data: {json.dumps({'text': word + ' '})}\n\n"
                await asyncio.sleep(0.01)
            yield "data: [DONE]\n\n"

        return StreamingResponse(graph_stream(), media_type="text/event-stream")

    else:
        # Direct single-agent path (true SSE streaming)
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
```

Also add these imports to the top of `main.py` if not present:
```python
from graph.nodes import AGENT_SKILLS, build_system_prompt, inject_registry
```

---

## Done when
- Server starts without import errors
- Direct mode (orchestrated: false) still streams as before
- Orchestrated mode (orchestrated: true) runs the graph and streams the final result
- Test orchestrated mode:
  ```bash
  curl -X POST http://localhost:8000/chat/stream \
    -H "Content-Type: application/json" \
    -d '{"agent":"master-architect","messages":[{"role":"user","content":"Design a new combat technique for a Lâmina practitioner. Route to the correct sub-agent."}],"orchestrated":true}'
  ```
  You should see the Master Architect route to `combat_rules` and stream back the result.
