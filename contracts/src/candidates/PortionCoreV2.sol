// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../interfaces/IERC20.sol";
import {CoreTransfer} from "../lib/CoreTransfer.sol";

/// @notice LOCAL CANDIDATE: not deployed, not audited.
/// @dev Core v1 with the loopholes C1–C9 from docs/MARKET-READINESS-REVIEW.md closed or narrowed.
///      Each change is marked with its finding number. Lifecycle:
///      create (Pending) → named reviewer attests (Funding) → buyers pay into escrow → finalize:
///      target met (Active) or not (Refunding, full refund). While Active, escrow is released to the
///      operator in fixed tranches, each proposed with evidence, approved by the reviewer and open to
///      holder challenge. Two failed tranches, a slash or a wind-down return unreleased escrow pro rata.
///      Residual limits are in docs/CORE-V2-CANDIDATE.md.
contract PortionCoreV2 {
    using CoreTransfer for IERC20;

    error Invalid();
    error Unauthorized();
    error Closed();
    error Protected();
    error Empty();
    error Reentrancy();
    error Paused();

    enum Phase { Pending, Funding, Active, Refunding }

    struct Listing {
        address operator;
        address recovery;        // C7
        address pendingOperator; // C7
        uint256 pendingAfter;    // C7
        bool pendingByRecovery;  // C7
        address reviewer;        // C9: named at creation, must attest before any sale
        Phase phase;             // C5
        bool activated;          // C5: the funding target was met
        uint256 deadline;        // C5
        uint256 minSold;         // C5: funding target in shares
        uint256 cadence;
        uint256 totalShares;
        uint256 lastDepositAt;
        uint256 closedAt;
        uint256 windDownAfter;   // C3
        bytes32 docHash;
        uint256 minimum;
        uint256 price;
        uint256 forSale;
        uint256 sold;
        uint256 staked;
        uint256 acc;
        uint256 bond;
        uint256 revenue;         // C2
        uint256 otherDeposits;   // C2
        uint256 reserve;         // C3
        uint256 raised;          // C5: purchase money received, gross
        uint256 released;        // C5: escrow paid out in tranches, gross of the sale fee
        uint256 refundPool;      // C5: unreleased escrow made refundable
        uint256 refunded;        // C5
        uint8 nextTranche;       // C5
        uint8 lapses;            // C5
        bool proposalOpen;       // C5
        bytes32 evidence;        // C5
        uint256 proposedAt;      // C5
        uint256 approvedAt;      // C5
        bool challenged;         // C5
    }
    struct Stake { uint256 amount; uint256 debt; uint256 owed; }
    struct Terms {
        uint32 asset;
        uint256 totalShares;
        uint256 forSale;
        uint256 cadence;
        uint256 price;
        uint256 minimum;
        uint256 bond;
        bytes32 docHash;
        address recovery;
        address reviewer;
        uint256 minSold;
        uint256 deadline;
        uint16[] tranches;
    }

    /// @dev C1: the stated minimum must annualise to at least this share of the offered value.
    ///      2% is a placeholder policy value, not a validated business number.
    uint256 public constant MIN_ANNUAL_BPS = 200;
    /// @dev C5: a holder needs this share of sold shares, staked, to challenge a tranche.
    uint256 public constant CHALLENGE_BPS = 1000;
    uint8 public constant MAX_LAPSES = 2;
    uint256 public constant MAX_TRANCHES = 12;
    /// @dev C8: longest pause, and the minimum gap before the guardian may pause again.
    uint256 public constant MAX_PAUSE = 7 days;
    uint256 private constant YEAR = 365 days;
    uint256 private constant SCALE = 1e18;

    // Stored rather than immutable, as in v1, so the deployed runtime code equals the reviewed artifact byte for
    // byte and the app can verify it. There are no setters: these deployment terms remain fixed.
    IERC20 public paymentToken;
    address public treasury;
    /// @dev C8: may pause new money for at most MAX_PAUSE. Zero disables pausing. Expected to be a multisig.
    address public guardian;
    uint16 private _prefix;
    uint256 public pausedUntil;
    uint256 public nextPauseAt;
    uint256 private _lock = 1;
    mapping(uint32 => Listing) private _listings;
    mapping(uint32 => uint16[]) private _tranches;
    mapping(uint32 => mapping(address => Stake)) public stakes;
    mapping(uint32 => mapping(address => uint256)) public paid;      // C5: purchase money per buyer
    mapping(uint32 => mapping(address => uint256)) public bought;    // C5: shares per buyer
    mapping(uint32 => mapping(address => bool)) public refundTaken;  // C5

    event Listed(uint32 indexed asset, address indexed operator, address indexed reviewer, bytes32 docHash);
    event Reviewed(uint32 indexed asset, address indexed reviewer, bytes32 evidence);
    event Bought(uint32 indexed asset, address indexed buyer, uint256 shares, uint256 cost);
    event FundingSettled(uint32 indexed asset, bool activated, uint256 raised);
    event Staked(uint32 indexed asset, address indexed account, uint256 amount);
    event Unstaked(uint32 indexed asset, address indexed account, uint256 amount);
    event Deposited(uint32 indexed asset, address indexed from, uint256 net, uint256 fee, bool qualifying);
    event Reserved(uint32 indexed asset, uint256 amount);
    event Claimed(uint32 indexed asset, address indexed account, uint256 amount);
    event BondAdded(uint32 indexed asset, uint256 amount);
    event Slashed(uint32 indexed asset, uint256 holders, uint256 tip);
    event TrancheProposed(uint32 indexed asset, uint8 tranche, bytes32 evidence);
    event TrancheApproved(uint32 indexed asset, uint8 tranche);
    event TrancheChallenged(uint32 indexed asset, uint8 tranche, address indexed by);
    event TrancheReleased(uint32 indexed asset, uint8 tranche, uint256 amount, uint256 fee);
    event TrancheLapsed(uint32 indexed asset, uint8 tranche, uint8 lapses);
    event RefundOpened(uint32 indexed asset, uint256 refundPool);
    event Refunded(uint32 indexed asset, address indexed to, uint256 amount);
    event WindDownNoticed(uint32 indexed asset, uint256 after_);
    event WoundDown(uint32 indexed asset);
    event BondWithdrawn(uint32 indexed asset, uint256 amount);
    event OperatorProposed(uint32 indexed asset, address indexed proposed, uint256 after_, bool byRecovery);
    event OperatorChanged(uint32 indexed asset, address indexed previous, address indexed next);
    event PauseChanged(uint256 pausedUntil);

    constructor(address token, address treasury_, address guardian_, uint16 prefix) {
        if (token == address(0) || treasury_ == address(0)) revert Invalid();
        paymentToken = IERC20(token);
        treasury = treasury_;
        guardian = guardian_;
        _prefix = prefix;
    }
    modifier guarded() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }
    /// @dev C8: only paths that take in or pay out new money stop. Claims, unstaking, refunds,
    ///      deposits, slashes and challenges keep working during a pause.
    modifier live() {
        if (block.timestamp < pausedUntil) revert Paused();
        _;
    }

    // ── Views ───────────────────────────────────────────────────────────────
    function shareToken(uint32 asset) public view returns (IERC20) {
        return IERC20(address(uint160(uint256(asset) << 128) | uint160(uint256(_prefix) << 16)));
    }
    function _get(uint32 asset) private view returns (Listing storage l) {
        l = _listings[asset];
        if (l.operator == address(0)) revert Invalid();
    }
    function listing(uint32 asset) external view returns (Listing memory) { return _get(asset); }
    function tranches(uint32 asset) external view returns (uint16[] memory) { _get(asset); return _tranches[asset]; }
    function pending(uint32 asset, address account) external view returns (uint256) {
        Listing storage l = _get(asset);
        Stake storage s = stakes[asset][account];
        return s.owed + s.amount * l.acc / SCALE - s.debt;
    }
    /// @notice Purchase money the contract still holds for this listing.
    function escrowed(uint32 asset) public view returns (uint256) {
        Listing storage l = _get(asset);
        return l.raised - l.released - l.refunded;
    }
    /// @return 0 on time, 1 late, 2 defaulted, 3 closed. Before activation there is nothing owed: 0.
    function health(uint32 asset) public view returns (uint8) {
        Listing storage l = _get(asset);
        if (l.closedAt != 0) return 3;
        if (!l.activated) return 0;
        uint256 elapsed = block.timestamp - l.lastDepositAt;
        if (elapsed <= l.cadence) return 0;
        return elapsed <= 2 * l.cadence ? 1 : 2;
    }

    // ── Accounting ──────────────────────────────────────────────────────────
    function _operator(Listing storage l) private view {
        if (msg.sender != l.operator) revert Unauthorized();
    }
    function _harvest(Listing storage l, Stake storage s) private {
        uint256 earned = s.amount * l.acc / SCALE;
        s.owed += earned - s.debt;
        s.debt = earned;
    }
    function _credit(uint32 asset, Listing storage l, uint256 amount) private {
        // C2: an operator staking its own shares only round-trips its deposits and inflates its record.
        if (msg.sender == l.operator) revert Unauthorized();
        Stake storage s = stakes[asset][msg.sender];
        _harvest(l, s);
        s.amount += amount;
        l.staked += amount;
        s.debt = s.amount * l.acc / SCALE;
    }
    function _debit(uint32 asset, Listing storage l, address account, uint256 amount) private {
        Stake storage s = stakes[asset][account];
        _harvest(l, s);
        s.amount -= amount;
        l.staked -= amount;
        s.debt = s.amount * l.acc / SCALE;
    }
    /// @dev C3: with nothing staked, money is held for holders instead of being refused or sent to the treasury.
    function _allocate(uint32 asset, Listing storage l, uint256 amount) private {
        l.reserve += amount;
        if (l.staked == 0) { emit Reserved(asset, amount); return; }
        l.acc += l.reserve * SCALE / l.staked;
        l.reserve = 0;
    }
    function _returnUnsold(uint32 asset, Listing storage l) private {
        uint256 amount = l.forSale;
        l.forSale = 0;
        if (amount > 0) shareToken(asset).safeTransfer(l.operator, amount);
    }
    /// @dev C5/C6: every path that ends a raise early returns the unreleased escrow.
    function _openRefund(uint32 asset, Listing storage l) private {
        l.phase = Phase.Refunding;
        l.proposalOpen = false;
        l.refundPool = l.raised - l.released;
        if (!l.activated) {
            // Nothing was released, so buyers are made whole and the operator did nothing wrong.
            l.closedAt = block.timestamp;
            _returnUnsold(asset, l);
        }
        emit RefundOpened(asset, l.refundPool);
    }

    // ── Listing and funding (C5, C9) ────────────────────────────────────────
    function create(Terms calldata t) external guarded live {
        uint256 n = t.tranches.length;
        if (_listings[t.asset].operator != address(0) || t.totalShares == 0 || t.forSale == 0 || t.forSale > t.totalShares
            || t.price == 0 || t.minimum == 0 || t.cadence < 60 || t.docHash == bytes32(0)
            || t.bond == 0 || t.bond < t.forSale * t.price / 20 || t.recovery == msg.sender
            || t.reviewer == address(0) || t.reviewer == msg.sender || t.reviewer == t.recovery
            || t.minSold == 0 || t.minSold > t.forSale || t.deadline <= block.timestamp
            || n == 0 || n > MAX_TRANCHES) revert Invalid();
        // C1: a token deposit can no longer keep the listing on time.
        if (t.minimum * YEAR * 10_000 < t.cadence * t.forSale * t.price * MIN_ANNUAL_BPS) revert Invalid();
        uint256 total;
        for (uint256 i; i < n; i++) {
            if (t.tranches[i] == 0) revert Invalid();
            total += t.tranches[i];
        }
        if (total != 10_000) revert Invalid();
        IERC20 shares = shareToken(t.asset);
        if (shares.totalSupply() != t.totalShares) revert Invalid();
        Listing storage l = _listings[t.asset];
        l.operator = msg.sender;
        l.recovery = t.recovery;
        l.reviewer = t.reviewer;
        l.deadline = t.deadline;
        l.minSold = t.minSold;
        l.cadence = t.cadence;
        l.totalShares = t.totalShares;
        l.docHash = t.docHash;
        l.minimum = t.minimum;
        l.price = t.price;
        l.forSale = t.forSale;
        l.bond = t.bond;
        _tranches[t.asset] = t.tranches;
        shares.safeTransferFrom(msg.sender, address(this), t.forSale);
        paymentToken.safeTransferFrom(msg.sender, address(this), t.bond);
        emit Listed(t.asset, msg.sender, t.reviewer, t.docHash);
    }
    /// @notice C9: the named reviewer records that it has checked the asset evidence. No sale opens before this.
    function attest(uint32 asset, bytes32 evidence) external guarded live {
        Listing storage l = _get(asset);
        if (msg.sender != l.reviewer) revert Unauthorized();
        if (l.phase != Phase.Pending || l.closedAt != 0 || evidence == bytes32(0)) revert Invalid();
        l.phase = Phase.Funding;
        emit Reviewed(asset, msg.sender, evidence);
    }
    /// @dev C5: purchase money is held by the contract. Shares are staked for the buyer and stay locked until the raise settles.
    function buy(uint32 asset, uint256 amount) external guarded live {
        Listing storage l = _get(asset);
        if (l.phase != Phase.Funding || block.timestamp > l.deadline) revert Closed();
        if (amount == 0 || amount > l.forSale || msg.sender == l.reviewer) revert Invalid();
        l.forSale -= amount;
        l.sold += amount;
        _credit(asset, l, amount);
        uint256 cost = amount * l.price;
        l.raised += cost;
        paid[asset][msg.sender] += cost;
        bought[asset][msg.sender] += amount;
        paymentToken.safeTransferFrom(msg.sender, address(this), cost);
        emit Bought(asset, msg.sender, amount, cost);
        emit Staked(asset, msg.sender, amount);
    }
    /// @notice Anyone may settle the raise once it sells out or the deadline passes.
    function finalize(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        if (l.phase != Phase.Funding) revert Closed();
        if (block.timestamp <= l.deadline && l.forSale != 0) revert Protected();
        if (l.sold >= l.minSold) {
            l.phase = Phase.Active;
            l.activated = true;
            l.lastDepositAt = block.timestamp;
            _returnUnsold(asset, l);
            emit FundingSettled(asset, true, l.raised);
        } else {
            emit FundingSettled(asset, false, l.raised);
            _openRefund(asset, l);
        }
    }
    /// @notice The operator may stop before activation (full refund) or afterwards (unreleased escrow refunded).
    function cancel(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        _operator(l);
        if (l.phase == Phase.Refunding || l.closedAt != 0) revert Closed();
        _openRefund(asset, l);
    }
    /// @notice Each buyer takes its share of the unreleased escrow. Before activation this is a full
    ///         refund and the buyer's locked shares go back to the operator.
    function refund(uint32 asset) external guarded returns (uint256 amount) {
        Listing storage l = _get(asset);
        if (l.phase != Phase.Refunding) revert Protected();
        if (refundTaken[asset][msg.sender]) revert Closed();
        if (l.raised == 0) revert Empty();
        amount = l.refundPool * paid[asset][msg.sender] / l.raised;
        if (amount == 0) revert Empty();
        refundTaken[asset][msg.sender] = true;
        l.refunded += amount;
        if (!l.activated) {
            uint256 shares = bought[asset][msg.sender];
            _debit(asset, l, msg.sender, shares);
            shareToken(asset).safeTransfer(l.operator, shares);
        }
        paymentToken.safeTransfer(msg.sender, amount);
        emit Refunded(asset, msg.sender, amount);
    }

    // ── Tranche release (C5) ────────────────────────────────────────────────
    function propose(uint32 asset, bytes32 evidence) external guarded live {
        Listing storage l = _get(asset);
        _operator(l);
        if (l.phase != Phase.Active || l.proposalOpen || evidence == bytes32(0) || l.nextTranche >= _tranches[asset].length) revert Invalid();
        l.proposalOpen = true;
        l.evidence = evidence;
        l.proposedAt = block.timestamp;
        l.approvedAt = 0;
        l.challenged = false;
        emit TrancheProposed(asset, l.nextTranche, evidence);
    }
    function approve(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        if (msg.sender != l.reviewer) revert Unauthorized();
        if (l.phase != Phase.Active || !l.proposalOpen || l.approvedAt != 0) revert Invalid();
        if (l.challenged || block.timestamp > l.proposedAt + 3 * l.cadence) revert Protected();
        l.approvedAt = block.timestamp;
        emit TrancheApproved(asset, l.nextTranche);
    }
    /// @notice A holder with at least CHALLENGE_BPS of sold shares staked stops the open tranche.
    function challenge(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        if (l.phase != Phase.Active || !l.proposalOpen) revert Invalid();
        if (stakes[asset][msg.sender].amount * 10_000 < l.sold * CHALLENGE_BPS) revert Unauthorized();
        l.challenged = true;
        emit TrancheChallenged(asset, l.nextTranche, msg.sender);
    }
    /// @notice Anyone may release an approved, unchallenged tranche one period after approval.
    function release(uint32 asset) external guarded live {
        Listing storage l = _get(asset);
        if (l.phase != Phase.Active || !l.proposalOpen) revert Invalid();
        // A defaulted operator receives no further escrow.
        if (l.challenged || l.approvedAt == 0 || block.timestamp < l.approvedAt + l.cadence
            || block.timestamp > l.proposedAt + 3 * l.cadence || health(asset) >= 2) revert Protected();
        uint8 index = l.nextTranche;
        bool last = index + 1 == _tranches[asset].length;
        // The last tranche takes the remainder so rounding never strands or invents a unit.
        uint256 amount = last ? l.raised - l.released : l.raised * _tranches[asset][index] / 10_000;
        uint256 fee = amount / 100;
        l.released += amount;
        l.nextTranche = index + 1;
        l.lapses = 0;
        l.proposalOpen = false;
        paymentToken.safeTransfer(l.operator, amount - fee);
        if (fee > 0) paymentToken.safeTransfer(treasury, fee);
        emit TrancheReleased(asset, index, amount, fee);
    }
    /// @notice Clears an expired or challenged tranche proposal. The second failure opens refunds.
    ///         A proposal that a pause overlapped does not count as a failure.
    function lapse(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        if (l.phase != Phase.Active || !l.proposalOpen) revert Invalid();
        if (!l.challenged && block.timestamp <= l.proposedAt + 3 * l.cadence) revert Protected();
        l.proposalOpen = false;
        if (pausedUntil > l.proposedAt) { emit TrancheLapsed(asset, l.nextTranche, l.lapses); return; }
        l.lapses += 1;
        emit TrancheLapsed(asset, l.nextTranche, l.lapses);
        if (l.lapses >= MAX_LAPSES) _openRefund(asset, l);
    }

    // ── Holders and revenue ─────────────────────────────────────────────────
    /// @dev C4: staking stays open during default so holders who unstaked can take part in a slash.
    function stake(uint32 asset, uint256 amount) external guarded {
        Listing storage l = _get(asset);
        if (l.closedAt != 0) revert Closed();
        if (!l.activated) revert Protected();
        if (amount == 0) revert Invalid();
        _credit(asset, l, amount);
        shareToken(asset).safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(asset, msg.sender, amount);
    }
    function unstake(uint32 asset, uint256 amount) external guarded {
        Listing storage l = _get(asset);
        // C5: purchased shares stay locked until the raise settles, so a failed raise can take them back.
        if (!l.activated) revert Protected();
        if (amount == 0 || amount > stakes[asset][msg.sender].amount) revert Invalid();
        _debit(asset, l, msg.sender, amount);
        shareToken(asset).safeTransfer(msg.sender, amount);
        emit Unstaked(asset, msg.sender, amount);
    }
    function deposit(uint32 asset, uint256 amount) external guarded {
        Listing storage l = _get(asset);
        if (l.closedAt != 0) revert Closed();
        if (!l.activated) revert Protected();
        if (amount == 0) revert Invalid();
        uint256 fee = amount / 200;
        uint256 net = amount - fee;
        bool fromOperator = msg.sender == l.operator;
        bool qualifies = fromOperator && amount >= l.minimum;
        if (qualifies) l.lastDepositAt = block.timestamp;
        if (fromOperator) l.revenue += net; else l.otherDeposits += net;
        _allocate(asset, l, net);
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        if (fee > 0) paymentToken.safeTransfer(treasury, fee);
        emit Deposited(asset, msg.sender, net, fee, qualifies);
    }
    function claim(uint32 asset) external guarded returns (uint256 amount) {
        Listing storage l = _get(asset);
        Stake storage s = stakes[asset][msg.sender];
        _harvest(l, s);
        amount = s.owed;
        if (amount == 0) revert Empty();
        s.owed = 0;
        paymentToken.safeTransfer(msg.sender, amount);
        emit Claimed(asset, msg.sender, amount);
    }

    // ── Bond and default (C3, C4, C6) ───────────────────────────────────────
    function topUp(uint32 asset, uint256 amount) external guarded {
        Listing storage l = _get(asset);
        _operator(l);
        if (l.closedAt != 0) revert Closed();
        if (amount == 0) revert Invalid();
        l.bond += amount;
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        emit BondAdded(asset, amount);
    }
    /// @dev C4: opens one period after default, giving holders time to restake.
    ///      C3: the bond goes to holders (or the reserve), never to the treasury.
    ///      C6: a slash also returns every unreleased tranche to buyers.
    function slash(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        if (!l.activated || l.closedAt != 0 || l.bond == 0 || block.timestamp - l.lastDepositAt <= 3 * l.cadence) revert Protected();
        uint256 tip = l.bond / 100;
        uint256 holders = l.bond - tip;
        l.bond = 0;
        _allocate(asset, l, holders); // compensation, deliberately not counted as revenue
        if (l.phase == Phase.Active && l.raised > l.released) _openRefund(asset, l);
        if (tip > 0) paymentToken.safeTransfer(msg.sender, tip);
        emit Slashed(asset, holders, tip);
    }

    // ── Closing (C3) ────────────────────────────────────────────────────────
    /// @dev C3: holders get two periods' notice, during which they can stake to keep the listing open.
    function noticeWindDown(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        _operator(l);
        if (l.closedAt != 0) revert Closed();
        if (!l.activated || l.windDownAfter != 0) revert Invalid();
        l.windDownAfter = block.timestamp + 2 * l.cadence;
        emit WindDownNoticed(asset, l.windDownAfter);
    }
    function windDown(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        _operator(l);
        if (l.closedAt != 0) revert Closed();
        if (l.windDownAfter == 0 || block.timestamp < l.windDownAfter) revert Protected();
        if (l.staked != 0 || l.reserve != 0 || (health(asset) == 2 && l.bond > 0)) revert Protected();
        if (l.phase == Phase.Active && l.raised > l.released) _openRefund(asset, l);
        l.closedAt = block.timestamp;
        emit WoundDown(asset);
    }
    /// @dev A raise that never activated returns the bond at once: buyers were refunded in full.
    function withdrawBond(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        _operator(l);
        if (l.closedAt == 0 || (l.activated && block.timestamp < l.closedAt + 2 * l.cadence)) revert Protected();
        uint256 amount = l.bond;
        if (amount == 0) revert Empty();
        l.bond = 0;
        paymentToken.safeTransfer(l.operator, amount);
        emit BondWithdrawn(asset, amount);
    }

    // ── Operator rotation (C7) ──────────────────────────────────────────────
    /// @dev The operator or the recovery address proposes; the new operator accepts after one period.
    ///      The operator cannot replace a proposal made by the recovery address.
    function proposeOperator(uint32 asset, address next) external guarded {
        Listing storage l = _get(asset);
        bool byRecovery = l.recovery != address(0) && msg.sender == l.recovery;
        if (!byRecovery) {
            _operator(l);
            if (l.pendingByRecovery) revert Protected();
        }
        if (next == address(0) || next == l.operator || next == l.reviewer) revert Invalid();
        l.pendingOperator = next;
        l.pendingAfter = block.timestamp + l.cadence;
        l.pendingByRecovery = byRecovery;
        emit OperatorProposed(asset, next, l.pendingAfter, byRecovery);
    }
    function acceptOperator(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        if (msg.sender != l.pendingOperator) revert Unauthorized();
        if (block.timestamp < l.pendingAfter) revert Protected();
        // C2 stays closed after rotation: an operator may not hold stake in its own listing.
        if (stakes[asset][msg.sender].amount != 0) revert Protected();
        address previous = l.operator;
        l.operator = msg.sender;
        l.pendingOperator = address(0);
        l.pendingAfter = 0;
        l.pendingByRecovery = false;
        if (l.recovery == msg.sender) l.recovery = address(0);
        emit OperatorChanged(asset, previous, msg.sender);
    }

    // ── Pause (C8) ──────────────────────────────────────────────────────────
    function pause() external guarded {
        if (msg.sender != guardian || guardian == address(0)) revert Unauthorized();
        if (block.timestamp < nextPauseAt) revert Protected();
        pausedUntil = block.timestamp + MAX_PAUSE;
        nextPauseAt = pausedUntil + MAX_PAUSE;
        emit PauseChanged(pausedUntil);
    }
    function unpause() external guarded {
        if (msg.sender != guardian) revert Unauthorized();
        if (block.timestamp >= pausedUntil) revert Invalid();
        pausedUntil = block.timestamp;
        emit PauseChanged(pausedUntil);
    }
}
