# Qamareth Agent System — Claude Code Task Files

Hand each file to Claude Code **in order**. Complete and verify each phase before
starting the next. Each file is self-contained — no need to reference the others
while working on it.

---

## Phase sequence

| File | What gets built | Done when |
|------|----------------|-----------|
| `phase-01-backend-shell.md` | FastAPI app, skill loading, SSE streaming, SRD registry | `POST /chat/stream` streams tokens locally |
| `phase-02-frontend-shell.md` | Next.js UI, chat page, agent selector, live streaming | Tokens render live in browser |
| `phase-03-langgraph.md` | LangGraph graph, all 15 agent nodes, orchestrated routing | ORCHESTRATED toggle works end-to-end |
| `phase-04-task-panel.md` | Redis job queue, lore ingest task, task UI pages | Lore document runs four-pass pipeline |
| `phase-05-deploy.md` | Railway (backend + Redis) + Vercel (frontend) | Both live, chat works in production |
| `phase-06-n8n-pipeline.md` | n8n workflow → MDX stubs → GitHub commits | Stubs appear in `lore-ingestion` branch |

---

## Key files produced (backend)

```
qamareth-agents/
├── main.py                       ← FastAPI app
├── requirements.txt
├── railway.toml
├── graph/
│   ├── state.py                  ← QamarethState TypedDict
│   ├── nodes.py                  ← all 15 agent node factories
│   ├── routing.py                ← Master Architect routing logic
│   └── builder.py                ← assembles the LangGraph
├── registry/
│   ├── srd_registry.json         ← live SRD index (commit to git)
│   └── registry.py               ← load/format/update registry
├── tasks/
│   ├── lore_ingest.py            ← four-pass Archivist pipeline
│   └── audit.py                  ← Theological Auditor batch
├── jobs.py                       ← Redis job queue
└── skills/
    ├── 00-shared-protocol.md     ← prepended to every agent
    ├── 00-master-architect.md
    ├── 01-lore-master.md
    ├── 02-srd-architect.md
    ├── 03-combat-rules.md
    ├── 04-magic-rules.md
    ├── 05-music-grimoires.md
    ├── 06-character-creation.md
    ├── 07-social-systems.md
    ├── 08-npc.md
    ├── 09-monsters.md
    ├── 10-items.md
    ├── 11-uiux.md
    ├── 12-frontend.md
    ├── 13-lore-archivist.md
    └── 14-theological-auditor.md
```

## Key files produced (frontend)

```
qamareth-agent-ui/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  ← redirects to /chat
│   ├── chat/page.tsx             ← main chat interface
│   ├── tasks/page.tsx            ← task list + submit
│   ├── tasks/[id]/page.tsx       ← task detail + polling
│   └── api/proxy/[...path]/route.ts  ← SSE-safe proxy
├── lib/
│   ├── types.ts
│   └── api.ts
├── tailwind.config.ts            ← Qamareth design tokens
└── next.config.ts
```

---

## Notes for Claude Code

- **Skills files** must be in `qamareth-agents/skills/` with exact filenames as listed.
  Claude Code should not modify `.md` skill files unless explicitly asked.

- **`srd_registry.json`** grows over time as content is committed.
  Treat it as a database file — commit it to git, don't regenerate it.

- **The shared protocol** (`00-shared-protocol.md`) is prepended programmatically
  in `nodes.py`. Do not embed it manually into other skill files.

- **CORS**: `ALLOWED_ORIGIN` on Railway must match the exact Vercel URL.
  Trailing slashes break it.

- **SSE proxy**: The Next.js proxy in `route.ts` must pass `res.body` directly.
  Never buffer SSE responses.
