# Phase 5 — Deploy to Railway + Vercel

## What you're deploying
- Backend (FastAPI + LangGraph) → Railway
- Redis → Railway (managed service)
- Frontend (Next.js) → Vercel

## Prerequisites
- Phases 1–4 complete and working locally
- Railway CLI installed: `npm install -g @railway/cli`
- Vercel CLI installed: `npm install -g vercel`
- Both CLIs logged in: `railway login` and `vercel login`

---

## Part A — Railway (Backend)

### Step 1: Initialize Railway project
```bash
cd qamareth-agents
railway init
# When prompted: create a new project
# Name it: qamareth-agents
```

### Step 2: Add Redis
In the Railway dashboard (railway.app):
1. Open your `qamareth-agents` project
2. Click **+ New** → **Database** → **Add Redis**
3. Railway will automatically inject `REDIS_URL` into your app environment

### Step 3: Set environment variables
```bash
railway variables set ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
# ALLOWED_ORIGIN comes after Vercel deploy — set it then
```

### Step 4: Verify railway.toml exists
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1"
restartPolicyType = "on-failure"
restartPolicyMaxRetries = 3
```

### Step 5: Deploy
```bash
railway up
```

### Step 6: Get your deployment URL
```bash
railway domain
# → something like: https://qamareth-agents-production.up.railway.app
```
Copy this URL — you need it for Vercel.

### Step 7: Verify backend is live
```bash
curl https://YOUR_RAILWAY_URL.up.railway.app/agents
# Should return JSON array of all 15 agents
```

---

## Part B — Vercel (Frontend)

### Step 1: Deploy
```bash
cd qamareth-agent-ui
vercel deploy --prod
```

### Step 2: Set environment variable
In Vercel dashboard → Your project → Settings → Environment Variables:

| Key | Value |
|-----|-------|
| `BACKEND_URL` | `https://YOUR_RAILWAY_URL.up.railway.app` |

**No trailing slash on the URL.**

Redeploy after setting:
```bash
vercel deploy --prod
```

### Step 3: Get your Vercel URL
```bash
# Shown after deploy, or in dashboard
# → something like: https://qamareth-agent-ui.vercel.app
```

---

## Part C — Finish Railway CORS config

Now that you have the Vercel URL, update Railway:
```bash
cd qamareth-agents
railway variables set ALLOWED_ORIGIN=https://YOUR_VERCEL_URL.vercel.app
```

Railway redeploys automatically.

---

## Smoke tests (run after both are live)

```bash
RAILWAY=https://YOUR_RAILWAY_URL.up.railway.app
VERCEL=https://YOUR_VERCEL_URL.vercel.app

# 1. Agents endpoint
curl $RAILWAY/agents | head -c 200

# 2. Registry endpoint  
curl $RAILWAY/registry | python3 -m json.tool | head -20

# 3. Chat stream (direct)
curl -X POST $RAILWAY/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"agent":"master-architect","messages":[{"role":"user","content":"List your sub-agents."}],"orchestrated":false}'

# 4. Frontend loads
open $VERCEL
```

---

## Ongoing deployment

For backend changes:
```bash
cd qamareth-agents
railway up
```

For frontend changes:
```bash
cd qamareth-agent-ui
vercel deploy --prod
```

Skill file changes (`.md` files) require a backend redeploy since they're loaded from disk at startup.

---

## Done when
- `GET https://YOUR_RAILWAY_URL/agents` returns all 15 agents
- Chat works from the Vercel frontend (tokens stream without CORS errors)
- Task submission works from the Vercel frontend
- No `REDIS_URL` errors in Railway logs (check: Railway dashboard → Deployments → Logs)

---

## Troubleshooting

**CORS errors in browser:**
Check `ALLOWED_ORIGIN` on Railway matches your exact Vercel URL (no trailing slash).

**`REDIS_URL` not set:**
In Railway dashboard, confirm the Redis service is in the same project and linked.
Check: Project → Variables → should show `REDIS_URL` auto-injected.

**SSE not streaming (getting full response at once):**
Vercel's serverless functions have a 4.5MB response limit but support streaming.
Make sure the proxy `route.ts` is passing `res.body` directly and not buffering.
If the issue persists, check that `Content-Type: text/event-stream` is set in the response.

**Skills not loading (500 on any chat request):**
The skill `.md` files must be committed to git — Railway builds from the repo.
Run `git add skills/ && git commit && railway up`.
