"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { submitTask, listJobs } from "@/lib/api"
import type { Job, TaskType } from "@/lib/types"

export default function TasksPage() {
  const [jobs, setJobs]         = useState<Job[]>([])
  const [taskType, setTaskType] = useState<TaskType>("lore_ingest")
  const [file, setFile]         = useState<File | null>(null)
  const [auditText, setAuditText] = useState("")
  const [auditName, setAuditName] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setJobs(await listJobs())
  }

  useEffect(() => { load() }, [])

  async function submit() {
    setSubmitting(true)
    if (taskType === "lore_ingest" && file) {
      await submitTask("lore_ingest", file)
    } else if (taskType === "audit") {
      await submitTask("audit", undefined,
        { element_name: auditName, element_text: auditText })
    }
    await load()
    setSubmitting(false)
    setFile(null)
    setAuditText("")
    setAuditName("")
  }

  const statusColor = (s: string) => ({
    queued:   "text-marginalia",
    running:  "text-brass",
    complete: "text-grove",
    failed:   "text-crimson",
  }[s] ?? "text-parchment-dim")

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl text-parchment mb-8 tracking-wide">
        Batch Tasks
      </h1>

      {/* Submit form */}
      <div className="bg-surface border border-border p-6 mb-8 space-y-4">
        <div className="flex gap-4">
          {(["lore_ingest", "audit"] as TaskType[]).map(t => (
            <button
              key={t}
              onClick={() => setTaskType(t)}
              className={`font-mono text-xs px-4 py-2 border transition-colors
                ${taskType === t
                  ? "border-steel text-steel"
                  : "border-border text-marginalia hover:border-parchment-dim"
                }`}
            >
              {t.replace("_", " ").toUpperCase()}
            </button>
          ))}
        </div>

        {taskType === "lore_ingest" && (
          <div>
            <label className="font-mono text-xs text-marginalia block mb-2">
              LORE DOCUMENT (.txt or .md)
            </label>
            <input
              type="file"
              accept=".txt,.md,.pdf"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="font-mono text-xs text-parchment-dim file:bg-surface-alt
                         file:border file:border-border file:text-parchment
                         file:font-mono file:text-xs file:px-3 file:py-1 file:mr-4"
            />
          </div>
        )}

        {taskType === "audit" && (
          <div className="space-y-3">
            <div>
              <label className="font-mono text-xs text-marginalia block mb-1">
                ELEMENT NAME
              </label>
              <input
                value={auditName}
                onChange={e => setAuditName(e.target.value)}
                placeholder="e.g. Collective Amplification mechanic"
                className="w-full bg-surface-alt border border-border text-parchment
                           font-body text-sm px-3 py-2 focus:outline-none focus:border-steel
                           placeholder:text-marginalia"
              />
            </div>
            <div>
              <label className="font-mono text-xs text-marginalia block mb-1">
                ELEMENT TEXT
              </label>
              <textarea
                value={auditText}
                onChange={e => setAuditText(e.target.value)}
                rows={6}
                placeholder="Paste the rule text, lore entry, or mechanic to audit..."
                className="w-full bg-surface-alt border border-border text-parchment
                           font-body text-sm px-3 py-2 resize-none focus:outline-none
                           focus:border-steel placeholder:text-marginalia"
              />
            </div>
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting || (taskType === "lore_ingest" && !file)}
          className="px-6 py-2 bg-steel text-ink font-mono text-xs tracking-widest
                     uppercase disabled:opacity-40 disabled:cursor-not-allowed
                     hover:bg-parchment transition-colors"
        >
          {submitting ? "SUBMITTING…" : "SUBMIT TASK"}
        </button>
      </div>

      {/* Job list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-xs text-marginalia tracking-widest">RECENT JOBS</h2>
          <button onClick={load}
            className="font-mono text-xs text-steel hover:text-parchment">
            REFRESH
          </button>
        </div>
        {jobs.map(job => (
          <Link key={job.id} href={`/tasks/${job.id}`}
            className="block bg-surface border border-border px-4 py-3
                       hover:border-steel transition-colors group">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-parchment-dim">
                {job.task_type.replace("_", " ").toUpperCase()}
              </span>
              <span className={`font-mono text-xs uppercase ${statusColor(job.status)}`}>
                {job.status}
              </span>
            </div>
            <div className="font-mono text-xs text-marginalia mt-1">
              {job.id.slice(0, 8)}… · {new Date(job.created_at).toLocaleString()}
            </div>
          </Link>
        ))}
        {jobs.length === 0 && (
          <p className="font-mono text-xs text-marginalia text-center py-8">
            No jobs yet.
          </p>
        )}
      </div>
    </div>
  )
}
