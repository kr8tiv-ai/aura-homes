import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";

const repoRoot = resolve(process.cwd(), "..");
const readRepo = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

test("public lifecycle and FAQ describe design intent, pilot data, and project-specific advice", () => {
  const lifecycle = readRepo("app/app/how-it-works/page.tsx");
  const faq = readRepo("app/app/faq/page.tsx");

  expect(lifecycle).toContain("deterministic geometry checks");
  expect(lifecycle).toContain("demonstration or user-supplied parcel facts");
  expect(lifecycle).toContain("Record the checks you perform");
  expect(lifecycle).not.toContain("real code checks");
  expect(lifecycle).not.toContain("against real parcel facts");

  expect(faq).toContain("800 sq ft Alberta reference scenario");
  expect(faq).toContain("Requirements vary by project and jurisdiction");
  expect(faq).toContain("Aura does not sell or ship an AWG");
  expect(faq).not.toContain("every Aura home ships");
  expect(faq).not.toContain("No. Alberta's Architects Act");
});

test("the public licence claim separates MIT software from plan-study licences", () => {
  const shell = readRepo("app/components/SiteShell.tsx");
  const faq = readRepo("app/app/faq/page.tsx");
  const submission = readRepo("docs/SUBMISSION.md");
  const notice = readRepo("NOTICE.md");

  expect(shell).toContain("MIT software · Plan studies keep their listed licences");
  expect(shell).not.toContain("Open source (MIT)");
  expect(faq).toContain("Aura's software is MIT-licensed");
  expect(faq).not.toContain("MIT, end to end");
  expect(submission).toContain("software is MIT-licensed; individual plan studies retain their listed licences");
  expect(notice).toContain("CC BY-SA");
  expect(notice).toContain("This notice does not relicense third-party material");
});

test("X Layer copy names the valueless test token and the currently empty public state", () => {
  const chains = readRepo("app/lib/chains.ts");
  const contracts = readRepo("app/lib/contracts.ts");
  const education = readRepo("app/app/how-crypto-works/page.tsx");
  const lab = readRepo("app/app/labs/xlayer-proof/XLayerProofLab.tsx");
  const deployments = readRepo("docs/DEPLOYMENTS.md");

  for (const source of [chains, contracts, lab]) {
    expect(source).toContain("faucet-compatible");
  }
  expect(contracts).not.toContain("Native Circle USDC on X Layer testnet");
  expect(lab).not.toContain("Native testnet USDC");
  expect(lab).not.toContain("Native USDC —");
  expect(education).toContain("zero milestones and zero home records");
  expect(education).not.toContain("project milestones and document fingerprints written");
  expect(education).not.toContain("inheriting security from Ethereum-style tooling");
  expect(deployments).toContain("Creation receipts prove deployment, not a funded lifecycle or physical work");

  const testnetRuntimeFiles = [
    "app/components/concierge/ConciergeApp.tsx",
    "app/lib/hooks.ts",
    "app/lib/payments/xLayerLifecycle.ts",
    "app/lib/escrowAbi.ts",
    "app/scripts/emit-abi.mjs",
    "contracts/contracts/AuraBuildEscrow.sol",
    "contracts/contracts/test/MockUSDC.sol",
    "contracts/scripts/deploy.js",
    "contracts/scripts/demo-lifecycle.js",
  ];
  for (const path of testnetRuntimeFiles) {
    expect(readRepo(path), path).not.toMatch(/native USDC/i);
  }
});

test("roadmap and submission use the canonical explorer and experimental-testnet wording", () => {
  const roadmap = readRepo("app/app/roadmap/page.tsx");
  const submission = readRepo("docs/SUBMISSION.md");

  expect(roadmap).toContain('const OKLINK = "https://www.oklink.com/x-layer-testnet/address"');
  expect(roadmap).toContain("Experimental transaction-mechanics contracts are deployed");
  expect(roadmap).toContain("proves transaction execution, not lifecycle facts");
  expect(submission).toContain("Experimental contracts deployed to **X Layer testnet 1952**");
  expect(submission).toContain("zero milestones and zero home records");
  expect(submission).not.toContain("proof lab with public receipts");
});
