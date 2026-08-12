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
});
