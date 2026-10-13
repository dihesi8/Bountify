const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const admin = process.env.ADMIN_ADDRESS || deployer.address;
  const Escrow = await ethers.getContractFactory("ArcTaskEscrow");
  const escrow = await Escrow.deploy(
    process.env.USDC_ADDRESS, admin,
    1_000_000n,    // min reward: 1 USDC
    100_000_000n,  // max reward: 100 USDC (deposit cap)
    500_000n       // min dispute bond: 0.5 USDC
  );
  await escrow.waitForDeployment();
  console.log("ArcTaskEscrow deployed:", await escrow.getAddress());
}

main().catch((e) => { console.error(e); process.exitCode = 1; });