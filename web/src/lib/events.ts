import { parseEventLogs, type Address, type Log, type PublicClient } from "viem";
import { escrowAbi } from "./abi";
import type { JobStatusLabel } from "./contracts";
import { parseMetadata, type JobMeta } from "./metadata";

export type FeedJob = JobMeta & {
  id: bigint;
  creator: Address;
  reward: bigint;
  deliveryDuration: bigint;
  status: JobStatusLabel;
  applicants: number;
  applications: { worker: Address; proofUrl: string }[];
  deliverablesUrl?: string;
  complaint?: { by: Address; reason: string; bond: bigint };
  workerAmount?: bigint;
  assignedAt?: bigint;
  worker?: Address;
  deliveryDeadline?: bigint;
  submittedAt?: bigint;
  createdBlock: bigint;
};

export const parseEscrowLogs = (logs: Log[]) => parseEventLogs({ abi: escrowAbi, logs });
type EscrowLog = ReturnType<typeof parseEscrowLogs>[number];

const MIN_SPAN = 2_000n;

/** getLogs that halves the block range whenever the RPC rejects it (range or result limits). */
export async function getLogsAdaptive(
  client: PublicClient,
  address: Address,
  from: bigint,
  to: bigint
): Promise<Log[]> {
  try {
    return await client.getLogs({ address, fromBlock: from, toBlock: to });
  } catch (err) {
    if (to - from < MIN_SPAN) throw err;
    const mid = from + (to - from) / 2n;
    const left = await getLogsAdaptive(client, address, from, mid);
    const right = await getLogsAdaptive(client, address, mid + 1n, to);
    return [...left, ...right];
  }
}

/** Rebuilds every job's current state from the escrow's event history. */
export function reduceJobs(logs: EscrowLog[]): FeedJob[] {
  const jobs = new Map<bigint, FeedJob>();
  const ordered = [...logs].sort(
    (a, b) => Number(a.blockNumber - b.blockNumber) || a.logIndex - b.logIndex
  );
  for (const log of ordered) {
    switch (log.eventName) {
      case "JobCreated": {
        const a = log.args;
        jobs.set(a.jobId, {
          ...parseMetadata(a.metadataUri),
          id: a.jobId,
          creator: a.creator,
          reward: a.reward,
          deliveryDuration: a.deliveryDuration,
          status: "Open",
          applicants: 0,
          applications: [],
          createdBlock: log.blockNumber,
        });
        break;
      }
      case "JobApplication": {
        const j = jobs.get(log.args.jobId);
        if (j) {
          j.applicants += 1;
          j.applications.push({ worker: log.args.worker, proofUrl: log.args.proofUrl });
        }
        break;
      }
      case "JobAssigned": {
        const j = jobs.get(log.args.jobId);
        if (j) {
          j.status = "Assigned";
          j.worker = log.args.worker;
          j.deliveryDeadline = log.args.deliveryDeadline;
          j.assignedAt = log.args.deliveryDeadline - j.deliveryDuration;
        }
        break;
      }
      case "WorkerWithdrew": {
        const j = jobs.get(log.args.jobId);
        if (j) {
          j.status = "Open";
          j.worker = undefined;
          j.deliveryDeadline = undefined;
          j.assignedAt = undefined;
        }
        break;
      }
      case "WorkSubmitted": {
        const j = jobs.get(log.args.jobId);
        if (j) {
          j.status = "Submitted";
          j.submittedAt = log.args.submissionTimestamp;
          j.deliverablesUrl = log.args.deliverablesUrl;
        }
        break;
      }
      case "ComplaintLogged": {
        const j = jobs.get(log.args.jobId);
        if (j) {
          j.status = "Disputed";
          j.complaint = { by: log.args.complainant, reason: log.args.reason, bond: log.args.bond };
        }
        break;
      }
      case "JobSettled": {
        const j = jobs.get(log.args.jobId);
        if (j) {
          const t = Number(log.args.settleType); // 4 = Reclaimed, 5 = Cancelled
          j.status = t === 4 || t === 5 ? "Cancelled" : "Resolved";
          j.workerAmount = log.args.workerAmount;
        }
        break;
      }
    }
  }
  return [...jobs.values()].sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));
}

// Logs are cached per escrow so refreshes only scan new blocks.
const cache = new Map<string, { logs: EscrowLog[]; next: bigint }>();

export async function loadJobs(
  client: PublicClient,
  chainId: number,
  address: Address,
  deployBlock: bigint
): Promise<FeedJob[]> {
  const key = `${chainId}:${address}`;
  const c = cache.get(key) ?? { logs: [], next: deployBlock };
  const latest = await client.getBlockNumber();
  if (latest >= c.next) {
    const raw = await getLogsAdaptive(client, address, c.next, latest);
    c.logs = [...c.logs, ...parseEscrowLogs(raw)];
    c.next = latest + 1n;
  }
  cache.set(key, c);
  return reduceJobs(c.logs);
}
