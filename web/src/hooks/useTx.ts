"use client";

import { useState } from "react";
import { useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useQueryClient } from "@tanstack/react-query";
import { ACTIVE_CHAIN } from "@/lib/chains";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Write = (params: any) => Promise<`0x${string}`>;

/** Sends transactions one at a time, waits for each receipt, then refreshes the feed. */
export function useTx() {
  const config = useConfig();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const write: Write = async (params) => {
    const hash = await writeContractAsync({ ...params, chainId: ACTIVE_CHAIN.id });
    await waitForTransactionReceipt(config, { hash });
    return hash;
  };

  async function run(fn: (write: Write) => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await fn(write);
      await queryClient.invalidateQueries({ queryKey: ["escrow-jobs"] });
      return true;
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      setError((err.shortMessage ?? err.message ?? "Transaction failed.").slice(0, 240));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { run, busy, error, config };
}
