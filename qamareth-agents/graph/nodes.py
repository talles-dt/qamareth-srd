from pathlib import Path
import os
from dotenv import load_dotenv
from openai import OpenAI
from graph.state import QamarethState
from registry.registry import load_registry, format_registry_for_context

load_dotenv()

SKILLS_DIR = Path(__file__).parent.parent / "skills"
client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.getenv("NVIDIA_API_KEY", ""),
)
MODEL = "meta/llama-3.3-70b-instruct"

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


def inject_registry(messages: list) -> list:
    """Prepend SRD state to the first user message."""
    registry = load_registry()
    srd_context = format_registry_for_context(registry)
    if not messages:
        return messages
    messages = list(messages)
    first = messages[0]
    # LangChain messages have .content; raw dicts have ["content"]
    if hasattr(first, "content"):
        from langchain_core.messages import HumanMessage
        first = HumanMessage(content=f"{srd_context}\n\n---\n\n{first.content}")
    else:
        first = first.copy()
        first["content"] = f"{srd_context}\n\n---\n\n{first['content']}"
    return [first] + messages[1:]


def make_agent_node(skill_file: str):
    system_prompt = build_system_prompt(skill_file)

    def node(state: QamarethState) -> dict:
        messages = inject_registry(state["messages"])
        # Convert LangChain messages to OpenAI format dicts
        openai_messages = [{"role": "system", "content": system_prompt}]
        for msg in messages:
            if hasattr(msg, "content"):
                # LangChain message object
                role = "user" if msg.type == "human" else "assistant"
                openai_messages.append({"role": role, "content": msg.content})
            else:
                # Already a dict
                openai_messages.append(msg)

        response = client.chat.completions.create(
            model=MODEL,
            messages=openai_messages,
            max_tokens=4096,
        )
        content = response.choices[0].message.content
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
