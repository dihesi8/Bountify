"use client";

import { formatUsdc } from "@/lib/contracts";
import { useJobs } from "@/hooks/useJobs";

export function StatsStrip() {
  const { data } = useJobs();
  const jobs = data ?? [];
  const locked = jobs
    .filter((j) => ["Open", "Assigned", "Submitted", "Disputed"].includes(j.status))
    .reduce((sum, j) => sum + j.reward, 0n);
  const paid = jobs.reduce((sum, j) => sum + (j.workerAmount ?? 0n), 0n);
  const items = [
    ["USDC in escrow now", formatUsdc(locked)],
    ["USDC paid to contributors", formatUsdc(paid)],
    ["Tasks posted", String(jobs.length)],
  ];
  return (
    <dl className="grid grid-cols-3 gap-4 border-y border-zinc-200 py-5 dark:border-zinc-800">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-sm text-zinc-500">{label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
