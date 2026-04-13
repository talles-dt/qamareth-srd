"use client"
import { useState, useRef, useEffect } from "react"

// ── DATA ──────────────────────────────────────────────────────────────────────
// Call Railway backend directly (CORS is configured)
const STREAM_URL = "https://qamareth-srd-production.up.railway.app/character/create/stream"

const STAGES = [
  { n: 1, label: "Origem",     qs: [1, 2, 3, 4] },
  { n: 2, label: "Formação",   qs: [5, 6, 7, 8] },
  { n: 3, label: "Harmonia",   qs: [9, 10, 11, 12] },
  { n: 4, label: "Conflitos",  qs: [13, 14, 15, 16] },
  { n: 5, label: "Destino",    qs: [17, 18, 19, 20] },
]

const GLYPHS = ["✦","☽","♩","⚔","♬","⬡","✧","◈","⚜","⌘","☽","✦","✸","✦","⚔","⬡","✦","✸","♩","◈"]

interface Question {
  n: number; s: number; title: string; hint: string; ex: string[];
  type: "text" | "options"; mech?: string; mechLabel?: string;
  rsV?: Record<string, number>
}

const QS: Question[] = [
  { n:1,  s:1, title:"Onde você nasceu?",
    hint:"Define sua cultura inicial, tradições locais e possíveis conexões sociais.",
    ex:["Meadowlands","Deep Woods","Desert","Marshes","Coastal Regions","Aurelia Prime"], type:"text" },
  { n:2,  s:1, title:"Qual era a ocupação da sua família?",
    hint:"Familiaridade com profissões, acesso a contatos, conhecimentos práticos.",
    ex:["Agricultores","Mercadores","Artesãos","Militares","Clérigos","Acadêmicos","Nômades","Criminosos"], type:"text" },
  { n:3,  s:1, title:"Como foi sua infância?",
    hint:"Gera uma Paixão inicial (nível 2–3).",
    ex:["Confortável","Disciplinada","Pobre","Violenta","Protegida","Itinerante"], type:"text", mech:"paixao_1", mechLabel:"→ Paixão inicial (nível 2–3)" },
  { n:4,  s:1, title:"Que evento marcou sua juventude?",
    hint:"Uma tragédia, descoberta, revelação, perda ou triunfo inesperado.",
    ex:[], type:"text" },
  { n:5,  s:2, title:"Quem foi seu mentor?",
    hint:"Define Escola de Formação, disciplinas disponíveis e rede de contato.",
    ex:["Sacerdote","Soldado","Músico","Mago","Engenheiro Magi-Tech","Caçador","Espião"], type:"text", mech:"escola", mechLabel:"→ Escola de Formação" },
  { n:6,  s:2, title:"O que você aprendeu primeiro?",
    hint:"Define a primeira Disciplina que o personagem domina.",
    ex:["Lâmina","Defesa","Voz","Instrumento","Retórica","Grimório","Tática","Leitura"], type:"text", mech:"disc1", mechLabel:"→ Disciplina inicial" },
  { n:7,  s:2, title:"Você teve acesso à educação formal?",
    hint:"Influencia acesso a conhecimentos teóricos e tradições.",
    ex:["Academia","Templo","Aprendizado informal","Autodidata"], type:"options" },
  { n:8,  s:2, title:"Qual habilidade você domina melhor?",
    hint:"Define sua especialização inicial — foco intenso dentro de uma Disciplina.",
    ex:[], type:"text", mech:"spec", mechLabel:"→ Especialização inicial" },
  { n:9,  s:3, title:"Quando você percebeu que o mundo canta?",
    hint:"Contribui para o RS inicial (junto com perguntas 10 e 11).",
    ex:["Desde criança","Durante o treinamento","Em um evento marcante","Ainda não compreendo completamente"],
    type:"options",
    rsV:{"Desde criança":2,"Durante o treinamento":1,"Em um evento marcante":1,"Ainda não compreendo completamente":0},
    mech:"rs", mechLabel:"→ RS +2 / +1 / +1 / +0" },
  { n:10, s:3, title:"Você foi treinado para usar magia?",
    hint:"Influencia acesso inicial a Partituras e rituais.",
    ex:["Treinamento formal","Aprendizado fragmentado","Tradição familiar","Nenhum treinamento"],
    type:"options",
    rsV:{"Treinamento formal":2,"Aprendizado fragmentado":1,"Tradição familiar":1,"Nenhum treinamento":0},
    mech:"rs", mechLabel:"→ RS +2 / +1 / +1 / +0" },
  { n:11, s:3, title:"Qual tradição musical mais influenciou você?",
    hint:"Define inclinação harmônica e escolas de magia mais acessíveis.",
    ex:["Litúrgica","Marcial","Erudita","Natural","Popular"],
    type:"options",
    rsV:{"Litúrgica":1,"Marcial":0,"Erudita":1,"Natural":0,"Popular":0},
    mech:"rs", mechLabel:"→ Inclinação harmônica + RS" },
  { n:12, s:3, title:"Qual som define sua memória mais forte?",
    hint:"Define identidade musical e possível Motivo secundário.",
    ex:["Canto coral","Ruído de batalha","Vento nas árvores","Máquinas ressonantes","Silêncio absoluto"], type:"text" },
  { n:13, s:4, title:"Quem você decepcionou?",
    hint:"Cria um rival, inimigo ou mentor frustrado.",
    ex:[], type:"text", mech:"rival", mechLabel:"→ Rival estabelecido" },
  { n:14, s:4, title:"Quem confia em você?",
    hint:"Cria um aliado que pode ajudar em momentos críticos.",
    ex:[], type:"text", mech:"aliado", mechLabel:"→ Aliado inicial" },
  { n:15, s:4, title:"Qual lei você já quebrou?",
    hint:"Define relação inicial com autoridades.",
    ex:["Contrabando","Heresia","Espionagem","Deserção","Rebelião"], type:"text" },
  { n:16, s:4, title:"Qual facção conhece seu nome?",
    hint:"+1 ponto de IP com essa facção. Define Honra inicial.",
    ex:["Harmonium","Ember Vanguard","Silent Accord","Verdant Shield","Silver Dawn","Ashen Path","Inquisição","Conselho de Ascendentes","Comércio de Olynn"],
    type:"text", mech:"faccao", mechLabel:"→ +1 IP com essa facção" },
  { n:17, s:5, title:"Qual foi sua maior vitória?",
    hint:"Gera uma Paixão positiva (nível 2–3).",
    ex:[], type:"text", mech:"paixao_pos", mechLabel:"→ Paixão positiva (nível 2–3)" },
  { n:18, s:5, title:"Qual foi seu maior fracasso?",
    hint:"Gera uma Paixão negativa (nível 2–3).",
    ex:[], type:"text", mech:"paixao_neg", mechLabel:"→ Paixão negativa (nível 2–3)" },
  { n:19, s:5, title:"Por que você continua lutando?",
    hint:"Motivação central do personagem no presente.",
    ex:["Fé","Liberdade","Conhecimento","Família","Poder","Redenção","Justiça","Vingança"], type:"text" },
  { n:20, s:5, title:"Qual é a nota que define sua alma?",
    hint:"Define o Motivo de Origem — tonalidade emocional e espiritual que orienta todo o desenvolvimento.",
    ex:["Esperança","Vingança","Devoção","Curiosidade","Liberdade","Ambição","Redenção","Proteção","Justiça","Conhecimento"],
    type:"text", mech:"motivo", mechLabel:"→ Motivo de Origem" },
]

// ── HELPERS ───────────────────────────────────────────────────────────────────
function stageOf(n: number) { return STAGES.find(s => s.qs.includes(n))! }

function clip(s: string, n: number) {
  if (!s) return "—"
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}

// ── CHARACTER SHEET TYPE ──────────────────────────────────────────────────────
interface CharSheet {
  // Identity
  name: string
  motivo_origem: string
  regiao: string
  ocupacao_familia: string
  infancia: string
  evento_juventude: string
  som_memoria: string

  // Attributes
  attributes: { Forca: string; Destreza: string; Ressonancia: string; Compostura: string; Agudeza: string; Firmeza: string }
  attribute_array: string

  // Disciplines
  disciplines: Record<string, number>

  // RS
  rs: number
  theosis_stage: string
  motif_capacity: number

  // Scar
  scar: { name: string; trigger: string; condition_applied: string; heightened_access: string; resolution: string }

  // Passions
  passions: { name: string; level: number }[]

  // Social
  honra: number
  ip_factions: { faction: string; ip: number }[]
  faction_standing: string
  grimoire_hook: string

  // NPCs
  aliado: string
  rival: string
  lei_quebrada: string

  // Magic
  partituras: { name: string; mode: string; effect: string; rhythm: string }[]

  // Combat
  combat_motifs: { name: string; type: string; condition: string; effect: string }[]

  // Equipment
  weapons: { name: string; tempo: string; function: string; speed: string }[]

  // Motivation
  motivacao: string
  escola: string

  // Narrative
  summary: string
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function CharacterCreatePage() {
  const [cur, setCur] = useState(0)
  const [ans, setAns] = useState<string[]>(Array(20).fill(""))
  const [generating, setGenerating] = useState(false)
  const [streamText, setStreamText] = useState("")
  const [sheet, setSheet] = useState<CharSheet | null>(null)
  const streamRef = useRef<HTMLDivElement>(null)

  const q = QS[cur]
  const stage = stageOf(q.n)
  const pct = ((cur + 1) / 20) * 100

  // Quick stats from answers
  const rsVal = calcRS(ans)
  const escola = ans[4]
  const faccao = ans[15]
  const motivo = ans[19]

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [cur, generating, sheet])

  function set(i: number, val: string) {
    setAns(prev => { const n = [...prev]; n[i] = val; return n })
  }

  function calcRS(a: string[]) {
    let rs = 2
    const v9 = QS[8].rsV, v10 = QS[9].rsV
    if (v9 && v9[a[8]] !== undefined) rs += v9[a[8]] - 1
    if (v10 && v10[a[9]] !== undefined) rs += v10[a[9]] - 1
    if (QS[10].rsV && QS[10].rsV[a[10]]) rs += 1
    return Math.max(2, Math.min(4, rs))
  }

  // ── AI Generation ─────────────────────────────────────────────────────
  async function generate() {
    setGenerating(true)
    setStreamText("")
    setSheet(null)
    try {
      const answersText = QS.map((qq, i) =>
        `P${qq.n} — ${qq.title}\n${ans[i] || "(sem resposta)"}`
      ).join("\n\n")

      const res = await fetch(STREAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: "",
          q1_inherit: `${ans[0]} · ${ans[1]}`,
          q2_survive: ans[2] + (ans[3] ? `\nEvento marcante: ${ans[3]}` : ""),
          q3_master: ans[5] + (ans[7] ? `\nEspecialização: ${ans[7]}` : ""),
          q4_denied: ans[15] ? `Facção: ${ans[15]}` : "",
          q5_carry: ans[19] + (ans[18] ? `\nMotivação: ${ans[18]}` : ""),
          answers_all: answersText,
          attribute_array: "balanced",
          education: ans[6],
          magic_training: ans[9],
          musical_tradition: ans[10],
          memory_sound: ans[11],
          name: "",
        }),
      })

      if (!res.ok || !res.body) throw new Error("Generation failed")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const raw = decoder.decode(value)
        for (const line of raw.split("\n\n")) {
          if (!line.startsWith("data:")) continue
          const payload = line.slice(5).trim()
          if (payload === "[DONE]") { tryParseSheet(buffer); break }
          try {
            const { text } = JSON.parse(payload)
            buffer += text
            setStreamText(buffer)
          } catch { buffer += payload; setStreamText(buffer) }
        }
      }
    } catch (e: any) {
      setStreamText(`Error: ${e.message}`)
    }
    setGenerating(false)
  }

  function tryParseSheet(full: string) {
    let jsonStr = full
    if (full.includes("```")) {
      for (const p of full.split("```")) {
        const c = p.startsWith("json") ? p.slice(4).trim() : p.trim()
        if (c.startsWith("{")) { jsonStr = c; break }
      }
    }
    const s = jsonStr.indexOf("{"), e = jsonStr.lastIndexOf("}")
    if (s !== -1 && e !== -1) {
      try { setSheet(JSON.parse(jsonStr.slice(s, e + 1))) } catch { /* keep raw */ }
    }
  }

  function reset() { setCur(0); setAns(Array(20).fill("")); setSheet(null); setStreamText(""); setGenerating(false) }
  function next() { if (cur < 19) setCur(c => c + 1); else generate() }
  function back() { if (cur > 0) setCur(c => c - 1) }

  // ─── Character Sheet Display ────────────────────────────────────────────
  if (sheet) {
    return <SheetView sheet={sheet} onReset={reset} raw={streamText} />
  }

  // ─── Streaming Generation ───────────────────────────────────────────────
  if (generating || streamText) {
    return (
      <div className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
        <h1 className="font-display text-2xl sm:text-3xl text-brass tracking-widest mb-6 text-center">
          Forjando Personagem
        </h1>
        {generating && (
          <div className="font-mono text-xs text-brass animate-pulse tracking-widest mb-4 text-center">
            CONSULTANDO A PRIMEIRA PERGUNTA…
          </div>
        )}
        <div ref={streamRef} className="bg-surface border border-border rounded-lg p-6 min-h-[300px]">
          <pre className="font-body text-sm text-parchment-dim whitespace-pre-wrap leading-relaxed">
            {streamText}
            {generating && <span className="animate-pulse">▋</span>}
          </pre>
        </div>
      </div>
    )
  }

  // ─── 20-Question Wizard ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-14 pb-10">
        <svg width="100" height="100" viewBox="0 0 60 60" fill="none" className="mb-7 animate-pulse">
          <circle cx="30" cy="30" r="27" stroke="#C8973A" strokeWidth="0.8" strokeOpacity="0.45"/>
          <circle cx="30" cy="30" r="18" stroke="#C8973A" strokeWidth="0.5" strokeOpacity="0.25"/>
          <path d="M30 6 C40 16 40 30 40 30 C40 44 30 54 30 54 C20 44 20 30 20 30 C20 16 30 6 30 6Z"
                stroke="#C8973A" strokeWidth="0.8" fill="none" strokeOpacity="0.6"/>
          <line x1="6" y1="30" x2="54" y2="30" stroke="#C8973A" strokeWidth="0.6" strokeOpacity="0.35"/>
          <line x1="30" y1="6" x2="30" y2="54" stroke="#C8973A" strokeWidth="0.6" strokeOpacity="0.2"/>
          <rect x="26.5" y="26.5" width="7" height="7" transform="rotate(45 30 30)"
                stroke="#C8973A" strokeWidth="0.8" fill="#C8973A" fillOpacity="0.15"/>
          <circle cx="30" cy="30" r="2.5" fill="#C8973A" fillOpacity="0.5"/>
        </svg>
        <h1 className="font-display text-2xl sm:text-4xl text-brass tracking-widest mb-4">As 20 Perguntas</h1>
        <div className="flex items-center gap-3 w-[200px] mb-4">
          <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-border" />
          <span className="text-xs text-marginalia">✦</span>
          <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-border" />
        </div>
        <p className="font-body text-parchment-dim italic text-sm leading-relaxed max-w-md">
          Etapa <span className="text-brass">{stage.n}</span> de 5 — <span className="text-brass">{stage.label}</span>
        </p>
        <p className="font-mono text-[0.55rem] tracking-[0.25em] uppercase text-marginalia mt-3">
          Ferramenta Interativa · Qamareth SRD
        </p>
      </section>

      <div className="max-w-2xl mx-auto px-6 pb-20">
        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-2.5 mb-7">
          {([
            { val: String(rsVal), name: "Ressonância", has: rsVal !== 2 },
            { val: clip(escola, 10), name: "Escola", has: !!escola },
            { val: clip(faccao, 10), name: "Facção", has: !!faccao },
            { val: clip(motivo, 10), name: "Motivo", has: !!motivo },
          ]).map(({ val, name, has }) => (
            <div key={name} className={`bg-surface border rounded-lg p-3.5 text-center relative overflow-hidden transition-colors ${has ? "border-steel/40" : "border-border"}`}>
              <div className={`absolute top-0 left-0 right-0 h-[2px] ${has ? "bg-gradient-to-r from-transparent via-steel/40 to-transparent" : "bg-transparent"}`} />
              <span className={`font-display text-lg ${has ? "text-brass" : "text-marginalia"}`}>{val}</span>
              <span className="block font-mono text-[0.45rem] tracking-widest uppercase text-marginalia mt-1">{name}</span>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div className="flex items-center gap-4 mb-10">
          <div className="flex-1 h-[1px] bg-border" />
          <div className="w-[100px] h-[2px] bg-surface-alt rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-steel/40 to-steel transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-[0.55rem] tracking-[0.3em] uppercase text-marginalia whitespace-nowrap">
            {cur + 1} / 20
          </span>
          <div className="flex-1 h-[1px] bg-border" />
        </div>

        {/* Question Card */}
        <div className="bg-surface border border-border rounded-lg p-7 sm:p-9 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-steel/30 to-transparent" />
          <div className="font-mono text-[0.5rem] tracking-[0.25em] uppercase text-marginalia mb-1">
            Pergunta {q.n < 10 ? "0" : ""}{q.n} · {stage.label}
          </div>
          <div className="font-display text-[3.5rem] sm:text-[5rem] text-surface-alt leading-none select-none -mb-3 -mt-2">
            {q.n < 10 ? "0" : ""}{q.n}
          </div>
          <h2 className="font-display text-lg sm:text-xl text-brass tracking-wide leading-snug mb-2.5">{q.title}</h2>
          <p className="font-body text-parchment-dim italic text-sm leading-relaxed">{q.hint}</p>

          {q.mechLabel && (
            <div className="bg-surface-alt border border-border border-l-2 border-l-steel/40 rounded-md p-3 mt-5">
              <span className="font-body text-parchment-dim text-sm italic">
                <strong className="text-brass not-italic">{q.mechLabel}</strong>
              </span>
            </div>
          )}

          {q.type === "options" && (
            <div className="grid grid-cols-2 gap-3 mt-5">
              {q.ex.map((e, i) => {
                const sel = ans[cur] === e
                return (
                  <button key={e} onClick={() => set(cur, e)}
                    className={`flex items-center gap-3.5 p-4 text-left rounded-md border transition-all
                      ${sel ? "border-steel bg-surface-alt" : "border-border bg-surface hover:border-steel/50 hover:bg-surface-alt hover:-translate-y-[1px]"}`}>
                    <span className={`text-base w-7 text-center flex-shrink-0 ${sel ? "text-brass" : "text-steel/40"}`}>{GLYPHS[i] || "·"}</span>
                    <span className={`font-body text-sm ${sel ? "text-parchment" : "text-parchment-dim"}`}>{e}</span>
                  </button>
                )
              })}
            </div>
          )}

          {q.ex.length > 0 && q.type === "text" && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {q.ex.map(e => (
                <button key={e} onClick={() => set(cur, e)}
                  className="font-mono text-[0.5rem] tracking-wider uppercase text-marginalia px-2.5 py-1 rounded-full border border-border hover:text-steel/60 hover:border-steel/30 hover:bg-steel/5 transition-all">{e}</button>
              ))}
            </div>
          )}

          <textarea
            value={ans[cur]}
            onChange={e => set(cur, e.target.value)}
            placeholder={q.type === "options" ? "Ou descreva livremente…" : "Escreva livremente…"}
            rows={4}
            className="w-full bg-surface-alt border border-border text-parchment font-body text-sm leading-relaxed p-4 mt-4 rounded-md resize-y focus:outline-none focus:border-steel/50 placeholder:text-marginalia placeholder:italic"
          />
        </div>

        {/* Navigation */}
        <div className="flex gap-3 items-center justify-center mt-7">
          {cur > 0 && (
            <button onClick={back}
              className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-marginalia hover:text-parchment border border-border px-5 py-3.5 rounded-sm transition-colors">
              ← Anterior
            </button>
          )}
          <button onClick={next}
            className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-ink bg-steel px-7 py-3.5 rounded-sm hover:bg-parchment transition-colors font-bold">
            {cur < 19 ? "Próxima →" : "Forjar Personagem ✦"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SHEET VIEW COMPONENT ────────────────────────────────────────────────────
function SheetView({ sheet, onReset, raw }: { sheet: CharSheet; onReset: () => void; raw: string }) {
  return (
    <div className="min-h-screen">
      <section className="flex flex-col items-center text-center px-6 pt-14 pb-10">
        <div className="flex items-center gap-3 w-[200px] mb-4">
          <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-border" />
          <span className="text-xs text-marginalia">✦</span>
          <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-border" />
        </div>
        <h1 className="font-display text-2xl sm:text-4xl text-brass tracking-widest mb-3">
          {sheet.name || "Personagem de Qamareth"}
        </h1>
        {sheet.motivo_origem && (
          <p className="font-body text-parchment-dim italic text-sm mb-2">
            &ldquo;{sheet.motivo_origem}&rdquo;
          </p>
        )}
        <p className="font-body text-marginalia text-sm">
          {[sheet.regiao, sheet.escola, sheet.faction_standing].filter(Boolean).join(" · ") || "Ficha gerada"}
        </p>
      </section>

      <div className="max-w-4xl mx-auto px-6 pb-20 space-y-4">

        {/* Core Mechanics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            [sheet.rs, "RS"],
            [sheet.theosis_stage, "Estágio"],
            [sheet.motif_capacity, "Cap. Motivo"],
            [sheet.honra, "Honra"],
            ["Claro", "Estado"],
          ].map(([val, name]) => (
            <div key={name} className="bg-surface border border-border rounded-lg p-4 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-steel/30 to-transparent" />
              <div className="font-display text-2xl text-brass">{val}</div>
              <div className="font-mono text-[0.45rem] tracking-widest uppercase text-marginalia mt-1">{name}</div>
            </div>
          ))}
        </div>

        {/* Attributes */}
        <div className="bg-surface border border-border rounded-lg p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-steel/30 to-transparent" />
          <div className="font-mono text-[0.5rem] tracking-widest uppercase text-steel/60 mb-4 pb-2 border-b border-border">Atributos</div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {Object.entries(sheet.attributes).map(([name, die]) => (
              <div key={name} className="text-center">
                <div className="font-mono text-[0.5rem] uppercase text-marginalia mb-1">{name}</div>
                <div className="font-display text-xl text-brass">{die}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Disciplines */}
        <div className="bg-surface border border-border rounded-lg p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-steel/30 to-transparent" />
          <div className="font-mono text-[0.5rem] tracking-widest uppercase text-steel/60 mb-4 pb-2 border-b border-border">Disciplinas</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(sheet.disciplines).map(([name, dice]) => (
              <div key={name} className="bg-surface-alt border border-border rounded-md px-3 py-2">
                <div className="font-mono text-[0.6rem] text-parchment">{name}</div>
                <div className="font-mono text-[0.6rem] text-brass text-right mt-0.5">
                  {"●".repeat(dice)}{"○".repeat(Math.max(0, 5 - dice))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Partituras + Combat Motifs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-surface border border-border rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-steel/30 to-transparent" />
            <div className="font-mono text-[0.5rem] tracking-widest uppercase text-steel/60 mb-3 pb-2 border-b border-border">Partituras</div>
            {sheet.partituras.map((p, i) => (
              <div key={i} className="mb-3 last:mb-0">
                <div className="font-body text-sm text-parchment font-bold">{p.name}</div>
                <div className="font-body text-xs text-parchment-dim">Modo: {p.mode} · {p.effect}</div>
                <div className="font-body text-xs text-marginalia">Ritmo: {p.rhythm}</div>
              </div>
            ))}
          </div>
          <div className="bg-surface border border-border rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-steel/30 to-transparent" />
            <div className="font-mono text-[0.5rem] tracking-widest uppercase text-steel/60 mb-3 pb-2 border-b border-border">Motivos de Combate</div>
            {sheet.combat_motifs.map((m, i) => (
              <div key={i} className="mb-3 last:mb-0">
                <div className="font-body text-sm text-parchment font-bold">{m.name}</div>
                <div className="font-body text-xs text-parchment-dim">[{m.type}]</div>
                <div className="font-body text-xs text-parchment-dim mt-1">{m.effect}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scar */}
        <div className="bg-surface border border-crimson/40 rounded-lg p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-crimson/40 to-transparent" />
          <div className="font-mono text-[0.5rem] tracking-widest uppercase text-crimson/60 mb-3 pb-2 border-b border-border">
            Cicatriz: {sheet.scar.name}
          </div>
          <div className="space-y-1.5 text-sm">
            <div><span className="font-mono text-[0.55rem] uppercase text-marginalia">Gatilho: </span><span className="text-parchment-dim">{sheet.scar.trigger}</span></div>
            <div><span className="font-mono text-[0.55rem] uppercase text-marginalia">Efeito: </span><span className="text-parchment-dim">{sheet.scar.condition_applied}</span></div>
            <div><span className="font-mono text-[0.55rem] uppercase text-marginalia">Acesso Elevado: </span><span className="text-parchment-dim">{sheet.scar.heightened_access}</span></div>
            <div><span className="font-mono text-[0.55rem] uppercase text-marginalia">Resolução: </span><span className="text-parchment-dim">{sheet.scar.resolution}</span></div>
          </div>
        </div>

        {/* Passions */}
        {sheet.passions.length > 0 && (
          <div className="bg-surface border border-border rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-steel/30 to-transparent" />
            <div className="font-mono text-[0.5rem] tracking-widest uppercase text-steel/60 mb-3 pb-2 border-b border-border">Paixões</div>
            <div className="flex flex-wrap gap-2">
              {sheet.passions.map(p => (
                <span key={p.name} className={`text-xs px-3 py-1 rounded-full border ${
                  p.level >= 6 ? "border-crimson text-crimson/80" :
                  p.level >= 3 ? "border-steel/30 text-steel" :
                  "border-border text-parchment-dim"
                }`}>
                  {p.name} (Nv. {p.level})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Faction + Social */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-surface border border-border rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-steel/30 to-transparent" />
            <div className="font-mono text-[0.5rem] tracking-widest uppercase text-steel/60 mb-3 pb-2 border-b border-border">Posição Social</div>
            <div className="space-y-2 text-sm">
              <div><span className="font-mono text-[0.55rem] uppercase text-marginalia">Facção: </span><span className="text-parchment">{sheet.faction_standing}</span></div>
              <div><span className="font-mono text-[0.55rem] uppercase text-marginalia">Grimório: </span><span className="text-parchment-dim">{sheet.grimoire_hook}</span></div>
              {sheet.ip_factions.length > 0 && (
                <div>
                  <span className="font-mono text-[0.55rem] uppercase text-marginalia">IP: </span>
                  {sheet.ip_factions.map(f => (
                    <span key={f.faction} className="text-parchment-dim">{f.faction} ({f.ip}) </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-steel/30 to-transparent" />
            <div className="font-mono text-[0.5rem] tracking-widest uppercase text-steel/60 mb-3 pb-2 border-b border-border">Relacionamentos</div>
            <div className="space-y-2 text-sm">
              {sheet.aliado && <div><span className="font-mono text-[0.55rem] uppercase text-marginalia">Aliado: </span><span className="text-grove">{sheet.aliado}</span></div>}
              {sheet.rival && <div><span className="font-mono text-[0.55rem] uppercase text-marginalia">Rival: </span><span className="text-crimson/80">{sheet.rival}</span></div>}
              {sheet.lei_quebrada && <div><span className="font-mono text-[0.55rem] uppercase text-marginalia">Lei Quebrada: </span><span className="text-parchment-dim">{sheet.lei_quebrada}</span></div>}
            </div>
          </div>
        </div>

        {/* Weapons */}
        {sheet.weapons.length > 0 && (
          <div className="bg-surface border border-border rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-steel/30 to-transparent" />
            <div className="font-mono text-[0.5rem] tracking-widest uppercase text-steel/60 mb-3 pb-2 border-b border-border">Armas & Equipamento</div>
            <div className="flex flex-wrap gap-3">
              {sheet.weapons.map((w, i) => (
                <div key={i} className="bg-surface-alt border border-border rounded-md px-4 py-2">
                  <div className="font-body text-sm text-parchment font-bold">{w.name}</div>
                  <div className="font-mono text-[0.55rem] text-marginalia">
                    {w.tempo} · {w.function} · Vel. {w.speed}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Backstory */}
        {sheet.summary && (
          <div className="bg-surface border border-border rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-steel/30 to-transparent" />
            <div className="font-mono text-[0.5rem] tracking-widest uppercase text-steel/60 mb-3 pb-2 border-b border-border">História</div>
            <pre className="font-body text-sm text-parchment-dim whitespace-pre-wrap leading-relaxed">{sheet.summary}</pre>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 justify-center">
          <button onClick={() => window.print()}
            className="font-mono text-xs text-steel hover:text-parchment border border-border px-6 py-3 tracking-widest uppercase">
            IMPRIMIR / PDF
          </button>
          <button onClick={() => {
            const blob = new Blob([JSON.stringify(sheet, null, 2)], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a"); a.href = url; a.download = `${(sheet.name||"personagem").toLowerCase().replace(/\s+/g,"-")}.json`; a.click()
          }}
            className="font-mono text-xs text-steel hover:text-parchment border border-border px-6 py-3 tracking-widest uppercase">
            EXPORTAR JSON
          </button>
          <button onClick={onReset}
            className="font-mono text-xs text-brass hover:text-parchment border border-border px-6 py-3 tracking-widest uppercase">
            NOVO PERSONAGEM
          </button>
        </div>
      </div>
    </div>
  )
}
