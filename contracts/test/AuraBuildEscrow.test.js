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

    // 0, 0, 0 => defaults: 10% holdback, 60-day holdback period, 14-day refund window
    const escrow = await ethers.deployContract("AuraBuildEscrow", [
      await usdc.getAddress(),
      homeowner.address,
      builder.address,
      arbiter.address,
      0,
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

  async function depositFixture() {
    const ctx = await deployFixture();
    await ctx.escrow.connect(ctx.homeowner).placeDeposit(USDC(12_000));
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

  describe("reservation deposit", function () {
    it("homeowner places the deposit and pulls it back in full before the deadline", async function () {
      const { usdc, escrow, homeowner } = await loadFixture(deployFixture);
      expect(await escrow.refundWindow()).to.equal(14 * DAY); // 0 in the constructor => 14-day default

      const before = await usdc.balanceOf(homeowner.address);
      const tx = await escrow.connect(homeowner).placeDeposit(USDC(12_000));
      const placedAt = await time.latest();
      await expect(tx)
        .to.emit(escrow, "DepositPlaced")
        .withArgs(USDC(12_000), placedAt + 14 * DAY);
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(USDC(12_000));

      await time.increase(13 * DAY);
      await expect(escrow.connect(homeowner).refundDeposit())
        .to.emit(escrow, "DepositRefunded")
        .withArgs(USDC(12_000));
      expect(await usdc.balanceOf(homeowner.address)).to.equal(before); // back whole, to the wei
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);
    });

    it("still refunds at the exact deadline", async function () {
      const { escrow, homeowner } = await loadFixture(depositFixture);
      // pin the refund tx's block timestamp to the deadline itself — inclusive boundary
      await time.setNextBlockTimestamp(await escrow.refundDeadline());
      await expect(escrow.connect(homeowner).refundDeposit()).to.emit(escrow, "DepositRefunded");
    });

    it("reverts the refund one second past the deadline", async function () {
      const { escrow, homeowner } = await loadFixture(depositFixture);
      await time.setNextBlockTimestamp((await escrow.refundDeadline()) + 1n);
      await expect(escrow.connect(homeowner).refundDeposit()).to.be.revertedWithCustomError(
        escrow,
        "RefundWindowClosed"
      );
    });

    it("lets nobody but the homeowner refund — not builder, arbiter, or stranger", async function () {
      const { escrow, builder, arbiter, stranger } = await loadFixture(depositFixture);
      for (const who of [builder, arbiter, stranger]) {
        await expect(escrow.connect(who).refundDeposit()).to.be.revertedWithCustomError(
          escrow,
          "NotHomeowner"
        );
      }
    });

    it("blocks conversion while the refund window is still open", async function () {
      const { escrow, homeowner } = await loadFixture(depositFixture);
      await escrow.connect(homeowner).addMilestone(USDC(12_000), DESC);
      await expect(escrow.connect(homeowner).convertDeposit(0)).to.be.revertedWithCustomError(
        escrow,
        "RefundWindowOpen"
      );
    });

    it("converts to the first milestone's funding after the deadline, then releases under 2-of-3", async function () {
      const { usdc, escrow, homeowner, builder } = await loadFixture(depositFixture);
      await escrow.connect(homeowner).addMilestone(USDC(12_000), DESC);
      await time.increaseTo((await escrow.refundDeadline()) + 1n);

      const homeownerBefore = await usdc.balanceOf(homeowner.address);
      await expect(escrow.connect(homeowner).convertDeposit(0))
        .to.emit(escrow, "DepositConverted")
        .withArgs(0, USDC(12_000))
        .and.to.emit(escrow, "MilestoneFunded")
        .withArgs(0, USDC(12_000));

      // conversion moves no new money — the USDC was already escrowed
      expect(await usdc.balanceOf(homeowner.address)).to.equal(homeownerBefore);
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(USDC(12_000));

      // the walk-away door is now closed
      await expect(escrow.connect(homeowner).refundDeposit()).to.be.revertedWithCustomError(
        escrow,
        "NoDeposit"
      );

      // normal 2-of-3 release with the 10% holdback
      await escrow.connect(homeowner).approveRelease(0);
      await escrow.connect(builder).approveRelease(0);
      await expect(escrow.connect(builder).release(0))
        .to.emit(escrow, "MilestoneReleased")
        .withArgs(0, USDC(10_800), USDC(1_200));
      expect(await usdc.balanceOf(builder.address)).to.equal(USDC(10_800));
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(USDC(1_200));
    });

    it("never double-spends a refund", async function () {
      const { escrow, homeowner } = await loadFixture(depositFixture);
      await escrow.connect(homeowner).refundDeposit();
      await expect(escrow.connect(homeowner).refundDeposit()).to.be.revertedWithCustomError(
        escrow,
        "NoDeposit"
      );
      // and a refunded deposit can never be converted either
      await escrow.connect(homeowner).addMilestone(USDC(12_000), DESC);
      await time.increase(15 * DAY);
      await expect(escrow.connect(homeowner).convertDeposit(0)).to.be.revertedWithCustomError(
        escrow,
        "NoDeposit"
      );
    });

    it("rejects a second deposit, a mismatched conversion, and converting into a funded milestone", async function () {
      const { escrow, homeowner } = await loadFixture(depositFixture);
      await expect(escrow.connect(homeowner).placeDeposit(USDC(1))).to.be.revertedWithCustomError(
        escrow,
        "DepositAlreadyPlaced"
      );
      await escrow.connect(homeowner).addMilestone(USDC(11_999), DESC); // id 0 — wrong amount
      await escrow.connect(homeowner).addMilestone(USDC(12_000), DESC); // id 1 — pre-funded below
      await escrow.connect(homeowner).fundMilestone(1);
      await time.increase(15 * DAY);
      await expect(escrow.connect(homeowner).convertDeposit(0)).to.be.revertedWithCustomError(
        escrow,
        "DepositMismatch"
      );
      await expect(escrow.connect(homeowner).convertDeposit(1)).to.be.revertedWithCustomError(
        escrow,
        "AlreadyFunded"
      );
    });

    it("cancel sweeps an outstanding deposit back to the homeowner", async function () {
      const { usdc, escrow, homeowner, arbiter } = await loadFixture(depositFixture);
      await escrow.connect(homeowner).addMilestone(USDC(50_000), DESC);
      await escrow.connect(homeowner).fundMilestone(0);

      const before = await usdc.balanceOf(homeowner.address);
      await escrow.connect(homeowner).approveCancel();
      await escrow.connect(arbiter).approveCancel();
      await expect(escrow.connect(homeowner).cancel())
        .to.emit(escrow, "DepositRefunded")
        .withArgs(USDC(12_000))
        .and.to.emit(escrow, "EscrowCancelled")
        .withArgs(USDC(62_000));
      expect((await usdc.balanceOf(homeowner.address)) - before).to.equal(USDC(62_000));
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);
    });

    it("keeps deposit + milestone accounting wei-exact across the full lifecycle", async function () {
      const { usdc, escrow, homeowner, builder } = await loadFixture(deployFixture);
      const escrowAddr = await escrow.getAddress();
      const homeownerStart = await usdc.balanceOf(homeowner.address);

      await escrow.connect(homeowner).placeDeposit(USDC(12_000));
      await escrow.connect(homeowner).addMilestone(USDC(12_000), DESC); // deposit converts here
      await escrow.connect(homeowner).addMilestone(USDC(50_000), DESC); // funded the normal way
      await escrow.connect(homeowner).fundMilestone(1);
      await time.increase(15 * DAY);
      await escrow.connect(homeowner).convertDeposit(0);

      for (const id of [0, 1]) {
        await escrow.connect(homeowner).approveRelease(id);
        await escrow.connect(builder).approveRelease(id);
        await escrow.connect(builder).release(id);
      }
      await time.increase(60 * DAY);
      await escrow.connect(builder).releaseHoldback(0);
      await escrow.connect(builder).releaseHoldback(1);

      // conservation: homeowner paid exactly 62,000; builder holds exactly 62,000; escrow empty
      expect(homeownerStart - (await usdc.balanceOf(homeowner.address))).to.equal(USDC(62_000));
      expect(await usdc.balanceOf(builder.address)).to.equal(USDC(62_000));
      expect(await usdc.balanceOf(escrowAddr)).to.equal(0);
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
        0,
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

    it("honors a custom refund window and rejects one beyond the cap", async function () {
      const [, homeowner, builder, arbiter] = await ethers.getSigners();
      const usdc = await ethers.deployContract("MockUSDC");
      await usdc.mint(homeowner.address, USDC(1000));
      const escrow = await ethers.deployContract("AuraBuildEscrow", [
        await usdc.getAddress(),
        homeowner.address,
        builder.address,
        arbiter.address,
        0,
        0,
        3 * DAY,
      ]);
      expect(await escrow.refundWindow()).to.equal(3 * DAY);
      await usdc.connect(homeowner).approve(await escrow.getAddress(), USDC(1000));
      await escrow.connect(homeowner).placeDeposit(USDC(1000));
      await time.increase(3 * DAY + 1);
      await expect(escrow.connect(homeowner).refundDeposit()).to.be.revertedWithCustomError(
        escrow,
        "RefundWindowClosed"
      );

      const Escrow = await ethers.getContractFactory("AuraBuildEscrow");
      await expect(
        Escrow.deploy(
          await usdc.getAddress(),
          homeowner.address,
          builder.address,
          arbiter.address,
          0,
          0,
          366 * DAY
        )
      ).to.be.revertedWithCustomError(Escrow, "InvalidRefundWindow");
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
      0,
    ]);
    const registry = await ethers.deployContract("AuraBuildRegistry");
    return { registry, escrow, usdc, deployer, homeowner, registrar, stranger };
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

  it("anchors the design and budget after deposit while a later refund remains honest", async function () {
    const { registry, escrow, usdc, homeowner } = await loadFixture(registryFixture);
    const escrowAddr = await escrow.getAddress();
    const amount = USDC(12_000);
    await usdc.mint(homeowner.address, amount);
    await usdc.connect(homeowner).approve(escrowAddr, amount);

    await expect(escrow.connect(homeowner).placeDeposit(amount)).to.emit(escrow, "DepositPlaced");
    await registry
      .connect(homeowner)
      .mint(homeowner.address, designHash, budgetHash, escrowAddr, "urn:aura:order:test");

    const record = await registry.records(0);
    expect(record.designHash).to.equal(designHash);
    expect(record.budgetHash).to.equal(budgetHash);
    expect(record.escrow).to.equal(escrowAddr);
    expect(record.status).to.equal(0); // Designed while the cooling-off window is open

    await expect(escrow.connect(homeowner).refundDeposit())
      .to.emit(escrow, "DepositRefunded")
      .withArgs(amount);
    expect(await usdc.balanceOf(homeowner.address)).to.equal(amount);
    expect((await registry.records(0)).status).to.equal(0); // never misrepresented as Funded
  });
});
