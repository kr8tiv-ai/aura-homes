// Custom chain definitions for X Layer (OKX). These are real, not stubs.
import { defineChain } from "viem";

export const xLayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.xlayer.tech"] },
  },
  blockExplorers: {
    default: { name: "OKLink", url: "https://www.oklink.com/xlayer" },
  },
});

export const xLayerTestnet = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testrpc.xlayer.tech/terigon"] },
  },
  testnet: true,
  // Faucet: https://web3.okx.com/xlayer/faucet
});

/** Native USDC (6 decimals) per chain — never the bridged USDC.e. */
export const USDC_ADDRESS: Record<number, `0x${string}`> = {
  [xLayer.id]: "0xB6CEceAB302E2E4948951eE7843FC24E92933061",
  [xLayerTestnet.id]: "0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3",
};

export const USDC_DECIMALS = 6;
