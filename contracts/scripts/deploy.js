// Deploys AuraBuildRegistry + one AuraBuildEscrow.
//
// Env vars:
//   PRIVATE_KEY  deployer key (via hardhat.config.js) — required on live networks
//   USDC         settlement-token address; defaults to the configured token per chain, or MockUSDC locally
//   HOMEOWNER / BUILDER / ARBITER   escrow roles; default to the deployer (dev only)
//   HOLDBACK_BPS / HOLDBACK_PERIOD  pass 0 or omit for defaults (10%, 60 days)
//   REFUND_WINDOW                   reservation-deposit cooling-off window in seconds;
//                                   pass 0 or omit for the default (14 days)

const { ethers, network } = require("hardhat");
const { XLAYER_USDC } = require("./network-config");
const {
  assertConnectedChainMatchesConfig,
  assertDeploymentAllowed,
} = require("./deployment-policy");

async function main() {
  const configuredChainId = network.config.chainId;
  const connectedNetwork = await ethers.provider.getNetwork();
  const chainId = assertConnectedChainMatchesConfig(configuredChainId, connectedNetwork.chainId);
  assertDeploymentAllowed(chainId);
  const [deployer] = await ethers.getSigners();
  console.log(`network: ${network.name} (chainId ${chainId})`);
  console.log(`deployer: ${deployer.address}`);

  let usdc = process.env.USDC ?? XLAYER_USDC[chainId];
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
    Number(process.env.REFUND_WINDOW ?? 0), // 0 -> default 14 days
  ]);
  await escrow.waitForDeployment();
  console.log(`AuraBuildEscrow:   ${await escrow.getAddress()}`);
  console.log(
    `holdback: ${await escrow.holdbackBps()} bps, period ${await escrow.holdbackPeriod()} s, ` +
      `refund window ${await escrow.refundWindow()} s`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
