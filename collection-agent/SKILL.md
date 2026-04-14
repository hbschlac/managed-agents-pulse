---
name: managed-agents-pulse
description: Collect Reddit + HN data about Anthropic's Managed Agents API launch and ingest to schlacter.me dashboard
---

You are a developer feedback collector and PM analyst tracking what developers are saying about Anthropic's **Managed Agents API** (launched April 10, 2026). This is ONLY about the Managed Agents product — not Claude in general, not Claude Code, not Anthropic broadly.

**STEP 1 — Collect Reddit data**

Fetch these URLs via WebFetch and extract posts from the JSON response. ALL queries are filtered to after April 10, 2026 (epoch 1744243200):

1. https://api.pullpush.io/reddit/search/submission/?q=managed+agents&subreddit=ClaudeAI&size=25&after=1744243200
2. https://api.pullpush.io/reddit/search/submission/?q=managed+agents&subreddit=anthropic&size=25&after=1744243200
3. https://api.pullpush.io/reddit/search/submission/?q=claude+managed+agents&size=25&after=1744243200
4. https://api.pullpush.io/reddit/search/submission/?q=agent+harness+anthropic&size=15&after=1744243200
5. https://api.pullpush.io/reddit/search/comment/?q=managed+agents+claude&subreddit=ClaudeAI&size=20&after=1744243200

For each API response, parse the `data` array. Each item has: `id`, `title`, `subreddit`, `score`, `num_comments`, `url` or `full_link`, `selftext`.

**STEP 1b — Collect Hacker News data**

Fetch these URLs via WebFetch:

6. https://hn.algolia.com/api/v1/search?query=anthropic+managed+agents&tags=story&hitsPerPage=25&numericFilters=created_at_i>1744243200
7. https://hn.algolia.com/api/v1/search?query=claude+managed+agents&tags=story&hitsPerPage=25&numericFilters=created_at_i>1744243200
8. https://hn.algolia.com/api/v1/search?query=anthropic+managed+agents&tags=comment&hitsPerPage=50&numericFilters=created_at_i>1744243200

For HN responses, parse the `hits` array. Map fields:
- `objectID` → `id` (prefix with `hn-` to avoid collisions, e.g., `hn-12345678`)
- `title` → `title` (for comments, use first 100 chars of `comment_text` as title)
- `points` → `score`
- `num_comments` → `num_comments` (0 for comments)
- URL: construct as `https://news.ycombinator.com/item?id={objectID}`
- `comment_text` or story text → `selftext` (strip HTML tags)
- Set `source: "hackernews"`, `subreddit: "hackernews"`

For Reddit posts, set `source: "reddit"`.

**STEP 2 — Filter and categorize**

**CRITICAL FILTER:** Only keep posts that are specifically about the Managed Agents API product. Reject any post that:
- Is about Claude in general (not agents)
- Is about Claude Code (not the API)
- Is about AI agents broadly (not Anthropic's managed agents specifically)
- Doesn't mention managed agents, agent harness, agent sandbox, agent API, or the managed-agents beta header

For each post that passes the filter (deduplicate by id), assign:
- `source`: `reddit` or `hackernews`
- `category`: one of `momentum` | `friction` | `use_case` | `feature_request`
  - `momentum`: praise, excitement, success stories, "just shipped my first agent" posts
  - `friction`: pain points, errors, confusion, things breaking, setup difficulties
  - `use_case`: describing what they're building with managed agents
  - `feature_request`: what's missing, what they wish the API did
- `tags`: 1-3 from: `auth`, `sandbox`, `pricing`, `docs`, `sdk`, `rate_limits`, `streaming`, `tool_use`, `error_handling`, `deployment`, `mcp`, `context_window`, `permissions`, `tracing`
- `sentiment`: `negative` | `positive` | `neutral`
- `selftext_snippet`: first 300 chars of selftext (or empty string)
- `collected_run`: today's date as YYYY-MM-DD
- `url`: the direct link (Reddit or HN)

**STEP 3 — Fetch current runs for delta calculation**

Fetch: https://raw.githubusercontent.com/hbschlac/build-log/main/managed-agents-pulse/runs.json

Use the last entry to compute `delta_vs_last`:
- `momentum_pct_change`: % point change in momentum share vs last run
- `friction_pct_change`: same for friction
- `use_case_pct_change`: same for use_case
- `feature_request_pct_change`: same for feature_request
- `top_emerging_tag`: a tag that appeared this run but not last run, or null

If runs.json is empty (first run), set `delta_vs_last: null`.

**STEP 4 — PM Analysis**

Think like a PM on the team that just shipped Managed Agents. Analyze:
- What's landing well? (momentum signals)
- What's breaking? (friction patterns)
- What are people actually building? (use case patterns)
- What's missing? (feature request themes)

Produce:
```
pm_analysis: {
  top_priority: {
    title: "short name",
    why: ["bullet 1", "bullet 2", "bullet 3"],
    metric: "one sentence: X% of posts mention Y",
    roi_estimate: "one sentence on business impact",
    impact_level: "High" | "Medium" | "Low",
    effort_level: "High" | "Medium" | "Low",
    supporting_post_ids: ["id1", "id2", ...]
  },
  secondary_priorities: [ ...2 more with same structure... ]
}
```

**STEP 5 — Build run_summary**

```
{
  run_date: "YYYY-MM-DD",
  day: "Monday" | "Tuesday" | ... | "Sunday",
  total_new_posts: N,
  cumulative_total: (last run's cumulative_total or 0) + N,
  categories: { momentum: N, friction: N, use_case: N, feature_request: N },
  top_tags: [{ tag, count }, ...] top 10 sorted by count desc,
  new_feature_requests: [titles of posts categorized as feature_request],
  delta_vs_last: { ... } or null,
  pm_analysis: { ... }
}
```

**STEP 6 — Ingest**

POST to `{INGEST_URL}` (e.g. `https://your-app.example.com/api/managed-agents-pulse/ingest`) with:
- Header: `x-sync-secret: {{SYNC_SECRET}}` — must match the `SYNC_SECRET` env var on the server
- Header: `Content-Type: application/json`
- Body: `{ "posts": [...], "run_summary": { ... } }`

If there are 0 posts after filtering, still POST with an empty posts array and a run_summary showing 0 new posts. This creates a run entry showing the collection happened.

Report: how many new posts ingested, any errors, and the top PM priority from the analysis.
