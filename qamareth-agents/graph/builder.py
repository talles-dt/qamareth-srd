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
