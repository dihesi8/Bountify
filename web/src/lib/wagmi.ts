import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { arcMainnet, arcTestnet } from "./chains";

// Both chains are registered so a wallet on the wrong network can be switched, but the
// UI should only ever act on ACTIVE_CHAIN (see chains.ts) via the `chainId` in
// escrowContract / usdcContract.
// Back off and retry when the public RPC answers 429 (rate limited).
const retry = { retryCount: 4, retryDelay: 1000 };

export const wagmiConfig = createConfig({
  chains: [arcMainnet, arcTestnet],
  connectors: [injected()], // MetaMask, Rabby, Coinbase Wallet extension, etc.
  transports: {
    [arcMainnet.id]: http(arcMainnet.rpcUrls.default.http[0], retry),
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0], retry),
  },
  ssr: true, // required for Next.js
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
