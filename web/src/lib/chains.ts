import { defineChain } from "viem";

// Arc uses USDC as the NATIVE gas token with 18 decimals. The ERC-20 USDC interface
// (see contracts.ts) uses 6 decimals. Never mix the two when formatting amounts.

// NOTE: NEXT_PUBLIC_* variables must be referenced literally (not via process.env[name])
// so Next.js can inline them into the browser bundle.
const TESTNET_RPC =
  process.env.NEXT_PUBLIC_ARC_TESTNET_RPC || "https://rpc.testnet.arc.network";
const MAINNET_RPC =
  process.env.NEXT_PUBLIC_ARC_MAINNET_RPC || "https://rpc.mainnet.arc.io";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [TESTNET_RPC] } },
  blockExplorers: {
    default: { name: "Arcscan Testnet", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export const arcMainnet = defineChain({
  id: 5042,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  // Arc's docs label the mainnet RPC and explorer "permissioned". If browsers get
  // blocked, point NEXT_PUBLIC_ARC_MAINNET_RPC at an endpoint you have access to.
  rpcUrls: { default: { http: [MAINNET_RPC] } },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.arc.io" },
  },
});

export const NETWORK: "mainnet" | "testnet" =
  process.env.NEXT_PUBLIC_ARC_NETWORK === "mainnet" ? "mainnet" : "testnet";

/** The chain this deployment of the site talks to. Defaults to testnet for safety. */
export const ACTIVE_CHAIN = NETWORK === "mainnet" ? arcMainnet : arcTestnet;
