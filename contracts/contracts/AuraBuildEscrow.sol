// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AuraBuildEscrow
/// @notice Milestone escrow for a single eco-home build, settled in native USDC on X Layer.
///         Releases require 2-of-3 approval (homeowner + builder, or the arbiter breaking a tie).
///         A statutory holdback (default 10%) is retained from every release and only becomes
///         releasable after a holdback period (default 60 days) — modeling Alberta's Prompt
///         Payment and Construction Lien Act lien-holdback regime.
contract AuraBuildEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------- types

    enum EscrowState {
        Active,
        Cancelled
    }

    struct Milestone {
        uint256 amount; // gross amount, USDC (6 decimals)
        bytes32 descriptionHash; // keccak256 of the off-chain scope description
        bool funded;
        bool released; // net portion paid to builder, holdback retained
        bool refunded; // refunded to homeowner via cancel()
        bool holdbackReleased;
        uint64 releasedAt; // starts the holdback clock
        uint256 holdbackAmount;
        uint8 approvalCount;
    }

    // ---------------------------------------------------------------- errors

    error ZeroAddress();
    error InvalidHoldbackBps();
    error NotHomeowner();
    error NotParty();
    error EscrowNotActive();
    error UnknownMilestone();
    error AlreadyFunded();
    error NotFunded();
    error AlreadyReleased();
    error AlreadyApproved();
    error InsufficientApprovals();
    error NoHoldback();
    error HoldbackAlreadyReleased();
    error HoldbackNotMatured();
    error ZeroAmount();

    // ---------------------------------------------------------------- events

    event MilestoneAdded(uint256 indexed id, uint256 amount, bytes32 descriptionHash);
    event MilestoneFunded(uint256 indexed id, uint256 amount);
    event ReleaseApproved(uint256 indexed id, address indexed approver, uint8 approvalCount);
    event MilestoneReleased(uint256 indexed id, uint256 netAmount, uint256 holdbackAmount);
    event HoldbackReleased(uint256 indexed id, uint256 amount);
    event CancelApproved(address indexed approver, uint8 approvalCount);
    event EscrowCancelled(uint256 refundedAmount);

    // ---------------------------------------------------------------- config

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant DEFAULT_HOLDBACK_BPS = 1_000; // 10%
    uint256 public constant DEFAULT_HOLDBACK_PERIOD = 60 days;

    IERC20 public immutable usdc;
    address public immutable homeowner; // payer
    address public immutable builder; // payee
    address public immutable arbiter; // tie-breaker
    uint256 public immutable holdbackBps;
    uint256 public immutable holdbackPeriod;

    // ---------------------------------------------------------------- state

    EscrowState public state;
    Milestone[] public milestones;
    // milestone id => approver => release approval
    mapping(uint256 => mapping(address => bool)) public releaseApprovals;
    // approver => cancel approval
    mapping(address => bool) public cancelApprovals;
    uint8 public cancelApprovalCount;

    // ---------------------------------------------------------------- setup

    /// @param holdbackBps_ statutory holdback in basis points; pass 0 for the 10% default
    /// @param holdbackPeriod_ seconds before a retained holdback matures; pass 0 for the 60-day default
    constructor(
        IERC20 usdc_,
        address homeowner_,
        address builder_,
        address arbiter_,
        uint256 holdbackBps_,
        uint256 holdbackPeriod_
    ) {
        if (
            address(usdc_) == address(0) || homeowner_ == address(0) || builder_ == address(0)
                || arbiter_ == address(0)
        ) revert ZeroAddress();
        if (holdbackBps_ > BPS_DENOMINATOR) revert InvalidHoldbackBps();

        usdc = usdc_;
        homeowner = homeowner_;
        builder = builder_;
        arbiter = arbiter_;
        holdbackBps = holdbackBps_ == 0 ? DEFAULT_HOLDBACK_BPS : holdbackBps_;
        holdbackPeriod = holdbackPeriod_ == 0 ? DEFAULT_HOLDBACK_PERIOD : holdbackPeriod_;
    }

    // ---------------------------------------------------------------- modifiers

    modifier onlyHomeowner() {
        if (msg.sender != homeowner) revert NotHomeowner();
        _;
    }

    modifier onlyParty() {
        if (msg.sender != homeowner && msg.sender != builder && msg.sender != arbiter) {
            revert NotParty();
        }
        _;
    }

    modifier whenActive() {
        if (state != EscrowState.Active) revert EscrowNotActive();
        _;
    }

    // ---------------------------------------------------------------- milestones

    function milestoneCount() external view returns (uint256) {
        return milestones.length;
    }

    function addMilestone(uint256 amount, bytes32 descriptionHash)
        external
        onlyHomeowner
        whenActive
        returns (uint256 id)
    {
        if (amount == 0) revert ZeroAmount();
        milestones.push();
        id = milestones.length - 1;
        Milestone storage m = milestones[id];
        m.amount = amount;
        m.descriptionHash = descriptionHash;
        emit MilestoneAdded(id, amount, descriptionHash);
    }

    function fundMilestone(uint256 id) external onlyHomeowner whenActive nonReentrant {
        Milestone storage m = _milestone(id);
        if (m.funded) revert AlreadyFunded();
        m.funded = true;
        usdc.safeTransferFrom(msg.sender, address(this), m.amount);
        emit MilestoneFunded(id, m.amount);
    }

    /// @notice Any of the three parties signals the milestone work is accepted.
    ///         Two distinct approvals unlock release() — homeowner + builder in the normal
    ///         case, or the arbiter siding with either party in a dispute.
    function approveRelease(uint256 id) external onlyParty whenActive {
        Milestone storage m = _milestone(id);
        if (!m.funded) revert NotFunded();
        if (m.released) revert AlreadyReleased();
        if (releaseApprovals[id][msg.sender]) revert AlreadyApproved();
        releaseApprovals[id][msg.sender] = true;
        m.approvalCount += 1;
        emit ReleaseApproved(id, msg.sender, m.approvalCount);
    }

    /// @notice Pays the builder the milestone amount minus the statutory holdback,
    ///         which stays escrowed until the holdback period elapses.
    function release(uint256 id) external onlyParty whenActive nonReentrant {
        Milestone storage m = _milestone(id);
        if (!m.funded) revert NotFunded();
        if (m.released) revert AlreadyReleased();
        if (m.approvalCount < 2) revert InsufficientApprovals();

        uint256 holdback = (m.amount * holdbackBps) / BPS_DENOMINATOR;
        uint256 net = m.amount - holdback;

        m.released = true;
        m.releasedAt = uint64(block.timestamp);
        m.holdbackAmount = holdback;

        usdc.safeTransfer(builder, net);
        emit MilestoneReleased(id, net, holdback);
    }

    /// @notice Releases the retained holdback to the builder once the lien period has run.
    ///         Deliberately callable even after cancellation: a released milestone's holdback
    ///         is earned money, the escrow only defers it.
    function releaseHoldback(uint256 id) external onlyParty nonReentrant {
        Milestone storage m = _milestone(id);
        if (!m.released) revert NotFunded();
        if (m.holdbackAmount == 0) revert NoHoldback();
        if (m.holdbackReleased) revert HoldbackAlreadyReleased();
        if (block.timestamp < uint256(m.releasedAt) + holdbackPeriod) revert HoldbackNotMatured();

        m.holdbackReleased = true;
        usdc.safeTransfer(builder, m.holdbackAmount);
        emit HoldbackReleased(id, m.holdbackAmount);
    }

    // ---------------------------------------------------------------- cancel

    /// @notice Cancellation also needs 2-of-3, so neither side can walk away unilaterally.
    function approveCancel() external onlyParty whenActive {
        if (cancelApprovals[msg.sender]) revert AlreadyApproved();
        cancelApprovals[msg.sender] = true;
        cancelApprovalCount += 1;
        emit CancelApproved(msg.sender, cancelApprovalCount);
    }

    /// @notice Refunds every funded-but-unreleased milestone to the homeowner.
    ///         Retained holdbacks from already-released milestones stay on their normal clock.
    function cancel() external onlyParty whenActive nonReentrant {
        if (cancelApprovalCount < 2) revert InsufficientApprovals();
        state = EscrowState.Cancelled;

        uint256 refund;
        uint256 len = milestones.length;
        for (uint256 i = 0; i < len; i++) {
            Milestone storage m = milestones[i];
            if (m.funded && !m.released && !m.refunded) {
                m.refunded = true;
                refund += m.amount;
            }
        }
        if (refund > 0) usdc.safeTransfer(homeowner, refund);
        emit EscrowCancelled(refund);
    }

    // ---------------------------------------------------------------- internal

    function _milestone(uint256 id) internal view returns (Milestone storage) {
        if (id >= milestones.length) revert UnknownMilestone();
        return milestones[id];
    }
}
