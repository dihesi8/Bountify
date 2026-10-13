import { autoReleaseTime, formatUsdc } from "@/lib/contracts";
import type { FeedJob } from "@/lib/events";
import { JobActions } from "./JobActions";

const LABEL: Record<string, string> = {
  Open: "Open",
  Assigned: "In progress",
  Submitted: "Awaiting review",
  Disputed: "Disputed",
  Resolved: "Completed",
  Cancelled: "Cancelled",
};
const DOT: Record<string, string> = {
  Open: "bg-emerald-500",
  Assigned: "bg-sky-500",
  Submitted: "bg-amber-500",
  Disputed: "bg-rose-500",
  Resolved: "bg-zinc-400",
  Cancelled: "bg-zinc-300 dark:bg-zinc-600",
};

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s % 60}s`;
}

function timerText(job: FeedJob, now: number): string | null {
  if (job.status !== "Open" && now === 0) return null;
  if (job.status === "Open") return `${Math.round(Number(job.deliveryDuration) / 86400)} day delivery window`;
  if (job.status === "Assigned" && job.deliveryDeadline) {
    const left = Number(job.deliveryDeadline) - now;
    return left > 0 ? `Delivery due in ${fmt(left)}` : "Delivery overdue";
  }
  if (job.status === "Submitted" && job.submittedAt) {
    const left = Number(autoReleaseTime(job.submittedAt)) - now;
    return left > 0 ? `Auto-release in ${fmt(left)}` : "Auto-release can be claimed now";
  }
  return null;
}

export function JobCard({ job, now }: { job: FeedJob; now: number }) {
  const timer = timerText(job, now);
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 py-5">
      <div className="min-w-0">
        <h3 className="text-lg font-medium leading-snug">{job.title}</h3>
        {job.description && (
          <p className="mt-1 line-clamp-2 max-w-prose text-zinc-600 dark:text-zinc-400">{job.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-zinc-500">
          <span>{job.category}</span>
          <span>
            by {job.creator.slice(0, 6)}…{job.creator.slice(-4)}
          </span>
          <span>
            {job.applicants} {job.applicants === 1 ? "applicant" : "applicants"}
          </span>
          {timer && <span className="tabular-nums">{timer}</span>}
        </div>
      </div>
      <div className="text-right">
        <p className="text-2xl font-semibold tabular-nums">{formatUsdc(job.reward)}</p>
        <p className="text-xs text-zinc-500">USDC in escrow</p>
        <p className="mt-2 inline-flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${DOT[job.status]}`} aria-hidden />
          {LABEL[job.status]}
        </p>
      </div>
      <div className="col-span-2">
        <JobActions job={job} now={now} />
      </div>
    </li>
  );
}
