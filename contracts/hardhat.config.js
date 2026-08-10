require("@nomicfoundation/hardhat-toolbox");

// Load contracts/.env (gitignored) so the documented one-command deploy works.
// Dependency-free on purpose: dotenv is not in this package's tree, and real
// environment variables always win over .env values.
const fs = require("fs");
const path = require("path");
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

// Deployer key comes from the environment only. See README.md — never hardcode.
const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Conservative EVM target: paris avoids PUSH0/MCOPY edge cases across
      // EVM implementations. X Layer migrated to OP Stack (see
      // docs/TOKEN-RESEARCH.md) — revisit this once Cancun support is verified.
      evmVersion: "paris",
    },
  },
  networks: {
    // X Layer testnet (gas token OKB). Faucet: https://web3.okx.com/xlayer/faucet
    xlayerTestnet: {
      url: "https://testrpc.xlayer.tech/terigon",
      chainId: 1952,
      accounts,
    },
    // X Layer mainnet. Explorer: https://www.oklink.com/xlayer
    xlayer: {
      url: "https://rpc.xlayer.tech",
      chainId: 196,
      accounts,
    },
  },
};
