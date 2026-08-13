const XLAYER_MAINNET_CHAIN_ID = 196;

function normalizeChainId(value, label) {
  const chainId = Number(value);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error(`${label} chain ID is invalid: ${String(value)}`);
  }
  return chainId;
}

function assertConnectedChainMatchesConfig(configuredChainId, connectedChainId) {
  const liveChainId = normalizeChainId(connectedChainId, "Connected RPC");
  if (configuredChainId === undefined || configuredChainId === null) {
    return liveChainId;
  }

  const expectedChainId = normalizeChainId(configuredChainId, "Configured network");
  if (expectedChainId !== liveChainId) {
    throw new Error(
      `Configured chain ID ${expectedChainId} does not match connected RPC chain ID ${liveChainId}; refusing deployment.`,
    );
  }
  return liveChainId;
}

/**
 * The current registry trusts a caller-supplied escrow callback and is not a
 * production attestation contract. Keep the policy executable so a copied
 * Hardhat command cannot turn the documented mainnet hold into a deployment.
 */
function assertDeploymentAllowed(chainId) {
  if (Number(chainId) === XLAYER_MAINNET_CHAIN_ID) {
    throw new Error(
      "X Layer mainnet deployment is blocked: the current AuraBuildRegistry is testnet-only. " +
        "Read docs/MAINNET-DECISION-BRIEF.md before designing a replacement.",
    );
  }
}

module.exports = {
  XLAYER_MAINNET_CHAIN_ID,
  assertConnectedChainMatchesConfig,
  assertDeploymentAllowed,
};
