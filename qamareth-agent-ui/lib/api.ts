const PROXY = "/api/proxy"

import type { Job, CharacterSheet } from "./types"

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

export async function submitTask(
  taskType: string,
  file?: File,
  payload: Record<string, unknown> = {}
): Promise<{ job_id: string }> {
  const form = new FormData()
  form.append("task_type", taskType)
  form.append("payload_json", JSON.stringify(payload))
  if (file) form.append("file", file)
  const res = await fetch(`${PROXY}/task/submit`, { method: "POST", body: form })
  return res.json()
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await fetch(`${PROXY}/task/${jobId}`)
  return res.json()
}

export async function listJobs(): Promise<Job[]> {
  const res = await fetch(`${PROXY}/tasks`)
  return res.json()
}

export async function commitToRegistry(
  entryType: string,
  entry: Record<string, unknown>
): Promise<void> {
  await fetch(`${PROXY}/registry/${entryType}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  })
}

export async function createCharacter(
  data: {
    concept?: string
    q1_inherit?: string
    q2_survive?: string
    q3_master?: string
    q4_denied?: string
    q5_carry?: string
    name?: string
    attribute_array?: string
  }
): Promise<{ status: string; character?: CharacterSheet; raw?: string }> {
  const res = await fetch(`${PROXY}/character/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }

  const text = await res.text()
  if (!text.trim()) {
    throw new Error("Empty response from server")
  }

  return JSON.parse(text)
}
