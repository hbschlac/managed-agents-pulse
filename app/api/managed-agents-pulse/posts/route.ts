import type { PulsePost } from "@/app/managed-agents-pulse/types";

const RAW_BASE =
  "https://raw.githubusercontent.com/hbschlac/build-log/main/managed-agents-pulse";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const run_date = searchParams.get("run_date");
  const category = searchParams.get("category");
  const tag = searchParams.get("tag");
  const source = searchParams.get("source");
  const ids = searchParams.get("ids"); // comma-separated post IDs

  try {
    const res = await fetch(`${RAW_BASE}/all-posts.json`, { cache: "no-store" });
    if (!res.ok) return Response.json({ error: "Data unavailable." }, { status: 503 });
    const allPosts: PulsePost[] = await res.json();

    let filtered = allPosts;
    if (run_date) filtered = filtered.filter((p) => p.collected_run === run_date);
    if (category) filtered = filtered.filter((p) => p.category === category);
    if (tag) filtered = filtered.filter((p) => p.tags.includes(tag));
    if (source) filtered = filtered.filter((p) => p.source === source);
    if (ids) {
      const idSet = new Set(ids.split(",").map((s) => s.trim()));
      filtered = filtered.filter((p) => idSet.has(p.id));
    }

    return Response.json(filtered);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
