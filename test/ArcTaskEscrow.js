const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const USDC = (n) => ethers.parseUnits(String(n), 6);
const DAY = 24 * 60 * 60;

async function deployFixture() {
  const [admin, creator, worker, other] = await ethers.getSigners();
  const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
  const escrow = await (await ethers.getContractFactory("ArcTaskEscrow"))
    .deploy(await usdc.getAddress(), admin.address, USDC(1), USDC(100), USDC(0.5));
  for (const s of [creator, worker]) {
    await usdc.mint(s.address, USDC(1000));
    await usdc.connect(s).approve(await escrow.getAddress(), ethers.MaxUint256);
  }
  return { admin, creator, worker, other, usdc, escrow };
}

async function assigned(f) {
  await f.escrow.connect(f.creator).createJob(USDC(50), 7 * DAY, "ipfs://meta");
  await f.escrow.connect(f.worker).applyForJob(1, "https://github.com/x");
  await f.escrow.connect(f.creator).approveWorker(1, f.worker.address);
}

describe("ArcTaskEscrow", () => {
  it("pays the worker on early approval", async () => {
    const f = await loadFixture(deployFixture);
    await assigned(f);
    await f.escrow.connect(f.worker).submitWork(1, "https://deliverable");
    await expect(f.escrow.connect(f.creator).approveWork(1))
      .to.changeTokenBalances(f.usdc, [f.escrow, f.worker], [-USDC(50), USDC(50)]);
  });

  it("auto-releases only after 4 days", async () => {
    const f = await loadFixture(deployFixture);
    await assigned(f);
    await f.escrow.connect(f.worker).submitWork(1, "u");
    await expect(f.escrow.claimAutoRelease(1)).to.be.revertedWith("4-day window active");
    await time.increase(4 * DAY);
    await expect(f.escrow.claimAutoRelease(1))
      .to.changeTokenBalance(f.usdc, f.worker, USDC(50));
  });

  it("refunds the creator when cancelling an open job", async () => {
    const f = await loadFixture(deployFixture);
    await f.escrow.connect(f.creator).createJob(USDC(50), 7 * DAY, "m");
    await expect(f.escrow.connect(f.creator).cancelJob(1))
      .to.changeTokenBalance(f.usdc, f.creator, USDC(50));
  });

  it("lets the creator reclaim after a missed deadline", async () => {
    const f = await loadFixture(deployFixture);
    await assigned(f);
    await time.increase(7 * DAY + 1);
    await expect(f.escrow.connect(f.creator).reclaimStaleJob(1))
      .to.changeTokenBalance(f.usdc, f.creator, USDC(50));
  });

  it("forfeits the bond to the worker when the creator's dispute loses", async () => {
    const f = await loadFixture(deployFixture);
    await assigned(f);
    await f.escrow.connect(f.worker).submitWork(1, "u");
    await f.escrow.connect(f.creator).logComplaint(1, "bad work");
    // 5% of 50 = 2.5 USDC bond goes to the worker along with the full reward
    await expect(f.escrow.resolveDispute(1, USDC(50), 0))
      .to.changeTokenBalance(f.usdc, f.worker, USDC(52.5));
  });

  it("rejects approving someone who never applied", async () => {
    const f = await loadFixture(deployFixture);
    await f.escrow.connect(f.creator).createJob(USDC(50), 7 * DAY, "m");
    await expect(f.escrow.connect(f.creator).approveWorker(1, f.other.address))
      .to.be.revertedWith("Worker did not apply");
  });
});