import asyncio
import os
from dotenv import load_dotenv
from anthropic import Anthropic
from graph.nodes import build_system_prompt
from registry.registry import load_registry, format_registry_for_context

load_dotenv()

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


async def run_audit(payload: dict) -> dict:
    """Runs the Theological Auditor against a given element."""
    element_name = payload.get("element_name", "unspecified")
    element_text = payload.get("element_text", "")
    system_prompt = build_system_prompt("14-theological-auditor.md")

    registry = load_registry()
    srd_context = format_registry_for_context(registry)

    prompt = (
        f"{srd_context}\n\n---\n\n"
        f"Please audit the following Qamareth system element.\n\n"
        f"**Element:** {element_name}\n\n"
        f"{element_text}\n\n"
        "Produce a full Audit Record covering all relevant axes."
    )

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": prompt}],
    )

    return {
        "element": element_name,
        "audit": response.content[0].text,
    }
