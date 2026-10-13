"use client";

import { useState, type ReactNode } from "react";
import { useAccount, useReadContract } from "wagmi";
import { readContract } from "wagmi/actions";
import {
  ADMIN_TIMEOUT_SECONDS,
  ESCROW_ADDRESS,
  autoReleaseTime,
  escrowContract,
  formatUsdc,
  usdcContract,
} from "@/lib/contracts";
import type { FeedJob } from "@/lib/events";
import { workerStats, type WorkerStats } from "@/lib/stats";
import { useJobs } from "@/hooks/useJobs";
import { useTx } from "@/hooks/useTx";

const btn =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2";
const field =
  "min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700";

// Links come from user-written event data, so only http(s) is ever rendered as a link.
export const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : undefined);
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const dur = (s: number) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((s % 3600) / 60)}m`;
};

function statsText(s: WorkerStats) {
  if (s.finished === 0) return "No finished tasks yet";
  const base = `${formatUsdc(s.earned)} USDC earned, ${s.completed} of ${s.finished} completed`;
  return s.avgTurnaround === undefined ? base : `${base}, delivers in ${dur(s.avgTurnaround)} on average`;
}

export function Link({ url, children }: { url?: string; children: ReactNode }) {
  const href = safeUrl(url);
  return href ? (
    <a href={href} target="_blank" rel="noreferrer noopener" className="underline">
      {children}
    </a>
  ) : (
    <span className="text-zinc-500">No valid link</span>
  );
}

export function JobActions({ job, now }: { job: FeedJob; now: number }) {
  const { address } = useAccount();
  const { run, busy, error, config } = useTx();
  const { data: all } = useJobs();
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const dispute = useReadContract({
    ...escrowContract,
    functionName: "jobs",
    args: [job.id],
    query: { enabled: job.status === "Disputed" },
  });
  if (!address) return null;

  const me = address.toLowerCase();
  const isCreator = job.creator.toLowerCase() === me;
  const isWorker = job.worker?.toLowerCase() === me;
  const applied = job.applications.some((a) => a.worker.toLowerCase() === me);
  const overdue = job.deliveryDeadline !== undefined && now > Number(job.deliveryDeadline);
  const releasable = job.submittedAt !== undefined && now >= Number(autoReleaseTime(job.submittedAt));
  const canDispute =
    (isCreator || isWorker) && (job.status === "Assigned" || (job.status === "Submitted" && !releasable));
  const disputedAt = dispute.data ? Number(dispute.data[6]) : undefined;

  const call = async (functionName: string, args: unknown[], clear = false) => {
    const ok = await run((write) => write({ ...escrowContract, functionName, args }));
    if (ok && clear) setText("");
  };

  const openDispute = async () => {
    const ok = await run(async (write) => {
      if (reason.trim().length < 5) throw new Error("Describe the problem in at least 5 characters.");
      if (new TextEncoder().encode(reason).length > 512) throw new Error("Keep the reason under 512 bytes.");
      const bond = await readContract(config, { ...escrowContract, functionName: "disputeBondFor", args: [job.reward] });
      const allowance = await readContract(config, {
        ...usdcContract,
        functionName: "allowance",
        args: [address, ESCROW_ADDRESS],
      });
      if (allowance < bond) await write({ ...usdcContract, functionName: "approve", args: [ESCROW_ADDRESS, bond] });
      await write({ ...escrowContract, functionName: "logComplaint", args: [job.id, reason.trim()] });
    });
    if (ok) setReason("");
  };

  return (
    <div className="mt-3 space-y-3">
      {job.status === "Open" && isCreator && (
        <>
          {job.applications.map((a) => (
            <div key={a.worker} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="tabular-nums">{short(a.worker)}</span>
              <Link url={a.proofUrl}>Proof of work</Link>
              <span className="text-zinc-500">{statsText(workerStats(all ?? [], a.worker))}</span>
              <button className={btn} disabled={busy} onClick={() => call("approveWorker", [job.id, a.worker])}>
                Approve
              </button>
            </div>
          ))}
          <button className={btn} disabled={busy} onClick={() => call("cancelJob", [job.id])}>
            Cancel and refund
          </button>
        </>
      )}

      {job.status === "Open" && !isCreator && !applied && (
        <div className="flex flex-wrap gap-2">
          <input className={field} placeholder="Link to your past work (https://…)" value={text} onChange={(e) => setText(e.target.value)} />
          <button className={btn} disabled={busy || !safeUrl(text)} onClick={() => call("applyForJob", [job.id, text.trim()], true)}>
            Apply
          </button>
        </div>
      )}

      {job.status === "Assigned" && isWorker && (
        <div className="flex flex-wrap gap-2">
          <input className={field} placeholder="Link to your deliverable (https://…)" value={text} onChange={(e) => setText(e.target.value)} />
          <button className={btn} disabled={busy || !safeUrl(text)} onClick={() => call("submitWork", [job.id, text.trim()], true)}>
            Submit work
          </button>
        </div>
      )}

      {job.status === "Assigned" && isCreator && overdue && (
        <button className={btn} disabled={busy} onClick={() => call("reclaimStaleJob", [job.id])}>
          Reclaim funds (deadline missed)
        </button>
      )}

      {job.status === "Submitted" && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link url={job.deliverablesUrl}>View deliverable</Link>
          {isCreator && (
            <button className={btn} disabled={busy} onClick={() => call("approveWork", [job.id])}>
              Approve and pay
            </button>
          )}
          {releasable && (
            <button className={btn} disabled={busy} onClick={() => call("claimAutoRelease", [job.id])}>
              Release payment
            </button>
          )}
        </div>
      )}

      {canDispute && (
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">Open a dispute</summary>
          <div className="mt-2 space-y-2">
            <textarea className={`${field} w-full`} rows={3} placeholder="What went wrong?" value={reason} onChange={(e) => setReason(e.target.value)} />
            <p className="text-zinc-500">
              You post a refundable bond (5% of the reward, at least 0.5 USDC). If the admin awards you less than half
              of the reward, the other side keeps it. Disputes must be opened before the 4-day review window ends.
            </p>
            <button className={btn} disabled={busy} onClick={openDispute}>
              Open dispute
            </button>
          </div>
        </details>
      )}

      {job.status === "Disputed" && (
        <div className="space-y-2 text-sm">
          {job.complaint && (
            <p>
              <span className="text-zinc-500">Opened by {short(job.complaint.by)}: </span>
              {job.complaint.reason}
            </p>
          )}
          {job.deliverablesUrl && <Link url={job.deliverablesUrl}>View deliverable</Link>}
          <p className="text-zinc-500">
            The admin decides the split. If there is no decision within 14 days, anyone can force a 50/50 split.
          </p>
          {disputedAt !== undefined && now >= disputedAt + ADMIN_TIMEOUT_SECONDS && (
            <button className={btn} disabled={busy} onClick={() => call("resolveExpiredDispute", [job.id])}>
              Force 50/50 split
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
