// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test} from "forge-std/Test.sol";
import {PortionCore} from "../src/PortionCore.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @dev Random callers drive two listings that share one payment-token balance. Calls that the contract
///      refuses are ignored; calls it accepts update the ghost totals the invariants compare against.
contract PortionCoreHandler is Test {
    PortionCore public immutable core;
    MockERC20 public immutable pay;
    address public immutable treasury;
    address public immutable operator;
    address[3] public actors;
    uint32[2] public assets;

    mapping(uint32 => uint256) public claimed;
    mapping(uint32 => uint256) public returnedShares;
    uint256 public treasuryFees;
    uint256 public accepted;
    /// @dev Accepted calls that can round an allocation down by under one unit.
    uint256 public roundings;
    /// @dev Accepted calls that change a stake. Each can over-allocate by under one unit: see PortionCoreRoundingTest.
    uint256 public stakeChanges;
    /// @dev Set if the contract ever accepts new money into a defaulted listing.
    bool public acceptedWhileDefaulted;

    constructor(PortionCore core_, MockERC20 pay_, address treasury_, address operator_, address[3] memory actors_, uint32[2] memory assets_) {
        core = core_;
        pay = pay_;
        treasury = treasury_;
        operator = operator_;
        actors = actors_;
        assets = assets_;
    }

    function _actor(uint256 seed) private view returns (address) { return actors[seed % actors.length]; }
    function _asset(uint256 seed) private view returns (uint32) { return assets[seed % assets.length]; }

    function buy(uint256 who, uint256 which, uint256 amount) external {
        uint32 asset = _asset(which);
        PortionCore.Listing memory l = core.listing(asset);
        amount = bound(amount, 1, l.forSale == 0 ? 1 : l.forSale);
        bool defaulted = core.health(asset) >= 2;
        vm.prank(_actor(who));
        try core.buy(asset, amount) {
            if (defaulted) acceptedWhileDefaulted = true;
            treasuryFees += amount * l.price / 100;
            accepted++;
            roundings++;
            stakeChanges++;
        } catch {}
    }

    function stake(uint256 who, uint256 which, uint256 amount) external {
        uint32 asset = _asset(which);
        address actor = _actor(who);
        uint256 held = core.shareToken(asset).balanceOf(actor);
        amount = bound(amount, 1, held == 0 ? 1 : held);
        bool defaulted = core.health(asset) == 2;
        vm.prank(actor);
        try core.stake(asset, amount) {
            if (defaulted) acceptedWhileDefaulted = true;
            accepted++;
            roundings++;
            stakeChanges++;
        } catch {}
    }

    function unstake(uint256 who, uint256 which, uint256 amount) external {
        uint32 asset = _asset(which);
        address actor = _actor(who);
        (uint256 held,,) = core.stakes(asset, actor);
        amount = bound(amount, 1, held == 0 ? 1 : held);
        vm.prank(actor);
        try core.unstake(asset, amount) {
            accepted++;
            roundings++;
            stakeChanges++;
        } catch {}
    }

    function deposit(uint256 who, uint256 which, uint256 amount) external {
        amount = bound(amount, 1, 1_000_000e6);
        vm.prank(_actor(who));
        try core.deposit(_asset(which), amount) {
            treasuryFees += amount / 200;
            accepted++;
            roundings++;
        } catch {}
    }

    function claim(uint256 who, uint256 which) external {
        uint32 asset = _asset(which);
        vm.prank(_actor(who));
        try core.claim(asset) returns (uint256 amount) {
            claimed[asset] += amount;
            accepted++;
            roundings++;
        } catch {}
    }

    function topUp(uint256 which, uint256 amount) external {
        amount = bound(amount, 1, 1_000e6);
        vm.prank(operator);
        try core.topUp(_asset(which), amount) { accepted++; } catch {}
    }

    function slash(uint256 who, uint256 which) external {
        uint32 asset = _asset(which);
        PortionCore.Listing memory l = core.listing(asset);
        vm.prank(_actor(who));
        try core.slash(asset) {
            if (l.staked == 0) treasuryFees += l.bond - l.bond / 100;
            accepted++;
            roundings++;
        } catch {}
    }

    function closeSale(uint256 which) external {
        uint32 asset = _asset(which);
        uint256 unsold = core.listing(asset).forSale;
        vm.prank(operator);
        try core.closeSale(asset) {
            returnedShares[asset] += unsold;
            accepted++;
        } catch {}
    }

    /// @dev Attempted rarely, because a wind-down with nothing staked would otherwise end most runs in their first calls.
    function windDown(uint256 which, uint256 chance) external {
        if (chance % 32 != 0) return;
        uint32 asset = _asset(which);
        uint256 unsold = core.listing(asset).forSale;
        vm.prank(operator);
        try core.windDown(asset) {
            returnedShares[asset] += unsold;
            accepted++;
        } catch {}
    }

    function withdrawBond(uint256 which) external {
        vm.prank(operator);
        try core.withdrawBond(_asset(which)) { accepted++; } catch {}
    }

    /// @dev `block.timestamp` is cached within a function under via_ir, so time advances from the VM's value.
    function advance(uint256 secs) external {
        vm.warp(vm.getBlockTimestamp() + bound(secs, 1, 10 days));
    }
}

/// @notice Properties of the deployed Core v1 that must hold after any sequence of calls.
contract PortionCoreInvariantTest is StdInvariant, Test {
    PortionCore core;
    MockERC20 pay;
    PortionCoreHandler handler;
    address operator = address(0xA11CE);
    address treasury = address(0xFEE);
    address[3] actors = [operator, address(0xA1), address(0xB0B)];
    uint32[2] assets = [uint32(7777), uint32(8888)];
    uint256[2] offered = [80, 1000];

    function setUp() public {
        pay = new MockERC20();
        core = new PortionCore(address(pay), treasury, 1);
        handler = new PortionCoreHandler(core, pay, treasury, operator, actors, assets);
        uint256[2] memory supply = [uint256(100), 1000];
        uint256[2] memory price = [uint256(10e6), 1e6];
        uint256[2] memory cadence = [uint256(7 days), 1 days];
        for (uint256 i; i < assets.length; i++) {
            address token = address(core.shareToken(assets[i]));
            vm.etch(token, address(new MockERC20()).code);
            MockERC20(token).mint(operator, supply[i]);
            for (uint256 a; a < actors.length; a++) {
                vm.prank(actors[a]);
                MockERC20(token).approve(address(core), type(uint256).max);
            }
            for (uint256 a; a < actors.length && i == 0; a++) {
                pay.mint(actors[a], 1e18);
                vm.prank(actors[a]);
                pay.approve(address(core), type(uint256).max);
            }
            vm.prank(operator);
            core.create(PortionCore.Terms(assets[i], supply[i], offered[i], cadence[i], price[i], 20e6, 50e6 + offered[i] * price[i] / 20, keccak256(abi.encode(i))));
        }
        targetContract(address(handler));
    }

    /// Every payment unit is accounted for: what the contract holds plus what was claimed equals bonds plus allocated income.
    function invariant_paymentBalanceEqualsObligations() public view {
        uint256 inflows;
        uint256 claimed;
        for (uint256 i; i < assets.length; i++) {
            PortionCore.Listing memory l = core.listing(assets[i]);
            inflows += l.bond + l.revenue;
            claimed += handler.claimed(assets[i]);
        }
        assertEq(pay.balanceOf(address(core)) + claimed, inflows);
    }

    /// Holders are owed what was allocated, within rounding: at most one unit over per stake change, and only dust under.
    function invariant_holdersOwedMatchesIncomeWithinRounding() public view {
        for (uint256 i; i < assets.length; i++) {
            uint256 revenue = core.listing(assets[i]).revenue;
            uint256 owed = handler.claimed(assets[i]);
            for (uint256 a; a < actors.length; a++) owed += core.pending(assets[i], actors[a]);
            assertLe(owed, revenue + handler.stakeChanges());
            assertLe(revenue, owed + handler.roundings() + actors.length);
        }
    }

    /// Every share the contract holds is either still for sale or staked by someone.
    function invariant_shareBalanceEqualsForSalePlusStaked() public view {
        for (uint256 i; i < assets.length; i++) {
            PortionCore.Listing memory l = core.listing(assets[i]);
            assertEq(core.shareToken(assets[i]).balanceOf(address(core)), l.forSale + l.staked);
        }
    }

    function invariant_stakedEqualsSumOfStakes() public view {
        for (uint256 i; i < assets.length; i++) {
            uint256 sum;
            for (uint256 a; a < actors.length; a++) {
                (uint256 amount,,) = core.stakes(assets[i], actors[a]);
                sum += amount;
            }
            assertEq(core.listing(assets[i]).staked, sum);
        }
    }

    /// Shares offered are only ever sold, still for sale, or returned to the operator.
    function invariant_offeredSharesAreConserved() public view {
        for (uint256 i; i < assets.length; i++) {
            PortionCore.Listing memory l = core.listing(assets[i]);
            assertEq(l.forSale + l.sold + handler.returnedShares(assets[i]), offered[i]);
        }
    }

    /// The treasury receives exactly the published fees: 1% of sales, 0.5% of deposits, plus a bond slashed with nobody staked.
    function invariant_treasuryReceivesExactlyTheFees() public view {
        assertEq(pay.balanceOf(treasury), handler.treasuryFees());
    }

    function invariant_closedListingsHoldNoSharesOrStakes() public view {
        for (uint256 i; i < assets.length; i++) {
            PortionCore.Listing memory l = core.listing(assets[i]);
            if (l.closedAt != 0) {
                assertEq(l.staked, 0);
                assertEq(l.forSale, 0);
                assertFalse(l.saleOpen);
            }
            if (l.saleOpen) assertGt(l.forSale, 0);
        }
    }

    function invariant_defaultedListingsNeverTakeNewMoney() public view {
        assertFalse(handler.acceptedWhileDefaulted());
    }
}

/// @notice Finding C10, found by the invariants above. The reward debt is rounded down when a stake changes, so
///         a holder can be credited under one unit too much. These tests pass because the deployed v1 behaves this way.
contract PortionCoreRoundingTest is Test {
    PortionCore core;
    MockERC20 pay;
    MockERC20 shares;
    address operator = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0B);
    uint32 constant ASSET = 7777;
    uint256 constant BOND = 50e6;

    function setUp() public {
        pay = new MockERC20();
        core = new PortionCore(address(pay), address(0xFEE), 1);
        address token = address(core.shareToken(ASSET));
        vm.etch(token, address(new MockERC20()).code);
        shares = MockERC20(token);
        shares.mint(operator, 100);
        address[3] memory who = [operator, alice, bob];
        for (uint256 i; i < who.length; i++) {
            pay.mint(who[i], 1e18);
            vm.startPrank(who[i]);
            pay.approve(address(core), type(uint256).max);
            shares.approve(address(core), type(uint256).max);
            vm.stopPrank();
        }
        vm.prank(operator);
        core.create(PortionCore.Terms(ASSET, 100, 100, 7 days, 1e6, 1, BOND, keccak256("terms")));
        vm.prank(alice); core.buy(ASSET, 3);
        vm.prank(bob); core.buy(ASSET, 1);
        vm.prank(alice); core.unstake(ASSET, 1);
        vm.prank(operator); core.deposit(ASSET, 2);
        vm.prank(alice); core.stake(ASSET, 1);
        vm.prank(operator); core.deposit(ASSET, 3);
        vm.prank(alice); core.unstake(ASSET, 1);
        vm.prank(operator); core.deposit(ASSET, 2);
    }

    function test_C10_holdersAreOwedOneUnitMoreThanWasDeposited() public view {
        assertEq(core.listing(ASSET).revenue, 7);
        assertEq(core.pending(ASSET, alice) + core.pending(ASSET, bob), 8);
    }

    /// The extra unit comes out of whatever else the contract holds, here the bond.
    function test_C10_theExtraUnitComesFromTheBond() public {
        vm.prank(alice); core.claim(ASSET);
        vm.prank(bob); core.claim(ASSET);
        assertEq(pay.balanceOf(address(core)), BOND - 1);
        assertEq(core.listing(ASSET).bond, BOND);
    }

    /// With no other listing to draw on, the last payout is one unit short until someone sends that unit.
    function test_C10_lastPayoutFailsUntilTheShortfallIsCovered() public {
        vm.prank(alice); core.claim(ASSET);
        vm.prank(bob); core.claim(ASSET);
        vm.prank(alice); core.unstake(ASSET, 2);
        vm.prank(bob); core.unstake(ASSET, 1);
        vm.startPrank(operator);
        core.closeSale(ASSET);
        core.windDown(ASSET);
        vm.warp(vm.getBlockTimestamp() + 14 days);
        vm.expectRevert();
        core.withdrawBond(ASSET);
        pay.transfer(address(core), 1);
        core.withdrawBond(ASSET);
        vm.stopPrank();
        assertEq(pay.balanceOf(address(core)), 0);
    }
}
