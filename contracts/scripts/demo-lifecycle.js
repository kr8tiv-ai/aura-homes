// demo-lifecycle.js — Aura Homes escrow lifecycle, narrated end to end.
//
// One command walks the full money story the 90-second demo tells:
// fund a milestone in USDC -> 2-of-3 release with Alberta's statutory 10%
// holdback retained -> an early holdback grab REVERTS (shown honestly) ->
// the 60-day lien period runs -> the holdback matures and pays out -> a
// disputed milestone settles via the arbiter tie-break -> every dollar
// reconciles against the chain.
//
// Designed to run identically on:
//   npx hardhat run scripts/demo-lifecycle.js                      in-process chain
//   npx hardhat run scripts/demo-lifecycle.js --network localhost  against `npx hardhat node`
//   npm run demo:lifecycle:testnet                                 X Layer testnet (1952)
//
// Local mode deploys MockUSDC, mints the build budget to the homeowner, and
// time-travels past the lien period. Live mode uses the chain's configured
// six-decimal settlement token
// and the PRIVATE_KEY signer as homeowner; builder and arbiter default to
// wallets derived deterministically from PRIVATE_KEY (override with
// BUILDER_KEY / ARBITER_KEY) and are topped up with gas automatically.
//
// Env (live networks only):
//   PRIVATE_KEY   homeowner / primary signer (wired via hardhat.config.js)
//   BUILDER_KEY   optional explicit builder key
//   ARBITER_KEY   optional explicit arbiter key
//   DEMO_SCALE    integer divisor on every milestone amount, for thin testnet
//                 USDC balances (DEMO_SCALE=1000 turns $12,000.00 into 12.00)

const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const { XLAYER_USDC } = require("./network-config");
const { assertDeploymentAllowed } = require("./deployment-policy");

// ---------------------------------------------------------------- config

const HOLDBACK_BPS = 1000; // 10% — Alberta Prompt Payment and Construction Lien Act model
const HOLDBACK_PERIOD = 60 * 24 * 60 * 60; // 60 days, in seconds
const REFUND_WINDOW = 14 * 24 * 60 * 60; // 14 days — reservation-deposit cooling-off window (v2)
const STATUS_NAMES = ["Designed", "Funded", "UnderConstruction", "Complete"];

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const AGENT_OUT = path.join(REPO_ROOT, "agent", "out");
const AGENT_SAMPLES = path.join(REPO_ROOT, "agent", "samples");

// Fallback mirror of agent/out/milestones.json — same 5 milestones, $301,280 total.
const FALLBACK_MILESTONES = [
  { name: "Design, engineering & permits", description: "Stamped drawings, development and building permits", amountCad: 12000 },
  { name: "Site prep & foundation", description: "Access, clearing, and engineered screw pile installation", amountCad: 18000 },
  { name: "SIP shell & envelope", description: "Panel fabrication, delivery, erection, roof, windows, and doors to lock-up", amountCad: 77000 },
  { name: "Off-grid systems", description: "Solar + battery, water, septic, mechanical, HRV, and wood stove", amountCad: 113000 },
  { name: "Interior & completion", description: "Fit-out, extras, deficiency list, and final inspection", amountCad: 81280 },
];

// ---------------------------------------------------------------- console helpers

const W = 78;
const LABEL = 26;

function banner(lines) {
  console.log("=".repeat(W));
  for (const l of lines) console.log(`  ${l}`);
  console.log("=".repeat(W));
}

function section(title) {
  console.log("");
  console.log(`--- ${title} ${"-".repeat(Math.max(3, W - title.length - 5))}`);
}

function line(label, value) {
  const padded = label.length >= LABEL ? `${label}  ` : label.padEnd(LABEL);
  console.log(`  ${padded}${value}`);
}

function note(text) {
  console.log(`  ${" ".repeat(LABEL)}${text}`);
}

// $12,000.00 from 6-decimal USDC units
function fmt(units) {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const s = ethers.formatUnits(abs, 6);
  const [int, frac = ""] = s.split(".");
  const commas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}$${commas}.${(frac + "00").slice(0, 2)}`;
}

const money = (units) => fmt(units).padStart(14);

async function step(label, txPromise) {
  const tx = await txPromise;
  const receipt = await tx.wait();
  line(label, `tx ${receipt.hash}`);
  return receipt;
}

// Pull the custom-error name out of an ethers v6 revert, honestly.
function decodeRevert(err, contract) {
  let data;
  let e = err;
  for (let hops = 0; e && hops < 6 && !data; hops++) {
    if (typeof e.data === "string" && e.data.startsWith("0x") && e.data.length >= 10) data = e.data;
    e = e.error ?? (e.info && e.info.error) ?? e.cause;
  }
  if (data) {
    try {
      const parsed = contract.interface.parseError(data);
      if (parsed) return `${parsed.name}(${parsed.args.join(", ")})`;
    } catch (_) { /* fall through */ }
  }
  const m = /custom error '([^']+)'/.exec(err.message ?? "");
  if (m) return m[1];
  return (err.shortMessage ?? err.message ?? "unknown revert").split("\n")[0];
}

// Run a call we EXPECT to revert. If it somehow succeeds, that is a contract
// bug and the demo must fail loudly — never paper over it.
async function expectRevert(label, txPromise, contract) {
  try {
    const tx = await txPromise;
    await tx.wait();
    throw new Error(`UNEXPECTED-SUCCESS: ${label}`);
  } catch (err) {
    if (String(err.message).startsWith("UNEXPECTED-SUCCESS")) {
      throw new Error(`${label} SUCCEEDED but must revert — contract invariant broken, aborting demo`);
    }
    line(label, `REVERTED: ${decodeRevert(err, contract)}`);
  }
}

// ---------------------------------------------------------------- data loading

function loadMilestones() {
  const p = path.join(AGENT_OUT, "milestones.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
    const list = parsed.milestones.map((m) => ({
      name: m.name,
      description: m.description,
      amountCad: m.amountCad,
    }));
    return { list, source: "agent/out/milestones.json" };
  } catch (_) {
    return { list: FALLBACK_MILESTONES, source: "built-in schedule (agent/out/milestones.json not readable)" };
  }
}

function fileHashOr(candidates, fallbackLabel) {
  for (const p of candidates) {
    try {
      const buf = fs.readFileSync(p);
      return { hash: ethers.keccak256(buf), source: path.relative(REPO_ROOT, p).replace(/\\/g, "/") };
    } catch (_) { /* try next */ }
  }
  return {
    hash: ethers.keccak256(ethers.toUtf8Bytes(fallbackLabel)),
    source: `fixed demo hash ("${fallbackLabel}")`,
  };
}

// ---------------------------------------------------------------- main

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId); // read live, per doctrine
  assertDeploymentAllowed(chainId);
  const isLocal = network.name === "hardhat" || network.name === "localhost" || chainId === 31337;
  const scale = BigInt(process.env.DEMO_SCALE || "1");
  if (scale < 1n) throw new Error("DEMO_SCALE must be a positive integer");
  const unitsFor = (cad) => (BigInt(cad) * 10n ** 6n) / scale;

  banner([
    "AURA HOMES — ESCROW LIFECYCLE DEMO",
    "Milestone-contract experiment on X Layer, using the configured settlement token and Alberta's statutory",
    "10% construction holdback modeled on-chain.",
  ]);

  // ---------------------------------------------------------- the cast
  section("THE CAST");
  let homeowner, builder, arbiter, deployer;
  if (isLocal) {
    [deployer, homeowner, builder, arbiter] = await ethers.getSigners();
  } else {
    if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY is required on live networks");
    [homeowner] = await ethers.getSigners();
    deployer = homeowner;
    const pk = process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`;
    const derive = (salt) =>
      new ethers.Wallet(ethers.keccak256(ethers.concat([pk, ethers.toUtf8Bytes(salt)])), ethers.provider);
    builder = process.env.BUILDER_KEY ? new ethers.Wallet(process.env.BUILDER_KEY, ethers.provider) : derive(":aura-demo-builder-v1");
    arbiter = process.env.ARBITER_KEY ? new ethers.Wallet(process.env.ARBITER_KEY, ethers.provider) : derive(":aura-demo-arbiter-v1");
  }
  line("network", `${network.name} (chainId ${chainId}, read live from the RPC)`);
  line("mode", isLocal ? "local simulation — MockUSDC, time travel enabled" : "LIVE network — configured settlement token, real time only");
  if (scale !== 1n) line("demo scale", `amounts divided by ${scale} (DEMO_SCALE)`);
  line("homeowner (payer)", homeowner.address);
  line("builder (payee)", builder.address);
  line("arbiter (tie-break)", arbiter.address);

  // Milestone schedule + document hashes
  const { list: schedule, source: scheduleSource } = loadMilestones();
  const amounts = schedule.map((m) => unitsFor(m.amountCad));
  const totalUnits = amounts.reduce((a, b) => a + b, 0n);
  const design = fileHashOr(
    [path.join(AGENT_OUT, "design-brief.json"), path.join(AGENT_SAMPLES, "design-brief.sample.json")],
    "aura-homes demo design brief v1"
  );
  const budget = fileHashOr(
    [path.join(AGENT_OUT, "budget.json"), path.join(AGENT_SAMPLES, "budget.sample.json")],
    "aura-homes demo budget v1"
  );

  // ---------------------------------------------------------- contracts
  section("CONTRACTS ON CHAIN");
  let usdc;
  if (isLocal) {
    usdc = await ethers.deployContract("MockUSDC");
    await usdc.waitForDeployment();
    line("MockUSDC", await usdc.getAddress());
    await step("mint build budget", usdc.mint(homeowner.address, totalUnits));
    note(`${fmt(totalUnits)} USDC minted to the homeowner — the full build budget`);
  } else {
    const usdcAddr = process.env.USDC ?? XLAYER_USDC[chainId];
    if (!usdcAddr) throw new Error(`no settlement token known for chainId ${chainId} — set USDC env var`);
    usdc = await ethers.getContractAt("MockUSDC", usdcAddr); // ERC20 surface only; mint is never called on live networks
    line("settlement token", usdcAddr);
    // Gas for the two supporting actors, then an honest funds check.
    for (const [who, label] of [[builder, "builder"], [arbiter, "arbiter"]]) {
      const bal = await ethers.provider.getBalance(who.address);
      if (bal < ethers.parseEther("0.005")) {
        await step(`${label} gas top-up`, homeowner.sendTransaction({ to: who.address, value: ethers.parseEther("0.02") }));
      }
    }
    const needed = amounts[0] + amounts[1]; // this demo funds milestones 1 and 2
    const have = await usdc.balanceOf(homeowner.address);
    if (have < needed) {
      throw new Error(
        `homeowner holds ${fmt(have)} USDC but the demo funds ${fmt(needed)} — ` +
          `top up the configured settlement token at ${await usdc.getAddress()} or set DEMO_SCALE to shrink amounts`
      );
    }
  }

  const escrow = await ethers.deployContract("AuraBuildEscrow", [
    await usdc.getAddress(),
    homeowner.address,
    builder.address,
    arbiter.address,
    HOLDBACK_BPS,
    HOLDBACK_PERIOD,
    REFUND_WINDOW,
  ]);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  line("AuraBuildEscrow", escrowAddr);
  note(`holdback ${HOLDBACK_BPS / 100}% | lien period ${HOLDBACK_PERIOD / 86400} days | releases need 2-of-3`);
  note(`reservation-deposit refund window ${REFUND_WINDOW / 86400} days (homeowner-only walk-away)`);

  const registry = await ethers.deployContract("AuraBuildRegistry");
  await registry.waitForDeployment();
  line("AuraBuildRegistry", await registry.getAddress());

  const balances = async () => {
    const [h, e, b] = await Promise.all([
      usdc.balanceOf(homeowner.address),
      usdc.balanceOf(escrowAddr),
      usdc.balanceOf(builder.address),
    ]);
    line("balances", `homeowner ${fmt(h)} | escrow ${fmt(e)} | builder ${fmt(b)}`);
  };
  const builderStart = await usdc.balanceOf(builder.address);

  // ---------------------------------------------------------- build record NFT
  section("BUILD RECORD NFT — THE RWA IS A HOME COMING INTO EXISTENCE");
  line("design hash", design.hash);
  note(`keccak256 of ${design.source}`);
  line("budget hash", budget.hash);
  note(`keccak256 of ${budget.source}`);
  await step(
    "mint build record #0",
    registry.connect(homeowner).mint(homeowner.address, design.hash, budget.hash, escrowAddr, "ipfs://aura-pilot-build-01")
  );
  line("registry status", STATUS_NAMES[Number((await registry.records(0)).status)]);

  // ---------------------------------------------------------- schedule
  section(`THE MILESTONE SCHEDULE — from ${scheduleSource}`);
  for (let i = 0; i < schedule.length; i++) {
    const descHash = ethers.keccak256(ethers.toUtf8Bytes(`${schedule[i].name} — ${schedule[i].description}`));
    await step(`add #${i + 1} ${schedule[i].name.padEnd(30)}`, escrow.connect(homeowner).addMilestone(amounts[i], descHash));
  }
  console.log("");
  console.log(`  ${"#".padEnd(4)}${"milestone".padEnd(34)}${"amount".padStart(14)}${"holdback (10%)".padStart(16)}`);
  for (let i = 0; i < schedule.length; i++) {
    const hb = (amounts[i] * BigInt(HOLDBACK_BPS)) / 10000n;
    console.log(`  ${String(i + 1).padEnd(4)}${schedule[i].name.padEnd(34)}${money(amounts[i])}${fmt(hb).padStart(16)}`);
  }
  console.log(`  ${"".padEnd(4)}${"TOTAL".padEnd(34)}${money(totalUnits)}${fmt((totalUnits * BigInt(HOLDBACK_BPS)) / 10000n).padStart(16)}`);
  console.log("");
  await step("approve escrow allowance", usdc.connect(homeowner).approve(escrowAddr, totalUnits));
  note(`homeowner authorizes the escrow to pull up to ${fmt(totalUnits)} USDC`);

  // ---------------------------------------------------------- milestone 1
  section("MILESTONE 1 — FUND, APPROVE 2-OF-3, RELEASE WITH HOLDBACK");
  await step("fund milestone #1", escrow.connect(homeowner).fundMilestone(0));
  await balances();
  await step("registry -> Funded", registry.connect(homeowner).updateStatus(0, 1));
  line("registry status", STATUS_NAMES[Number((await registry.records(0)).status)]);
  await step("homeowner approves", escrow.connect(homeowner).approveRelease(0));
  await step("builder approves", escrow.connect(builder).approveRelease(0));
  note("2 of 3 approvals — release unlocked");

  const builderBeforeM1 = await usdc.balanceOf(builder.address);
  await step("release milestone #1", escrow.connect(builder).release(0));
  const m1 = await escrow.milestones(0);
  line("builder received", `${fmt((await usdc.balanceOf(builder.address)) - builderBeforeM1)}  (90% of ${fmt(m1.amount)})`);
  line("holdback retained", `${fmt(m1.holdbackAmount)}  stays escrowed — Alberta's statutory 10%`);
  await balances();
  await step("registry -> UnderConstruction", registry.connect(homeowner).updateStatus(0, 2));
  line("registry status", STATUS_NAMES[Number((await registry.records(0)).status)]);

  // ---------------------------------------------------------- holdback clock
  section("THE HOLDBACK CLOCK — THE CONTRACT SPEAKS CONSTRUCTION LAW");
  note("the builder tries to take the holdback the moment the milestone releases:");
  await expectRevert("early holdback grab", escrow.connect(builder).releaseHoldback(0), escrow);
  note("the lien period is law, not a suggestion — the contract enforces it");
  const maturesAt = new Date(Number(m1.releasedAt + (await escrow.holdbackPeriod())) * 1000);
  if (isLocal) {
    await network.provider.send("evm_increaseTime", [HOLDBACK_PERIOD]);
    await network.provider.send("evm_mine");
    line("time travel", "+60 days via evm_increaseTime (local chain only)");
    const builderBeforeHb = await usdc.balanceOf(builder.address);
    await step("release holdback #1", escrow.connect(builder).releaseHoldback(0));
    line("builder received", `${fmt((await usdc.balanceOf(builder.address)) - builderBeforeHb)}  — matured holdback, earned in full`);
    await balances();
  } else {
    line("holdback matures", maturesAt.toUTCString());
    note("live network — no time travel; run releaseHoldback(0) after that date");
  }

  // ---------------------------------------------------------- milestone 2
  section("MILESTONE 2 — DISPUTE PATH: THE ARBITER BREAKS THE TIE");
  await step("fund milestone #2", escrow.connect(homeowner).fundMilestone(1));
  await balances();
  note("this time the homeowner goes silent — a dispute:");
  await step("builder approves", escrow.connect(builder).approveRelease(1));
  await expectRevert("release with 1 approval", escrow.connect(builder).release(1), escrow);
  note("one voice is never enough — the arbiter reviews the work and sides with the builder:");
  await step("arbiter breaks the tie", escrow.connect(arbiter).approveRelease(1));
  const builderBeforeM2 = await usdc.balanceOf(builder.address);
  await step("release milestone #2", escrow.connect(arbiter).release(1));
  const m2 = await escrow.milestones(1);
  line("builder received", `${fmt((await usdc.balanceOf(builder.address)) - builderBeforeM2)}  (90% of ${fmt(m2.amount)})`);
  line("holdback retained", `${fmt(m2.holdbackAmount)}  matures ${new Date(Number(m2.releasedAt + (await escrow.holdbackPeriod())) * 1000).toUTCString()}`);
  await balances();

  // ---------------------------------------------------------- settlement
  section("SETTLEMENT — EVERY DOLLAR ACCOUNTED, READ BACK FROM THE CHAIN");
  const count = Number(await escrow.milestoneCount());
  let funded = 0n, fundedUnreleased = 0n, netReleased = 0n, holdbackHeld = 0n, holdbackPaid = 0n;
  for (let i = 0; i < count; i++) {
    const m = await escrow.milestones(i);
    if (m.funded && !m.refunded) funded += m.amount;
    if (m.funded && !m.released && !m.refunded) fundedUnreleased += m.amount;
    if (m.released) {
      netReleased += m.amount - m.holdbackAmount;
      if (m.holdbackReleased) holdbackPaid += m.holdbackAmount;
      else holdbackHeld += m.holdbackAmount;
    }
  }
  const escrowBal = await usdc.balanceOf(escrowAddr);
  const builderDelta = (await usdc.balanceOf(builder.address)) - builderStart;
  const accounted = netReleased + holdbackPaid + holdbackHeld + fundedUnreleased;

  line("funded into escrow", money(funded));
  line("released to builder (net)", money(netReleased));
  line("holdback released", money(holdbackPaid));
  line("holdback still escrowed", money(holdbackHeld));
  line("funded, awaiting release", money(fundedUnreleased));
  line("", "-".repeat(14).padStart(14));
  line("accounted for", money(accounted));
  console.log("");
  line("on-chain escrow balance", money(escrowBal));
  line("on-chain builder receipts", money(builderDelta));

  const ok =
    funded === accounted &&
    escrowBal === holdbackHeld + fundedUnreleased &&
    builderDelta === netReleased + holdbackPaid;
  console.log("");
  line("RECONCILED TO THE DOLLAR", ok ? "YES" : "NO — MISMATCH, DO NOT SHIP THIS RUN");
  if (!ok) process.exitCode = 1;

  console.log("");
  banner([
    "Lifecycle complete: Designed -> Funded -> UnderConstruction,",
    "one milestone matured and settled, one dispute arbitrated,",
    `${fmt(holdbackHeld)} still protecting subcontractors under the lien regime.`,
  ]);
}

main().catch((err) => {
  console.error("");
  console.error(`DEMO FAILED: ${err.message ?? err}`);
  process.exitCode = 1;
});
