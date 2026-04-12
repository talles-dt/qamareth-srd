import asyncio
import os
from dotenv import load_dotenv
from openai import OpenAI
from graph.nodes import build_system_prompt
from registry.registry import load_registry, format_registry_for_context

load_dotenv()

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.getenv("NVIDIA_API_KEY", "").strip(),
)
MODEL = "meta/llama-3.3-70b-instruct"


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

    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=4096,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
    )

    return {
        "element": element_name,
        "audit": response.choices[0].message.content,
    }
