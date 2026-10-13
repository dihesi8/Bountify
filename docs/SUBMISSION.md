# DoraHacks submission text (Arc Microgrants)

**Project name:** Bountify

**One-liner:** Pre-funded USDC task escrow with a 4-day auto-release, live on Arc mainnet.

**Description:**
Bountify removes payment risk for contributors and quality risk for creators. Every task locks 100% of its USDC reward in a smart contract before work begins, so fake or unfunded listings can't exist. Contributors apply with proof of past work, the creator assigns one of them, and the reward is reserved for that wallet. When the contributor delivers, the creator can pay instantly; if the creator goes silent, anyone can release payment to the contributor after 4 days. If there's a disagreement, either side can open a bonded dispute that an admin resolves, with a forced 50/50 fallback if the admin never acts. Creators can also cancel unassigned tasks for a full refund or reclaim funds when a contributor misses the deadline. Every outcome emits an on-chain event, which makes earnings and completion rate computable from history.

**Why Arc:** The escrow and the gas are both USDC, so users never hold a second token. On mainnet a contributor paid about 0.0018 USDC in gas for two transactions (apply and submit).

**Deployed on Arc mainnet:** `0x2E4bC9BF256857C281e7845EEB3D64c58D3B0904`
Deploy transaction: `0xe87984ec26c6cc952bd49894a56bf01e7a7e7a3881ba59c479cd4d3c4dcf8825`

**Repository:** <paste your public GitHub URL>

**Demo (optional):** <Vercel URL or video link>

**Evidence it works:**
- Full lifecycle on Arc mainnet (job #1, 1 USDC): createJob `0x531d97a9f7342ce14fff2e35a8137a5885de866efb9080599f69027f40700952`, approveWork `0x9355da9943e0e4014ced6fe3bc3fb85708cacc8631a5979da5790eecc1b27693`. All six transactions are listed in the README.
- 6 automated tests passing (payout, auto-release timing, cancel refund, deadline reclaim, dispute bond, applicant check)
- Full lifecycle on Arc testnet (contract `0x0cF66babDb41cAAd88Ca12d69Ee5D4D91E63C01F`): createJob `0xd2dae53716ea0da0fe2240ec33b44499d517a1cb4e3422b4545a32d7d4c0cddc`, approveWork `0xebc69c65c82f5026318d4bb6e4d0132fa25c63fd4823a48fe6dd70a05b3f4b93`
- Mainnet deploy script reads owner, USDC address and limits back from chain and aborts on mismatch

**Known limits (stated up front):** unaudited, 25 USDC per-task deposit cap on mainnet, single admin address for disputes. The front end's dispute form and admin queue have not yet been exercised end to end on mainnet.

**Stack:** Solidity 0.8.24, OpenZeppelin 5, Hardhat, Next.js, wagmi, viem
