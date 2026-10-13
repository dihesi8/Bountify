import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { arcMainnet, arcTestnet } from "./chains";

// Both chains are registered so a wallet on the wrong network can be switched, but the
// UI should only ever act on ACTIVE_CHAIN (see chains.ts) via the `chainId` in
// escrowContract / usdcContract.
export const wagmiConfig = createConfig({
  chains: [arcMainnet, arcTestnet],
  connectors: [injected()], // MetaMask, Rabby, Coinbase Wallet extension, etc.
  transports: {
    [arcMainnet.id]: http(arcMainnet.rpcUrls.default.http[0]),
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
  },
  ssr: true, // required for Next.js
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
