export type AgentId =
  | "master-architect" | "lore-master" | "srd-architect"
  | "combat-rules" | "magic-rules" | "music-grimoires"
  | "character-creation" | "social-systems" | "npc"
  | "monsters" | "items" | "uiux" | "frontend"
  | "lore-archivist" | "theological-auditor"

export interface Message {
  role: "user" | "assistant"
  content: string
  agent?: AgentId
  timestamp: string
}

export const AGENTS: { id: AgentId; label: string }[] = [
  { id: "master-architect",    label: "Master Architect"    },
  { id: "lore-master",         label: "Lore Master"         },
  { id: "lore-archivist",      label: "Lore Archivist"      },
  { id: "srd-architect",       label: "SRD Architect"       },
  { id: "combat-rules",        label: "Combat Rules"        },
  { id: "magic-rules",         label: "Magic Rules"         },
  { id: "music-grimoires",     label: "Music Grimoires"     },
  { id: "character-creation",  label: "Character Creation"  },
  { id: "social-systems",      label: "Social Systems"      },
  { id: "npc",                 label: "NPC"                 },
  { id: "monsters",            label: "Monsters"            },
  { id: "items",               label: "Items"               },
  { id: "uiux",                label: "UI / UX"             },
  { id: "frontend",            label: "Frontend"            },
  { id: "theological-auditor", label: "Theological Auditor" },
]

export interface Job {
  id: string
  status: "queued" | "running" | "complete" | "failed"
  task_type: string
  created_at: string
  result?: string
  error?: string
}

export type TaskType = "lore_ingest" | "audit"

export interface CharacterSheet {
  name: string
  concept: string
  attributes: Record<string, string>
  disciplines: Record<string, number>
  scar_condition: {
    name: string
    trigger: string
    condition_applied: string
    heightened_access: string
    resolution: string
  }
  starting_position: {
    faction: string
    standing: string
    grimoire_hook: string
  }
  drive: string
  summary: string
}
