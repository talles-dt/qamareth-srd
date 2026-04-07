import Link from "next/link"

const TEMPLATES = [
  {
    slug: "character",
    title: "As 20 Perguntas",
    subtitle: "Character Creation",
    description:
      "Criação de personagem através de história, não de fichas. Responda às 20 perguntas e gere uma ficha mecânica completa.",
    tag: "Ferramenta Interativa",
  },
]

export default function TemplatesPage() {
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="font-display text-3xl text-parchment mb-2 tracking-wide">
        Templates
      </h1>
      <p className="font-body text-parchment-dim text-sm mb-10">
        Ferramentas e modelos prontos para uso com o sistema Qamareth SRD.
      </p>

      <div className="space-y-4">
        {TEMPLATES.map(t => (
          <Link
            key={t.slug}
            href={`/templates/${t.slug}`}
            className="block bg-surface border border-border rounded-lg p-6 hover:border-steel transition-colors group"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-display text-xl text-parchment group-hover:text-brass transition-colors">
                  {t.title}
                </div>
                <div className="font-mono text-xs text-steel/60 tracking-widest mt-1">
                  {t.subtitle}
                </div>
                <p className="font-body text-sm text-parchment-dim mt-3 leading-relaxed">
                  {t.description}
                </p>
              </div>
              <span className="font-mono text-[0.5rem] tracking-widest uppercase text-marginalia border border-border px-3 py-1 rounded-full shrink-0">
                {t.tag}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
