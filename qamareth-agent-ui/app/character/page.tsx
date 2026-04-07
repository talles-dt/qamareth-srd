"use client"
import { useState, useEffect } from "react"

// ── DATA ──────────────────────────────────────────────────────────────────────
const STAGES = [
  { n: 1, label: "Origem",     qs: [1, 2, 3, 4] },
  { n: 2, label: "Formação",   qs: [5, 6, 7, 8] },
  { n: 3, label: "Harmonia",   qs: [9, 10, 11, 12] },
  { n: 4, label: "Conflitos",  qs: [13, 14, 15, 16] },
  { n: 5, label: "Destino",    qs: [17, 18, 19, 20] },
]

const GLYPHS = ["✦","☽","♩","⚔","♬","⬡","✧","◈","⚜","⌘","☽","✦","✸","✦","⚔","⬡","✦","✸","♩","◈"]

interface Question {
  n: number
  s: number
  title: string
  hint: string
  ex: string[]
  type: "text" | "options"
  mech?: string
  mechLabel?: string
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

function calcRS(ans: string[]) {
  let rs = 2
  const v9 = QS[8].rsV, v10 = QS[9].rsV, v11 = QS[10].rsV
  if (v9  && v9[ans[8]]  !== undefined) rs += v9[ans[8]] - 1
  if (v10 && v10[ans[9]] !== undefined) rs += v10[ans[9]] - 1
  if (v11 && v11[ans[10]] !== undefined) rs += 1
  return Math.max(2, Math.min(4, rs))
}

function clip(s: string, n: number) {
  if (!s) return "—"
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function CharacterCreatePage() {
  const [cur, setCur] = useState(0)
  const [ans, setAns] = useState<string[]>(Array(20).fill(""))
  const [done, setDone] = useState(false)

  const q = QS[cur]
  const stage = stageOf(q.n)
  const rs = calcRS(ans)
  const pct = ((cur + 1) / 20) * 100
  const escola = ans[4]
  const faccao = ans[15]
  const motivo = ans[19]

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [cur, done])

  function set(i: number, val: string) {
    setAns(prev => { const n = [...prev]; n[i] = val; return n })
  }

  function next() {
    if (cur < 19) setCur(c => c + 1)
    else setDone(true)
  }

  function back() {
    if (cur > 0) setCur(c => c - 1)
  }

  function reset() {
    setCur(0)
    setAns(Array(20).fill(""))
    setDone(false)
  }

  // ── Character Sheet ──────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen">
        {/* Sheet Hero */}
        <section className="flex flex-col items-center text-center px-6 py-16">
          <h1 className="font-display text-3xl sm:text-4xl text-brass tracking-wide mb-4">
            {motivo || "Personagem de Qamareth"}
          </h1>
          <p className="font-body text-marginalia italic text-sm">
            {[ans[0], ans[4], ans[15]].filter(Boolean).join(" · ") || "Ficha gerada pelas 20 Perguntas"}
          </p>
        </section>

        <div className="max-w-4xl mx-auto px-6 pb-20 space-y-4">

          {/* Mechanics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              [rs, "RS inicial"],
              ["10", "Disciplinas"],
              [clip(faccao, 12), "Facção"],
              [clip(motivo, 12), "Motivo"],
            ].map(([val, name]) => (
              <div key={name} className="bg-surface border border-border rounded-lg p-4 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-steel/30 to-transparent" />
                <div className="font-display text-2xl text-brass">{val}</div>
                <div className="font-mono text-[0.5rem] tracking-widest uppercase text-marginalia mt-1">{name}</div>
              </div>
            ))}
          </div>

          {/* School & Discipline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-surface border border-border rounded-lg p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-steel/30 to-transparent" />
              <div className="font-mono text-[0.5rem] tracking-widest uppercase text-steel/60 mb-3 pb-2 border-b border-border">Escola & Formação</div>
              {escola && <p className="font-body text-parchment text-sm">{escola}</p>}
              {ans[5] && <p className="font-body text-parchment-dim text-sm mt-1">Disciplina: {ans[5]}</p>}
              {ans[7] && <p className="font-body text-parchment-dim text-sm mt-1">Especialização: {ans[7]}</p>}
            </div>
            <div className="bg-surface border border-border rounded-lg p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-steel/30 to-transparent" />
              <div className="font-mono text-[0.5rem] tracking-widest uppercase text-steel/60 mb-3 pb-2 border-b border-border">Relações</div>
              {ans[13] && <p className="font-body text-parchment-dim text-sm"><span className="text-parchment font-bold">Rival: </span>{ans[13]}</p>}
              {ans[14] && <p className="font-body text-parchment-dim text-sm mt-1"><span className="text-parchment font-bold">Aliado: </span>{ans[14]}</p>}
            </div>
          </div>

          {/* Passions */}
          {[ans[2], ans[16], ans[17]].filter(Boolean).length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-steel/30 to-transparent" />
              <div className="font-mono text-[0.5rem] tracking-widest uppercase text-steel/60 mb-3 pb-2 border-b border-border">Paixões</div>
              <div className="flex flex-wrap gap-2">
                {ans[2] && (
                  <span className="text-xs px-3 py-1 rounded-full border border-border text-parchment-dim">{clip(ans[2], 28)}</span>
                )}
                {ans[16] && (
                  <span className="text-xs px-3 py-1 rounded-full border border-steel/30 text-steel">{clip(ans[16], 28)}</span>
                )}
                {ans[17] && (
                  <span className="text-xs px-3 py-1 rounded-full border border-crimson text-crimson/80">{clip(ans[17], 28)}</span>
                )}
              </div>
            </div>
          )}

          {/* Question Log */}
          <div className="bg-surface border border-border rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-steel/30 to-transparent" />
            <div className="font-mono text-[0.5rem] tracking-widest uppercase text-steel/60 mb-4 pb-2 border-b border-border">Respostas — As 20 Perguntas</div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {QS.map((qq, i) => (
                <div key={qq.n} className="border-b border-border/50 pb-3 last:border-0">
                  <div className="font-mono text-[0.5rem] tracking-widest uppercase text-steel/60 mb-1">
                    Pergunta {qq.n < 10 ? "0" : ""}{qq.n} · {stageOf(qq.n).label}
                  </div>
                  <p className="font-body text-sm text-parchment-dim leading-relaxed">
                    {ans[i] || <span className="text-marginalia italic">sem resposta</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-3 pt-4">
            <button
              onClick={() => window.print()}
              className="font-mono text-xs text-steel hover:text-parchment border border-border px-6 py-3 tracking-widest uppercase"
            >
              IMPRIMIR / PDF
            </button>
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify({ answers: ans, rs, escola, faccao, motivo }, null, 2)], { type: "application/json" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = "personagem-qamareth.json"
                a.click()
              }}
              className="font-mono text-xs text-steel hover:text-parchment border border-border px-6 py-3 tracking-widest uppercase"
            >
              EXPORTAR JSON
            </button>
            <button
              onClick={reset}
              className="font-mono text-xs text-brass hover:text-parchment border border-border px-6 py-3 tracking-widest uppercase"
            >
              NOVO PERSONAGEM
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Wizard ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-14 pb-10">
        <svg width="100" height="100" viewBox="0 0 60 60" fill="none" className="mb-7 animate-pulse">
          <circle cx="30" cy="30" r="27" stroke="var(--color-brass, #C8973A)" strokeWidth="0.8" strokeOpacity="0.45"/>
          <circle cx="30" cy="30" r="18" stroke="var(--color-brass, #C8973A)" strokeWidth="0.5" strokeOpacity="0.25"/>
          <path d="M30 6 C40 16 40 30 40 30 C40 44 30 54 30 54 C20 44 20 30 20 30 C20 16 30 6 30 6Z"
                stroke="var(--color-brass, #C8973A)" strokeWidth="0.8" fill="none" strokeOpacity="0.6"/>
          <line x1="6" y1="30" x2="54" y2="30" stroke="var(--color-brass, #C8973A)" strokeWidth="0.6" strokeOpacity="0.35"/>
          <line x1="30" y1="6" x2="30" y2="54" stroke="var(--color-brass, #C8973A)" strokeWidth="0.6" strokeOpacity="0.2"/>
          <rect x="26.5" y="26.5" width="7" height="7" transform="rotate(45 30 30)"
                stroke="var(--color-brass, #C8973A)" strokeWidth="0.8" fill="var(--color-brass, #C8973A)" fillOpacity="0.15"/>
          <circle cx="30" cy="30" r="2.5" fill="var(--color-brass, #C8973A)" fillOpacity="0.5"/>
        </svg>
        <h1 className="font-display text-2xl sm:text-4xl text-brass tracking-widest mb-4">
          As 20 Perguntas
        </h1>
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
            { val: String(rs), name: "Ressonância", has: rs !== undefined && rs !== 2 },
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
          <h2 className="font-display text-lg sm:text-xl text-brass tracking-wide leading-snug mb-2.5">
            {q.title}
          </h2>
          <p className="font-body text-parchment-dim italic text-sm leading-relaxed">
            {q.hint}
          </p>

          {/* Mechanic Note */}
          {q.mechLabel && (
            <div className="bg-surface-alt border border-border border-l-2 border-l-steel/40 rounded-md p-3 mt-5">
              <span className="font-body text-parchment-dim text-sm italic">
                <strong className="text-brass not-italic">{q.mechLabel}</strong>
              </span>
            </div>
          )}

          {/* Options Grid */}
          {q.type === "options" && (
            <div className="grid grid-cols-2 gap-3 mt-5">
              {q.ex.map((e, i) => {
                const selected = ans[cur] === e
                return (
                  <button
                    key={e}
                    onClick={() => set(cur, e)}
                    className={`flex items-center gap-3.5 p-4 text-left rounded-md border transition-all
                      ${selected
                        ? "border-steel bg-surface-alt shadow-[0_0_0_1px_rgba(123,157,180,0.15)]"
                        : "border-border bg-surface hover:border-steel/50 hover:bg-surface-alt hover:-translate-y-[1px]"
                      }`}
                  >
                    <span className={`text-base w-7 text-center flex-shrink-0 ${selected ? "text-brass" : "text-steel/40"}`}>
                      {GLYPHS[i] || "·"}
                    </span>
                    <span className={`font-body text-sm ${selected ? "text-parchment" : "text-parchment-dim"}`}>{e}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Example Tags */}
          {q.ex.length > 0 && q.type === "text" && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {q.ex.map(e => (
                <button
                  key={e}
                  onClick={() => set(cur, e)}
                  className="font-mono text-[0.5rem] tracking-wider uppercase text-marginalia px-2.5 py-1 rounded-full border border-border hover:text-steel/60 hover:border-steel/30 hover:bg-steel/5 transition-all"
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {/* Textarea */}
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
            <button
              onClick={back}
              className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-marginalia hover:text-parchment border border-border px-5 py-3.5 rounded-sm transition-colors"
            >
              ← Anterior
            </button>
          )}
          <button
            onClick={next}
            className="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-ink bg-steel px-7 py-3.5 rounded-sm hover:bg-parchment transition-colors font-bold"
          >
            {cur < 19 ? "Próxima →" : "Gerar ficha ✦"}
          </button>
        </div>
      </div>
    </div>
  )
}
