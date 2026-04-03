# Phase 2 — Frontend Shell

## What you're building
A Next.js 15 app with:
- A single chat page that talks to the Phase 1 backend
- Agent selector dropdown (all 15 agents)
- Live SSE streaming rendered token-by-token
- Qamareth design system (dark ink palette, typography)

No task panel yet. No LangGraph. Just chat working end-to-end in the browser.

## Prerequisite
Phase 1 backend must be running locally at `http://localhost:8000`.

## Repo to create
`qamareth-agent-ui/`

## Setup
```bash
npx create-next-app@latest qamareth-agent-ui \
  --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd qamareth-agent-ui
npm install react-markdown @tailwindcss/typography
```

---

## Files to create or replace

### .env.local
```
BACKEND_URL=http://localhost:8000
```

### tailwind.config.ts
Replace the generated file entirely:
```typescript
import type { Config } from "tailwindcss"

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink:             "#0D0F14",
        surface:         "#141820",
        "surface-alt":   "#1C2230",
        border:          "#2A3348",
        brass:           "#C8973A",
        steel:           "#7B9DB4",
        crimson:         "#8B3A3A",
        grove:           "#4A7C59",
        parchment:       "#E8DCC8",
        "parchment-dim": "#9A8E7C",
        marginalia:      "#5A5248",
      },
      fontFamily: {
        display: ["Cormorant Garamond", "serif"],
        body:    ["IBM Plex Serif", "serif"],
        mono:    ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config
```

### app/layout.tsx
```tsx
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Qamareth Agent System",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=IBM+Plex+Mono&family=IBM+Plex+Serif:ital,wght@0,400;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ink text-parchment font-body antialiased">
        {children}
      </body>
    </html>
  )
}
```

### app/globals.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #2A3348; border-radius: 0; }
```

### app/page.tsx
```tsx
import { redirect } from "next/navigation"
export default function Home() {
  redirect("/chat")
}
```

---

### lib/types.ts
```typescript
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
```

---

### lib/api.ts
```typescript
const PROXY = "/api/proxy"

export async function streamChat(
  agent: string,
  messages: { role: string; content: string }[],
  orchestrated: boolean,
  onChunk: (text: string) => void,
  onDone: () => void
): Promise<void> {
  const res = await fetch(`${PROXY}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent, messages, orchestrated }),
  })

  if (!res.ok || !res.body) {
    onDone()
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const raw = decoder.decode(value)
    for (const line of raw.split("\n\n")) {
      if (!line.startsWith("data:")) continue
      const payload = line.slice(5).trim()
      if (payload === "[DONE]") { onDone(); return }
      try {
        const { text } = JSON.parse(payload)
        onChunk(text)
      } catch {}
    }
  }
  onDone()
}
```

---

### app/api/proxy/[...path]/route.ts
```typescript
import { NextRequest } from "next/server"

const BACKEND = process.env.BACKEND_URL!

async function forward(req: NextRequest, params: { path: string[] }) {
  const path = params.path.join("/")
  const url = `${BACKEND}/${path}${req.nextUrl.search}`
  const contentType = req.headers.get("content-type") || ""

  const isMultipart = contentType.includes("multipart")
  const body = req.method === "GET" ? undefined
    : isMultipart ? await req.formData()
    : await req.text()

  const res = await fetch(url, {
    method: req.method,
    headers: isMultipart ? {} : { "Content-Type": contentType },
    body: body as BodyInit,
  })

  const isSSE = res.headers.get("content-type")?.includes("text/event-stream")
  if (isSSE) {
    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  }

  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
  })
}

export const GET  = (req: NextRequest, ctx: any) => forward(req, ctx.params)
export const POST = (req: NextRequest, ctx: any) => forward(req, ctx.params)
```

---

### app/chat/page.tsx
```tsx
"use client"
import { useState, useRef, useEffect } from "react"
import { streamChat } from "@/lib/api"
import { AGENTS, type AgentId, type Message } from "@/lib/types"

export default function ChatPage() {
  const [messages, setMessages]       = useState<Message[]>([])
  const [input, setInput]             = useState("")
  const [agent, setAgent]             = useState<AgentId>("master-architect")
  const [orchestrated, setOrchestrated] = useState(false)
  const [streaming, setStreaming]     = useState(false)
  const [streamBuffer, setBuffer]     = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamBuffer])

  async function send() {
    if (!input.trim() || streaming) return

    const userMsg: Message = {
      role: "user", content: input,
      timestamp: new Date().toISOString()
    }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput("")
    setStreaming(true)
    setBuffer("")

    let buf = ""
    await streamChat(
      agent,
      history.map(m => ({ role: m.role, content: m.content })),
      orchestrated,
      chunk => { buf += chunk; setBuffer(buf) },
      () => {
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: buf, agent,
            timestamp: new Date().toISOString() }
        ])
        setBuffer("")
        setStreaming(false)
      }
    )
  }

  return (
    <div className="flex flex-col h-screen">

      {/* Header bar */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-border bg-surface shrink-0">
        <span className="font-mono text-xs text-marginalia tracking-widest">AGENT</span>
        <select
          value={agent}
          onChange={e => setAgent(e.target.value as AgentId)}
          className="bg-surface-alt border border-border text-parchment
                     font-mono text-xs px-3 py-1.5 focus:outline-none focus:border-steel"
        >
          {AGENTS.map(a => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 ml-auto cursor-pointer">
          <input
            type="checkbox"
            checked={orchestrated}
            onChange={e => setOrchestrated(e.target.checked)}
            className="accent-steel"
          />
          <span className="font-mono text-xs text-marginalia tracking-widest">ORCHESTRATED</span>
        </label>
      </header>

      {/* Message list */}
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-marginalia font-mono text-xs mt-20 tracking-widest">
            QAMARETH AGENT SYSTEM — SELECT AN AGENT AND BEGIN
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-3xl px-4 py-3 text-sm leading-relaxed
              ${m.role === "user"
                ? "bg-surface-alt border border-border text-parchment"
                : "bg-surface border-l-2 border-steel text-parchment"
              }`}
            >
              {m.role === "assistant" && m.agent && (
                <div className="font-mono text-xs text-steel mb-2 uppercase tracking-widest">
                  {m.agent}
                </div>
              )}
              <div className="whitespace-pre-wrap font-body">{m.content}</div>
            </div>
          </div>
        ))}

        {/* Live streaming bubble */}
        {streaming && streamBuffer && (
          <div className="flex justify-start">
            <div className="max-w-3xl px-4 py-3 text-sm bg-surface border-l-2 border-steel">
              <div className="font-mono text-xs text-steel mb-2 uppercase tracking-widest">
                {agent} <span className="animate-pulse">▋</span>
              </div>
              <div className="whitespace-pre-wrap font-body">{streamBuffer}</div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <footer className="border-t border-border px-6 py-4 flex gap-3 bg-surface shrink-0">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Task an agent… (Shift+Enter for newline)"
          rows={3}
          className="flex-1 bg-surface-alt border border-border text-parchment font-body
                     text-sm px-4 py-2 resize-none focus:outline-none focus:border-steel
                     placeholder:text-marginalia"
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="px-6 py-2 bg-steel text-ink font-mono text-xs tracking-widest
                     uppercase disabled:opacity-40 disabled:cursor-not-allowed
                     hover:bg-parchment transition-colors self-end"
        >
          SEND
        </button>
      </footer>
    </div>
  )
}
```

---

## Run locally
```bash
npm run dev
```
Open `http://localhost:3000`.

## Done when
- Page loads with dark ink background
- Agent dropdown shows all 15 agents
- Sending a message streams tokens live in the browser
- Assistant bubble shows the agent name in steel color above the response
- `ORCHESTRATED` toggle is present (can be on/off; backend ignores it for now)
