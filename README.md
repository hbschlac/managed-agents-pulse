# Managed Agents Pulse

A developer feedback intelligence dashboard for the Anthropic Managed Agents API launch (April 10, 2026).

**Live:** [schlacter.me/managed-agents-pulse](https://schlacter.me/managed-agents-pulse)

Built by Hannah Schlacter as a gift to the Anthropic engineering + PM team after meeting one of them at the launch. Shared publicly so anyone can fork the pattern and point it at a different product.

---

## What it does

Pulls developer conversation about a specific product from Hacker News + Reddit every N hours, categorizes each post as **momentum / friction / use case / feature request**, and surfaces the top-scoring pull quote per bucket on a live dashboard. No AI-generated roadmap, no prescription — just organized signal.

Stack:
- **Next.js 15+ App Router** — server components, Suspense, tagged cache revalidation
- **GitHub as the database** — JSON files in a `build-log` repo, written via the Contents API with SHA-based optimistic locking
- **Claude Code scheduled task** — runs on a cron, does the collection + classification + POST to the ingest route
- **Recharts** — client-side dashboards
- **Vercel** — hosting

---

## Architecture

```
┌────────────────────────────┐
│ Claude Code scheduled task │   collection-agent/SKILL.md
│ (runs on cron, e.g. 2h)    │
└────────────┬───────────────┘
             │ fetch HN Algolia + pullpush.io
             │ filter + classify + build summary
             │ POST w/ x-sync-secret
             ▼
┌────────────────────────────┐
│ /api/managed-agents-pulse/ │   app/api/managed-agents-pulse/ingest/route.ts
│ ingest                     │
└────────────┬───────────────┘
             │ validate, dedupe, PUT
             ▼
┌────────────────────────────┐
│ github.com/{OWNER}/        │   all-posts.json + runs.json
│ build-log/managed-agents-  │
│ pulse/                     │
└────────────┬───────────────┘
             │ raw.githubusercontent.com
             ▼
┌────────────────────────────┐
│ /managed-agents-pulse      │   app/managed-agents-pulse/page.tsx
│ (server component + client │   app/managed-agents-pulse/Dashboard.tsx
│  Dashboard)                │
└────────────────────────────┘
```

---

## Fork it for a different product

### 1. Stand up the Next.js app

Copy these into an existing Next.js 15+ App Router project:

```
app/managed-agents-pulse/          → your-route/
app/api/managed-agents-pulse/      → api/your-route/
```

Rename the route (e.g. `/your-product-pulse`), update:
- `app/api/.../ingest/route.ts` — `REPO` constant (GitHub storage path)
- `app/api/.../posts/route.ts` — `RAW_BASE` constant
- `app/managed-agents-pulse/page.tsx` — `RAW_BASE` constant
- Cache tag names (currently `"managed-agents-pulse"`)

### 2. Set env vars

```
GITHUB_TOKEN=ghp_...     # PAT with repo:contents write on your build-log repo
SYNC_SECRET=...          # any long random string; also in the scheduled task
```

### 3. Init the storage repo

Create a GitHub repo `{OWNER}/build-log` and seed two empty JSON arrays:

```
build-log/
└── managed-agents-pulse/         ← rename to your product
    ├── all-posts.json            ← []
    └── runs.json                 ← []
```

### 4. Point the collection agent at your product

`collection-agent/SKILL.md` has the full pipeline: search queries, field mapping, classification rules, PM analysis prompt. Edit:
- Search queries in STEP 1 / 1b (swap "managed agents" for your product)
- The CRITICAL FILTER (STEP 2) — specific rules for what's in-scope
- The valid tags list (STEP 2) — product-specific categories
- The ingest URL + `{{SYNC_SECRET}}` (STEP 6)

Register it with the [scheduled-tasks MCP](https://claude.com/claude-code) on the cron you want (e.g. `0 */2 * * *` for every 2 hours).

### 5. Deploy

Vercel, Render, wherever. The page is mostly static + one client component fetching from a public raw.githubusercontent.com URL — runs cheap.

---

## Design choices worth stealing

**Narrow scope beats wide scope.** The collection agent is strict about what counts as "in scope" — a post about the specific product, not the parent company or adjacent tools. When the product is brand new (days old), aggressive filtering is what separates signal from noise.

**Surface signal, don't prescribe.** The first version had an AI-generated "Top Priority / ROI / impact level" card. As an outsider to the team, prescribing roadmap reads as presumptuous — so it was cut. The current Most-Quoted module shows the top-scoring post per category with the actual pull quote. Readers decide what matters.

**GitHub as a database.** For a read-heavy public dashboard with infrequent writes (every few hours), a GitHub repo beats Postgres/KV: free, versioned, public (which is a feature — anyone can audit the raw data), zero cold-start. SHA-based optimistic locking handles the rare concurrent write.

**Sequential, not parallel, writes to the same directory.** An earlier version wrote `all-posts.json` and `runs.json` in parallel via `Promise.all([...])` — GitHub returned 409 on the second write because the directory SHA changed. Writes to the same folder must be sequential.

---

## File map

```
managed-agents-pulse/
├── app/
│   ├── managed-agents-pulse/
│   │   ├── page.tsx                    Server component, fetches runs.json
│   │   ├── Dashboard.tsx               Client component, Recharts + drilldown drawer
│   │   └── types.ts                    PulsePost, RunSummary, PostCategory
│   └── api/
│       └── managed-agents-pulse/
│           ├── ingest/route.ts         POST — validates + writes to GitHub
│           └── posts/route.ts          GET — filtered reads from raw.githubusercontent
├── collection-agent/
│   └── SKILL.md                        The cron-runnable Claude Code task
└── README.md
```

---

## License

MIT. Take it, run with it.
