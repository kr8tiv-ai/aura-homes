const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const USDC = (n) => ethers.parseUnits(n.toString(), 6);
const DAY = 24 * 60 * 60;
const DESC = ethers.keccak256(ethers.toUtf8Bytes("Milestone 1: screw piles + SIP shell"));

describe("AuraBuildEscrow", function () {
  async function deployFixture() {
    const [deployer, homeowner, builder, arbiter, stranger] = await ethers.getSigners();

    const usdc = await ethers.deployContract("MockUSDC");
    await usdc.mint(homeowner.address, USDC(1_000_000));

    // 0, 0 => defaults: 10% holdback, 60-day holdback period
    const escrow = await ethers.deployContract("AuraBuildEscrow", [
      await usdc.getAddress(),
      homeowner.address,
      builder.address,
      arbiter.address,
      0,
      0,
    ]);
    await usdc.connect(homeowner).approve(await escrow.getAddress(), USDC(1_000_000));

    return { usdc, escrow, deployer, homeowner, builder, arbiter, stranger };
  }

  async function fundedMilestoneFixture() {
    const ctx = await deployFixture();
    await ctx.escrow.connect(ctx.homeowner).addMilestone(USDC(50_000), DESC);
    await ctx.escrow.connect(ctx.homeowner).fundMilestone(0);
    return ctx;
  }

  describe("happy path", function () {
    it("funds, approves 2-of-3, releases with 10% holdback retained, then releases holdback after 60 days", async function () {
      const { usdc, escrow, homeowner, builder } = await loadFixture(deployFixture);

      await expect(escrow.connect(homeowner).addMilestone(USDC(50_000), DESC))
        .to.emit(escrow, "MilestoneAdded")
        .withArgs(0, USDC(50_000), DESC);

      await expect(escrow.connect(homeowner).fundMilestone(0))
        .to.emit(escrow, "MilestoneFunded")
        .withArgs(0, USDC(50_000));
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(USDC(50_000));

      await escrow.connect(homeowner).approveRelease(0);
      await escrow.connect(builder).approveRelease(0);

      // 50,000 gross -> 45,000 net to builder, 5,000 holdback retained
      await expect(escrow.connect(builder).release(0))
        .to.emit(escrow, "MilestoneReleased")
        .withArgs(0, USDC(45_000), USDC(5_000));
      expect(await usdc.balanceOf(builder.address)).to.equal(USDC(45_000));
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(USDC(5_000));

      // too early — lien period still running
      await expect(escrow.connect(builder).releaseHoldback(0)).to.be.revertedWithCustomError(
        escrow,
        "HoldbackNotMatured"
      );

      await time.increase(60 * DAY);
      await expect(escrow.connect(builder).releaseHoldback(0))
        .to.emit(escrow, "HoldbackReleased")
        .withArgs(0, USDC(5_000));
      expect(await usdc.balanceOf(builder.address)).to.equal(USDC(50_000));
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);
    });

    it("reverts holdback release just before maturity and allows it just after", async function () {
      const { escrow, homeowner, builder } = await loadFixture(fundedMilestoneFixture);
      await escrow.connect(homeowner).approveRelease(0);
      await escrow.connect(builder).approveRelease(0);
      await escrow.connect(homeowner).release(0);

      await time.increase(60 * DAY - 10);
      await expect(escrow.connect(builder).releaseHoldback(0)).to.be.revertedWithCustomError(
        escrow,
        "HoldbackNotMatured"
      );
      await time.increase(11);
      await expect(escrow.connect(builder).releaseHoldback(0)).to.emit(escrow, "HoldbackReleased");
    });
  });

  describe("approvals", function () {
    it("blocks release with fewer than 2 approvals", async function () {
      const { escrow, homeowner } = await loadFixture(fundedMilestoneFixture);
      await escrow.connect(homeowner).approveRelease(0);
      await expect(escrow.connect(homeowner).release(0)).to.be.revertedWithCustomError(
        escrow,
        "InsufficientApprovals"
      );
    });

    it("lets the arbiter break a tie (builder + arbiter release over a silent homeowner)", async function () {
      const { usdc, escrow, builder, arbiter } = await loadFixture(fundedMilestoneFixture);
      await escrow.connect(builder).approveRelease(0);
      await escrow.connect(arbiter).approveRelease(0);
      await escrow.connect(arbiter).release(0);
      expect(await usdc.balanceOf(builder.address)).to.equal(USDC(45_000));
    });

    it("rejects strangers and double approvals", async function () {
      const { escrow, homeowner, stranger } = await loadFixture(fundedMilestoneFixture);
      await expect(escrow.connect(stranger).approveRelease(0)).to.be.revertedWithCustomError(
        escrow,
        "NotParty"
      );
      await escrow.connect(homeowner).approveRelease(0);
      await expect(escrow.connect(homeowner).approveRelease(0)).to.be.revertedWithCustomError(
        escrow,
        "AlreadyApproved"
      );
    });
  });

  describe("cancel", function () {
    it("refunds unreleased funds to the homeowner with 2-of-3 cancel approvals", async function () {
      const { usdc, escrow, homeowner, builder, arbiter } = await loadFixture(deployFixture);
      await escrow.connect(homeowner).addMilestone(USDC(50_000), DESC);
      await escrow.connect(homeowner).addMilestone(USDC(30_000), DESC);
      await escrow.connect(homeowner).fundMilestone(0);
      await escrow.connect(homeowner).fundMilestone(1);

      // milestone 0 is completed and released; milestone 1 never happens
      await escrow.connect(homeowner).approveRelease(0);
      await escrow.connect(builder).approveRelease(0);
      await escrow.connect(homeowner).release(0);

      const before = await usdc.balanceOf(homeowner.address);
      await escrow.connect(homeowner).approveCancel();
      await escrow.connect(arbiter).approveCancel();
      await expect(escrow.connect(homeowner).cancel())
        .to.emit(escrow, "EscrowCancelled")
        .withArgs(USDC(30_000));
      expect((await usdc.balanceOf(homeowner.address)) - before).to.equal(USDC(30_000));

      // escrow is dead for new activity
      await expect(
        escrow.connect(homeowner).addMilestone(USDC(1), DESC)
      ).to.be.revertedWithCustomError(escrow, "EscrowNotActive");

      // but the earned holdback from milestone 0 still matures normally
      await time.increase(60 * DAY);
      await expect(escrow.connect(builder).releaseHoldback(0)).to.emit(escrow, "HoldbackReleased");
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);
    });

    it("blocks unilateral cancel", async function () {
      const { escrow, homeowner } = await loadFixture(fundedMilestoneFixture);
      await escrow.connect(homeowner).approveCancel();
      await expect(escrow.connect(homeowner).cancel()).to.be.revertedWithCustomError(
        escrow,
        "InsufficientApprovals"
      );
    });
  });

  describe("configuration", function () {
    it("honors custom holdback bps and period", async function () {
      const [, homeowner, builder, arbiter] = await ethers.getSigners();
      const usdc = await ethers.deployContract("MockUSDC");
      await usdc.mint(homeowner.address, USDC(1000));
      const escrow = await ethers.deployContract("AuraBuildEscrow", [
        await usdc.getAddress(),
        homeowner.address,
        builder.address,
        arbiter.address,
        500, // 5%
        7 * DAY,
      ]);
      await usdc.connect(homeowner).approve(await escrow.getAddress(), USDC(1000));
      await escrow.connect(homeowner).addMilestone(USDC(1000), DESC);
      await escrow.connect(homeowner).fundMilestone(0);
      await escrow.connect(homeowner).approveRelease(0);
      await escrow.connect(builder).approveRelease(0);
      await expect(escrow.connect(builder).release(0))
        .to.emit(escrow, "MilestoneReleased")
        .withArgs(0, USDC(950), USDC(50));
      await time.increase(7 * DAY);
      await expect(escrow.connect(builder).releaseHoldback(0)).to.emit(escrow, "HoldbackReleased");
    });
  });
});

describe("AuraBuildRegistry", function () {
  async function registryFixture() {
    const [deployer, homeowner, builder, arbiter, registrar, stranger] = await ethers.getSigners();
    const usdc = await ethers.deployContract("MockUSDC");
    const escrow = await ethers.deployContract("AuraBuildEscrow", [
      await usdc.getAddress(),
      homeowner.address,
      builder.address,
      arbiter.address,
      0,
      0,
    ]);
    const registry = await ethers.deployContract("AuraBuildRegistry");
    return { registry, escrow, deployer, homeowner, registrar, stranger };
  }

  const designHash = ethers.keccak256(ethers.toUtf8Bytes("design-brief-v1"));
  const budgetHash = ethers.keccak256(ethers.toUtf8Bytes("budget-v1"));

  it("lets the escrow's homeowner mint and update a build record", async function () {
    const { registry, escrow, homeowner } = await loadFixture(registryFixture);
    const escrowAddr = await escrow.getAddress();

    await expect(
      registry.connect(homeowner).mint(homeowner.address, designHash, budgetHash, escrowAddr, "ipfs://build-0")
    )
      .to.emit(registry, "BuildMinted")
      .withArgs(0, escrowAddr, designHash, budgetHash);

    expect(await registry.tokenURI(0)).to.equal("ipfs://build-0");
    expect((await registry.records(0)).status).to.equal(0); // Designed

    await registry.connect(homeowner).updateStatus(0, 2); // UnderConstruction
    expect((await registry.records(0)).status).to.equal(2);
  });

  it("lets a registrar mint, and blocks everyone else", async function () {
    const { registry, escrow, deployer, registrar, stranger } = await loadFixture(registryFixture);
    const escrowAddr = await escrow.getAddress();

    await expect(
      registry.connect(stranger).mint(stranger.address, designHash, budgetHash, escrowAddr, "ipfs://x")
    ).to.be.revertedWithCustomError(registry, "NotAuthorized");

    await registry.connect(deployer).setRegistrar(registrar.address, true);
    await registry.connect(registrar).mint(registrar.address, designHash, budgetHash, escrowAddr, "ipfs://y");
    expect(await registry.nextTokenId()).to.equal(1);
  });
});
