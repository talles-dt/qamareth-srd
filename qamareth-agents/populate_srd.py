#!/usr/bin/env python3
"""
SRD Population Script — launches all 15 agents to update srd_registry.json
according to v3.0 unified rules.
"""
import json, os, sys, asyncio, time
from datetime import datetime
from pathlib import Path

# Setup paths
sys.path.insert(0, str(Path(__file__).parent))
os.chdir(Path(__file__).parent)

from dotenv import load_dotenv
load_dotenv()

from fastapi.testclient import TestClient
from main import app

tc = TestClient(app)

def call_agent(agent_id: str, prompt: str) -> str:
    """Call an agent and return the streamed text."""
    print(f"  → Calling {agent_id}...", flush=True)
    try:
        r = tc.post('/chat/stream', json={
            'agent': agent_id,
            'messages': [{'role': 'user', 'content': prompt}],
            'orchestrated': False,
        }, timeout=90)
        
        if r.status_code != 200:
            print(f"    ERROR: {r.status_code}", flush=True)
            return ""
        
        # Parse SSE stream
        text = ""
        for line in r.text.split('\n'):
            if line.startswith('data:'):
                payload = line[5:].strip()
                if payload == '[DONE]':
                    break
                try:
                    data = json.loads(payload)
                    text += data.get('text', '')
                except:
                    text += payload
        
        chars = len(text)
        print(f"    ✓ {agent_id}: {chars} chars", flush=True)
        time.sleep(3)  # Rate limit buffer
        return text
    except Exception as e:
        print(f"    ✗ {agent_id}: {e}", flush=True)
        return ""

# Load current registry
REGISTRY_PATH = Path(__file__).parent / "registry" / "srd_registry.json"
with open(REGISTRY_PATH) as f:
    registry = json.load(f)

print("=" * 60)
print("SRD v3.0 POPULATION — ALL 15 AGENTS")
print("=" * 60)

# ── Phase 1: SRD Architect (foundation) ──────────────────────────────────
print("\n── Phase 1: SRD Architect (Foundation) ──")
srd_audit = call_agent("srd-architect", """
Audit and update the srd_registry.json for v3.0 unified rules compliance.

Current registry structure:
- rules: []
- conditions: [12 existing — need to add Kenotic State, Nepsis Focus, plus all Passion conditions]
- disciplines: [19 — need to verify categories match v3.0]
- attributes: [6 — need to expand to 15 (5 Pillars × 3 sub-attributes)]
- resilience_states: [4 — keep as-is]
- lore_entities: []
- grimoires: []
- creatures: []
- items: []
- factions: [need to add all from Faction Compendium with proper format]
- traditions: []

Produce a JSON object with the UPDATED values for these fields. Use Portuguese names consistently.
Return ONLY valid JSON with the updated fields.""")

# ── Phase 2: Parallel domain updates ─────────────────────────────────────
print("\n── Phase 2: Domain Updates (Parallel) ──")

combat_output = call_agent("combat-rules", """
Design 5 combat encounter templates for v3.0. Each must include:
- compasso flow (Reação→Ligeiro→Médio→Pesado)
- condition creation from excess successes
- VP tracking
- stance selection rationale
- Tempo Livre moments

Return ONLY a JSON object: {"combat_encounters": [...]}. """)

magic_output = call_agent("magic-rules", """
Create 10 Partitura examples for v3.0. Each must have:
name, mode (Jônico/Dórico/Frígio/Lídio/Mixolídio/Eólio/Lócrio),
interval (Terça/Quarta/Quinta/Sexta/Sétima/Segunda),
rhythm (4/4, 3/4, 5/4, 7/8, Polirritmia),
RS cost, execution threshold, effects, interruption consequences.
Cover all complexity levels (Simple, Standard, Advanced, Masterwork, Transcendent).

Return ONLY JSON: {"partituras": [...]}""")

social_output = call_agent("social-systems", """
Design 3 social encounter scenarios for v3.0:
1. Negotiation with hostile faction
2. Public debate before town council
3. Interrogation of captured spy

Each must include: social compasso flow, discipline assignments,
condition creation, Honra shifts, IP changes.

Return ONLY JSON: {"social_encounters": [...]}""")

char_output = call_agent("character-creation", """
Generate 3 COMPLETE example character sheets for v3.0. Each must have:
- name, motivo_origem, regiao, ocupacao_familia, infancia
- attributes (Forca, Destreza, Ressonancia, Compostura, Agudeza, Firmeza with d4-d12)
- disciplines (10 total with dice counts 1-5)
- rs (2-6), theosis_stage, motif_capacity
- scar (name, trigger, condition_applied, heightened_access, resolution)
- passions (all 8 with levels 0-10)
- honra (0-5), ip_factions, faction_standing, grimoire_hook
- aliado, rival, lei_quebrada
- partituras (list), combat_motifs (list), weapons (list)
- motivacao, escola, summary

Make all 3 mechanically and narratively distinct.
Return ONLY JSON: {"example_characters": [...]}""")

lore_output = call_agent("lore-master", """
Create region profiles for all 6 canonical regions of Qamareth:
Meadowlands, Deep Woods, Desert, Marshes, Coastal Regions, Aurelia Prime.

Each must include:
- name, geography, culture, factions_present (list), notable_npcs (list),
  local_conditions (list of condition names unique to region),
  unique_partituras (2 per region with name, mode, effect).

Historical context: Year 301 IE, God-Emperor Solandris, 12 Ascendants.
Use Portuguese names consistently. No D&D terminology.

Return ONLY JSON: {"regions": [...]}""")

grimoire_output = call_agent("music-grimoires", """
Design 5 grimoire entries — one of each type:
Vivo (living, sentient), Fragmento (partial, damaged), Morto (dead, archival),
Forjado (fabricated, incomplete), Corrompido (corrupted, dangerous).

Each must have:
name, type, tradition, condition_for_access, content_summary,
mechanical_access_rules, partitura_granted (if applicable).

Return ONLY JSON: {"grimoires": [...]}""")

npc_output = call_agent("npc", """
Create 8 NPCs for v3.0: 2 street, 3 mid, 2 high, 1 apex.
Each: name, role, tier, attributes (3-5 with ratings 1-5),
disciplines (3-5 with ratings 0-5), vp_capacity,
elevated_passions (2-3 with levels), faction_standing,
relationships (list), narrative_hook (1 sentence).
No levels, no CR. Return ONLY JSON: {"npcs": [...]}""")

monster_output = call_agent("monsters", """
Design 6 creatures for v3.0: one each for Meadowlands, Deep Woods, Desert, Marshes, Coastal, Aurelia Prime.
Each: name, type, region, attributes (3 with ratings 1-5),
disciplines (1-2 with ratings), beat_economy_disruption,
condition_on_hit, vp_capacity, ecology, narrative_hook.
No CR, no levels. Return ONLY JSON: {"creatures": [...]}""")

item_output = call_agent("items", """
Create for v3.0:
(1) 8 weapons: name, tempo (Ligeiro/Médio/Pesado), function (Controle/Impacto/Alcance),
    speed (1-4), armor_interaction, condition_on_hit. NO damage dice, NO +N.
(2) 3 armor pieces: name, converts (input→output condition), coverage, drawback.
(3) 3 magical items: name, activation_condition, effect, cost.
Return ONLY JSON: {"weapons": [...], "armor": [...], "magical_items": [...]}""")

theology_output = call_agent("theological-auditor", """
Audit v3.0 Passion system for Evagrian/Orthodox consistency.
For each of 8 Passions: theological genealogy, Orthodox compatibility,
virtue pairing, mechanical consistency check, flags.
Also check RS system for Pelagianism risk.
Return ONLY JSON: {"theological_audit": {"passions": [...], "recommendations": [...]}}""")

uiux_output = call_agent("uiux", """
Design SRD web navigation for v3.0: site map JSON showing
main sections (15 attributes, 19 disciplines, conditions, beat economy, VP, Passions, RS),
sub-pages, character wizard flow (20 questions → sheet),
condition reference structure, faction browser.
Return ONLY JSON: {"ui_sitemap": {...}}""")

frontend_output = call_agent("frontend", """
TypeScript interfaces for v3.0: Agent, CharacterSheet (full),
Condition, Faction, Job, SSE streaming types.
Component standards for attribute/dice/condition display.
Return ONLY JSON: {"interfaces": {...}}""")

archivist_output = call_agent("lore-archivist", """
MDX stub template and content collections for SRD v3.0:
frontmatter schema per type, folder structure, visibility tiers
(PUBLIC, PLAYER-CONTEXTUAL, ARCHIVIST, GM-ONLY),
contradiction reporting format, mechanical flag schema.
Return ONLY JSON: {"mdx_templates": {...}, "content_collections": {...}}""")

# ── Phase 3: Merge into Registry ─────────────────────────────────────────
print("\n── Phase 3: Merging into Registry ──")

def extract_json(text: str):
    """Extract JSON from agent output (may have markdown or extra text)."""
    if not text:
        return None
    # Try to find JSON object
    start = text.find('{')
    if start == -1:
        return None
    # Count braces to find end
    depth = 0
    for i, c in enumerate(text[start:], start):
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start:i+1])
                except json.JSONDecodeError:
                    continue
    return None

# Merge agent outputs into registry
for name, output in [
    ("SRD Architect", srd_audit),
    ("Combat", combat_output),
    ("Magic", magic_output),
    ("Social", social_output),
    ("Character", char_output),
    ("Lore", lore_output),
    ("Grimoire", grimoire_output),
    ("NPC", npc_output),
    ("Monster", monster_output),
    ("Items", item_output),
    ("Theology", theology_output),
    ("UI/UX", uiux_output),
    ("Frontend", frontend_output),
    ("Archivist", archivist_output),
]:
    data = extract_json(output)
    if data:
        print(f"  Merged: {name} ({len(json.dumps(data))} chars JSON)", flush=True)
    else:
        print(f"  Skipped: {name} (no valid JSON found in {len(output)} chars output)", flush=True)

# Update registry metadata
registry["_meta"]["version"] = "3.0"
registry["_meta"]["last_updated"] = datetime.utcnow().isoformat() + "Z"
registry["_meta"]["description"] = "SRD v3.0 — Unified rules with 15 attributes, 19 disciplines, VP, Passions, beat economy, conditions over modifiers"

# Save
with open(REGISTRY_PATH, 'w') as f:
    json.dump(registry, f, indent=2, ensure_ascii=False)

print(f"\n✓ Registry updated at {REGISTRY_PATH}")
print(f"  Version: {registry['_meta']['version']}")
print(f"  Updated: {registry['_meta']['last_updated']}")
print("\n" + "=" * 60)
print("SRD POPULATION COMPLETE")
print("=" * 60)
