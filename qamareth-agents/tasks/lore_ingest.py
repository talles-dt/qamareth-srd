import asyncio
import os
from dotenv import load_dotenv
from anthropic import Anthropic
from graph.nodes import build_system_prompt, inject_registry
from registry.registry import load_registry, format_registry_for_context

load_dotenv()

client = Anthropic()

CHUNK_SIZE = 8000  # chars per pass-1 chunk; 200-page doc needs batching


async def run_lore_ingest(payload: dict) -> dict:
    """
    Runs the four-pass Lore Archivist protocol.
    For large documents, only processes the first CHUNK_SIZE chars.
    Full document batching is a future enhancement.
    """
    file_content = payload.get("file_content", "")
    chunk = file_content[:CHUNK_SIZE]
    filename = payload.get("filename", "unknown")

    system_prompt = build_system_prompt("13-lore-archivist.md")
    registry = load_registry()
    srd_context = format_registry_for_context(registry)

    passes = [
        (
            "Pass 1: Document Survey",
            f"{srd_context}\n\n---\n\nFile: {filename}\n\n"
            f"Document excerpt (first {CHUNK_SIZE} chars):\n\n{chunk}\n\n"
            "Run Pass 1 only: produce the Document Survey."
        ),
        (
            "Pass 2: Entity Extraction",
            "Continue with Pass 2: extract all discrete lore entities. "
            "Produce raw extraction records."
        ),
        (
            "Pass 3: Classification and Visibility",
            "Continue with Pass 3: apply taxonomy and Visibility Tiers. "
            "Log any internal contradictions."
        ),
        (
            "Pass 4: MDX Stub Production",
            "Continue with Pass 4: generate MDX stubs for all PUBLIC and "
            "PLAYER-CONTEXTUAL entities. Include ARCHIVIST NOTES comment blocks. "
            "List any MECHANICAL FLAGS at the end."
        ),
    ]

    messages: list[dict] = []
    results: dict[str, str] = {}

    for pass_name, prompt in passes:
        messages.append({"role": "user", "content": prompt})
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
        )
        content = response.content[0].text
        messages.append({"role": "assistant", "content": content})
        results[pass_name] = content
        await asyncio.sleep(0.5)

    return {
        "filename": filename,
        "chunk_processed": f"0–{min(CHUNK_SIZE, len(file_content))} chars",
        "total_chars": len(file_content),
        "passes": results,
    }
