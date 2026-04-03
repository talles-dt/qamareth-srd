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
