# Phase 6 — n8n Lore Ingestion Pipeline

## What you're building
An n8n workflow that:
1. Accepts a lore document upload (triggered manually or on a schedule)
2. Sends it to the backend Lore Archivist pipeline
3. Polls until complete
4. Commits MDX stubs to the `qamareth-srd` GitHub repo
5. Optionally updates the SRD registry with extracted lore entities

## Prerequisites
- Phase 5 (deployment) complete — backend live on Railway
- n8n instance running (self-hosted on Railway, or n8n.cloud)
- GitHub personal access token with `repo` write scope
- `qamareth-srd` Astro repo exists on GitHub

---

## n8n Workflow — Node by Node

### Overview
```
Manual Trigger
  → Read Binary File (or HTTP webhook)
  → HTTP Request: POST /task/submit
  → Set: extract job_id
  → Wait 10s
  → Loop:
      HTTP Request: GET /task/:id
      IF status == complete → break
      IF status == failed   → stop + notify
      ELSE → Wait 10s → loop
  → Code: parse result, extract MDX stubs
  → Loop over stubs:
      GitHub: Create or Update File
  → Loop over lore entities:
      HTTP Request: POST /registry/lore_entities
```

---

## Node configurations

### Node 1: Manual Trigger
- Type: **Manual Trigger**
- No configuration needed
- Use this to kick off a pipeline run on demand

---

### Node 2: Read Binary File
- Type: **Read/Write Files from Disk** (n8n built-in)
- Operation: Read File
- File Path: `/path/to/your/lore-document.txt`
  *(Or replace this node with an HTTP Webhook that accepts file uploads)*

**Alternative — use HTTP Webhook instead:**
- Type: **Webhook**
- HTTP Method: POST
- Response Mode: Last Node
- Accepts multipart form data with a `file` field

---

### Node 3: HTTP Request — Submit Task
- Type: **HTTP Request**
- Method: POST
- URL: `https://YOUR_RAILWAY_URL.up.railway.app/task/submit`
- Body Content Type: **Form-Data**
- Form fields:
  - `task_type`: `lore_ingest` (string)
  - `file`: `{{ $binary.data }}` (binary — reference the file from Node 2)
  - `payload_json`: `{}` (string)

---

### Node 4: Set — Extract Job ID
- Type: **Set**
- Assignment:
  - Name: `job_id`
  - Value: `{{ $json.job_id }}`

---

### Node 5: Wait
- Type: **Wait**
- Wait Amount: 10
- Wait Unit: Seconds

---

### Node 6: HTTP Request — Poll Job Status
- Type: **HTTP Request**
- Method: GET
- URL: `https://YOUR_RAILWAY_URL.up.railway.app/task/{{ $('Set').item.json.job_id }}`

---

### Node 7: IF — Check Status
- Type: **IF**
- Condition 1: `{{ $json.status }}` equals `complete` → **True branch → continue**
- Condition 2: `{{ $json.status }}` equals `failed`  → **False branch → stop**
- If neither: loop back to Node 5 (Wait)

To create the loop: connect the **else** output of the IF node back to Node 5.
*(In n8n, drag the output connector back to the Wait node.)*

---

### Node 8: Code — Parse Result and Extract Stubs
- Type: **Code**
- Language: JavaScript
- Code:
```javascript
const result = JSON.parse($input.item.json.result || '{}');
const passes = result.passes || {};

// Extract Pass 4 output (MDX stubs)
const pass4 = passes['Pass 4: MDX Stub Production'] || '';

// Simple stub splitter — splits on "## " headings
const stubBlocks = pass4.split(/\n(?=## )/).filter(b => b.trim().startsWith('##'));

const stubs = stubBlocks.map(block => {
  const lines = block.trim().split('\n');
  const title = lines[0].replace(/^##\s*/, '').trim();

  // Extract frontmatter type if present
  const typeMatch = block.match(/\*\*Type:\*\*\s*(\S+)/);
  const entityType = typeMatch ? typeMatch[1].toLowerCase() : 'lore';

  // Map entity type to content collection folder
  const folderMap = {
    faction: 'rules',     // adjust to your actual folder structure
    place: 'rules',
    figure: 'rules',
    grimoire: 'grimoires',
    tradition: 'rules',
    creature: 'bestiary',
    item: 'arsenal',
    myth: 'rules',
  };
  const folder = folderMap[entityType] || 'rules';

  // Slugify title
  const slug = title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();

  return { title, slug, folder, content: block, entityType };
});

// Also extract lore entities for registry
const entityMatches = [...pass4.matchAll(/\*\*Type:\*\*\s*(\S+)[^\n]*\n[^\n]*\*\*([^*]+)\*\*/g)];

return stubs.map(stub => ({ json: stub }));
```

---

### Node 9: Loop Over Items
- Type: **Split In Batches** (to process stubs one by one)
- Batch Size: 1

---

### Node 10: GitHub — Create or Update File
- Type: **GitHub**
- Credential: your GitHub PAT
- Operation: **Create or Update File**
- Repository Owner: your GitHub username
- Repository Name: `qamareth-srd`
- File Path: `src/content/{{ $json.folder }}/{{ $json.slug }}.mdx`
- File Content: `{{ $json.content }}`
- Commit Message: `feat(lore): add archivist stub — {{ $json.title }}`
- Branch: `lore-ingestion` *(push to a branch, not main — review before merging)*

---

### Node 11 (optional): HTTP Request — Update Registry
- Type: **HTTP Request**
- Method: POST
- URL: `https://YOUR_RAILWAY_URL.up.railway.app/registry/lore_entities`
- Body: JSON
```json
{
  "name": "{{ $json.title }}",
  "type": "{{ $json.entityType }}",
  "visibility": "public"
}
```

---

## Content folder mapping

Adjust Node 8's `folderMap` to match your actual Astro content structure:
```
src/content/
├── rules/       ← factions, figures, places, traditions, concepts
├── grimoires/   ← grimoire entries
├── bestiary/    ← creatures
└── arsenal/     ← items, weapons, armor
```

---

## Running the pipeline

1. Upload your lore document to the path referenced in Node 2
   (or trigger the webhook with a file upload)
2. Execute the workflow manually in n8n
3. Watch the job status poll until `complete`
4. Check the `lore-ingestion` branch in `qamareth-srd` for new `.mdx` files
5. Review the stubs, voice them with the Lore Master agent in the chat UI
6. Merge the branch → Cloudflare Pages rebuilds automatically

---

## Done when
- Workflow executes without errors on a small test document (~5 pages)
- At least one `.mdx` stub appears in the `lore-ingestion` branch
- The stub contains `ARCHIVIST NOTES` comment blocks
- Registry endpoint shows the new lore entity
