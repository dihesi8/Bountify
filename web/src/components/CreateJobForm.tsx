"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { readContract } from "wagmi/actions";
import { ACTIVE_CHAIN } from "@/lib/chains";
import { ESCROW_ADDRESS, escrowContract, formatUsdc, parseUsdc, usdcContract } from "@/lib/contracts";
import { CATEGORIES, encodeMetadata, type Category } from "@/lib/metadata";
import { useTx } from "@/hooks/useTx";

const field =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2";

export function CreateJobForm() {
  const { address, chainId } = useAccount();
  const { run, busy, error, config } = useTx();
  const min = useReadContract({ ...escrowContract, functionName: "minReward" });
  const max = useReadContract({ ...escrowContract, functionName: "maxReward" });
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("Dev");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("5");
  const [days, setDays] = useState("7");
  const [done, setDone] = useState(false);

  if (!address) return <p className="text-sm text-zinc-500">Connect a wallet to post a task.</p>;

  return (
    <details className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <summary className="cursor-pointer font-medium">Post a task</summary>
      <form
        className="mt-4 grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setDone(false);
          const ok = await run(async (write) => {
            const windowDays = Number(days);
            if (title.trim().length < 3) throw new Error("Add a title of at least 3 characters.");
            if (!(windowDays >= 1 && windowDays <= 90)) throw new Error("Delivery window must be 1 to 90 days.");
            const amount = parseUsdc(reward);
            const metadata = encodeMetadata({ title, category, description });
            const allowance = await readContract(config, {
              ...usdcContract,
              functionName: "allowance",
              args: [address, ESCROW_ADDRESS],
            });
            if (allowance < amount) {
              await write({ ...usdcContract, functionName: "approve", args: [ESCROW_ADDRESS, amount] });
            }
            await write({
              ...escrowContract,
              functionName: "createJob",
              args: [amount, BigInt(Math.round(windowDays * 86400)), metadata],
            });
          });
          if (ok) {
            setDone(true);
            setTitle("");
            setDescription("");
          }
        }}
      >
        {chainId !== ACTIVE_CHAIN.id && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Switch your wallet to {ACTIVE_CHAIN.name} with the button at the top first.
          </p>
        )}
        <label className="grid gap-1 text-sm">
          Title
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-sm">
            Category
            <select className={field} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Reward in USDC{min.data !== undefined && max.data !== undefined && ` (${formatUsdc(min.data)} to ${formatUsdc(max.data)})`}
            <input className={field} inputMode="decimal" value={reward} onChange={(e) => setReward(e.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            Delivery window in days
            <input className={field} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} required />
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          Description
          <textarea className={field} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <p className="text-sm text-zinc-500">
          The reward is locked in escrow until you approve the work or cancel an unassigned task.
        </p>
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={busy || chainId !== ACTIVE_CHAIN.id}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {busy ? "Confirm in your wallet…" : "Post task"}
          </button>
          {done && <span className="text-sm text-emerald-600">Task posted. It will appear in the feed in a few seconds.</span>}
          {error && (
            <span role="alert" className="text-sm text-rose-600">
              {error}
            </span>
          )}
        </div>
      </form>
    </details>
  );
}
