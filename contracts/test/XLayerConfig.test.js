const { expect } = require("chai");
const fs = require("fs");
const path = require("path");

const { XLAYER_USDC } = require("../scripts/network-config");

describe("X Layer network configuration", function () {
  it("uses the USDC_TEST contract currently funded by the official testnet faucet", function () {
    expect(XLAYER_USDC[1952]).to.equal("0xcB8BF24c6cE16Ad21D707c9505421a17f2bec79D");
  });

  it("keeps every executable package off the retired faucet token", function () {
    const repoRoot = path.resolve(__dirname, "..", "..");
    const runtimeFiles = [
      "agent/src/concierge/order.ts",
      "agent/src/mcp/payment.ts",
      "design-api/app/procurement.py",
    ];
    const retired = "0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3";
    const current = XLAYER_USDC[1952];

    for (const relativePath of runtimeFiles) {
      const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
      expect(source, relativePath).to.include(current);
      expect(source, relativePath).not.to.include(retired);
    }
  });

  it("hard-stops the current contracts before any X Layer mainnet deployment", function () {
    const {
      assertConnectedChainMatchesConfig,
      assertDeploymentAllowed,
    } = require("../scripts/deployment-policy");
    const deploySource = fs.readFileSync(path.resolve(__dirname, "..", "scripts", "deploy.js"), "utf8");
    const lifecycleSource = fs.readFileSync(path.resolve(__dirname, "..", "scripts", "demo-lifecycle.js"), "utf8");

    expect(() => assertDeploymentAllowed(196)).to.throw(
      "X Layer mainnet deployment is blocked",
    );
    expect(() => assertDeploymentAllowed(1952)).not.to.throw();
    expect(() => assertDeploymentAllowed(31337)).not.to.throw();
    expect(() => assertConnectedChainMatchesConfig(1952, 196)).to.throw(
      "Configured chain ID 1952 does not match connected RPC chain ID 196",
    );
    expect(() => assertConnectedChainMatchesConfig(1952, 1952)).not.to.throw();
    expect(() => assertConnectedChainMatchesConfig(undefined, 31337)).not.to.throw();
    expect(deploySource).to.include("await ethers.provider.getNetwork()");
    expect(deploySource).to.include(
      "assertConnectedChainMatchesConfig(configuredChainId, connectedNetwork.chainId)",
    );
    expect(deploySource).to.include("assertDeploymentAllowed(chainId)");
    expect(lifecycleSource).to.include("assertDeploymentAllowed(chainId)");
  });
});
