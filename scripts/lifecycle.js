const { ethers } = require("hardhat");

const ESCROW = "0x0cF66babDb41cAAd88Ca12d69Ee5D4D91E63C01F";
const USDC_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

async function main() {
  // Creator = PRIVATE_KEY wallet (the deployer). Worker = WORKER_PRIVATE_KEY wallet.
  const [creator] = await ethers.getSigners();
  if (!process.env.WORKER_PRIVATE_KEY) throw new Error("Set WORKER_PRIVATE_KEY in .env");
  const worker = new ethers.Wallet(process.env.WORKER_PRIVATE_KEY, ethers.provider);

  const escrow = await ethers.getContractAt("ArcTaskEscrow", ESCROW);
  const usdc = await ethers.getContractAt(USDC_ABI, await escrow.usdc());
  const asWorker = escrow.connect(worker);

  const reward = 1_000_000n; // 1 USDC (6 decimals) = the minimum reward
  const bal = async (a) => ethers.formatUnits(await usdc.balanceOf(a), 6);
  const step = async (label, txPromise) => {
    const tx = await txPromise;
    const receipt = await tx.wait();
    console.log(`${label}: ${receipt.hash}`);
  };

  console.log("creator", creator.address, "USDC:", await bal(creator.address));
  console.log("worker ", worker.address, "USDC:", await bal(worker.address));

  await step("approve USDC     ", usdc.approve(ESCROW, reward));
  await step("createJob        ", escrow.createJob(reward, 86400n, "testnet lifecycle job"));
  const jobId = await escrow.jobCount();
  console.log("jobId:", jobId.toString());

  await step("applyForJob      ", asWorker.applyForJob(jobId, "https://github.com/example"));
  await step("approveWorker    ", escrow.approveWorker(jobId, worker.address));
  await step("submitWork       ", asWorker.submitWork(jobId, "https://example.com/deliverable"));
  await step("approveWork      ", escrow.approveWork(jobId));

  const job = await escrow.jobs(jobId);
  console.log("job status (5 = Resolved):", Number(job.status));
  console.log("worker USDC after:", await bal(worker.address));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});