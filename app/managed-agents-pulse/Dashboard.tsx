"use client";

import { useState, useCallback, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid,
} from "recharts";
import type { PulsePost, RunSummary, PostCategory } from "./types";

// ─── colours ──────────────────────────────────────────────────────────────────
const CAT_COLOR: Record<PostCategory, string> = {
  momentum: "#22c55e",
  friction: "#ef4444",
  use_case: "#3b82f6",
  feature_request: "#8b5cf6",
};
const CAT_LABEL: Record<PostCategory, string> = {
  momentum: "Momentum",
  friction: "Friction",
  use_case: "Use Case",
  feature_request: "Feature Request",
};
// ─── lazy post fetching ───────────────────────────────────────────────────────
function buildPostsUrl(params: Record<string, string>) {
  const q = new URLSearchParams(params);
  return `/api/managed-agents-pulse/posts?${q.toString()}`;
}

async function fetchPosts(url: string): Promise<PulsePost[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ─── drilldown drawer ─────────────────────────────────────────────────────────
interface DrawerState {
  label: string;
  query: string;
}

function DrilldownDrawer({
  drawer,
  onClose,
}: {
  drawer: DrawerState | null;
  onClose: () => void;
}) {
  const [posts, setPosts] = useState<PulsePost[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (!drawer) { setPosts(null); return; }
    setLoading(true);
    setPosts(null);
    fetchPosts(drawer.query).then((p) => { setPosts(p); setLoading(false); });
  }, [drawer]);

  if (!drawer) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-xl bg-[#18181f] border-l border-white/10 z-50 flex flex-col shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">Source data</p>
            <h2 className="text-sm font-semibold text-white leading-snug">{drawer.label}</h2>
            {posts && (
              <p className="text-xs text-stone-500 mt-0.5">
                {posts.length} post{posts.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white transition-colors ml-4 mt-0.5 text-xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-[#0f0f13] rounded-lg p-4 border border-white/5 animate-pulse h-24" />
              ))}
            </div>
          )}
          {!loading && posts?.length === 0 && (
            <p className="text-stone-500 text-sm">No posts to show.</p>
          )}
          {!loading && posts && [...posts].sort((a, b) => b.score - a.score).map((post) => (
            <div key={post.id} className="bg-[#0f0f13] rounded-lg p-4 border border-white/5 hover:border-white/15 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: CAT_COLOR[post.category] + "22", color: CAT_COLOR[post.category] }}
                >
                  {CAT_LABEL[post.category]}
                </span>
                <span className="text-xs text-stone-500 shrink-0">
                  {post.source === "hackernews" ? "HN" : `r/${post.subreddit}`} · {"\u2191"}{post.score}
                </span>
              </div>
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white font-medium hover:text-blue-300 transition-colors leading-snug block mb-2"
              >
                {post.title} {"\u2197"}
              </a>
              {post.selftext_snippet && (
                <p className="text-xs text-stone-400 leading-relaxed line-clamp-3">{post.selftext_snippet}</p>
              )}
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-stone-600">{post.collected_run}</span>
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View on {post.source === "hackernews" ? "HN" : "Reddit"} →
                </a>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

// ─── stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, onClick, color }: {
  label: string; value: string | number; sub?: string; onClick?: () => void; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white/5 hover:bg-white/8 active:bg-white/10 border border-white/8 rounded-xl p-5 text-left transition-all cursor-pointer group w-full"
    >
      <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-bold transition-colors" style={{ color: color ?? "white" }}>{value}</p>
      {sub && <p className="text-xs text-stone-500 mt-1">{sub}</p>}
      <p className="text-xs text-stone-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">click to drill down</p>
    </button>
  );
}

// ─── module 1: latest findings ──────────────────────────────────────────────
function LatestFindings({
  latestRun,
  openDrawer,
}: {
  latestRun: RunSummary | null;
  openDrawer: (label: string, query: string) => void;
}) {
  const [filter, setFilter] = useState<PostCategory | "all">("all");
  const [previewPosts, setPreviewPosts] = useState<PulsePost[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!latestRun) return;
    setLoadingPreview(true);
    fetchPosts(buildPostsUrl({ run_date: latestRun.run_date }))
      .then((p) => { setPreviewPosts(p); setLoadingPreview(false); });
  }, [latestRun?.run_date]);

  const displayed = filter === "all" ? previewPosts : previewPosts.filter((p) => p.category === filter);

  if (!latestRun) {
    return (
      <section className="bg-white/5 border border-white/8 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Latest Findings</h2>
        <p className="text-stone-500 text-sm">Collecting data — the Managed Agents API launched April 10, 2026. Check back as the conversation builds.</p>
      </section>
    );
  }

  return (
    <section className="bg-white/5 border border-white/8 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">Latest Run</p>
          <h2 className="text-xl font-bold text-white">Developer Conversation</h2>
          <p className="text-sm text-stone-400 mt-1">
            {latestRun.day} · {latestRun.run_date} · {latestRun.total_new_posts} new posts
          </p>
        </div>
        <a
          href="https://raw.githubusercontent.com/hbschlac/build-log/main/managed-agents-pulse/all-posts.json"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/12 border border-white/10 text-stone-300 transition-colors"
        >
          {"\u2193"} Download raw data
        </a>
      </div>

      {/* category filter badges */}
      <div className="flex gap-2 flex-wrap mb-5">
        {(["all", "momentum", "friction", "use_case", "feature_request"] as const).map((cat) => {
          const count = cat === "all" ? latestRun.total_new_posts : (latestRun.categories[cat] ?? 0);
          const active = filter === cat;
          return (
            <button
              key={cat}
              onClick={() => {
                setFilter(cat);
                const q = cat === "all"
                  ? buildPostsUrl({ run_date: latestRun.run_date })
                  : buildPostsUrl({ run_date: latestRun.run_date, category: cat });
                const label = cat === "all" ? "All posts this run" : `${CAT_LABEL[cat]} posts`;
                openDrawer(label, q);
              }}
              className="text-xs px-3 py-1 rounded-full border transition-all"
              style={
                active && cat !== "all"
                  ? { background: CAT_COLOR[cat] + "22", borderColor: CAT_COLOR[cat], color: CAT_COLOR[cat] }
                  : { background: "transparent", borderColor: "rgba(255,255,255,0.1)", color: "#a8a29e" }
              }
            >
              {cat === "all" ? "All" : CAT_LABEL[cat]} ({count})
            </button>
          );
        })}
      </div>

      {/* post preview cards */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {loadingPreview && [1, 2, 3].map((i) => (
          <div key={i} className="bg-[#0f0f13] rounded-lg p-3 border border-white/5 animate-pulse h-14" />
        ))}
        {!loadingPreview && displayed.map((post) => (
          <button
            key={post.id}
            onClick={() => openDrawer(`"${post.title}"`, buildPostsUrl({ ids: post.id }))}
            className="w-full text-left bg-[#0f0f13] hover:bg-white/5 border border-white/5 hover:border-white/15 rounded-lg p-3 transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: CAT_COLOR[post.category] + "22", color: CAT_COLOR[post.category] }}
              >
                {CAT_LABEL[post.category]}
              </span>
              <span className="text-xs text-stone-500">
                {post.source === "hackernews" ? "HN" : `r/${post.subreddit}`} · {"\u2191"}{post.score}
              </span>
              <span className="ml-auto text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">view source →</span>
            </div>
            <p className="text-sm text-white leading-snug">{post.title}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

// ─── module 2: cumulative trends & wow ───────────────────────────────────────
function CumulativeTrends({
  runs,
  openDrawer,
}: {
  runs: RunSummary[];
  openDrawer: (label: string, query: string) => void;
}) {
  // Need at least 2 runs for trends to be meaningful
  if (runs.length < 2) return null;

  const last10 = runs.slice(-10);
  const latestRun = runs[runs.length - 1];

  const trendData = last10.map((r) => {
    const total = r.total_new_posts || 1;
    return {
      date: r.run_date.slice(5),
      momentum: Math.round((r.categories.momentum / total) * 100),
      friction: Math.round((r.categories.friction / total) * 100),
      use_case: Math.round((r.categories.use_case / total) * 100),
      feature_request: Math.round((r.categories.feature_request / total) * 100),
      run_date: r.run_date,
    };
  });

  const pieData = latestRun ? [
    { name: "Momentum", value: latestRun.categories.momentum, color: CAT_COLOR.momentum, cat: "momentum" as PostCategory },
    { name: "Friction", value: latestRun.categories.friction, color: CAT_COLOR.friction, cat: "friction" as PostCategory },
    { name: "Use Cases", value: latestRun.categories.use_case, color: CAT_COLOR.use_case, cat: "use_case" as PostCategory },
    { name: "Feature Requests", value: latestRun.categories.feature_request, color: CAT_COLOR.feature_request, cat: "feature_request" as PostCategory },
  ] : [];

  const tagData = latestRun?.top_tags.slice(0, 8).map((t) => {
    const prevRun = runs[runs.length - 2];
    const prevCount = prevRun?.top_tags.find((pt) => pt.tag === t.tag)?.count ?? 0;
    return { tag: t.tag, thisRun: t.count, lastRun: prevCount };
  }) ?? [];

  const delta = latestRun?.delta_vs_last;

  return (
    <section className="bg-white/5 border border-white/8 rounded-2xl p-6 space-y-8">
      <div>
        <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">Trends</p>
        <h2 className="text-xl font-bold text-white">Run-over-Run Changes</h2>
      </div>

      {/* deltas */}
      {delta && (
        <div className="flex gap-3 flex-wrap">
          {([
            { label: "Momentum", val: delta.momentum_pct_change, cat: "momentum" as PostCategory },
            { label: "Friction", val: delta.friction_pct_change, cat: "friction" as PostCategory },
            { label: "Use Cases", val: delta.use_case_pct_change, cat: "use_case" as PostCategory },
          ]).map(({ label, val, cat }) => (
            <button
              key={label}
              onClick={() => openDrawer(`${label} — latest run`, buildPostsUrl({ run_date: latestRun!.run_date, category: cat }))}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/8 border border-white/8 rounded-lg px-4 py-2 transition-colors"
            >
              <span className="text-sm text-stone-300">{label}</span>
              <span className={`text-sm font-bold ${val > 0 ? "text-red-400" : val < 0 ? "text-green-400" : "text-stone-400"}`}>
                {val > 0 ? "\u2191" : val < 0 ? "\u2193" : "\u2014"}{Math.abs(val).toFixed(1)}%
              </span>
            </button>
          ))}
          {delta.top_emerging_tag && (
            <button
              onClick={() => openDrawer(`Posts tagged "${delta.top_emerging_tag}"`, buildPostsUrl({ tag: delta.top_emerging_tag! }))}
              className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 rounded-lg px-4 py-2 transition-colors"
            >
              <span className="text-xs text-amber-300">New tag:</span>
              <span className="text-sm font-medium text-amber-200">{delta.top_emerging_tag}</span>
            </button>
          )}
        </div>
      )}

      {/* trend line */}
      {trendData.length > 1 && (
        <div>
          <p className="text-xs text-stone-400 mb-3">Category % over last {trendData.length} runs — click a data point to see posts</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: "#78716c", fontSize: 11 }} />
              <YAxis tick={{ fill: "#78716c", fontSize: 11 }} unit="%" />
              <Tooltip contentStyle={{ background: "#18181f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} labelStyle={{ color: "#e7e5e4" }} itemStyle={{ color: "#a8a29e" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#a8a29e" }} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Line type="monotone" dataKey="momentum" stroke={CAT_COLOR.momentum} name="Momentum" dot={{ r: 4, cursor: "pointer" }} onClick={(d: any) => openDrawer(`Momentum · ${d.run_date}`, buildPostsUrl({ run_date: d.run_date, category: "momentum" }))} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Line type="monotone" dataKey="friction" stroke={CAT_COLOR.friction} name="Friction" dot={{ r: 4, cursor: "pointer" }} onClick={(d: any) => openDrawer(`Friction · ${d.run_date}`, buildPostsUrl({ run_date: d.run_date, category: "friction" }))} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Line type="monotone" dataKey="use_case" stroke={CAT_COLOR.use_case} name="Use Cases" dot={{ r: 4, cursor: "pointer" }} onClick={(d: any) => openDrawer(`Use Cases · ${d.run_date}`, buildPostsUrl({ run_date: d.run_date, category: "use_case" }))} />
              <Line type="monotone" dataKey="feature_request" stroke={CAT_COLOR.feature_request} name="Feature Requests" dot={{ r: 4, cursor: "pointer" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* pie + tag bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-stone-400 mb-3">This run&apos;s split — click a slice</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={(e: any) => openDrawer(`${e.name} · this run`, buildPostsUrl({ run_date: latestRun!.run_date, category: e.cat }))}
                style={{ cursor: "pointer" }}
              >
                {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#18181f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} itemStyle={{ color: "#a8a29e" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#a8a29e" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="text-xs text-stone-400 mb-3">Top tags: this run vs last — click a bar</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={tagData} layout="vertical">
              <XAxis type="number" tick={{ fill: "#78716c", fontSize: 10 }} />
              <YAxis dataKey="tag" type="category" tick={{ fill: "#a8a29e", fontSize: 10 }} width={90} />
              <Tooltip contentStyle={{ background: "#18181f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} itemStyle={{ color: "#a8a29e" }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#a8a29e" }} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Bar dataKey="thisRun" name="This run" fill="#3b82f6" radius={[0, 3, 3, 0]} onClick={(d: any) => openDrawer(`Posts tagged "${d.tag}" · this run`, buildPostsUrl({ run_date: latestRun!.run_date, tag: d.tag }))} style={{ cursor: "pointer" }} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Bar dataKey="lastRun" name="Last run" fill="#1e3a5f" radius={[0, 3, 3, 0]} onClick={(d: any) => { const prev = runs[runs.length - 2]; if (prev) openDrawer(`Posts tagged "${d.tag}" · last run`, buildPostsUrl({ run_date: prev.run_date, tag: d.tag })); }} style={{ cursor: "pointer" }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

// ─── module 3: most-quoted ──────────────────────────────────────────────────
function MostQuoted({
  latestRun,
  openDrawer,
}: {
  latestRun: RunSummary | null;
  openDrawer: (label: string, query: string) => void;
}) {
  const [posts, setPosts] = useState<PulsePost[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!latestRun) return;
    setLoading(true);
    fetchPosts(buildPostsUrl({ run_date: latestRun.run_date }))
      .then((p) => { setPosts(p); setLoading(false); });
  }, [latestRun?.run_date]);

  if (!latestRun) return null;

  const cats: PostCategory[] = ["momentum", "friction", "use_case", "feature_request"];
  const byCat = (cat: PostCategory) =>
    posts.filter((p) => p.category === cat).sort((a, b) => b.score - a.score).slice(0, 2);

  return (
    <section className="bg-white/5 border border-white/8 rounded-2xl p-6">
      <div className="mb-5">
        <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">Signal</p>
        <h2 className="text-xl font-bold text-white">Most-quoted this run</h2>
        <p className="text-sm text-stone-400 mt-1">
          Top-scoring posts in each bucket, with the actual quotes. No prescription — just the raw signal.
        </p>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-5 animate-pulse h-40" />
          ))}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cats.map((cat) => {
            const top = byCat(cat);
            return (
              <div key={cat} className="rounded-xl border border-white/8 bg-white/3 p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: CAT_COLOR[cat] + "22", color: CAT_COLOR[cat] }}
                  >
                    {CAT_LABEL[cat]} ({latestRun.categories[cat] ?? 0})
                  </span>
                  {(latestRun.categories[cat] ?? 0) > 0 && (
                    <button
                      onClick={() => openDrawer(`${CAT_LABEL[cat]} · latest run`, buildPostsUrl({ run_date: latestRun.run_date, category: cat }))}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      See all →
                    </button>
                  )}
                </div>

                {top.length === 0 ? (
                  <p className="text-xs text-stone-500">Nothing in this bucket yet.</p>
                ) : (
                  <div className="space-y-4 flex-1">
                    {top.map((post) => (
                      <div key={post.id}>
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-white hover:text-blue-300 transition-colors block mb-1 leading-snug"
                        >
                          {post.title} {"\u2197"}
                        </a>
                        {post.selftext_snippet && (
                          <blockquote
                            className="text-sm text-stone-300 border-l-2 pl-3 my-2 leading-relaxed"
                            style={{ borderColor: CAT_COLOR[cat] + "66" }}
                          >
                            &ldquo;{post.selftext_snippet.trim()}&rdquo;
                          </blockquote>
                        )}
                        <p className="text-xs text-stone-500">
                          &mdash; {post.source === "hackernews" ? "Hacker News" : `r/${post.subreddit}`} &middot; {"\u2191"}{post.score} &middot; {post.num_comments} comment{post.num_comments !== 1 ? "s" : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-stone-600 mt-5 border border-white/5 rounded-lg px-3 py-2 bg-white/3">
        Based on Reddit + HN posts about Managed Agents (n={latestRun.total_new_posts}). Public forums skew toward early adopters and vocal users &mdash; directional signal, not a verdict.
      </p>
    </section>
  );
}

// ─── main dashboard ───────────────────────────────────────────────────────────
export default function Dashboard({ runs }: { runs: RunSummary[] }) {
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const openDrawer = useCallback((label: string, query: string) => setDrawer({ label, query }), []);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  const latestRun = runs[runs.length - 1] ?? null;
  const totalPosts = latestRun?.cumulative_total ?? 0;

  return (
    <>
      <DrilldownDrawer drawer={drawer} onClose={closeDrawer} />
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">

        {/* header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs tracking-widest uppercase text-stone-500 mb-1">schlacter.me</p>
            <h1 className="text-3xl font-bold text-white">Managed Agents API — Developer Pulse</h1>
            <p className="text-stone-400 mt-1 text-sm">What developers are saying about the Managed Agents API launch (April 10, 2026)</p>
            <p className="text-xs text-stone-500 mt-1">Sources: Reddit + Hacker News · auto-updated</p>
            {latestRun && <p className="text-xs text-stone-600 mt-1">Last updated {latestRun.run_date}</p>}
          </div>
          <a
            href="https://raw.githubusercontent.com/hbschlac/build-log/main/managed-agents-pulse/all-posts.json"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-4 py-2 rounded-lg bg-white/8 hover:bg-white/12 border border-white/10 text-stone-300 transition-colors self-start"
          >
            {"\u2193"} Download all data (JSON)
          </a>
        </div>

        {/* stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total posts"
            value={totalPosts}
            sub="since launch"
            onClick={() => openDrawer("All posts — since launch", buildPostsUrl({}))}
          />
          <StatCard
            label="Momentum"
            value={latestRun?.categories.momentum ?? 0}
            sub="latest run"
            color={CAT_COLOR.momentum}
            onClick={() => latestRun && openDrawer("Momentum · latest run", buildPostsUrl({ run_date: latestRun.run_date, category: "momentum" }))}
          />
          <StatCard
            label="Friction"
            value={latestRun?.categories.friction ?? 0}
            sub="latest run"
            color={CAT_COLOR.friction}
            onClick={() => latestRun && openDrawer("Friction · latest run", buildPostsUrl({ run_date: latestRun.run_date, category: "friction" }))}
          />
          <StatCard
            label="Use cases"
            value={latestRun?.categories.use_case ?? 0}
            sub="latest run"
            color={CAT_COLOR.use_case}
            onClick={() => latestRun && openDrawer("Use Cases · latest run", buildPostsUrl({ run_date: latestRun.run_date, category: "use_case" }))}
          />
        </div>

        <LatestFindings latestRun={latestRun} openDrawer={openDrawer} />
        <CumulativeTrends runs={runs} openDrawer={openDrawer} />
        <MostQuoted latestRun={latestRun} openDrawer={openDrawer} />

        {/* footer */}
        <footer className="text-center py-8 border-t border-white/5">
          <p className="text-xs text-stone-600">
            Built by Hannah Schlacter · Independent developer feedback analysis
          </p>
        </footer>
      </div>
    </>
  );
}
