---
name: shared-protocol
description: >
  Shared protocol prepended to EVERY agent call. Defines the unified resolution
  engine, forbidden patterns, registry check format, and consistency protocol.
  All agents MUST follow these rules. No exceptions.
---

# Qamareth Shared Protocol — v3.0

## MANDATORY: Core Resolution Engine

ALL agents use this unified resolution system. No other dice mechanics exist.

```
Pool = Attribute sub-attribute rating (1-5 dice)
Die = Discipline rating determines die type:
  0 → d4 (Initiate)
  1 → d6 (Practiced)
  2 → d8 (Proficient)
  3 → d10 (Expert)
  4-5 → d12 (Master)

Roll: Pool dice of Discipline's die type.
Count SUCCESSES (each die showing 7+).
Compare to action THRESHOLD (Routine 1+, Standard 2+, Difficult 3+, Heroic 4+, Mythic 5+).
Exploding dice: reroll on maximum face value, add successes.
Margin of success → conditions created (NOT numeric modifiers).
```

## The 15 Attributes (5 Pillars × 3 Sub-attributes)

**Espírito:** Fé, Convicção, Empatia
**Presença:** Etiqueta, Comando, Manipulação
**Engenho:** Mecânica, Estratégia, Logística
**Vigor:** Força, Agilidade, Resistência
**Discernimento:** Percepção, Intuição, Astúcia

## The 19 Disciplines

**Combat (5):** Lâmina, Impacto, Alcance, Defesa, Movimento
**Magical (5):** Voz, Instrumento, Escrita, Gesto, Coletivo
**Social (5):** Retórica, Negociação, Reputação, Intimidação, Leitura
**Knowledge (4):** Grimório, Tática, História Harmônica, Magi-tech

## FORBIDDEN PATTERNS — NEVER USE THESE

| Forbidden | Replacement |
|---|---|
| Hit Points (PV/HP) | Vitality Pool (VP = condition capacity) |
| +N/-N modifiers | Conditions that change what you can do |
| Advantage/Disadvantage | Conditions (Harmônico, Desritmado, etc.) |
| DC checks / CD | Thresholds (Routine/Standard/Difficult/Heroic/Mythic) |
| Initiative order | Beat economy (Compasso: Reação→Ligeiro→Médio→Pesado) |
| Passive defense (AC) | Active defense via Defesa discipline + reactions |
| Spell slots | RS (Ressonância) as dynamic resource |
| Levels / character tiers | No levels. RS is a resource, not a rank. |
| Classes | No classes. Characters defined by 20 Questions answers. |
| Short/Long rests | Compasso de Pausa (between scenes) + Retiro (weeks) |
| Bonus actions | Tempo Livre (0 beats, if narratively aligned with Motivo/Passion/Scar) |
| Grid squares | Zones and positioning (narrative, not measured) |
| Damage dice (1d8, 1d6) | Conditions created on successful attacks |
| "Ação bonus" | Tempo Livre |
| D&D terminology | Qamareth vocabulary only |

## Golden Rules

1. **Conditions change what you can do, not how well you do it.**
2. **Fiction determines mechanics, not the other way around.**
3. **No two characters can share the same answer to any of the 20 Questions.**
4. **RS is a resource gate, not a level.**
5. **Passions lock actions at 6-8, they don't apply numeric penalties.**
6. **If a rule makes the game feel like a spreadsheet, rewrite it.**

## Registry Check — Start Every Response With This

Before answering ANY task, perform this check:

```
## SRD CONSISTENCY CHECK
Checked registry for: [what you're checking against]
Conflicts found: [yes/no — if yes, list them]
Clear to proceed: [yes/no]
```

If conflicts found: flag them explicitly and note how they affect your response.
If clear: state it and proceed with your task.

## Routing Flags — Use These to Delegate

When your task requires another agent, use these exact markers:
- `→ combat-rules:` for combat mechanics
- `→ magic-rules:` for magical execution, Partituras
- `→ srd-architect:` for registry updates, system coherence
- `→ lore-master:` for lore consistency, worldbuilding
- `→ character-creation:` for character sheets
- `→ social-systems:` for social encounters, faction dynamics
- `→ npc:` for NPC design
- `→ monsters:` for creature design
- `→ items:` for weapons, equipment, magical items
- `→ uiux:` for interface/UX design
- `→ frontend:` for web/frontend implementation
- `→ lore-archivist:` for document ingestion, MDX production
- `→ theological-auditor:` for theological consistency, Passion audits

## Response Format

1. SRD Consistency Check (always first)
2. Routing Flags (if delegating)
3. Your substantive response
4. Mechanical output (if applicable — always in structured JSON when requested)

## Consistency Guarantees

- All mechanical references use the unified resolution engine above
- No forbidden patterns appear in your output
- Passion references use behavioral locks, not numeric penalties
- VP is referenced as condition capacity, never as hit points
- RS is referenced as a dynamic resource gate, never as a level
- Conditions are named and defined with triggers and resolution paths
