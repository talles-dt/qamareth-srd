"use client"
import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { getJob } from "@/lib/api"
import type { Job } from "@/lib/types"

function renderPasses(obj: Record<string, unknown>): React.ReactNode {
  if (!obj.passes || typeof obj.passes !== "object") return null
  return Object.entries(obj.passes as Record<string, string>).map(([name, content]) => (
    <div key={name} className="bg-surface border border-border">
      <div className="px-4 py-2 border-b border-border">
        <span className="font-mono text-xs text-steel uppercase tracking-widest">
          {name}
        </span>
      </div>
      <pre className="px-4 py-4 text-xs text-parchment-dim font-mono
                      whitespace-pre-wrap overflow-x-auto leading-relaxed">
        {content}
      </pre>
    </div>
  ))
}

function renderAudit(obj: Record<string, unknown>): React.ReactNode {
  if (!obj.audit) return null
  return (
    <div className="bg-surface border border-border">
      <div className="px-4 py-2 border-b border-border">
        <span className="font-mono text-xs text-steel uppercase tracking-widest">
          AUDIT RECORD — {String(obj.element)}
        </span>
      </div>
      <pre className="px-4 py-4 text-xs text-parchment-dim font-mono
                      whitespace-pre-wrap overflow-x-auto leading-relaxed">
        {String(obj.audit)}
      </pre>
    </div>
  )
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<Job | null>(null)

  const load = useCallback(async () => {
    setJob(await getJob(id))
  }, [id])

  useEffect(() => {
    load()
    // Poll while running
    const interval = setInterval(async () => {
      const j = await getJob(id)
      setJob(j)
      if (j.status === "complete" || j.status === "failed") {
        clearInterval(interval)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [id, load])

  if (!job) return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="font-mono text-xs text-marginalia animate-pulse">LOADING…</span>
    </div>
  )

  let resultObj: Record<string, unknown> | null = null
  if (job.result) {
    try { resultObj = JSON.parse(job.result) } catch {}
  }

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <Link href="/tasks"
        className="font-mono text-xs text-steel hover:text-parchment mb-6 block">
        ← BACK TO TASKS
      </Link>

      <div className="bg-surface border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs text-parchment-dim uppercase">
            {job.task_type.replace("_", " ")}
          </span>
          <span className={`font-mono text-xs uppercase
            ${job.status === "complete" ? "text-grove"
            : job.status === "failed"   ? "text-crimson"
            : job.status === "running"  ? "text-brass animate-pulse"
            : "text-marginalia"}`}>
            {job.status}
          </span>
        </div>
        <div className="font-mono text-xs text-marginalia">
          {job.id} · {new Date(job.created_at).toLocaleString()}
        </div>
      </div>

      {job.status === "failed" && job.error && (
        <div className="bg-surface border border-crimson p-4 mb-6">
          <p className="font-mono text-xs text-crimson">{job.error}</p>
        </div>
      )}

      {resultObj && (
        <div className="space-y-4">
          {renderPasses(resultObj)}
          {renderAudit(resultObj)}
        </div>
      )}

      {job.status === "running" && (
        <div className="text-center py-12">
          <span className="font-mono text-xs text-brass animate-pulse tracking-widest">
            PROCESSING…
          </span>
        </div>
      )}
    </div>
  )
}
