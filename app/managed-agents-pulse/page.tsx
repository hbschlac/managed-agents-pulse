import { Suspense } from "react";
import Dashboard from "./Dashboard";
import type { RunSummary } from "./types";

export const metadata = { title: "Managed Agents Pulse — schlacter.me" };

const RAW_BASE =
  "https://raw.githubusercontent.com/hbschlac/build-log/main/managed-agents-pulse";

async function getRuns(): Promise<RunSummary[]> {
  try {
    const res = await fetch(`${RAW_BASE}/runs.json`, { next: { tags: ["managed-agents-pulse"] } });
    if (!res.ok) return [];
    return (await res.json()) ?? [];
  } catch {
    return [];
  }
}

async function DashboardLoader() {
  const runs = await getRuns();
  return <Dashboard runs={runs} />;
}

export default function ManagedAgentsPulsePage() {
  return (
    <main className="min-h-screen bg-[#0f0f13] text-white">
      <Suspense fallback={<div className="p-12 text-stone-500">Loading...</div>}>
        <DashboardLoader />
      </Suspense>
    </main>
  );
}
