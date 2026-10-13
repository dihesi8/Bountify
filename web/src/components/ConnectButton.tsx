"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { ACTIVE_CHAIN } from "@/lib/chains";

const btn =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2";

export function ConnectButton() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected || !address) {
    return (
      <div className="text-right">
        <button className={btn} disabled={isPending} onClick={() => connect({ connector: connectors[0] })}>
          {isPending ? "Check your wallet…" : "Connect wallet"}
        </button>
        {error && <p className="mt-1 text-xs text-rose-600">No wallet found. Install MetaMask or Rabby.</p>}
      </div>
    );
  }
  if (chainId !== ACTIVE_CHAIN.id) {
    return (
      <button className={btn} onClick={() => switchChain({ chainId: ACTIVE_CHAIN.id })}>
        Switch to {ACTIVE_CHAIN.name}
      </button>
    );
  }
  return (
    <button className={btn} onClick={() => disconnect()} title="Disconnect">
      {address.slice(0, 6)}…{address.slice(-4)}
    </button>
  );
}
