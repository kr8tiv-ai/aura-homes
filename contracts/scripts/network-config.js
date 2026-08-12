// Canonical USDC-family settlement token per X Layer chain.
// Mainnet uses Circle native USDC; testnet follows the token funded by the
// official X Layer faucet so end-to-end lifecycle checks remain executable.
const XLAYER_USDC = Object.freeze({
  196: "0xB6CEceAB302E2E4948951eE7843FC24E92933061",
  1952: "0xcB8BF24c6cE16Ad21D707c9505421a17f2bec79D",
});

module.exports = { XLAYER_USDC };
