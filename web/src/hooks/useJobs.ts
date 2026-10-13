"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { PublicClient } from "viem";
import { ACTIVE_CHAIN } from "@/lib/chains";
import { ESCROW_ADDRESS, ESCROW_DEPLOY_BLOCK } from "@/lib/contracts";
import { loadJobs } from "@/lib/events";

export function useJobs() {
  const client = usePublicClient({ chainId: ACTIVE_CHAIN.id });
  return useQuery({
    queryKey: ["escrow-jobs", ACTIVE_CHAIN.id, ESCROW_ADDRESS],
    enabled: !!client,
    queryFn: () =>
      loadJobs(client as unknown as PublicClient, ACTIVE_CHAIN.id, ESCROW_ADDRESS, ESCROW_DEPLOY_BLOCK),
    refetchInterval: 15_000,
  });
}
