const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// MAINNET ONLY. Run from the project root:
//   $env:CONFIRM_MAINNET="yes"
//   npx hardhat run scripts/deploy-mainnet.js --network arcMainnet

const MAINNET_CHAIN_ID = 5042n;
const USDC = "0x3600000000000000000000000000000000000000"; // Arc's USDC ERC-20 interface
const HARDHAT_DEFAULT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".toLowerCase();

async function main() {
  // --- Guards -------------------------------------------------------------
  if (network.name !== "arcMainnet") throw new Error(`Mainnet-only script (got "${network.name}")`);
  if (process.env.CONFIRM_MAINNET !== "yes") throw new Error('Set $env:CONFIRM_MAINNET="yes" to continue');

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer account. Set MAINNET_PRIVATE_KEY in .env");
  if (deployer.address.toLowerCase() === HARDHAT_DEFAULT) {
    throw new Error("Deployer is the PUBLIC Hardhat test key. Use a fresh wallet.");
  }

  const { chainId } = await ethers.provider.getNetwork();
  if (chainId !== MAINNET_CHAIN_ID) throw new Error(`Chain ID ${chainId}, expected ${MAINNET_CHAIN_ID}`);

  const admin = process.env.ADMIN_ADDRESS;
  if (!admin || !ethers.isAddress(admin) || admin === ethers.ZeroAddress) {
    throw new Error("Set a valid ADMIN_ADDRESS in .env");
  }
  if (admin.toLowerCase() === HARDHAT_DEFAULT) throw new Error("Admin is the PUBLIC Hardhat key.");
  if (admin.toLowerCase() === deployer.address.toLowerCase()) {
    console.warn("WARNING: admin is the same wallet as the deployer. A separate admin wallet is safer.");
  }

  // --- Limits (token units, 6 decimals) ------------------------------------
  const minReward = BigInt(process.env.MIN_REWARD || 1_000_000); //  1 USDC
  const maxReward = BigInt(process.env.MAX_REWARD || 25_000_000); // 25 USDC deposit cap
  const minBond = BigInt(process.env.MIN_BOND || 500_000); //        0.5 USDC
  if (minReward === 0n || minReward > maxReward) throw new Error("Bad reward limits");
  if (minBond === 0n) throw new Error("Min bond must be above zero");
  if (maxReward > 100_000_000n) throw new Error("Cap above 100 USDC is blocked for the unaudited launch.");

  // --- USDC sanity ---------------------------------------------------------
  if ((await ethers.provider.getCode(USDC)) === "0x") throw new Error("No contract at the USDC address");
  const usdc = await ethers.getContractAt(
    ["function decimals() view returns (uint8)", "function symbol() view returns (string)"],
    USDC
  );
  const [decimals, symbol] = await Promise.all([usdc.decimals(), usdc.symbol()]);
  if (decimals !== 6n || symbol !== "USDC") {
    throw new Error(`USDC reports ${decimals} decimals / "${symbol}". Expected 6 / "USDC". Stopping.`);
  }

  // --- Gas balance (native USDC has 18 decimals) ----------------------------
  const gasBal = await ethers.provider.getBalance(deployer.address);
  if (gasBal === 0n) throw new Error("Deployer has no USDC for gas on Arc mainnet");

  console.log("Network  :", network.name, `(chain ${chainId})`);
  console.log("Deployer :", deployer.address, `| gas balance ${ethers.formatEther(gasBal)} USDC`);
  console.log("Admin    :", admin);
  console.log("USDC     :", USDC, `(${symbol}, ${decimals} decimals)`);
  console.log(
    "Limits   :",
    `min ${ethers.formatUnits(minReward, 6)}, cap ${ethers.formatUnits(maxReward, 6)}, bond floor ${ethers.formatUnits(minBond, 6)} USDC`
  );

  // --- Deploy ---------------------------------------------------------------
  const Escrow = await ethers.getContractFactory("ArcTaskEscrow");
  const escrow = await Escrow.deploy(USDC, admin, minReward, maxReward, minBond);
  const deployTx = escrow.deploymentTransaction();
  console.log("Deploy tx:", deployTx.hash);
  await escrow.waitForDeployment();
  const receipt = await deployTx.wait();
  const address = await escrow.getAddress();
  console.log("Deployed :", address);

  // --- Read back what actually landed on-chain ---------------------------------
  const ok =
    (await escrow.owner()).toLowerCase() === admin.toLowerCase() &&
    (await escrow.usdc()).toLowerCase() === USDC.toLowerCase() &&
    (await escrow.minReward()) === minReward &&
    (await escrow.maxReward()) === maxReward &&
    (await escrow.minBond()) === minBond;
  if (!ok) throw new Error(`READ-BACK MISMATCH at ${address}. Do not use this deployment.`);
  console.log("Read-back OK: owner, USDC and limits match.");

  // --- Save a deployment record for the front end and README ------------------------
  const record = {
    network: "arcMainnet",
    chainId: Number(chainId),
    address,
    deployTx: deployTx.hash,
    block: receipt.blockNumber,
    deployer: deployer.address,
    admin,
    usdc: USDC,
    minReward: minReward.toString(),
    maxReward: maxReward.toString(),
    minBond: minBond.toString(),
    deployedAt: new Date().toISOString(),
  };
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "arcMainnet.json"), JSON.stringify(record, null, 2));
  console.log("Saved    : deployments/arcMainnet.json");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
