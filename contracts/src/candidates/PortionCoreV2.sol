// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../interfaces/IERC20.sol";
import {CoreTransfer} from "../lib/CoreTransfer.sol";

/// @notice LOCAL CANDIDATE: not deployed, not audited, not used by the app.
/// @dev Core v1 with the loopholes C1–C4 and C7 from docs/MARKET-READINESS-REVIEW.md closed or narrowed.
///      Each change is marked with its finding number. Residual limits are in docs/CORE-V2-CANDIDATE.md.
contract PortionCoreV2 {
    using CoreTransfer for IERC20;

    error Invalid();
    error Unauthorized();
    error Closed();
    error Protected();
    error Empty();
    error Reentrancy();

    struct Listing {
        address operator;
        address recovery;        // C7: may propose a new operator; cannot be overridden by the operator
        address pendingOperator; // C7
        uint256 pendingAfter;    // C7: earliest acceptance time
        bool pendingByRecovery;  // C7
        uint256 cadence;
        uint256 totalShares;
        uint256 lastDepositAt;
        uint256 closedAt;
        uint256 windDownAfter;   // C3: wind-down needs public notice first
        bool saleOpen;
        bytes32 docHash;
        uint256 minimum;
        uint256 price;
        uint256 forSale;
        uint256 staked;
        uint256 acc;
        uint256 bond;
        uint256 revenue;         // C2: net deposits from the operator only
        uint256 otherDeposits;   // C2: net deposits from anyone else, never counted as track record
        uint256 reserve;         // C3: holders' money waiting for someone to stake
        uint256 sold;
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
    }

    /// @dev C1: the stated minimum must annualise to at least this share of the offered value.
    ///      2% is a placeholder policy value, not a validated business number.
    uint256 public constant MIN_ANNUAL_BPS = 200;
    uint256 private constant YEAR = 365 days;
    uint256 private constant SCALE = 1e18;

    IERC20 public immutable paymentToken;
    address public immutable treasury;
    uint16 private immutable _prefix;
    uint256 private _lock = 1;
    mapping(uint32 => Listing) private _listings;
    mapping(uint32 => mapping(address => Stake)) public stakes;

    event Listed(uint32 indexed asset, address indexed operator, bytes32 docHash);
    event Bought(uint32 indexed asset, address indexed buyer, uint256 shares, uint256 cost);
    event Staked(uint32 indexed asset, address indexed account, uint256 amount);
    event Unstaked(uint32 indexed asset, address indexed account, uint256 amount);
    event Deposited(uint32 indexed asset, address indexed from, uint256 net, uint256 fee, bool qualifying);
    event Reserved(uint32 indexed asset, uint256 amount);
    event Claimed(uint32 indexed asset, address indexed account, uint256 amount);
    event BondAdded(uint32 indexed asset, uint256 amount);
    event Slashed(uint32 indexed asset, uint256 holders, uint256 tip);
    event SaleClosed(uint32 indexed asset, uint256 returnedShares);
    event WindDownNoticed(uint32 indexed asset, uint256 after_);
    event WoundDown(uint32 indexed asset);
    event BondWithdrawn(uint32 indexed asset, uint256 amount);
    event OperatorProposed(uint32 indexed asset, address indexed proposed, uint256 after_, bool byRecovery);
    event OperatorChanged(uint32 indexed asset, address indexed previous, address indexed next);

    constructor(address token, address treasury_, uint16 prefix) {
        if (token == address(0) || treasury_ == address(0)) revert Invalid();
        paymentToken = IERC20(token);
        treasury = treasury_;
        _prefix = prefix;
    }
    modifier guarded() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }
    function shareToken(uint32 asset) public view returns (IERC20) {
        return IERC20(address(uint160(uint256(asset) << 128) | uint160(uint256(_prefix) << 16)));
    }
    function _get(uint32 asset) private view returns (Listing storage l) {
        l = _listings[asset];
        if (l.operator == address(0)) revert Invalid();
    }
    function listing(uint32 asset) external view returns (Listing memory) {
        return _get(asset);
    }
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
    /// @dev C3: with nothing staked, money is held for holders instead of being refused or sent to the treasury.
    function _allocate(uint32 asset, Listing storage l, uint256 amount) private {
        l.reserve += amount;
        if (l.staked == 0) { emit Reserved(asset, amount); return; }
        l.acc += l.reserve * SCALE / l.staked;
        l.reserve = 0;
    }
    function pending(uint32 asset, address account) external view returns (uint256) {
        Listing storage l = _get(asset);
        Stake storage s = stakes[asset][account];
        return s.owed + s.amount * l.acc / SCALE - s.debt;
    }
    /// @return 0 on time, 1 late, 2 defaulted, 3 closed.
    function health(uint32 asset) public view returns (uint8) {
        Listing storage l = _get(asset);
        if (l.closedAt != 0) return 3;
        uint256 elapsed = block.timestamp - l.lastDepositAt;
        if (elapsed <= l.cadence) return 0;
        return elapsed <= 2 * l.cadence ? 1 : 2;
    }
    function create(Terms calldata t) external guarded {
        if (_listings[t.asset].operator != address(0) || t.totalShares == 0 || t.forSale > t.totalShares
            || t.price == 0 || t.minimum == 0 || t.cadence < 60 || t.docHash == bytes32(0)
            || t.bond == 0 || t.bond < t.forSale * t.price / 20 || t.recovery == msg.sender) revert Invalid();
        // C1: a token deposit can no longer keep the listing on time.
        if (t.minimum * YEAR * 10_000 < t.cadence * t.forSale * t.price * MIN_ANNUAL_BPS) revert Invalid();
        IERC20 shares = shareToken(t.asset);
        if (shares.totalSupply() != t.totalShares) revert Invalid();
        Listing storage l = _listings[t.asset];
        l.operator = msg.sender;
        l.recovery = t.recovery;
        l.cadence = t.cadence;
        l.totalShares = t.totalShares;
        l.lastDepositAt = block.timestamp;
        l.saleOpen = t.forSale > 0;
        l.docHash = t.docHash;
        l.minimum = t.minimum;
        l.price = t.price;
        l.forSale = t.forSale;
        l.bond = t.bond;
        if (t.forSale > 0) shares.safeTransferFrom(msg.sender, address(this), t.forSale);
        paymentToken.safeTransferFrom(msg.sender, address(this), t.bond);
        emit Listed(t.asset, msg.sender, t.docHash);
    }
    function buy(uint32 asset, uint256 amount) external guarded {
        Listing storage l = _get(asset);
        if (health(asset) >= 2) revert Protected();
        if (!l.saleOpen || amount == 0 || amount > l.forSale) revert Invalid();
        l.forSale -= amount;
        l.sold += amount;
        if (l.forSale == 0) l.saleOpen = false;
        _credit(asset, l, amount);
        uint256 cost = amount * l.price;
        uint256 fee = cost / 100;
        paymentToken.safeTransferFrom(msg.sender, l.operator, cost - fee);
        if (fee > 0) paymentToken.safeTransferFrom(msg.sender, treasury, fee);
        emit Bought(asset, msg.sender, amount, cost);
        emit Staked(asset, msg.sender, amount);
    }
    /// @dev C4: staking stays open during default so holders who unstaked can take part in a slash.
    function stake(uint32 asset, uint256 amount) external guarded {
        Listing storage l = _get(asset);
        if (l.closedAt != 0) revert Closed();
        if (amount == 0) revert Invalid();
        _credit(asset, l, amount);
        shareToken(asset).safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(asset, msg.sender, amount);
    }
    function unstake(uint32 asset, uint256 amount) external guarded {
        Listing storage l = _get(asset);
        Stake storage s = stakes[asset][msg.sender];
        if (amount == 0 || amount > s.amount) revert Invalid();
        _harvest(l, s);
        s.amount -= amount;
        l.staked -= amount;
        s.debt = s.amount * l.acc / SCALE;
        shareToken(asset).safeTransfer(msg.sender, amount);
        emit Unstaked(asset, msg.sender, amount);
    }
    function deposit(uint32 asset, uint256 amount) external guarded {
        Listing storage l = _get(asset);
        if (l.closedAt != 0) revert Closed();
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
    function slash(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        if (l.closedAt != 0 || l.bond == 0 || block.timestamp - l.lastDepositAt <= 3 * l.cadence) revert Protected();
        uint256 tip = l.bond / 100;
        uint256 holders = l.bond - tip;
        l.bond = 0;
        _allocate(asset, l, holders); // compensation, deliberately not counted as revenue
        if (tip > 0) paymentToken.safeTransfer(msg.sender, tip);
        emit Slashed(asset, holders, tip);
    }
    function _returnSale(uint32 asset, Listing storage l) private {
        uint256 amount = l.forSale;
        l.forSale = 0;
        l.saleOpen = false;
        if (amount > 0) shareToken(asset).safeTransfer(l.operator, amount);
        emit SaleClosed(asset, amount);
    }
    function closeSale(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        _operator(l);
        _returnSale(asset, l);
    }
    /// @dev C3: holders get two periods' notice, during which they can stake to keep the listing open.
    function noticeWindDown(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        _operator(l);
        if (l.closedAt != 0) revert Closed();
        if (l.windDownAfter != 0) revert Invalid();
        l.windDownAfter = block.timestamp + 2 * l.cadence;
        emit WindDownNoticed(asset, l.windDownAfter);
    }
    function windDown(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        _operator(l);
        if (l.closedAt != 0) revert Closed();
        if (l.windDownAfter == 0 || block.timestamp < l.windDownAfter) revert Protected();
        if (l.staked != 0 || l.reserve != 0 || (health(asset) == 2 && l.bond > 0)) revert Protected();
        l.closedAt = block.timestamp;
        _returnSale(asset, l);
        emit WoundDown(asset);
    }
    function withdrawBond(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        _operator(l);
        if (l.closedAt == 0 || block.timestamp < l.closedAt + 2 * l.cadence) revert Protected();
        uint256 amount = l.bond;
        if (amount == 0) revert Empty();
        l.bond = 0;
        paymentToken.safeTransfer(l.operator, amount);
        emit BondWithdrawn(asset, amount);
    }
    /// @dev C7: the operator or the recovery address proposes; the new operator accepts after one period.
    ///      The operator cannot replace a proposal made by the recovery address.
    function proposeOperator(uint32 asset, address next) external guarded {
        Listing storage l = _get(asset);
        bool byRecovery = l.recovery != address(0) && msg.sender == l.recovery;
        if (!byRecovery) {
            _operator(l);
            if (l.pendingByRecovery) revert Protected();
        }
        if (next == address(0) || next == l.operator) revert Invalid();
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
}
