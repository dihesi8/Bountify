const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// MAINNET smoke test: one real job at the minimum reward (1 USDC), full happy path.
//   $env:CONFIRM_MAINNET="yes"
//   npx hardhat run scripts/lifecycle-mainnet.js --network arcMainnet
//
// Creator = MAINNET_PRIVATE_KEY wallet. Worker = WORKER_MAINNET_PRIVATE_KEY wallet.
// Both need a little native USDC for gas; the creator also needs the reward amount.

const USDC_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

async function main() {
  if (network.name !== "arcMainnet") throw new Error(`Mainnet-only script (got "${network.name}")`);
  if (process.env.CONFIRM_MAINNET !== "yes") throw new Error('Set $env:CONFIRM_MAINNET="yes" to continue');
  if (!process.env.WORKER_MAINNET_PRIVATE_KEY) throw new Error("Set WORKER_MAINNET_PRIVATE_KEY in .env");

  // Escrow address: env override, else the record written by deploy-mainnet.js
  const recordPath = path.join(__dirname, "..", "deployments", "arcMainnet.json");
  const escrowAddr =
    process.env.MAINNET_ESCROW ||
    (fs.existsSync(recordPath) ? JSON.parse(fs.readFileSync(recordPath, "utf8")).address : null);
  if (!escrowAddr || !ethers.isAddress(escrowAddr)) {
    throw new Error("No escrow address. Run deploy-mainnet.js first or set MAINNET_ESCROW in .env");
  }

  const [creator] = await ethers.getSigners();
  const worker = new ethers.Wallet(process.env.WORKER_MAINNET_PRIVATE_KEY, ethers.provider);
  if (worker.address === creator.address) throw new Error("Worker and creator must be different wallets");

  const escrow = await ethers.getContractAt("ArcTaskEscrow", escrowAddr);
  const usdc = await ethers.getContractAt(USDC_ABI, await escrow.usdc());
  const asWorker = escrow.connect(worker);

  const reward = await escrow.minReward(); // smallest job the contract allows
  const bal = async (a) => ethers.formatUnits(await usdc.balanceOf(a), 6);
  const step = async (label, txPromise) => {
    const tx = await txPromise;
    const receipt = await tx.wait();
    console.log(`${label}: ${receipt.hash}`);
  };

  console.log("Escrow  :", escrowAddr);
  console.log("Creator :", creator.address, "USDC:", await bal(creator.address));
  console.log("Worker  :", worker.address, "USDC:", await bal(worker.address));
  console.log("Reward  :", ethers.formatUnits(reward, 6), "USDC");

  await step("approve USDC  ", usdc.approve(escrowAddr, reward));
  await step("createJob     ", escrow.createJob(reward, 86400n, "mainnet smoke test"));
  const jobId = await escrow.jobCount();
  console.log("jobId:", jobId.toString());

  await step("applyForJob   ", asWorker.applyForJob(jobId, "https://github.com/example"));
  await step("approveWorker ", escrow.approveWorker(jobId, worker.address));
  await step("submitWork    ", asWorker.submitWork(jobId, "https://example.com/deliverable"));
  await step("approveWork   ", escrow.approveWork(jobId));

  const job = await escrow.jobs(jobId);
  console.log("Job status (5 = Resolved):", Number(job.status));
  console.log("Worker USDC after:", await bal(worker.address));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
