// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {SafeTransfer} from "./lib/SafeTransfer.sol";

/// @notice Budget candidate, not the contract used by the current SDK/UI.
/// @dev Native asset IDs identify listings. Display metadata and NFT references belong in the
///      hashed document, not duplicate contract strings. Fees/rules are fixed for this version.
contract PortionCore {
    using SafeTransfer for IERC20;

    error Invalid();
    error Unauthorized();
    error Closed();
    error Protected();
    error Empty();
    error Reentrancy();

    struct Listing {
        address operator;
        uint64 cadence;
        uint64 totalShares;
        uint64 lastDepositAt;
        uint64 closedAt;
        bool saleOpen;
        bytes32 docHash;
        uint256 minimum;
        uint256 price;
        uint256 forSale;
        uint256 staked;
        uint256 acc;
        uint256 bond;
        uint256 revenue;
    }
    struct Stake { uint256 amount; uint256 debt; uint256 owed; }
    struct Terms {
        uint32 asset;
        uint64 totalShares;
        uint64 forSale;
        uint64 cadence;
        uint256 price;
        uint256 minimum;
        uint256 bond;
        bytes32 docHash;
    }

    // Storage is smaller than repeating immutable values throughout runtime bytecode here.
    // There are no setters: these deployment terms remain fixed.
    IERC20 public paymentToken;
    address public treasury;
    uint16 private _prefix;
    uint256 private _lock = 1;
    uint256 private constant SCALE = 1e18;
    mapping(uint32 => Listing) private _listings;
    mapping(uint32 => mapping(address => Stake)) public stakes;

    event Listed(uint32 indexed asset, address indexed operator, bytes32 docHash);
    event Bought(uint32 indexed asset, address indexed buyer, uint256 shares, uint256 cost);
    event Staked(uint32 indexed asset, address indexed account, uint256 amount);
    event Unstaked(uint32 indexed asset, address indexed account, uint256 amount);
    event Deposited(uint32 indexed asset, address indexed from, uint256 net, uint256 fee, bool qualifying);
    event Claimed(uint32 indexed asset, address indexed account, uint256 amount);
    event BondAdded(uint32 indexed asset, uint256 amount);
    event Slashed(uint32 indexed asset, uint256 holders, uint256 tip);
    event SaleClosed(uint32 indexed asset, uint256 returnedShares);
    event WoundDown(uint32 indexed asset);
    event BondWithdrawn(uint32 indexed asset, uint256 amount);

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
    function listing(uint32 asset) external view returns (Listing memory) { return _get(asset); }
    function _operator(Listing storage l) private view {
        if (msg.sender != l.operator) revert Unauthorized();
    }
    function _harvest(Listing storage l, Stake storage s) private {
        uint256 earned = s.amount * l.acc / SCALE;
        s.owed += earned - s.debt;
        s.debt = earned;
    }
    function _credit(uint32 asset, Listing storage l, uint256 amount) private {
        Stake storage s = stakes[asset][msg.sender];
        _harvest(l, s);
        s.amount += amount;
        l.staked += amount;
        s.debt = s.amount * l.acc / SCALE;
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
        return elapsed <= 2 * uint256(l.cadence) ? 1 : 2;
    }
    function create(Terms calldata t) external guarded {
        if (_listings[t.asset].operator != address(0) || t.totalShares == 0 || t.forSale > t.totalShares
            || t.price == 0 || t.minimum == 0 || t.cadence < 60 || t.docHash == bytes32(0)
            || t.bond == 0 || t.bond < uint256(t.forSale) * t.price / 20) revert Invalid();
        IERC20 shares = shareToken(t.asset);
        if (shares.totalSupply() != t.totalShares) revert Invalid();
        Listing storage l = _listings[t.asset];
        l.operator = msg.sender;
        l.cadence = t.cadence;
        l.totalShares = t.totalShares;
        l.lastDepositAt = uint64(block.timestamp);
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
        if (!l.saleOpen || amount == 0 || amount > l.forSale) revert Invalid();
        l.forSale -= amount;
        if (l.forSale == 0) l.saleOpen = false;
        _credit(asset, l, amount);
        uint256 cost = amount * l.price;
        uint256 fee = cost / 100;
        paymentToken.safeTransferFrom(msg.sender, l.operator, cost - fee);
        if (fee > 0) paymentToken.safeTransferFrom(msg.sender, treasury, fee);
        emit Bought(asset, msg.sender, amount, cost);
        emit Staked(asset, msg.sender, amount);
    }
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
        if (amount == 0 || l.staked == 0) revert Invalid();
        uint256 fee = amount / 200;
        uint256 net = amount - fee;
        l.acc += net * SCALE / l.staked;
        l.revenue += net;
        bool qualifies = msg.sender == l.operator && amount >= l.minimum;
        if (qualifies) l.lastDepositAt = uint64(block.timestamp);
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
    function slash(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        if (health(asset) != 2 || l.bond == 0) revert Protected();
        uint256 tip = l.bond / 100;
        uint256 holders = l.bond - tip;
        l.bond = 0;
        if (l.staked == 0) {
            paymentToken.safeTransfer(treasury, holders);
            holders = 0;
        } else {
            l.acc += holders * SCALE / l.staked;
            l.revenue += holders;
        }
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
    function windDown(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        _operator(l);
        if (l.closedAt != 0) revert Closed();
        if (l.staked != 0 || (health(asset) == 2 && l.bond > 0)) revert Protected();
        l.closedAt = uint64(block.timestamp);
        _returnSale(asset, l);
        emit WoundDown(asset);
    }
    function withdrawBond(uint32 asset) external guarded {
        Listing storage l = _get(asset);
        _operator(l);
        if (l.closedAt == 0 || block.timestamp < uint256(l.closedAt) + 2 * uint256(l.cadence)) revert Protected();
        uint256 amount = l.bond;
        if (amount == 0) revert Empty();
        l.bond = 0;
        paymentToken.safeTransfer(l.operator, amount);
        emit BondWithdrawn(asset, amount);
    }
}
