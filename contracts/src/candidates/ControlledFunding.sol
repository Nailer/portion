// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../interfaces/IERC20.sol";
import {CoreTransfer} from "../lib/CoreTransfer.sol";

/// @notice CANDIDATE, NOT DEPLOYED, NOT WIRED INTO THE SDK OR APP. Escrow for one-off funding
///         campaigns with milestone release. It implements docs/CONTROLLED-FUNDING-DESIGN.md so
///         the rules can be tested; it is not an audited product, a legal arrangement or
///         protection against a dishonest reviewer pair.
/// @dev Contributions are held here, separate from Core's bond and revenue balances. Money moves
///      only to a beneficiary fixed at creation, in the share fixed at creation, after the operator
///      proposes evidence, an independent reviewer and a participant representative both approve,
///      and a challenge window passes. If approvals do not arrive, or a large contributor
///      challenges twice, the unreleased balance becomes refundable pro rata. Money already
///      released is not recoverable. This contract does not issue shares or allocate revenue; an
///      adapter would read `contributed` to do that.
contract ControlledFunding {
    using CoreTransfer for IERC20;

    error Invalid();
    error Unauthorized();
    error Closed();
    error Protected();
    error Empty();
    error Reentrancy();

    enum Phase { Funding, Active, Refunding, Completed }

    struct Milestone { address beneficiary; uint16 bps; bool released; }
    struct Proposal { bytes32 evidence; uint64 proposedAt; uint64 approvedAt; bool reviewerOk; bool representativeOk; bool challenged; }
    struct Campaign {
        address operator;
        address reviewer;
        address representative;
        uint256 target;
        uint256 cap;
        uint64 deadline;
        uint64 challengeWindow;
        uint64 proposalLife;
        Phase phase;
        uint256 raised;
        uint256 released;
        uint256 refunded;
        uint256 refundPool;
        uint8 nextMilestone;
        uint8 lapses;
        bool proposalOpen;
        Proposal proposal;
    }

    uint256 public constant MAX_MILESTONES = 12;
    uint8 public constant MAX_LAPSES = 2;
    /// @dev A contributor needs this share of the raise to challenge, so dust cannot stall a release.
    uint256 public constant CHALLENGE_BPS = 1000;
    uint64 public constant MIN_WINDOW = 1 hours;
    uint64 public constant MAX_WINDOW = 30 days;

    IERC20 public immutable paymentToken;
    uint256 public campaignCount;
    uint256 private _lock = 1;
    mapping(uint256 => Campaign) private _campaigns;
    mapping(uint256 => Milestone[]) private _milestones;
    mapping(uint256 => mapping(address => uint256)) public contributed;
    mapping(uint256 => mapping(address => bool)) public refundClaimed;

    event Created(uint256 indexed id, address indexed operator, address reviewer, address representative, uint256 target, uint256 cap, uint64 deadline);
    event Contributed(uint256 indexed id, address indexed from, uint256 amount, uint256 raised);
    event Activated(uint256 indexed id, uint256 raised);
    event Proposed(uint256 indexed id, uint8 milestone, bytes32 evidence);
    event Approved(uint256 indexed id, address indexed by);
    event Challenged(uint256 indexed id, address indexed by);
    event Released(uint256 indexed id, uint8 milestone, address indexed beneficiary, uint256 amount);
    event Lapsed(uint256 indexed id, uint8 milestone, uint8 lapses);
    event RefundOpened(uint256 indexed id, uint256 refundPool);
    event Refunded(uint256 indexed id, address indexed to, uint256 amount);
    event Completed(uint256 indexed id);

    constructor(address token) {
        if (token == address(0)) revert Invalid();
        paymentToken = IERC20(token);
    }

    modifier guarded() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    function _get(uint256 id) private view returns (Campaign storage c) {
        c = _campaigns[id];
        if (c.operator == address(0)) revert Invalid();
    }

    function campaign(uint256 id) external view returns (Campaign memory) { return _get(id); }
    function milestones(uint256 id) external view returns (Milestone[] memory) { _get(id); return _milestones[id]; }
    /// @notice Money this campaign should still hold. The sum over campaigns equals this contract's token balance.
    function held(uint256 id) public view returns (uint256) {
        Campaign storage c = _get(id);
        return c.raised - c.released - c.refunded;
    }

    function create(
        address reviewer,
        address representative,
        uint256 target,
        uint256 cap,
        uint64 deadline,
        uint64 challengeWindow,
        uint64 proposalLife,
        address[] calldata beneficiaries,
        uint16[] calldata bps
    ) external guarded returns (uint256 id) {
        uint256 n = beneficiaries.length;
        if (
            reviewer == address(0) || representative == address(0)
            || reviewer == msg.sender || representative == msg.sender || reviewer == representative
            || target == 0 || cap < target || deadline <= block.timestamp
            || challengeWindow < MIN_WINDOW || challengeWindow > MAX_WINDOW
            || proposalLife < challengeWindow + MIN_WINDOW || proposalLife > 2 * MAX_WINDOW
            || n == 0 || n > MAX_MILESTONES || n != bps.length
        ) revert Invalid();
        uint256 total;
        id = ++campaignCount;
        for (uint256 i; i < n; i++) {
            // An operator cannot pay itself against its own evidence.
            if (beneficiaries[i] == address(0) || beneficiaries[i] == msg.sender || bps[i] == 0) revert Invalid();
            total += bps[i];
            _milestones[id].push(Milestone(beneficiaries[i], bps[i], false));
        }
        if (total != 10_000) revert Invalid();
        Campaign storage c = _campaigns[id];
        c.operator = msg.sender;
        c.reviewer = reviewer;
        c.representative = representative;
        c.target = target;
        c.cap = cap;
        c.deadline = deadline;
        c.challengeWindow = challengeWindow;
        c.proposalLife = proposalLife;
        emit Created(id, msg.sender, reviewer, representative, target, cap, deadline);
    }

    function contribute(uint256 id, uint256 amount) external guarded {
        Campaign storage c = _get(id);
        // The operator and reviewer may not fund the raise they control or judge.
        if (c.phase != Phase.Funding || block.timestamp > c.deadline) revert Closed();
        if (amount == 0 || c.raised + amount > c.cap || msg.sender == c.operator || msg.sender == c.reviewer) revert Invalid();
        c.raised += amount;
        contributed[id][msg.sender] += amount;
        emit Contributed(id, msg.sender, amount, c.raised);
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Anyone may settle the raise once the deadline has passed or the cap is reached.
    function finalize(uint256 id) external guarded {
        Campaign storage c = _get(id);
        if (c.phase != Phase.Funding) revert Closed();
        if (block.timestamp <= c.deadline && c.raised != c.cap) revert Protected();
        if (c.raised >= c.target) {
            c.phase = Phase.Active;
            emit Activated(id, c.raised);
        } else {
            _openRefund(id, c);
        }
    }

    /// @notice The operator may stop a campaign. Only unreleased money is returned.
    function cancel(uint256 id) external guarded {
        Campaign storage c = _get(id);
        if (msg.sender != c.operator) revert Unauthorized();
        if (c.phase != Phase.Funding && c.phase != Phase.Active) revert Closed();
        _openRefund(id, c);
    }

    function propose(uint256 id, bytes32 evidence) external guarded {
        Campaign storage c = _get(id);
        if (msg.sender != c.operator) revert Unauthorized();
        if (c.phase != Phase.Active || c.proposalOpen || evidence == bytes32(0)) revert Invalid();
        c.proposalOpen = true;
        c.proposal = Proposal(evidence, uint64(block.timestamp), 0, false, false, false);
        emit Proposed(id, c.nextMilestone, evidence);
    }

    /// @notice The independent reviewer and the participant representative each approve once per proposal.
    function approve(uint256 id) external guarded {
        Campaign storage c = _get(id);
        if (c.phase != Phase.Active || !c.proposalOpen) revert Invalid();
        Proposal storage p = c.proposal;
        if (p.challenged || block.timestamp > uint256(p.proposedAt) + c.proposalLife) revert Protected();
        if (msg.sender == c.reviewer) p.reviewerOk = true;
        else if (msg.sender == c.representative) p.representativeOk = true;
        else revert Unauthorized();
        if (p.reviewerOk && p.representativeOk && p.approvedAt == 0) p.approvedAt = uint64(block.timestamp);
        emit Approved(id, msg.sender);
    }

    /// @notice A contributor holding at least CHALLENGE_BPS of the raise stops the open proposal.
    function challenge(uint256 id) external guarded {
        Campaign storage c = _get(id);
        if (c.phase != Phase.Active || !c.proposalOpen) revert Invalid();
        if (contributed[id][msg.sender] * 10_000 < c.raised * CHALLENGE_BPS) revert Unauthorized();
        c.proposal.challenged = true;
        emit Challenged(id, msg.sender);
    }

    /// @notice Pays the fixed beneficiary its fixed share once both approvals exist, the challenge
    ///         window has passed and the proposal has not expired or been challenged. Anyone may call it.
    function release(uint256 id) external guarded {
        Campaign storage c = _get(id);
        if (c.phase != Phase.Active || !c.proposalOpen) revert Invalid();
        Proposal storage p = c.proposal;
        if (p.challenged || !p.reviewerOk || !p.representativeOk) revert Protected();
        if (block.timestamp < uint256(p.approvedAt) + c.challengeWindow || block.timestamp > uint256(p.proposedAt) + c.proposalLife) revert Protected();
        uint8 index = c.nextMilestone;
        Milestone storage m = _milestones[id][index];
        if (m.released) revert Closed();
        bool last = index + 1 == _milestones[id].length;
        // The last milestone takes the remainder so rounding never strands or invents a unit.
        uint256 amount = last ? c.raised - c.released : c.raised * m.bps / 10_000;
        address to = m.beneficiary;
        m.released = true;
        c.released += amount;
        c.nextMilestone = index + 1;
        c.lapses = 0;
        c.proposalOpen = false;
        delete c.proposal;
        if (last) { c.phase = Phase.Completed; emit Completed(id); }
        emit Released(id, index, to, amount);
        paymentToken.safeTransfer(to, amount); // a failed transfer reverts everything above
    }

    /// @notice Clears an expired or challenged proposal. A second failure opens refunds.
    function lapse(uint256 id) external guarded {
        Campaign storage c = _get(id);
        if (c.phase != Phase.Active || !c.proposalOpen) revert Invalid();
        Proposal storage p = c.proposal;
        if (!p.challenged && block.timestamp <= uint256(p.proposedAt) + c.proposalLife) revert Protected();
        c.proposalOpen = false;
        delete c.proposal;
        c.lapses += 1;
        emit Lapsed(id, c.nextMilestone, c.lapses);
        if (c.lapses >= MAX_LAPSES) _openRefund(id, c);
    }

    /// @notice Each contributor takes their share of what has not been released.
    function refund(uint256 id) external guarded returns (uint256 amount) {
        Campaign storage c = _get(id);
        if (c.phase != Phase.Refunding) revert Protected();
        if (refundClaimed[id][msg.sender]) revert Closed();
        if (c.raised == 0) revert Empty();
        amount = c.refundPool * contributed[id][msg.sender] / c.raised;
        if (amount == 0) revert Empty();
        refundClaimed[id][msg.sender] = true;
        c.refunded += amount;
        emit Refunded(id, msg.sender, amount);
        paymentToken.safeTransfer(msg.sender, amount);
    }

    function _openRefund(uint256 id, Campaign storage c) private {
        c.phase = Phase.Refunding;
        c.proposalOpen = false;
        delete c.proposal;
        c.refundPool = c.raised - c.released;
        emit RefundOpened(id, c.refundPool);
    }
}
