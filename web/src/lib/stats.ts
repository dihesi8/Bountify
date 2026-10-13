import type { Address } from "viem";
import type { FeedJob } from "./events";

export type WorkerStats = { earned: bigint; finished: number; completed: number; avgTurnaround?: number };

/** On-chain track record, rebuilt from escrow events. Disputes the worker lost count as finished, not completed. */
export function workerStats(jobs: FeedJob[], worker: Address): WorkerStats {
  const w = worker.toLowerCase();
  const mine = jobs.filter((j) => j.worker?.toLowerCase() === w);
  const finished = mine.filter((j) => j.status === "Resolved" || j.status === "Cancelled");
  const completed = finished.filter((j) => (j.workerAmount ?? 0n) > 0n);
  const times = mine
    .filter((j) => j.submittedAt !== undefined && j.assignedAt !== undefined)
    .map((j) => Number((j.submittedAt as bigint) - (j.assignedAt as bigint)));
  return {
    earned: completed.reduce((sum, j) => sum + (j.workerAmount ?? 0n), 0n),
    finished: finished.length,
    completed: completed.length,
    avgTurnaround: times.length ? times.reduce((a, b) => a + b, 0) / times.length : undefined,
  };
}
