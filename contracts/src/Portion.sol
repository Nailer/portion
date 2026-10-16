// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {SafeTransfer} from "./lib/SafeTransfer.sol";

/// @title Portion
/// @notice Revenue-sharing listings for real things that earn.
///
/// How it fits together on Portaldot V3 (see docs/architecture.md):
///  - The *deed* is a native NFT, locked by the native NftFractionalization pallet.
///  - The *shares* are the native fungible asset minted by that pallet. They are visible here as an
///    ERC-20 because the runtime's AssetsPrecompiles module exposes every native asset at a
///    deterministic address (see `shareToken`). No share-token contract exists or needs auditing.
///  - This contract is the *operator accountability layer*: primary sale, revenue distribution to
///    share-holders, and an operator bond that is slashed to holders if revenue stops arriving.
///  - The listing is created from a single `Utility.batchAll` extrinsic that also performs the native
///    steps, so the whole thing is atomic. This contract trusts none of it blindly: it checks the
///    share supply it can see and pulls tokens with allowances the operator granted in that batch.
contract Portion {
    using SafeTransfer for IERC20;

    // ───────────────────────────── errors ─────────────────────────────
    error NotOwner();
    error NotOperator();
    error UnknownListing();
    error BadParams();
    error DuplicateAsset();
    error ShareSupplyMismatch();
    error BondTooSmall();
    error SaleNotOpen();
    error SoldOut();
    error NoStakers();
    error NothingToClaim();
    error NotSlashable();
    error NothingToSlash();
    error StillWindingDown();
    error AlreadyWoundDown();
    error InsufficientStake();
    error Reentrancy();

    // ───────────────────────────── types ──────────────────────────────
    enum Health {
        Healthy, // revenue arrived within one cadence
        Late, // overdue by up to two cadences
        Defaulted, // overdue by more than two cadences: bond can be slashed
        WoundDown // operator ended the listing
    }

    struct Listing {
        address operator;
        address payToken;
        uint32 assetId;
        uint32 nftCollection;
        uint32 nftItem;
        uint8 category;
        uint32 strikes;
        uint64 totalShares;
        uint64 cadence; // seconds between expected revenue deposits
        uint64 createdAt;
        uint64 lastDepositAt; // last *qualifying* operator deposit
        uint64 closedAt;
        bool saleOpen;
        bytes32 docHash; // blake2-256 of terms+photo stored with TransactionStorage
        bytes32 coverHash;
        uint256 minPerPeriod; // minimum deposit that resets the cadence clock
        string name;
        string summary;
    }

    struct Vault {
        uint256 totalStaked;
        uint256 accPerShare; // payToken units per share, scaled by PRECISION
        uint256 totalRevenue; // net of fees, cumulative
        uint256 deposits;
        uint256 bond;
        uint256 forSale; // shares still on offer
        uint256 sold; // shares sold in the primary sale
        uint256 salePrice; // payToken units per share
    }

    struct UserStake {
        uint256 amount;
        uint256 debt;
        uint256 owed;
    }

    struct CreateParams {
        uint32 assetId;
        uint32 nftCollection;
        uint32 nftItem;
        uint8 category;
        uint64 totalShares;
        uint64 sharesForSale;
        uint64 cadence;
        address payToken;
        uint256 salePrice;
        uint256 minPerPeriod;
        uint256 bond;
        bytes32 docHash;
        bytes32 coverHash;
        string name;
        string summary;
    }

    // ───────────────────────────── storage ────────────────────────────
    uint256 private constant PRECISION = 1e18;
    uint256 private constant BPS = 10_000;

    /// @notice Index of the AssetsPrecompiles module in the runtime (verified on the V3 testnet).
    uint16 public immutable precompilePrefix;

    address public owner;
    address public treasury;
    uint16 public saleFeeBps = 100; // 1.00% of primary-sale proceeds
    uint16 public revenueFeeBps = 50; // 0.50% of revenue deposits
    uint16 public minBondBps = 500; // bond must be >= 5% of the raise
    uint16 public slashTipBps = 100; // 1% of a slashed bond goes to whoever calls `slash`
    uint64 public minCadence = 60;

    Listing[] private _listings;
    mapping(uint256 => Vault) private _vaults;
    mapping(uint256 => mapping(address => UserStake)) private _stakes;
    mapping(uint32 => uint256) private _idPlusOneByAsset;
    uint256 private _lock = 1;

    // ───────────────────────────── events ─────────────────────────────
    event Listed(
        uint256 indexed id,
        address indexed operator,
        uint32 indexed assetId,
        uint64 totalShares,
        uint64 sharesForSale,
        uint256 salePrice,
        address payToken,
        uint64 cadence,
        bytes32 docHash,
        string name
    );
    event Bought(uint256 indexed id, address indexed buyer, uint256 shares, uint256 cost);
    event Staked(uint256 indexed id, address indexed who, uint256 amount);
    event Unstaked(uint256 indexed id, address indexed who, uint256 amount);
    event RevenueDeposited(uint256 indexed id, address indexed from, uint256 net, uint256 fee, bytes32 memo, bool qualifying);
    event Claimed(uint256 indexed id, address indexed who, uint256 amount);
    event BondToppedUp(uint256 indexed id, uint256 amount, uint256 newBond);
    event Slashed(uint256 indexed id, address indexed caller, uint256 toHolders, uint256 tip, uint32 strikes);
    event SaleClosed(uint256 indexed id, uint256 returnedShares);
    event WoundDown(uint256 indexed id);
    event BondWithdrawn(uint256 indexed id, uint256 amount);

    // ───────────────────────────── modifiers ──────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(address treasury_, uint16 precompilePrefix_) {
        owner = msg.sender;
        treasury = treasury_;
        precompilePrefix = precompilePrefix_;
    }

    // ───────────────────────────── helpers ────────────────────────────

    /// @notice ERC-20 address of a native asset: [assetId:4][zeros:12][prefix:2][zeros:2].
    function shareToken(uint32 assetId) public view returns (address) {
        return address(uint160(uint256(assetId) << 128) | uint160(uint256(precompilePrefix) << 16));
    }

    function _get(uint256 id) private view returns (Listing storage l) {
        if (id >= _listings.length) revert UnknownListing();
        l = _listings[id];
    }

    // ───────────────────────────── create ─────────────────────────────

    /// @notice Register a listing whose native deed/shares already exist (created earlier in the same batch).
    /// @dev Operator must have approved this contract for `sharesForSale` shares and `bond` payToken.
    function createListing(CreateParams calldata p) external nonReentrant returns (uint256 id) {
        uint256 nameLen = bytes(p.name).length;
        if (
            nameLen == 0 || nameLen > 64 || bytes(p.summary).length > 280 || p.totalShares == 0
                || p.sharesForSale > p.totalShares || p.salePrice == 0 || p.minPerPeriod == 0 || p.cadence < minCadence
                || p.payToken == address(0)
        ) revert BadParams();
        if (_idPlusOneByAsset[p.assetId] != 0) revert DuplicateAsset();

        IERC20 shares = IERC20(shareToken(p.assetId));
        if (shares.totalSupply() != p.totalShares) revert ShareSupplyMismatch();

        uint256 raise = uint256(p.sharesForSale) * p.salePrice;
        if (p.bond < (raise * minBondBps) / BPS) revert BondTooSmall();

        id = _listings.length;
        _idPlusOneByAsset[p.assetId] = id + 1;
        _listings.push(
            Listing({
                operator: msg.sender,
                payToken: p.payToken,
                assetId: p.assetId,
                nftCollection: p.nftCollection,
                nftItem: p.nftItem,
                category: p.category,
                strikes: 0,
                totalShares: p.totalShares,
                cadence: p.cadence,
                createdAt: uint64(block.timestamp),
                lastDepositAt: uint64(block.timestamp),
                closedAt: 0,
                saleOpen: p.sharesForSale > 0,
                docHash: p.docHash,
                coverHash: p.coverHash,
                minPerPeriod: p.minPerPeriod,
                name: p.name,
                summary: p.summary
            })
        );
        Vault storage v = _vaults[id];
        v.forSale = p.sharesForSale;
        v.salePrice = p.salePrice;
        v.bond = p.bond;

        if (p.sharesForSale > 0) shares.safeTransferFrom(msg.sender, address(this), p.sharesForSale);
        if (p.bond > 0) IERC20(p.payToken).safeTransferFrom(msg.sender, address(this), p.bond);

        emit Listed(id, msg.sender, p.assetId, p.totalShares, p.sharesForSale, p.salePrice, p.payToken, p.cadence, p.docHash, p.name);
    }

    // ───────────────────────────── primary sale ───────────────────────

    /// @notice Buy shares at the fixed offer price. Bought shares start earning immediately.
    function buy(uint256 id, uint256 shares) external nonReentrant {
        Listing storage l = _get(id);
        Vault storage v = _vaults[id];
        if (!l.saleOpen) revert SaleNotOpen();
        if (shares == 0 || shares > v.forSale) revert SoldOut();

        uint256 cost = shares * v.salePrice;
        uint256 fee = (cost * saleFeeBps) / BPS;

        v.forSale -= shares;
        v.sold += shares;
        if (v.forSale == 0) l.saleOpen = false;

        _credit(id, msg.sender, shares);

        IERC20 pay = IERC20(l.payToken);
        pay.safeTransferFrom(msg.sender, l.operator, cost - fee);
        if (fee > 0) pay.safeTransferFrom(msg.sender, treasury, fee);

        emit Bought(id, msg.sender, shares, cost);
        emit Staked(id, msg.sender, shares);
    }

    /// @notice Operator stops the sale and takes back unsold shares.
    function closeSale(uint256 id) external nonReentrant {
        Listing storage l = _get(id);
        if (msg.sender != l.operator) revert NotOperator();
        Vault storage v = _vaults[id];
        uint256 back = v.forSale;
        l.saleOpen = false;
        v.forSale = 0;
        if (back > 0) IERC20(shareToken(l.assetId)).safeTransfer(l.operator, back);
        emit SaleClosed(id, back);
    }

    // ───────────────────────────── vault ──────────────────────────────

    /// @notice Lock shares you already hold (for example bought on the native DEX) to earn revenue.
    function stake(uint256 id, uint256 amount) external nonReentrant {
        Listing storage l = _get(id);
        if (amount == 0) revert BadParams();
        _credit(id, msg.sender, amount);
        IERC20(shareToken(l.assetId)).safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(id, msg.sender, amount);
    }

    function unstake(uint256 id, uint256 amount) external nonReentrant {
        Listing storage l = _get(id);
        Vault storage v = _vaults[id];
        UserStake storage s = _stakes[id][msg.sender];
        if (amount == 0 || amount > s.amount) revert InsufficientStake();
        _harvest(v, s);
        s.amount -= amount;
        v.totalStaked -= amount;
        s.debt = (s.amount * v.accPerShare) / PRECISION;
        IERC20(shareToken(l.assetId)).safeTransfer(msg.sender, amount);
        emit Unstaked(id, msg.sender, amount);
    }

    /// @notice Pay revenue into the vault. Anyone may pay; only an operator deposit of at least
    ///         `minPerPeriod` resets the cadence clock.
    function deposit(uint256 id, uint256 amount, bytes32 memo) external nonReentrant {
        Listing storage l = _get(id);
        Vault storage v = _vaults[id];
        if (amount == 0) revert BadParams();
        if (v.totalStaked == 0) revert NoStakers();

        uint256 fee = (amount * revenueFeeBps) / BPS;
        uint256 net = amount - fee;
        v.accPerShare += (net * PRECISION) / v.totalStaked;
        v.totalRevenue += net;
        v.deposits += 1;

        bool qualifying = msg.sender == l.operator && amount >= l.minPerPeriod;
        if (qualifying) l.lastDepositAt = uint64(block.timestamp);

        IERC20 pay = IERC20(l.payToken);
        pay.safeTransferFrom(msg.sender, address(this), amount);
        if (fee > 0) pay.safeTransfer(treasury, fee);

        emit RevenueDeposited(id, msg.sender, net, fee, memo, qualifying);
    }

    function claim(uint256 id) external nonReentrant returns (uint256 amount) {
        Listing storage l = _get(id);
        Vault storage v = _vaults[id];
        UserStake storage s = _stakes[id][msg.sender];
        _harvest(v, s);
        amount = s.owed;
        if (amount == 0) revert NothingToClaim();
        s.owed = 0;
        IERC20(l.payToken).safeTransfer(msg.sender, amount);
        emit Claimed(id, msg.sender, amount);
    }

    // ───────────────────────────── accountability ─────────────────────

    function topUpBond(uint256 id, uint256 amount) external nonReentrant {
        Listing storage l = _get(id);
        if (msg.sender != l.operator) revert NotOperator();
        if (amount == 0) revert BadParams();
        Vault storage v = _vaults[id];
        v.bond += amount;
        IERC20(l.payToken).safeTransferFrom(msg.sender, address(this), amount);
        emit BondToppedUp(id, amount, v.bond);
    }

    /// @notice Anyone can slash a defaulted operator's bond to the share-holders and keep a small tip.
    function slash(uint256 id) external nonReentrant {
        Listing storage l = _get(id);
        Vault storage v = _vaults[id];
        if (health(id) != Health.Defaulted) revert NotSlashable();
        uint256 b = v.bond;
        if (b == 0) revert NothingToSlash();

        v.bond = 0;
        l.strikes += 1;
        uint256 tip = (b * slashTipBps) / BPS;
        uint256 toHolders = b - tip;

        IERC20 pay = IERC20(l.payToken);
        if (v.totalStaked == 0) {
            // nobody to compensate: the remainder goes to the treasury rather than back to the defaulter
            pay.safeTransfer(treasury, toHolders);
            toHolders = 0;
        } else {
            v.accPerShare += (toHolders * PRECISION) / v.totalStaked;
            v.totalRevenue += toHolders;
        }
        if (tip > 0) pay.safeTransfer(msg.sender, tip);
        emit Slashed(id, msg.sender, toHolders, tip, l.strikes);
    }

    /// @notice Operator ends the listing. Holders keep full claim rights; the bond unlocks after two cadences.
    function windDown(uint256 id) external nonReentrant {
        Listing storage l = _get(id);
        if (msg.sender != l.operator) revert NotOperator();
        if (l.closedAt != 0) revert AlreadyWoundDown();
        Vault storage v = _vaults[id];
        uint256 back = v.forSale;
        l.closedAt = uint64(block.timestamp);
        l.saleOpen = false;
        v.forSale = 0;
        if (back > 0) IERC20(shareToken(l.assetId)).safeTransfer(l.operator, back);
        emit WoundDown(id);
    }

    function withdrawBond(uint256 id) external nonReentrant {
        Listing storage l = _get(id);
        if (msg.sender != l.operator) revert NotOperator();
        if (l.closedAt == 0 || block.timestamp < l.closedAt + 2 * uint256(l.cadence)) revert StillWindingDown();
        Vault storage v = _vaults[id];
        uint256 b = v.bond;
        if (b == 0) revert NothingToSlash();
        v.bond = 0;
        IERC20(l.payToken).safeTransfer(l.operator, b);
        emit BondWithdrawn(id, b);
    }

    // ───────────────────────────── views ──────────────────────────────

    function health(uint256 id) public view returns (Health) {
        Listing storage l = _get(id);
        if (l.closedAt != 0) return Health.WoundDown;
        uint256 overdue = block.timestamp - l.lastDepositAt;
        if (overdue <= l.cadence) return Health.Healthy;
        if (overdue <= 2 * uint256(l.cadence)) return Health.Late;
        return Health.Defaulted;
    }

    /// @notice Seconds until the operator becomes slashable (0 if already).
    function secondsUntilSlashable(uint256 id) external view returns (uint256) {
        Listing storage l = _get(id);
        if (l.closedAt != 0) return type(uint256).max;
        uint256 deadline = uint256(l.lastDepositAt) + 2 * uint256(l.cadence);
        return block.timestamp >= deadline ? 0 : deadline - block.timestamp;
    }

    function pending(uint256 id, address who) public view returns (uint256) {
        _get(id);
        Vault storage v = _vaults[id];
        UserStake storage s = _stakes[id][who];
        return s.owed + (s.amount * v.accPerShare) / PRECISION - s.debt;
    }

    function stakeOf(uint256 id, address who) external view returns (uint256) {
        return _stakes[id][who].amount;
    }

    function listingCount() external view returns (uint256) {
        return _listings.length;
    }

    function idOfAsset(uint32 assetId) external view returns (bool found, uint256 id) {
        uint256 x = _idPlusOneByAsset[assetId];
        return (x != 0, x == 0 ? 0 : x - 1);
    }

    function getListing(uint256 id) external view returns (Listing memory l, Vault memory v, Health h) {
        l = _get(id);
        v = _vaults[id];
        h = health(id);
    }

    /// @notice A page of listings in one call, so the explore page needs a single dry-run.
    function getListings(uint256 offset, uint256 limit)
        external
        view
        returns (Listing[] memory ls, Vault[] memory vs, Health[] memory hs)
    {
        uint256 n = _listings.length;
        uint256 end = offset >= n ? offset : (offset + limit > n ? n : offset + limit);
        uint256 len = end - offset;
        ls = new Listing[](len);
        vs = new Vault[](len);
        hs = new Health[](len);
        for (uint256 i; i < len; i++) {
            ls[i] = _listings[offset + i];
            vs[i] = _vaults[offset + i];
            hs[i] = health(offset + i);
        }
    }

    struct Position {
        uint256 id;
        uint256 staked;
        uint256 pending;
    }

    /// @notice All positions of `who` in a single call (used by the portfolio page).
    function positionsOf(address who, uint256 offset, uint256 limit) external view returns (Position[] memory out) {
        uint256 n = _listings.length;
        if (offset >= n) return new Position[](0);
        uint256 end = offset + limit > n ? n : offset + limit;
        Position[] memory tmp = new Position[](end - offset);
        uint256 c;
        for (uint256 i = offset; i < end; i++) {
            UserStake storage s = _stakes[i][who];
            uint256 p = pending(i, who);
            if (s.amount != 0 || p != 0) tmp[c++] = Position(i, s.amount, p);
        }
        out = new Position[](c);
        for (uint256 j; j < c; j++) out[j] = tmp[j];
    }

    // ───────────────────────────── admin ──────────────────────────────

    function setFees(uint16 saleBps, uint16 revenueBps) external onlyOwner {
        if (saleBps > 500 || revenueBps > 500) revert BadParams();
        saleFeeBps = saleBps;
        revenueFeeBps = revenueBps;
    }

    function setRules(uint16 minBond, uint16 slashTip, uint64 minCadence_) external onlyOwner {
        if (minBond > 5_000 || slashTip > 1_000 || minCadence_ == 0) revert BadParams();
        minBondBps = minBond;
        slashTipBps = slashTip;
        minCadence = minCadence_;
    }

    function setTreasury(address t) external onlyOwner {
        if (t == address(0)) revert BadParams();
        treasury = t;
    }

    function transferOwnership(address o) external onlyOwner {
        if (o == address(0)) revert BadParams();
        owner = o;
    }

    // ───────────────────────────── internals ──────────────────────────

    function _credit(uint256 id, address who, uint256 amount) private {
        Vault storage v = _vaults[id];
        UserStake storage s = _stakes[id][who];
        _harvest(v, s);
        s.amount += amount;
        v.totalStaked += amount;
        s.debt = (s.amount * v.accPerShare) / PRECISION;
    }

    function _harvest(Vault storage v, UserStake storage s) private {
        if (s.amount == 0) return;
        uint256 accrued = (s.amount * v.accPerShare) / PRECISION;
        s.owed += accrued - s.debt;
        s.debt = accrued;
    }
}
