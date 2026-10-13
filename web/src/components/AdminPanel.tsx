"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { escrowContract, formatUsdc } from "@/lib/contracts";
import type { FeedJob } from "@/lib/events";
import { useJobs } from "@/hooks/useJobs";
import { useTx } from "@/hooks/useTx";
import { Link } from "./JobActions";

function DisputeRow({ job }: { job: FeedJob }) {
  const { run, busy, error } = useTx();
  const [pct, setPct] = useState(50);
  const worker = (job.reward * BigInt(pct)) / 100n;
  const creator = job.reward - worker;
  return (
    <li className="space-y-3 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">
          #{job.id.toString()} {job.title}
        </h3>
        <p className="tabular-nums">{formatUsdc(job.reward)} USDC in escrow</p>
      </div>
      {job.complaint && <p className="text-sm">{job.complaint.reason}</p>}
      {job.deliverablesUrl && (
        <p className="text-sm">
          <Link url={job.deliverablesUrl}>View deliverable</Link>
        </p>
      )}
      <label className="block text-sm">
        Worker receives {pct}% ({formatUsdc(worker)} USDC), creator is refunded {100 - pct}% ({formatUsdc(creator)} USDC)
        <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="mt-2 block w-full" />
      </label>
      <p className="text-xs text-zinc-500">
        The bond goes back to whoever opened the dispute if they receive at least half; otherwise the other side keeps it.
      </p>
      <button
        disabled={busy}
        onClick={() => run((write) => write({ ...escrowContract, functionName: "resolveDispute", args: [job.id, worker, creator] }))}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Resolve dispute
      </button>
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
    </li>
  );
}

export function AdminPanel() {
  const { address } = useAccount();
  const owner = useReadContract({ ...escrowContract, functionName: "owner" });
  const { data } = useJobs();
  if (!address || !owner.data || owner.data.toLowerCase() !== address.toLowerCase()) return null;
  const disputed = (data ?? []).filter((j) => j.status === "Disputed");
  return (
    <section className="mt-12 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-xl font-semibold">Dispute queue</h2>
      <p className="mt-1 text-sm text-zinc-500">Only the admin wallet sees this section.</p>
      {disputed.length === 0 ? (
        <p className="py-6 text-zinc-500">No open disputes.</p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
          {disputed.map((j) => (
            <DisputeRow key={j.id.toString()} job={j} />
          ))}
        </ul>
      )}
    </section>
  );
}
