import { erc20Abi, formatUnits, parseUnits, type Address, type Hash } from "viem";
import { escrowAbi } from "./abi";
import { ACTIVE_CHAIN, arcMainnet, arcTestnet } from "./chains";

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

/** Arc's USDC ERC-20 interface. Same address on testnet and mainnet. 6 decimals. */
export const USDC_ADDRESS: Address = "0x3600000000000000000000000000000000000000";
export const USDC_DECIMALS = 6;

/** ArcTaskEscrow deployments, keyed by chain ID. */
export const ESCROW_ADDRESSES: Record<number, Address> = {
  [arcMainnet.id]: "0x2E4bC9BF256857C281e7845EEB3D64c58D3B0904",
  [arcTestnet.id]: "0x0cF66babDb41cAAd88Ca12d69Ee5D4D91E63C01F",
};

/**
 * First block worth scanning for escrow events (use for getLogs / getContractEvents
 * `fromBlock`, so you never scan from block 0 on a public RPC).
 *  - Mainnet: the "block" field in deployments/arcMainnet.json
 *  - Testnet: the block of your first createJob transaction (see README / setup notes)
 */
// Defaults are a block before each network's first job. Env overrides are ignored when empty or "0".
const startBlock = (value: string | undefined, fallback: bigint) =>
  value && value !== "0" ? BigInt(value) : fallback;

export const DEPLOY_BLOCKS: Record<number, bigint> = {
  [arcMainnet.id]: startBlock(process.env.NEXT_PUBLIC_ARC_MAINNET_DEPLOY_BLOCK, 25743158n),
  [arcTestnet.id]: startBlock(process.env.NEXT_PUBLIC_ARC_TESTNET_DEPLOY_BLOCK, 66203429n),
};

export const ESCROW_ADDRESS: Address = ESCROW_ADDRESSES[ACTIVE_CHAIN.id];
export const ESCROW_DEPLOY_BLOCK: bigint = DEPLOY_BLOCKS[ACTIVE_CHAIN.id];

// ---------------------------------------------------------------------------
// Ready-to-spread contract configs for wagmi / viem hooks
//   useReadContract({ ...escrowContract, functionName: "jobCount" })
// ---------------------------------------------------------------------------

export const escrowContract = {
  address: ESCROW_ADDRESS,
  abi: escrowAbi,
  chainId: ACTIVE_CHAIN.id,
} as const;

export const usdcContract = {
  address: USDC_ADDRESS,
  abi: erc20Abi,
  chainId: ACTIVE_CHAIN.id,
} as const;

// ---------------------------------------------------------------------------
// Enums and constants that mirror the Solidity contract
// ---------------------------------------------------------------------------

/** Index = on-chain JobStatus value. */
export const JOB_STATUS = [
  "None",
  "Open",
  "Assigned",
  "Submitted",
  "Disputed",
  "Resolved",
  "Cancelled",
] as const;
export type JobStatusLabel = (typeof JOB_STATUS)[number];

export function jobStatusLabel(status: number | bigint): JobStatusLabel {
  return JOB_STATUS[Number(status)] ?? "None";
}

/** Index = on-chain SettleType value (from the JobSettled event). */
export const SETTLE_TYPE = [
  "Approved",
  "AutoRelease",
  "DisputeResolved",
  "DisputeTimeout",
  "Reclaimed",
  "Cancelled",
] as const;

const DAY = 24 * 60 * 60;
export const AUTO_RELEASE_SECONDS = 4 * DAY; // AUTO_RELEASE_DELAY
export const ADMIN_TIMEOUT_SECONDS = 14 * DAY; // ADMIN_TIMEOUT
export const MIN_DELIVERY_SECONDS = 1 * DAY; // MIN_DELIVERY
export const MAX_DELIVERY_SECONDS = 90 * DAY; // MAX_DELIVERY
export const MAX_TEXT_LENGTH = 512; // bytes per string (URLs, reasons, metadata)

/** Unix time (seconds) when a submitted job becomes claimable via claimAutoRelease(). */
export function autoReleaseTime(submissionTimestamp: bigint): bigint {
  return submissionTimestamp + BigInt(AUTO_RELEASE_SECONDS);
}

// ---------------------------------------------------------------------------
// Amount helpers. ERC-20 USDC = 6 decimals. Native gas balance = 18 decimals.
// ---------------------------------------------------------------------------

/** 1500000n -> "1.5" */
export function formatUsdc(units: bigint): string {
  return formatUnits(units, USDC_DECIMALS);
}

/** "1.5" -> 1500000n. Throws on invalid input; validate user input before calling. */
export function parseUsdc(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS);
}

/** For wallet gas balances (useBalance), which are 18-decimal native USDC. */
export function formatNativeUsdc(wei: bigint): string {
  return formatUnits(wei, 18);
}

// ---------------------------------------------------------------------------
// Explorer links
// ---------------------------------------------------------------------------

const EXPLORER = ACTIVE_CHAIN.blockExplorers.default.url;
export const txUrl = (hash: Hash) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address: Address) => `${EXPLORER}/address/${address}`;
