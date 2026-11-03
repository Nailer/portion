// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test} from "forge-std/Test.sol";
import {PortionCoreV2} from "../src/candidates/PortionCoreV2.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @dev Random callers drive two Core v2 raises through funding, tranches, refunds and default. Calls that the
///      contract refuses are ignored; calls it accepts update the ghost totals the invariants compare against.
contract PortionCoreV2Handler is Test {
    PortionCoreV2 public immutable core;
    address public immutable operator;
    address public immutable reviewer;
    address public immutable guardian;
    address[3] public holders;
    uint32[2] public assets;

    mapping(uint32 => uint256) public claimed;
    mapping(uint32 => uint256) public allocated;
    mapping(uint32 => uint256) public returnedShares;
    uint256 public treasuryFees;
    uint256 public roundings;
    uint256 public stakeChanges;

    constructor(PortionCoreV2 core_, address operator_, address reviewer_, address guardian_, address[3] memory holders_, uint32[2] memory assets_) {
        core = core_;
        operator = operator_;
        reviewer = reviewer_;
        guardian = guardian_;
        holders = holders_;
        assets = assets_;
    }

    function _holder(uint256 seed) private view returns (address) { return holders[seed % holders.length]; }
    function _asset(uint256 seed) private view returns (uint32) { return assets[seed % assets.length]; }

    /// @dev Random calls rarely line up a whole raise or tranche, so these two steps walk the path and leave the rest random.
    function settleRaise(uint256 who, uint256 which, uint256 amount) external {
        uint32 asset = _asset(which);
        PortionCoreV2.Listing memory l = core.listing(asset);
        amount = bound(amount, 1, l.forSale == 0 ? 1 : l.forSale);
        if (l.minSold > l.sold + amount && l.minSold - l.sold <= l.forSale) amount = l.minSold - l.sold;
        vm.prank(_holder(who));
        try core.buy(asset, amount) { stakeChanges++; roundings++; } catch {}
        if (l.phase != PortionCoreV2.Phase.Funding) return;
        vm.warp(l.deadline + 1);
        uint256 unsold = core.listing(asset).forSale;
        try core.finalize(asset) { returnedShares[asset] += unsold; } catch {}
    }

    function releaseTranche(uint256 which, bytes32 evidence) external {
        uint32 asset = _asset(which);
        PortionCoreV2.Listing memory l = core.listing(asset);
        vm.prank(operator);
        try core.propose(asset, evidence) {} catch {}
        vm.prank(reviewer);
        try core.approve(asset) {} catch {}
        vm.warp(vm.getBlockTimestamp() + l.cadence);
        vm.prank(operator);
        try core.deposit(asset, l.minimum) {
            treasuryFees += l.minimum / 200;
            allocated[asset] += l.minimum - l.minimum / 200;
            roundings++;
        } catch {}
        uint256 before = core.listing(asset).released;
        try core.release(asset) {
            treasuryFees += (core.listing(asset).released - before) / 100;
        } catch {}
    }

    function buy(uint256 who, uint256 which, uint256 amount) external {
        uint32 asset = _asset(which);
        uint256 left = core.listing(asset).forSale;
        amount = bound(amount, 1, left == 0 ? 1 : left);
        vm.prank(_holder(who));
        try core.buy(asset, amount) { stakeChanges++; roundings++; } catch {}
    }

    function finalize(uint256 which) external {
        uint32 asset = _asset(which);
        uint256 unsold = core.listing(asset).forSale;
        try core.finalize(asset) { returnedShares[asset] += unsold; } catch {}
    }

    /// @dev Attempted rarely, because cancelling early would otherwise end most runs in their first calls.
    function cancel(uint256 which, uint256 chance) external {
        if (chance % 32 != 0) return;
        uint32 asset = _asset(which);
        PortionCoreV2.Listing memory l = core.listing(asset);
        vm.prank(operator);
        try core.cancel(asset) { if (!l.activated) returnedShares[asset] += l.forSale; } catch {}
    }

    function refund(uint256 who, uint256 which) external {
        uint32 asset = _asset(which);
        vm.prank(_holder(who));
        try core.refund(asset) {
            roundings++;
            if (!core.listing(asset).activated) stakeChanges++;
        } catch {}
    }

    function propose(uint256 which, bytes32 evidence) external {
        vm.prank(operator);
        try core.propose(_asset(which), evidence) {} catch {}
    }

    function approveTranche(uint256 which) external {
        vm.prank(reviewer);
        try core.approve(_asset(which)) {} catch {}
    }

    function challenge(uint256 who, uint256 which, uint256 chance) external {
        if (chance % 8 != 0) return;
        vm.prank(_holder(who));
        try core.challenge(_asset(which)) {} catch {}
    }

    function release(uint256 which) external {
        uint32 asset = _asset(which);
        PortionCoreV2.Listing memory l = core.listing(asset);
        try core.release(asset) {
            treasuryFees += (core.listing(asset).released - l.released) / 100;
        } catch {}
    }

    function lapse(uint256 which) external {
        try core.lapse(_asset(which)) {} catch {}
    }

    function stake(uint256 who, uint256 which, uint256 amount) external {
        uint32 asset = _asset(which);
        address holder = _holder(who);
        uint256 held = core.shareToken(asset).balanceOf(holder);
        amount = bound(amount, 1, held == 0 ? 1 : held);
        vm.prank(holder);
        try core.stake(asset, amount) { stakeChanges++; roundings++; } catch {}
    }

    /// @dev The contract must refuse both; the invariant below fails if either is ever accepted.
    function insiderTakesStake(uint256 which, bool asOperator, bool bySale) external {
        uint32 asset = _asset(which);
        address insider = asOperator ? operator : reviewer;
        vm.prank(insider);
        if (bySale) {
            try core.buy(asset, 1) { stakeChanges++; roundings++; } catch {}
        } else {
            try core.stake(asset, 1) { stakeChanges++; roundings++; } catch {}
        }
    }

    function unstake(uint256 who, uint256 which, uint256 amount) external {
        uint32 asset = _asset(which);
        address holder = _holder(who);
        (uint256 held,,) = core.stakes(asset, holder);
        amount = bound(amount, 1, held == 0 ? 1 : held);
        vm.prank(holder);
        try core.unstake(asset, amount) { stakeChanges++; roundings++; } catch {}
    }

    function deposit(uint256 who, uint256 which, uint256 amount) external {
        uint32 asset = _asset(which);
        amount = bound(amount, 1, 1_000_000e6);
        address from = who % 2 == 0 ? operator : _holder(who);
        vm.prank(from);
        try core.deposit(asset, amount) {
            treasuryFees += amount / 200;
            allocated[asset] += amount - amount / 200;
            roundings++;
        } catch {}
    }

    function claim(uint256 who, uint256 which) external {
        uint32 asset = _asset(which);
        vm.prank(_holder(who));
        try core.claim(asset) returns (uint256 amount) {
            claimed[asset] += amount;
            roundings++;
        } catch {}
    }

    function topUp(uint256 which, uint256 amount) external {
        amount = bound(amount, 1, 1_000e6);
        vm.prank(operator);
        try core.topUp(_asset(which), amount) {} catch {}
    }

    function slash(uint256 who, uint256 which) external {
        uint32 asset = _asset(which);
        uint256 bond = core.listing(asset).bond;
        vm.prank(_holder(who));
        try core.slash(asset) {
            allocated[asset] += bond - bond / 100;
            roundings++;
        } catch {}
    }

    function noticeWindDown(uint256 which, uint256 chance) external {
        if (chance % 32 != 0) return;
        vm.prank(operator);
        try core.noticeWindDown(_asset(which)) {} catch {}
    }

    function windDown(uint256 which) external {
        vm.prank(operator);
        try core.windDown(_asset(which)) {} catch {}
    }

    function withdrawBond(uint256 which) external {
        vm.prank(operator);
        try core.withdrawBond(_asset(which)) {} catch {}
    }

    function pause() external {
        vm.prank(guardian);
        try core.pause() {} catch {}
    }

    function unpause() external {
        vm.prank(guardian);
        try core.unpause() {} catch {}
    }

    /// @dev `block.timestamp` is cached within a function under via_ir, so time advances from the VM's value.
    function advance(uint256 secs) external {
        vm.warp(vm.getBlockTimestamp() + bound(secs, 1, 10 days));
    }
}

/// @notice Properties of the Core v2 candidate that must hold after any sequence of calls.
contract PortionCoreV2InvariantTest is StdInvariant, Test {
    PortionCoreV2 core;
    MockERC20 pay;
    PortionCoreV2Handler handler;
    address operator = address(0xA11CE);
    address reviewer = address(0x2E71E3);
    address recovery = address(0xCA201);
    address guardian = address(0x6A11);
    address treasury = address(0xFEE);
    address[3] holders = [address(0xA1), address(0xB0B), address(0xDA7E)];
    uint32[2] assets = [uint32(7777), uint32(8888)];
    uint256[2] offered = [uint256(80), 1000];

    function setUp() public {
        pay = new MockERC20();
        core = new PortionCoreV2(address(pay), treasury, guardian, 1);
        handler = new PortionCoreV2Handler(core, operator, reviewer, guardian, holders, assets);
        pay.mint(operator, 1e18);
        vm.prank(operator);
        pay.approve(address(core), type(uint256).max);
        for (uint256 a; a < holders.length; a++) {
            pay.mint(holders[a], 1e18);
            vm.prank(holders[a]);
            pay.approve(address(core), type(uint256).max);
        }
        uint256[2] memory supply = [uint256(100), 1000];
        uint256[2] memory price = [uint256(10e6), 1e6];
        uint256[2] memory minSold = [uint256(40), 100];
        uint16[] memory parts = new uint16[](3);
        parts[0] = 3333; parts[1] = 3333; parts[2] = 3334;
        for (uint256 i; i < assets.length; i++) {
            address token = address(core.shareToken(assets[i]));
            vm.etch(token, address(new MockERC20()).code);
            MockERC20(token).mint(operator, supply[i]);
            vm.prank(operator);
            MockERC20(token).approve(address(core), type(uint256).max);
            for (uint256 a; a < holders.length; a++) {
                vm.prank(holders[a]);
                MockERC20(token).approve(address(core), type(uint256).max);
            }
            vm.prank(operator);
            core.create(PortionCoreV2.Terms(assets[i], supply[i], offered[i], 7 days, price[i], 200e6, 50e6 + offered[i] * price[i] / 20,
                keccak256(abi.encode(i)), recovery, reviewer, minSold[i], vm.getBlockTimestamp() + 30 days, parts));
            vm.prank(reviewer);
            core.attest(assets[i], keccak256("evidence"));
        }
        targetContract(address(handler));
    }

    /// Every payment unit is accounted for: what the contract holds plus what was claimed equals bonds, unreleased escrow and allocated income.
    function invariant_paymentBalanceEqualsObligations() public view {
        uint256 obligations;
        uint256 claimed;
        for (uint256 i; i < assets.length; i++) {
            PortionCoreV2.Listing memory l = core.listing(assets[i]);
            obligations += l.bond + core.escrowed(assets[i]) + handler.allocated(assets[i]);
            claimed += handler.claimed(assets[i]);
        }
        assertEq(pay.balanceOf(address(core)) + claimed, obligations);
    }

    /// Holders and the reserve are owed what was allocated, within rounding: see PortionCoreRoundingTest.
    function invariant_holdersOwedMatchesIncomeWithinRounding() public view {
        for (uint256 i; i < assets.length; i++) {
            uint256 allocated = handler.allocated(assets[i]);
            uint256 owed = handler.claimed(assets[i]) + core.listing(assets[i]).reserve;
            for (uint256 a; a < holders.length; a++) owed += core.pending(assets[i], holders[a]);
            assertLe(owed, allocated + handler.stakeChanges());
            assertLe(allocated, owed + handler.roundings() + holders.length);
        }
    }

    /// Purchase money only ever leaves as an approved tranche or a refund, and refunds never exceed the pool.
    function invariant_escrowIsConserved() public view {
        for (uint256 i; i < assets.length; i++) {
            PortionCoreV2.Listing memory l = core.listing(assets[i]);
            assertLe(l.released + l.refunded, l.raised);
            assertLe(l.refunded, l.refundPool);
            assertLe(l.nextTranche, 3);
            assertEq(l.raised, l.sold * l.price);
            if (l.phase == PortionCoreV2.Phase.Refunding) assertEq(l.refundPool, l.raised - l.released);
            if (!l.activated) assertEq(l.released, 0);
        }
    }

    /// Every share the contract holds is either still for sale or staked by someone.
    function invariant_shareBalanceEqualsForSalePlusStaked() public view {
        for (uint256 i; i < assets.length; i++) {
            PortionCoreV2.Listing memory l = core.listing(assets[i]);
            assertEq(core.shareToken(assets[i]).balanceOf(address(core)), l.forSale + l.staked);
        }
    }

    function invariant_stakedEqualsSumOfStakes() public view {
        for (uint256 i; i < assets.length; i++) {
            uint256 sum;
            for (uint256 a; a < holders.length; a++) {
                (uint256 amount,,) = core.stakes(assets[i], holders[a]);
                sum += amount;
            }
            assertEq(core.listing(assets[i]).staked, sum);
        }
    }

    /// The treasury receives exactly 1% of released tranches and 0.5% of deposits, and never a slashed bond.
    function invariant_treasuryReceivesExactlyTheFees() public view {
        assertEq(pay.balanceOf(treasury), handler.treasuryFees());
    }

    /// An operator or reviewer cannot hold stake in the listing.
    function invariant_operatorAndReviewerNeverStake() public view {
        for (uint256 i; i < assets.length; i++) {
            (uint256 op,,) = core.stakes(assets[i], operator);
            (uint256 rev,,) = core.stakes(assets[i], reviewer);
            assertEq(op + rev, 0);
        }
    }
}

/// @notice Finding C10 in the candidate: the same rounding as deployed v1, found by the invariants.
contract PortionCoreV2RoundingTest is Test {
    function test_C10_holdersAreOwedOneUnitMoreThanWasDeposited() public {
        address operator = address(0xA11CE);
        address alice = address(0xA1);
        address bob = address(0xB0B);
        uint32 asset = 7777;
        MockERC20 pay = new MockERC20();
        PortionCoreV2 core = new PortionCoreV2(address(pay), address(0xFEE), address(0), 1);
        address token = address(core.shareToken(asset));
        vm.etch(token, address(new MockERC20()).code);
        MockERC20 shares = MockERC20(token);
        shares.mint(operator, 100);
        address[3] memory who = [operator, alice, bob];
        for (uint256 i; i < who.length; i++) {
            pay.mint(who[i], 1e18);
            vm.startPrank(who[i]);
            pay.approve(address(core), type(uint256).max);
            shares.approve(address(core), type(uint256).max);
            vm.stopPrank();
        }
        uint16[] memory parts = new uint16[](1);
        parts[0] = 10_000;
        vm.prank(operator);
        core.create(PortionCoreV2.Terms(asset, 100, 100, 7 days, 1e6, 200e6, 50e6, keccak256("terms"), address(0xCA201), address(0x2E71E3), 1,
            vm.getBlockTimestamp() + 30 days, parts));
        vm.prank(address(0x2E71E3));
        core.attest(asset, keccak256("evidence"));
        vm.prank(alice); core.buy(asset, 3);
        vm.prank(bob); core.buy(asset, 1);
        vm.warp(vm.getBlockTimestamp() + 30 days + 1);
        core.finalize(asset);
        vm.prank(alice); core.unstake(asset, 1);
        vm.prank(operator); core.deposit(asset, 2);
        vm.prank(alice); core.stake(asset, 1);
        vm.prank(operator); core.deposit(asset, 3);
        vm.prank(alice); core.unstake(asset, 1);
        vm.prank(operator); core.deposit(asset, 2);
        assertEq(core.listing(asset).revenue, 7);
        assertEq(core.pending(asset, alice) + core.pending(asset, bob), 8);
    }
}
