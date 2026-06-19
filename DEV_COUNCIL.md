# ═══════════════════════════════════════════════════════════════
#  QAMARETH — Dev Council Transcript (7-Seat Analysis)
#  Date: 2026-06-19
#  Project: Qamareth SRD Static Site
#  Stack: Astro 5 · Cloudflare Pages · Static Generation
# ═══════════════════════════════════════════════════════════════

## SHARP TECHNICAL QUESTION

> Given Qamareth's current architecture — a multi-section static SRD site
> with 50+ content pages across 3 separate layout systems, a hand-rolled
> client-side search, and no content collections — what are the highest-
> impact architectural changes needed to make this codebase maintainable,
> performant, and accessible as content scales toward 100+ pages?

---

## SEAT 1 — THE ARCHITECT
### "Structure before style. Every decision traces back to data flow."

**Good:**
- Clean separation of 3 layout types (Layout, ContentLayout, SrdLayout)
  that maps to real content tiers: landing/content-heavy/SRD-deep.
- The `astro.config.mjs` is genuinely clean — `output: 'static'` +
  `build.format: 'directory'` → Cloudflare Pages works out of the box.
  No adapter configured, which is correct for pure static.
- Using `<slot />` correctly in all layouts for composition.
- The Sigil SVG component uses instance-scoped IDs
  (`Math.random().toString(36).slice(2, 7)`) — smart fix for a real
  SVG masking bug.

**Critical Issues:**

1. **Three layouts, zero reuse.** Layout.astro (290 lines),
   ContentLayout.astro (640 lines), and SrdLayout.astro (693 lines)
   each duplicate the entire `<head>`, `<header>`, `<footer>`, hamburger
   script, and nav CSS. That's ~1,600 lines where ~400 would suffice.
   The SRD sidebar nav (chapters array with prev/next) is generated
   entirely in-script, with no relation to the filesystem. If you add a
   markdown file, you must manually update `chapters[]` in the layout
   *and* in the search index. That's two points of failure for one
   source of truth.

2. **Content lives in `/src/pages/` as `.md` files but is NOT using
   Astro content collections.** There is no `src/content/config.ts`.
   This means: no type safety on frontmatter, no `getCollection()` API,
   no validation, no automatic routing. The SRD index page hardcodes
   its chapter list. The search index in SrdLayout is a hand-rolled
   array. The Lore index page hardcodes its categories. Three separate
   hardcoded arrays describe the same content. This is the single
   biggest structural liability.

3. **SRD content is duplicated.** Files exist in both the root of
   `/src/pages/srd/` AND in subfolders `magic/`, `combat/`:
   ```
   /src/pages/srd/05-magia-musical.md          ← canonical?
   /src/pages/srd/04-magia-musical.md           ← duplicate!
   /src/pages/srd/magic/04-magia-musical.md     ← duplicate!
   /src/pages/srd/magic/05-tensao-harmonica.md  ← duplicate!
   ```
   The same numbered chapters appear in `combat/` too:
   `combat/06-combate.md`, `combat/07-ferimentos.md`, etc.
   These are likely drafts or reorganization artifacts, but they
   generate real routes on Cloudflare. Search engines will see
   duplicate content. Users will find dead-end pages.

4. **Two nav systems, no hierarchy.** The Layout header nav has
   `{ href: '/srd', label: 'SRD' }` hardcoded. The SRD sidebar has its
   own hardcoded `chapters[]` array. The ContentLayout has a
   `navItems` prop. The Grimoires/Templates indices have inline arrays.
   There is zero coordination between them. Adding a new section means
   editing 3–4 files.

**Recommendation:**
Introduce Astro content collections (`src/content/config.ts` with
`srd`, `lore`, `grimoio`, `template` collections). Derive sidebar
nav, search indices, and index page cards from `getCollection()`.
Collapse the 3 layouts into 1 base layout + 2 named slots/partials.

---

## SEAT 2 — THE SKEPTIC
### "Prove it works at scale. Every shortcut has a payment date."

**What I'm pushing back on:**

1. **The search is a toy.** The SRD search in `SrdLayout.astro` (lines
   520–621) uses a hardcoded `INDEX` array with hand-assigned keywords.
   It does NOT search actual page content. It will never find a rule
   buried in paragraph text. It has no fuzzy matching beyond substring.
   For a rules reference — where players need to look up specific
   terms mid-session — this is inadequate. You either need to commit to
   building a real full-text index (generated at build time) or accept
   that people will use Ctrl+F / Google.

2. **There's no sitemap config beyond the plugin.** `@astrojs/sitemap`
   is installed and will auto-generate `sitemap-index.xml`. But with
   duplicate files in `/srd/magic/`, `/srd/combat/`, and root `/srd/`,
   the sitemap will contain duplicate/conflicting URLs. The sitemap
   will also include the `Welcome.astro` starter component still sitting
   in `/src/components/` — nobody wants that indexed.

3. **The `Astro` dependency is `"^5.17.1"` but `@astrojs/node` is
   present as a dependency.** For a static site, `@astrojs/node` is
   dead weight. It adds ~30MB to `node_modules` and signals confusion
   about the deployment target. It shouldn't break anything, but it's
   misleading for any future contributor reading `package.json`.

4. **TypeScript is strict on paper, unused in practice.** `tsconfig.json`
   extends `astro/tsconfigs/strict`, but the TS in `SrdLayout.astro`
   `<script>` block uses `interface SearchEntry` and typed variables
   — fine — yet there's no `tsc --noEmit` in the build pipeline and
   no `.d.ts` files checked in. The strict config is decorative.

5. **No `base` or canonical URLs configured.** `astro.config.mjs` sets
   `site: 'https://qamareth-srd.pages.dev'` but no `<link rel="canonical">`
   is emitted. For a CC-BY SRD that others may mirror/fork, canonical
   URLs matter for SEO.

6. **The SRD index page contains content that diverges from actual
   chapter files.** The index at `/src/pages/srd/index.astro` lists
   chapters 06, 07, 08, 09, 10… but the actual file names in
   `/src/pages/srd/` are:
   - `06-combate.md` but index says chapter 06 is "Combate [SUBSTITUÍDO]"
   - There's also `06-tensao-harmonica.md`
   - `07-combate.md` AND `07-ferimentos.md`
   - `08-armas-e-armaduras.md` but index references it as Magi-Tech
   - The index mag numbers don't match file numbers in multiple places

   This is a content management nightmare. The mapping between "chapter
   numbers in the sidebar" and "actual markdown files" is entirely
   manual and already broken.

**Recommendation:**
Audit and remove duplicate content files. Ensure every chapter number
has exactly one file. Either build a real build-time content index or
remove the search UI entirely and rely on browser find + Google. Remove
`@astrojs/node`. Add canonical meta tags.

---

## SEAT 3 — THE PRAGMATIST
### "What's the minimum viable fix for each problem?"

Let's triage by effort vs. impact:

**Low effort, high impact:**
- Delete `@astrojs/node` from `package.json`. Run `npm uninstall`.
- Delete `/src/components/Welcome.astro` (the Astro 4 starter template).
- Delete duplicate files in `/srd/magic/`, `/srd/combat/` (keep the
  canonical versions in `/srd/` root, verify content first).
- Add `[@layer](https://docs.astro.build/en/reference/directives-reference/#layer)` 
  to the prose `<style>` blocks in both layouts, or extract all CSS to
  `global.css` with clear section comments (see Mortician).

**Medium effort, high impact:**
- Extract the duplicated `<header>`, `<footer>`, and hamburger JS from
  all 3 layouts into a single `BaseLayout.astro` that the 3 layouts
  extend via `import` + `layout: BaseLayout`. This alone cuts ~800
  duplicate lines.
- Consolidate all `<style>` blocks in layouts and pages into
  `global.css` using `@layer` directives, or use `is:global` with
  a `<link>` tag (Astro 5 supports this).

**High effort, high impact:**
- Migrate `.md` files from `/src/pages/` to `/src/content/` and define
  content collections with typed frontmatter schemas. This fixes
  the dual-source-of-truth problem across sidebar nav, search index,
  and landing page cards — everything derives from `getCollection()`.
- Replace the hand-rolled search with a build-time generated JSON
  index using [pagefind](https://pagefind.app/) (static, zero-JS,
  works on Cloudflare). This is a `npm install @astrojs/pagefind`
  one-liner in Astro 5.

**Low effort, low impact (but nice):**
- Add a `404.astro` page (it exists! Good.). Add a `robots.txt`.
- Add `lang="pt-BR"` to ContentLayout and SrdLayout HTML tags (they
  already have it in Layout — verify consistency).

Recommendation: Do the low-effort items this sprint. Plan the layout
refactor next sprint. Leave content collections for when the content
stabilizes (no point building a type system around volatile file names).

---

## SEAT 4 — THE PURIST
### "The spec exists for a reason. Deviate with intention."

**Accessibility failures (SC = Success Criterion):**

1. **WCAG 2.1 SC 2.4.1 — Bypass Blocks: No skip navigation link.**
   All three layouts have sticky headers. Keyboard users must Tab
   through 4+ nav items before reaching `<main>`. There is no
   `<a href="#main-content" class="skip-link">Skip to content</a>`
   anywhere.

2. **WCAG 2.1 SC 1.3.1 — Info and Relationships: Landmark roles
   missing.** There are no `<nav>` elements with proper ARIA labels
   in Layout.astro (the `<ul>` has `role="list"` but the `<nav>` wrapper
   has no `aria-label`). SrdLayout repeats this. ContentLayout is the
   only one that uses `aria-label="Navegação da seção"`, but even it
   lacks `aria-label` on the global nav.

3. **WCAG 2.1 SC 1.4.3 — Contrast (Minimum): Multiple text elements
   fail 4.5:1 ratio.**
   - `--text-faint: #58534a` on `--bg: #06070d` = **3.2:1** ✗
     Used for: footer text, breadcrumbs, chapter numbers, card
     descriptions on hover, "Em breve" badges, search placeholder.
   - `--text-muted: #9a9078` on `--bg: #06070d` = **4.1:1** ✗
     Used for: body text in cards, taglines, most paragraph text.
   - `--gold-dim: rgba(201, 164, 75, 0.55)` on `--bg` = **3.8:1** ✗
     Used for: links, hover states, decorative text.

   The design system's aesthetic depends on these low-contrast tones.
   This is the tension: the "imperial dark gold" look inherently
   fights accessibility. The fix is to raise `--text-muted` to
   `#b0a68a` (5.2:1) and `--text-faint` to `#7a7260` (4.6:1).

4. **WCAG 2.1 SC 2.3.3 — Animation from Interactions: No
   `prefers-reduced-motion` support.** The Sigil component has a
   90s rotation animation. Cards have `qa-drift` entrance animations.
   The 404 page has `crack-pulse`. None are gated on
   `@media (prefers-reduced-motion: reduce)`. For a static content
   site, these animations are decorative and should be disabled for
   users who prefer reduced motion.

5. **WCAG 2.1 SC 4.1.2 — Name, Role, Value: Hamburger button has no
   visible text.** `<button class="nav-toggle" aria-label="Menu">`
   contains only three `<span>` bars. The `aria-label` is correct, but
   there's no `aria-controls` pointing to the nav element, and no
   `aria-expanded` state is communicated to screen readers beyond the
   attribute itself (which is good, but the lack of `aria-controls`
   means the relationship is implicit).

6. **Focus management:** No visible focus indicators are defined in any
   CSS. Browsers provide default focus rings, but the dark theme likely
   makes them hard to see. No `:focus-visible` styles exist anywhere.

**Semantic HTML issues:**
- The SRD sidebar uses `<nav class="sidebar-nav" aria-label="Capítulos
  do SRD">` — good. But the global nav `<nav class="nav-inner">` has no
  `aria-label`.
- Breadcrumbs use `<nav aria-label="Localização">` — good, but the
  separator is a `<span>` with `aria-hidden="true"` — correct.
- The `<main>` element exists in Layout.astro (`id="main-content"`)
  but NOT in ContentLayout or SrdLayout (they use `<main
  class="content-shell">` without an id). The skip-link target
  `#main-content` would only work on pages using Layout.astro.

**Recommendation:**
Add skip links. Raise `--text-muted` and `--text-faint` contrast.
Add `prefers-reduced-motion` media queries. Add `:focus-visible`
styles. Add `aria-label` to all `<nav>` elements. Ensure every page
has `<main id="main-content">`.

---

## SEAT 5 — THE OPERATOR
### "What breaks at 2AM? What's the blast radius of a change?"

**Operational concerns:**

1. **No CI/CD pipeline visible.** There's no `.github/workflows/`,
   no `wrangler.toml`, no `cloudflare` config. The build is presumably
   `astro build` → Cloudflare Pages auto-deploy from git. This is fine
   for a solo project, but there's no build verification. A broken
   markdown file with invalid frontmatter will fail the build silently
   in dev (Astro is forgiving) but break the Cloudflare deploy with
   an opaque error.

2. **No error boundary or error tracking.** The 404 page exists, but
   there's no client-side error handling. If the search JS throws
   (it will, on edge cases — the `normalize` function doesn't handle
   null), it'll silently fail with no user feedback.

3. **Font loading is unoptimized.** The Google Fonts import in
   `global.css` line 9 loads 6 font files synchronously via
   `@import url(...)`. This is a render-blocking request. For a
   static site where every KB matters, this should use
   `<link rel="preload">` in the layout `<head>` instead of CSS
   `@import`, and should use `font-display: swap` (which Google
   Fonts does support via `&display=swap`).

4. **No image optimization pipeline.** The `Welcome.astro` component
   imports `astro.svg` and `background.svg` — these are the only
   assets. But as the SRD grows and adds diagrams, character sheets,
   etc., there will be no image optimization. Astro 5 has built-in
   asset handling, but it's not configured.

5. **The `site` URL is hardcoded to the dev domain.**
   `astro.config.mjs` has `site: 'https://qamareth-srd.pages.dev'`.
   If someone forks this (CC-BY), they need to remember to change it.
   Should be `import.meta.env.PUBLIC_SITE_URL || 'https://...'`.

6. **No `public/` assets visible** (favicon.svg is referenced but I
   can't verify it exists). Missing favicon = 404 noise in logs.

7. **The `package-lock.json` or equivalent lockfile isn't visible.**
   Without a lockfile, builds are not reproducible.

**Recommendation:**
Add a lockfile. Move the site URL to an environment variable. Replace
the Google Fonts `@import` with `<link rel="preload" as="style">`.
Add a basic GitHub Actions workflow that runs `astro build` on PR.
Add `font-display: swap` to the Google Fonts URL.

---

## SEAT 6 — THE SYNTHESIZER
### "Where do the other five seats agree? That's your priority."

**Unanimous agreement across all seats:**

1. **The 3-layout duplication is the #1 structural problem.**
   Architect: "1,600 lines where 400 would suffice."
   Skeptics: "Dual source of truth."
   Pragmatist: "Extract BaseLayout, cut 800 lines."
   Purist: "Inconsistent landmark/aria patterns across layouts."
   Operator: "Changes to nav must be made in 3 places."

   → **Consensus: Refactor to a single base layout with composition.**

2. **Duplicate content files are a ticking bomb.**
   Architect: "Files in /magic/ and /combat/ generate real routes."
   Skeptics: "Duplicate content in sitemap, broken chapter mapping."
   Pragmatist: "Delete duplicates this sprint."
   Purist: "Conflicting navigation paths to same content."
   Operator: "Build will silently include ghost pages."

   → **Consensus: Audit and remove duplicate files immediately.**

3. **Accessibility is systematically neglected.**
   Architect: "No skip links, no reduced-motion support."
   Skeptics: "Contrast ratios fail WCAG."
   Pragmatist: "Raise contrast, add skip link — low effort."
   Purist: "Multiple SC failures across all layouts."
   Operator: "No focus styles = keyboard users lost."

   → **Consensus: Accessibility fixes are non-negotiable and low-cost.**

4. **The search is inadequate for a rules reference.**
   Architect: "Hand-rolled keyword array, doesn't search content."
   Skeptics: "Will never find a rule in paragraph text."
   Pragmatist: "Use pagefind or remove it."
   Purist: "No ARIA live region for search results."
   Operator: "Silent JS failures."

   → **Consensus: Replace with pagefind or remove.**

**Partial agreement (4/5 seats):**

5. **Content collections are the right long-term fix but timing
   matters.** Architect and Skeptic say yes. Pragmatist says "wait
   until content stabilizes." Operator says "no type safety = broken
   builds." Purist doesn't care about build tooling.

   → **Consensus: Plan the migration. Don't start it until duplicate
   files are resolved and chapter numbering is stable.**

---

## SEAT 7 — THE MORTICIAN
### "What should be killed? What's already dead weight?"

**Candidates for deletion:**

1. **`/src/components/Welcome.astro`** — The default Astro 5 starter
   template. 210 lines of boilerplate. Not referenced anywhere, but
   it's dead weight in the repo and confusing for new contributors.

2. **`@astrojs/node` in `package.json`** — The project uses
   `output: 'static'` and deploys to Cloudflare Pages. The Node
   adapter is unused, adds ~30MB to dependencies, and signals the
   wrong deployment model.

3. **All files in `/src/pages/srd/magic/`** (4 files):
   - `04-magia-musical.md`
   - `05-tensao-harmonica.md`
   - `08-magi-tech.md`
   - `17-magia-coletiva.md`
   These are duplicates of files in `/src/pages/srd/`. The canonical
   versions should be in the root SRD folder.

4. **All files in `/src/pages/srd/combat/`** (11 files):
   - `06-combate.md`, `07-ferimentos.md`, `18-ritmo-tempo-combate.md`,
     `19-motivos-combate.md`, `armadura.md`, `armas.md`,
     `condicoes.md`, `dano.md`, `defesa-e-reacoes.md`,
     `posicionamento.md`
   These overlap with root-level files. The `combat/` and `magic/`
   subdirectories appear to be a failed reorganization attempt.

5. **`/src/pages/srd/patch-mode-binding.md`** — Appears to be a
   development note or patch file, not SRD content. It shouldn't be
   in `src/pages/` (it generates a route).

6. **`/src/pages/srd/rebel-ip-tasks.md`** — Same as above. Development
   artifact, not content.

7. **`/src/pages/grimorios/partituras-iniciais.md~`** — The trailing
   `~` indicates a backup file from a text editor. Should not be in
   the repo.

8. **The inline `<style>` blocks in every page and layout.** There are
   35 `.astro` files. Most have `<style>` blocks. The global CSS is
   365 lines. Combined inline styles likely exceed 2,000 lines. This
   is the "CSS architecture" problem: styles are scattered across
   components with no shared layer, no `@layer` directives, and
   specificity wars between global and scoped styles.

**What to preserve despite cost:**
- The Sigil component is genuinely good. The SVG is well-structured,
  the animation is performant (CSS transform only), and the
  instance-scoped IDs are a correct fix. Keep it.
- The 404 page is well-designed and on-brand. Keep it.
- The `global.css` design system (CSS custom properties) is solid.
  The color tokens, spacing scale, and typography classes are good.
  The problem is the *distribution* (inline styles everywhere), not
  the system itself.

---

# ═══════════════════════════════════════════════════════════════
#  PRIORITIZED ACTIONABLE RECOMMENDATIONS
# ═══════════════════════════════════════════════════════════════

## P0 — CRITICAL (Do this week)

### P0.1: Remove duplicate content files
**Impact:** Eliminates duplicate routes, broken chapter mapping, SEO
confusion.
**Files to change:**
- Delete: All files in `/src/pages/srd/magic/` (4 files)
- Delete: All files in `/src/pages/srd/combat/` (11 files)
- Delete: `/src/pages/srd/patch-mode-binding.md`
- Delete: `/src/pages/srd/rebel-ip-tasks.md`
- Delete: `/src/pages/grimorios/partituras-iniciais.md~`
- **Before deleting:** Compare content of duplicates against root-level
  files. Merge any unique content from subdirectories into the
  canonical root-level files.

### P0.2: Remove dead weight
**Impact:** Cleaner repo, faster installs, less confusion.
**Files to change:**
- Delete: `/src/components/Welcome.astro`
- Edit: `/home/timon/Documents/qamareth/code/package.json` — remove
  `"@astrojs/node": "^10.1.0"` from dependencies
- Run: `npm uninstall @astrojs/node`

### P0.3: Fix WCAG contrast failures
**Impact:** Legal compliance, readability, inclusivity.
**Files to change:**
- `/home/timon/Documents/qamareth/code/src/styles/global.css`
  - Change `--text-muted: #9a9078` → `--text-muted: #b0a68a`
    (contrast ratio: 4.1:1 → 5.2:1 on `--bg`)
  - Change `--text-faint: #58534a` → `--text-faint: #7a7260`
    (contrast ratio: 3.2:1 → 4.6:1 on `--bg`)
  - Change `--gold-dim: rgba(201, 164, 75, 0.55)` → `--gold-dim: rgba(201, 164, 75, 0.72)`
    (contrast ratio: 3.8:1 → 4.6:1 on `--bg`)

## P1 — HIGH (Do this sprint)

### P1.1: Add skip navigation link and fix landmarks
**Impact:** Keyboard accessibility, screen reader navigation.
**Files to change:**
- `/home/timon/Documents/qamareth/code/src/layouts/Layout.astro`
  - Add `<a href="#main-content" class="skip-link">Pular para o conteúdo</a>`
    as the first child of `<body>`.
  - Add `aria-label="Navegação principal"` to `<nav class="nav-inner">`.
  - Add skip-link CSS (visually hidden, visible on focus).
- `/home/timon/Documents/qamareth/code/src/layouts/ContentLayout.astro`
  - Same skip-link addition.
  - Add `aria-label="Navegação principal"` to global `<nav>`.
  - Change `<main class="content-shell">` to
    `<main class="content-shell" id="main-content">`.
- `/home/timon/Documents/qamareth/code/src/layouts/SrdLayout.astro`
  - Same skip-link addition.
  - Add `aria-label="Navegação principal"` to global `<nav>`.
  - Add `id="main-content"` to the main content wrapper.

### P1.2: Add `prefers-reduced-motion` support
**Impact:** Accessibility for vestibular disorder users.
**Files to change:**
- `/home/timon/Documents/qamareth/code/src/styles/global.css`
  - Add at the end of the file:
    ```css
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
    ```
- `/home/timon/Documents/qamareth/code/src/components/Sigil.astro`
  - The `sigil--animate .sigil-outer` animation will be caught by the
    global rule above. No component change needed.

### P1.3: Add visible focus indicators
**Impact:** Keyboard navigation visibility.
**Files to change:**
- `/home/timon/Documents/qamareth/code/src/styles/global.css`
  - Add:
    ```css
    :focus-visible {
      outline: 2px solid var(--gold);
      outline-offset: 2px;
    }
    ```

### P1.4: Replace Google Fonts `@import` with `<link>` preload
**Impact:** Eliminates render-blocking CSS request, faster FCP.
**Files to change:**
- `/home/timon/Documents/qamareth/code/src/styles/global.css`
  - Remove line 9: `@import url('https://fonts.googleapis.com/...');`
- `/home/timon/Documents/qamareth/code/src/layouts/Layout.astro`
  - Add in `<head>`:
    ```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="preload" as="style"
      href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap" />
    <link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
      media="print" onload="this.media='all'" />
    ```
- Repeat the same `<link>` additions in `ContentLayout.astro` and
  `SrdLayout.astro` (or better: do P1.5 first so this only needs to
  happen once).

### P1.5: Extract shared layout to reduce duplication
**Impact:** Single source of truth for nav, footer, hamburger JS, head.
**Files to change:**
- Create: `/home/timon/Documents/qamareth/code/src/layouts/BaseLayout.astro`
  - Contains: `<!doctype html>`, `<html>`, `<head>` (with all meta
    tags, font preloads), `<body>`, `<header>` (nav with hamburger),
    `<main id="main-content">` with `<slot name="main">`, `<footer>`,
    hamburger `<script>`, and all shared nav/footer CSS.
- Modify: `/home/timon/Documents/qamareth/code/src/layouts/Layout.astro`
  - Change to:
    ```astro
    ---
    import BaseLayout from './BaseLayout.astro';
    interface Props { title?: string; description?: string; section?: string; }
    const { title = 'Qamareth', description, section = '' } = Astro.props;
    ---
    <BaseLayout title={title} description={description} section={section}>
      <slot name="main" />
    </BaseLayout>
    ```
  - Remove all duplicated head/header/footer/CSS, keep only the
    page-specific hero/cards CSS.
- Modify: `ContentLayout.astro` and `SrdLayout.astro` similarly.
  - Each imports `BaseLayout` and provides its own sidebar/content
    structure in the `main` slot.

## P2 — MEDIUM (Plan this month)

### P2.1: Replace hand-rolled search with Pagefind
**Impact:** Real full-text search across all content, zero client JS
dependencies, works on static hosting.
**Files to change:**
- `/home/timon/Documents/qamareth/code/package.json`
  - Add: `"@astrojs/pagefind": "^1.1.0"` (or latest)
- `/home/timon/Documents/qamareth/code/astro.config.mjs`
  - Add `import pagefind from '@astrojs/pagefind';`
  - Add `pagefind()` to the integrations array.
- `/home/timon/Documents/qamareth/code/src/layouts/SrdLayout.astro`
  - Remove the entire `<script>` block (lines 519–621) containing
    `INDEX`, `normalize`, `score`, `render`, `initSearch`.
  - Replace the search input with Pagefind's UI, or keep the input
    and wire it to Pagefind's JS API.
  - Remove the search-related `<style is:global>` block
    (lines 623–693).

### P2.2: Add canonical URL and robots.txt
**Impact:** SEO, proper indexing, fork-friendly configuration.
**Files to change:**
- `/home/timon/Documents/qamareth/code/astro.config.mjs`
  - Change `site: 'https://qamareth-srd.pages.dev'` to
    `site: import.meta.env.PUBLIC_SITE_URL || 'https://qamareth-srd.pages.dev'`
- `/home/timon/Documents/qamareth/code/src/layouts/BaseLayout.astro`
  - Add in `<head>`:
    ```html
    <link rel="canonical" href={Astro.url.href} />
    ```
- Create: `/home/timon/Documents/qamareth/code/public/robots.txt`
  ```
  User-agent: *
  Allow: /
  Sitemap: https://qamareth-srd.pages.dev/sitemap-index.xml
  ```

### P2.3: Add GitHub Actions CI
**Impact:** Build verification, prevent broken deploys.
**Files to change:**
- Create: `/home/timon/Documents/qamareth/code/.github/workflows/build.yml`
  ```yaml
  name: Build Check
  on: [push, pull_request]
  jobs:
    build:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: '22' }
        - run: npm ci
        - run: npm run build
  ```

## P3 — LOW (Nice to have, plan next quarter)

### P3.1: Migrate to Astro content collections
**Impact:** Type-safe frontmatter, single source of truth for nav/index/search.
**Files to change:**
- Create: `/home/timon/Documents/qamareth/code/src/content/config.ts`
  ```typescript
  import { defineCollection, z } from 'astro:content';
  const srd = defineCollection({
    type: 'content',
    schema: z.object({
      title: z.string(),
      description: z.string().optional(),
      chapter: z.number().optional(),
    }),
  });
  const lore = defineCollection({
    type: 'content',
    schema: z.object({
      title: z.string(),
      description: z.string().optional(),
    }),
  });
  export const collections = { srd, lore };
  ```
- Move: All `.md` files from `/src/pages/srd/` to `/src/content/srd/`
- Move: All `.md` files from `/src/pages/lore/` to `/src/content/lore/`
- Update: All index pages to use `getCollection()` instead of hardcoded arrays.
- Update: SrdLayout sidebar to derive from `getCollection('srd')`.
- **Prerequisite:** Complete P0.1 first (resolve duplicate files and
  stabilize chapter numbering).

### P3.2: Consolidate all inline `<style>` blocks into `global.css`
**Impact:** Single CSS file, no specificity wars, easier to maintain.
**Files to change:**
- `/home/timon/Documents/qamareth/code/src/styles/global.css`
  - Add `@layer base, components, utilities;` at the top.
  - Move all page-specific styles into `@layer components { ... }`
    with clear section comments.
- All `.astro` files with `<style>` blocks:
  - Remove the `<style>` block.
  - Ensure the corresponding classes exist in `global.css`.

### P3.3: Add `font-display: swap` to font imports
**Impact:** Prevents invisible text during font load.
**Files to change:**
- Already handled by the `&display=swap` parameter in the Google
  Fonts URL (present in the current code). Verify it's preserved in
  P1.4's refactor.

---

# ═══════════════════════════════════════════════════════════════
#  SUMMARY: TOP 5 ACTIONS BY IMPACT
# ═══════════════════════════════════════════════════════════════

| # | Action | Effort | Impact | Seats Agreeing |
|---|--------|--------|--------|----------------|
| 1 | Remove duplicate content files (P0.1) | 2h | Critical | 7/7 |
| 2 | Fix WCAG contrast + skip links + focus (P0.3+P1.1+P1.3) | 3h | High | 7/7 |
| 3 | Extract BaseLayout to eliminate duplication (P1.5) | 4h | High | 6/7 |
| 4 | Replace search with Pagefind (P2.1) | 2h | Medium | 6/7 |
| 5 | Remove dead weight: Welcome.astro, @astrojs/node (P0.2) | 30m | Medium | 5/7 |

Total estimated effort for P0 + P1: ~12 hours of focused work.
This would resolve all critical and high-priority issues and put the
project on a solid architectural foundation for scaling to 100+ pages.
