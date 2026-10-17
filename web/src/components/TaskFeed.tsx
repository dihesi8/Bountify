"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { ACTIVE_CHAIN, NETWORK } from "@/lib/chains";
import { ESCROW_DEPLOY_BLOCK, parseUsdc } from "@/lib/contracts";
import { CATEGORIES, type Category } from "@/lib/metadata";
import type { FeedJob } from "@/lib/events";
import { useJobs } from "@/hooks/useJobs";
import { JobCard } from "./JobCard";

type Tab = "Open" | "In progress" | "Completed" | "Mine" | "All";
const TABS: Tab[] = ["Open", "In progress", "Completed", "Mine", "All"];

// Tiers fit the 25 USDC launch cap. Edit freely; min is inclusive, max is exclusive.
const TIERS: { label: string; min?: bigint; max?: bigint }[] = [
  { label: "Any reward" },
  { label: "Under 5 USDC", max: parseUsdc("5") },
  { label: "5 to 25 USDC", min: parseUsdc("5"), max: parseUsdc("25") },
  { label: "25 USDC and up", min: parseUsdc("25") },
];

const inTab = (j: FeedJob, tab: Tab, me?: string) =>
  tab === "All" ||
  (tab === "Mine" &&
    !!me &&
    (j.creator.toLowerCase() === me ||
      j.worker?.toLowerCase() === me ||
      j.applications.some((a) => a.worker.toLowerCase() === me))) ||
  (tab === "Open" && j.status === "Open") ||
  (tab === "In progress" && ["Assigned", "Submitted", "Disputed"].includes(j.status)) ||
  (tab === "Completed" && j.status === "Resolved");

const select =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2";

export function TaskFeed() {
  const { data, isLoading, error, refetch } = useJobs();
  const { address } = useAccount();
  const me = address?.toLowerCase();
  const [tab, setTab] = useState<Tab>("Open");
  const [category, setCategory] = useState<Category | "All">("All");
  const [tier, setTier] = useState(0);
  const [sort, setSort] = useState<"new" | "reward">("new");
  const [now, setNow] = useState(0); // set after mount so prerender never reads the clock

  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const jobs = useMemo(() => {
    const t = TIERS[tier];
    const list = (data ?? []).filter(
      (j) =>
        inTab(j, tab, me) &&
        (category === "All" || j.category === category) &&
        (t.min === undefined || j.reward >= t.min) &&
        (t.max === undefined || j.reward < t.max)
    );
    return sort === "reward"
      ? [...list].sort((a, b) => (b.reward > a.reward ? 1 : b.reward < a.reward ? -1 : 0))
      : list;
  }, [data, tab, category, tier, sort, me]);

  return (
    <section aria-busy={isLoading}>
      {ESCROW_DEPLOY_BLOCK === 0n && (
        <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Set NEXT_PUBLIC_ARC_{NETWORK === "mainnet" ? "MAINNET" : "TESTNET"}_DEPLOY_BLOCK in .env.local so the feed
          doesn&apos;t scan from block 0.
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800">
        <div role="tablist" className="flex gap-6">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 pb-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${
                tab === t ? "border-current" : "border-transparent text-zinc-500 hover:text-current"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="pb-3 text-sm text-zinc-500">{ACTIVE_CHAIN.name}</p>
      </div>

      <div className="flex flex-wrap gap-3 py-4">
        <select aria-label="Category" className={select} value={category} onChange={(e) => setCategory(e.target.value as Category | "All")}>
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select aria-label="Reward" className={select} value={tier} onChange={(e) => setTier(Number(e.target.value))}>
          {TIERS.map((t, i) => (
            <option key={t.label} value={i}>
              {t.label}
            </option>
          ))}
        </select>
        <select aria-label="Sort" className={select} value={sort} onChange={(e) => setSort(e.target.value as "new" | "reward")}>
          <option value="new">Newest first</option>
          <option value="reward">Highest reward</option>
        </select>
      </div>

      {isLoading && <p className="py-10 text-zinc-500">Loading tasks from {ACTIVE_CHAIN.name}…</p>}

      {error && (
        <div className="py-10">
          <p>Couldn&apos;t load tasks from {ACTIVE_CHAIN.name}. Check your RPC connection, then retry.</p>
          <p className="mt-1 text-sm text-zinc-500">{errorText(error)}</p>
          <button onClick={() => refetch()} className="mt-3 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && jobs.length === 0 && (
        <p className="py-10 text-zinc-500">No tasks match these filters. Clear a filter or check back soon.</p>
      )}

      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {jobs.map((j) => (
          <JobCard key={j.id.toString()} job={j} now={now} />
        ))}
      </ul>
    </section>
  );
}

// viem errors keep the useful part (the server's reason) in `details`; `message` buries it after the request body.
function errorText(e: Error & { shortMessage?: string; details?: string }) {
  const text = [e.shortMessage, e.details].filter(Boolean).join(": ");
  return (text || e.message).slice(0, 240);
}
