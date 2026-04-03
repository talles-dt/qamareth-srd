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

    last_msg = state["messages"][-1]
    last = last_msg.content.lower() if hasattr(last_msg, "content") else last_msg["content"].lower()

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
