import { NextRequest, NextResponse } from "next/server"

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
      status: res.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  }

  // Buffer the response to avoid stream issues with long-running requests
  const data = await res.arrayBuffer()
  return new Response(data, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/json",
    },
  })
}

export const GET  = (req: NextRequest, ctx: any) => forward(req, ctx.params)
export const POST = (req: NextRequest, ctx: any) => forward(req, ctx.params)
