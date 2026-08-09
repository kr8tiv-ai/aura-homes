// Deploys AuraBuildRegistry + one AuraBuildEscrow.
//
// Env vars:
//   PRIVATE_KEY  deployer key (via hardhat.config.js) — required on live networks
//   USDC         USDC address; defaults to native USDC per chain, or MockUSDC locally
//   HOMEOWNER / BUILDER / ARBITER   escrow roles; default to the deployer (dev only)
//   HOLDBACK_BPS / HOLDBACK_PERIOD  pass 0 or omit for defaults (10%, 60 days)

const { ethers, network } = require("hardhat");

// Native USDC (6 decimals) — never bridged USDC.e.
const NATIVE_USDC = {
  196: "0xB6CEceAB302E2E4948951eE7843FC24E92933061", // X Layer mainnet
  1952: "0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3", // X Layer testnet
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = network.config.chainId ?? 31337;
  console.log(`network: ${network.name} (chainId ${chainId})`);
  console.log(`deployer: ${deployer.address}`);

  let usdc = process.env.USDC ?? NATIVE_USDC[chainId];
  if (!usdc) {
    console.log("no USDC for this chain — deploying MockUSDC (local dev only)");
    const mock = await ethers.deployContract("MockUSDC");
    await mock.waitForDeployment();
    usdc = await mock.getAddress();
  }
  console.log(`usdc: ${usdc}`);

  const registry = await ethers.deployContract("AuraBuildRegistry");
  await registry.waitForDeployment();
  console.log(`AuraBuildRegistry: ${await registry.getAddress()}`);

  const escrow = await ethers.deployContract("AuraBuildEscrow", [
    usdc,
    process.env.HOMEOWNER ?? deployer.address,
    process.env.BUILDER ?? deployer.address,
    process.env.ARBITER ?? deployer.address,
    Number(process.env.HOLDBACK_BPS ?? 0), // 0 -> default 1000 bps (10%)
    Number(process.env.HOLDBACK_PERIOD ?? 0), // 0 -> default 60 days
  ]);
  await escrow.waitForDeployment();
  console.log(`AuraBuildEscrow:   ${await escrow.getAddress()}`);
  console.log(
    `holdback: ${await escrow.holdbackBps()} bps, period ${await escrow.holdbackPeriod()} s`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
