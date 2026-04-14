import { revalidateTag } from "next/cache";
import type { PulsePost, RunSummary } from "@/app/managed-agents-pulse/types";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const REPO = "hbschlac/build-log";
const BASE = "https://api.github.com/repos/" + REPO + "/contents/managed-agents-pulse";

// ─── validation ───────────────────────────────────────────────────────────────
const VALID_CATEGORIES = new Set(["momentum", "friction", "use_case", "feature_request"]);
const VALID_SENTIMENTS = new Set(["negative", "positive", "neutral"]);
const VALID_TAGS = new Set([
  "auth", "sandbox", "pricing", "docs", "sdk", "rate_limits", "streaming",
  "tool_use", "error_handling", "deployment", "mcp", "context_window",
  "permissions", "tracing",
]);
const VALID_IMPACT = new Set(["High", "Medium", "Low"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validatePost(p: unknown): { ok: boolean; reason?: string } {
  if (typeof p !== "object" || !p) return { ok: false, reason: "not an object" };
  const post = p as Record<string, unknown>;
  if (!post.id || typeof post.id !== "string") return { ok: false, reason: "missing id" };
  if (!post.title || typeof post.title !== "string") return { ok: false, reason: "missing title" };
  if (!post.collected_run || !DATE_RE.test(post.collected_run as string))
    return { ok: false, reason: `invalid collected_run: ${post.collected_run}` };
  if (!VALID_CATEGORIES.has(post.category as string))
    return { ok: false, reason: `invalid category: ${post.category}` };
  if (!VALID_SENTIMENTS.has(post.sentiment as string))
    return { ok: false, reason: `invalid sentiment: ${post.sentiment}` };
  if (!Array.isArray(post.tags))
    return { ok: false, reason: "tags must be array" };
  const badTag = (post.tags as unknown[]).find((t) => !VALID_TAGS.has(t as string));
  if (badTag) return { ok: false, reason: `unknown tag: ${badTag}` };
  if (typeof post.url !== "string" || (!post.url.includes("reddit") && !post.url.includes("ycombinator")))
    return { ok: false, reason: `invalid url: ${post.url}` };
  return { ok: true };
}

function validateRunSummary(r: unknown): { ok: boolean; reason?: string } {
  if (typeof r !== "object" || !r) return { ok: false, reason: "not an object" };
  const s = r as Record<string, unknown>;
  if (!DATE_RE.test(s.run_date as string)) return { ok: false, reason: `invalid run_date: ${s.run_date}` };
  if (typeof s.total_new_posts !== "number") return { ok: false, reason: "total_new_posts must be number" };
  if (typeof s.cumulative_total !== "number") return { ok: false, reason: "cumulative_total must be number" };
  const cats = s.categories as Record<string, unknown>;
  if (!cats || typeof cats !== "object") return { ok: false, reason: "categories missing" };
  for (const k of ["momentum", "friction", "use_case", "feature_request"]) {
    if (typeof cats[k] !== "number") return { ok: false, reason: `categories.${k} must be number` };
  }
  if (!Array.isArray(s.top_tags)) return { ok: false, reason: "top_tags must be array" };
  const pm = s.pm_analysis as Record<string, unknown> | undefined;
  if (pm) {
    const top = pm.top_priority as Record<string, unknown> | undefined;
    if (top && top.impact_level && !VALID_IMPACT.has(top.impact_level as string))
      return { ok: false, reason: `invalid impact_level: ${top.impact_level}` };
  }
  return { ok: true };
}

// ─── github helpers ───────────────────────────────────────────────────────────
async function getFile(path: string): Promise<{ content: unknown[]; sha: string }> {
  const res = await fetch(`${BASE}/${path}`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub GET ${path} failed: ${res.status}`);
  const data = await res.json();
  const decoded = Buffer.from(data.content, "base64").toString("utf-8");
  return { content: JSON.parse(decoded), sha: data.sha };
}

async function putFile(path: string, content: unknown[], sha: string, message: string) {
  const encoded = Buffer.from(JSON.stringify(content, null, 2)).toString("base64");
  const res = await fetch(`${BASE}/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, content: encoded, sha }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT ${path} failed: ${res.status} ${err}`);
  }
}

// ─── route ────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const secret = process.env.SYNC_SECRET?.trim();
  if (!secret) return Response.json({ error: "Server misconfigured." }, { status: 500 });

  const authHeader = request.headers.get("x-sync-secret");
  let body: { secret?: string; posts?: unknown[]; run_summary?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const provided = authHeader ?? body.secret;
  if (provided !== secret) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const { posts, run_summary } = body;
  if (!Array.isArray(posts) || !run_summary) {
    return Response.json({ error: "posts (array) and run_summary required." }, { status: 400 });
  }

  // Validate run_summary
  const summaryCheck = validateRunSummary(run_summary);
  if (!summaryCheck.ok) {
    return Response.json({ error: `Invalid run_summary: ${summaryCheck.reason}` }, { status: 422 });
  }

  // Validate and filter posts — reject entire request if >20% are invalid
  const validPosts: PulsePost[] = [];
  const rejectedPosts: { index: number; reason: string }[] = [];
  for (let i = 0; i < posts.length; i++) {
    const check = validatePost(posts[i]);
    if (check.ok) {
      validPosts.push(posts[i] as PulsePost);
    } else {
      rejectedPosts.push({ index: i, reason: check.reason! });
    }
  }
  if (posts.length > 0 && rejectedPosts.length / posts.length > 0.2) {
    return Response.json({
      error: "Too many invalid posts — possible data quality issue. Aborting.",
      rejected: rejectedPosts.slice(0, 5),
    }, { status: 422 });
  }

  try {
    const [allPostsFile, runsFile] = await Promise.all([
      getFile("all-posts.json"),
      getFile("runs.json"),
    ]);

    const existingPosts = allPostsFile.content as PulsePost[];
    const existingIds = new Set(existingPosts.map((p) => p.id));
    const newPosts = validPosts.filter((p) => !existingIds.has(p.id));
    const updatedPosts = [...existingPosts, ...newPosts];

    const existingRuns = runsFile.content as RunSummary[];
    const updatedRuns = [...existingRuns, run_summary as RunSummary];

    const runDate = (run_summary as RunSummary).run_date;
    // Sequential writes to avoid GitHub SHA race condition on same directory
    await putFile("all-posts.json", updatedPosts, allPostsFile.sha,
      `data: managed-agents-pulse run ${runDate} (+${newPosts.length} posts)`);
    await putFile("runs.json", updatedRuns, runsFile.sha,
      `data: managed-agents-pulse run summary ${runDate}`);

    revalidateTag("managed-agents-pulse", "max");

    return Response.json({
      ok: true,
      new_posts: newPosts.length,
      rejected_posts: rejectedPosts.length,
      total_posts: updatedPosts.length,
      runs: updatedRuns.length,
    });
  } catch (err) {
    console.error("ingest error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
