"use client"
import { useState } from "react"
import { createCharacter } from "@/lib/api"
import type { CharacterSheet } from "@/lib/types"

const STEPS = ["Concept", "Origin", "Survival", "Mastery", "Denial", "Burden"]

const QUESTIONS = [
  {
    key: "concept",
    label: "CONCEPT",
    title: "Who is this person?",
    subtitle: "A brief concept — a soldier, a witch's heir, a wandering minstrel…",
    placeholder: "e.g. A defected imperial soldier",
    multiline: true,
  },
  {
    key: "q1_inherit",
    label: "Q1 — INHERIT",
    title: "What did you inherit?",
    subtitle: "What did your family or community give you that you couldn't choose — blood, reputation, debt, gift?",
    placeholder: "e.g. My father's sword, his debts, and his reputation among the officers…",
    multiline: true,
  },
  {
    key: "q2_survive",
    label: "Q2 — SURVIVE",
    title: "What did you survive?",
    subtitle: "What broke you once, and what remains of you after it?",
    placeholder: "e.g. The Inquisition burned my home. I walked out, but my face never heals…",
    multiline: true,
  },
  {
    key: "q3_master",
    label: "Q3 — MASTER",
    title: "What did you master?",
    subtitle: "What one thing can you do that most people cannot — and how did you learn it?",
    placeholder: "e.g. I can read a battlefield — not just positions, but morale, supply lines, weakness…",
    multiline: true,
  },
  {
    key: "q4_denied",
    label: "Q4 — DENIED",
    title: "What were you denied?",
    subtitle: "What knowledge, access, or recognition was withheld from you — and why?",
    placeholder: "e.g. I was denied formal education because my family had no papers…",
    multiline: true,
  },
  {
    key: "q5_carry",
    label: "Q5 — CARRY",
    title: "What do you carry?",
    subtitle: "Not equipment. What is the thing — memory, vow, name, grief — that you bring into every room?",
    placeholder: "e.g. I carry the names of every soldier I commanded. All twelve of them…",
    multiline: true,
  },
]

export default function CharacterCreatePage() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const [character, setCharacter] = useState<CharacterSheet | null>(null)
  const [rawOutput, setRawOutput] = useState("")
  const [error, setError] = useState("")

  function updateAnswer(key: string, value: string) {
    setAnswers(prev => ({ ...prev, [key]: value }))
  }

  async function generate() {
    setGenerating(true)
    setError("")
    setRawOutput("")
    setCharacter(null)
    try {
      const result = await createCharacter(answers)
      if (result.status === "ok" && result.character) {
        setCharacter(result.character)
      } else if (result.raw) {
        setRawOutput(result.raw)
        // Try to parse JSON from raw markdown
        const raw = result.raw
        if (raw.includes("```")) {
          const parts = raw.split("```")
          for (const p of parts) {
            const cleaned = p.startsWith("json") ? p.slice(4).trim() : p.trim()
            if (cleaned.startsWith("{")) {
              try {
                setCharacter(JSON.parse(cleaned))
                break
              } catch { /* continue */ }
            }
          }
        }
      } else {
        setError("Character generation returned no data.")
      }
    } catch (e: any) {
      setError(e.message || "Failed to generate character")
    }
    setGenerating(false)
  }

  function reset() {
    setStep(0)
    setAnswers({})
    setCharacter(null)
    setRawOutput("")
    setError("")
  }

  // ─── Character Sheet Display ───────────────────────────────────────────
  if (character) {
    return (
      <div className="min-h-screen p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl text-parchment tracking-wide">
            {character.name || "Unnamed Character"}
          </h1>
          <button
            onClick={reset}
            className="font-mono text-xs text-steel hover:text-parchment border border-border px-4 py-2"
          >
            NEW CHARACTER
          </button>
        </div>

        {character.concept && (
          <p className="font-body text-parchment-dim italic mb-8 text-sm">
            {character.concept}
          </p>
        )}

        {/* Attributes */}
        <div className="bg-surface border border-border p-6 mb-6">
          <h2 className="font-mono text-xs text-steel uppercase tracking-widest mb-4">
            Attributes
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {Object.entries(character.attributes).map(([name, die]) => (
              <div key={name} className="text-center">
                <div className="font-mono text-xs text-marginalia">{name}</div>
                <div className="font-mono text-lg text-brass font-bold">{die}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Disciplines */}
        <div className="bg-surface border border-border p-6 mb-6">
          <h2 className="font-mono text-xs text-steel uppercase tracking-widest mb-4">
            Disciplines
          </h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(character.disciplines).map(([name, dice]) => (
              <div key={name} className="bg-surface-alt border border-border px-4 py-2">
                <div className="font-mono text-xs text-parchment">{name}</div>
                <div className="font-mono text-xs text-brass text-right">
                  {"●".repeat(dice)}{"○".repeat(Math.max(0, 5 - dice))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scar Condition */}
        <div className="bg-surface border border-crimson p-6 mb-6">
          <h2 className="font-mono text-xs text-crimson uppercase tracking-widest mb-3">
            Scar: {character.scar_condition.name}
          </h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-mono text-xs text-marginalia">Trigger: </span>
              <span className="text-parchment-dim">{character.scar_condition.trigger}</span>
            </div>
            <div>
              <span className="font-mono text-xs text-marginalia">Effect: </span>
              <span className="text-parchment-dim">{character.scar_condition.condition_applied}</span>
            </div>
            <div>
              <span className="font-mono text-xs text-marginalia">Heightened Access: </span>
              <span className="text-parchment-dim">{character.scar_condition.heightened_access}</span>
            </div>
            <div>
              <span className="font-mono text-xs text-marginalia">Resolution: </span>
              <span className="text-parchment-dim">{character.scar_condition.resolution}</span>
            </div>
          </div>
        </div>

        {/* Starting Position */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-surface border border-border p-6">
            <h2 className="font-mono text-xs text-steel uppercase tracking-widest mb-3">
              Faction Standing
            </h2>
            <div className="font-body text-parchment">{character.starting_position.faction}</div>
            <div className="font-mono text-xs text-brass mt-1">
              {character.starting_position.standing}
            </div>
          </div>
          <div className="bg-surface border border-border p-6">
            <h2 className="font-mono text-xs text-steel uppercase tracking-widest mb-3">
              Grimoire Hook
            </h2>
            <div className="font-body text-parchment-dim">{character.starting_position.grimoire_hook}</div>
          </div>
        </div>

        {/* Drive */}
        <div className="bg-surface border border-border p-6 mb-6">
          <h2 className="font-mono text-xs text-steel uppercase tracking-widest mb-3">
            Drive
          </h2>
          <p className="font-body text-parchment text-sm italic">
            &ldquo;{character.drive}&rdquo;
          </p>
        </div>

        {/* Summary */}
        <div className="bg-surface border border-border p-6 mb-6">
          <h2 className="font-mono text-xs text-steel uppercase tracking-widest mb-3">
            Backstory
          </h2>
          <pre className="font-body text-sm text-parchment-dim whitespace-pre-wrap leading-relaxed">
            {character.summary}
          </pre>
        </div>

        {/* Export */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(character, null, 2)], { type: "application/json" })
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = `${character.name.toLowerCase().replace(/\s+/g, "-")}.json`
              a.click()
            }}
            className="font-mono text-xs text-steel hover:text-parchment border border-border px-4 py-2"
          >
            EXPORT JSON
          </button>
          {rawOutput && (
            <button
              onClick={() => {
                const blob = new Blob([rawOutput], { type: "text/plain" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `${character.name.toLowerCase().replace(/\s+/g, "-")}.md`
                a.click()
              }}
              className="font-mono text-xs text-steel hover:text-parchment border border-border px-4 py-2"
            >
              EXPORT FULL
            </button>
          )}
        </div>
      </div>
    )
  }

  // ─── Multi-Step Form ───────────────────────────────────────────────────
  const current = QUESTIONS[step]
  const isLast = step === QUESTIONS.length - 1
  const hasAnswer = answers[current.key]?.trim()

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl text-parchment mb-2 tracking-wide">
        Character Creation
      </h1>
      <p className="font-body text-parchment-dim text-sm mb-8">
        Answer the provenance questions — your character emerges from who they are, not what they choose.
      </p>

      {/* Step indicators */}
      <div className="flex gap-1 mb-8">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            className={`flex-1 py-1 text-center font-mono text-xs tracking-widest border-b-2 transition-colors
              ${i === step
                ? "border-steel text-steel"
                : i < step
                  ? "border-grove text-grove"
                  : "border-border text-marginalia"
              }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question */}
      <div className="bg-surface border border-border p-6 mb-6 space-y-4">
        <div className="font-mono text-xs text-marginalia tracking-widest">
          {current.label}
        </div>
        <h2 className="font-display text-xl text-parchment">
          {current.title}
        </h2>
        <p className="font-body text-sm text-parchment-dim">
          {current.subtitle}
        </p>
        <textarea
          value={answers[current.key] || ""}
          onChange={e => updateAnswer(current.key, e.target.value)}
          placeholder={current.placeholder}
          rows={4}
          className="w-full bg-surface-alt border border-border text-parchment font-body
                     text-sm px-4 py-3 resize-none focus:outline-none focus:border-steel
                     placeholder:text-marginalia"
          autoFocus
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-surface border border-crimson p-4 mb-6">
          <p className="font-mono text-xs text-crimson">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="font-mono text-xs text-marginalia hover:text-parchment
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← BACK
        </button>

        {!isLast ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!hasAnswer}
            className="font-mono text-xs text-steel hover:text-parchment
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            NEXT →
          </button>
        ) : (
          <button
            onClick={generate}
            disabled={generating}
            className="px-8 py-3 bg-steel text-ink font-mono text-xs tracking-widest
                       uppercase disabled:opacity-40 disabled:cursor-not-allowed
                       hover:bg-parchment transition-colors"
          >
            {generating ? "FORGING CHARACTER…" : "CREATE CHARACTER"}
          </button>
        )}
      </div>

      {/* Loading overlay */}
      {generating && (
        <div className="fixed inset-0 bg-ink/80 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="font-mono text-xs text-brass animate-pulse tracking-widest mb-2">
              FORGING CHARACTER
            </div>
            <div className="font-mono text-xs text-marginalia">
              Consulting the First Question…
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
