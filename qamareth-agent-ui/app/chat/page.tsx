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
