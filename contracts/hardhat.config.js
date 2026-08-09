require("@nomicfoundation/hardhat-toolbox");

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
