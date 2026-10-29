// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PortionCore} from "../src/PortionCore.sol";
import {PortionCoreV2} from "../src/candidates/PortionCoreV2.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @dev Shared actors and token setup. Finding numbers refer to docs/MARKET-READINESS-REVIEW.md.
abstract contract LoopholeBase is Test {
    MockERC20 pay;
    MockERC20 shares;
    address operator = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0B);
    address carol = address(0xCA201);
    address dave = address(0xDA7E);
    address treasury = address(0xFEE);
    uint32 constant ASSET = 7777;

    /// @dev `block.timestamp` is cached within a function under via_ir, so time always advances from the VM's value.
    function _skip(uint256 secs) internal { vm.warp(vm.getBlockTimestamp() + secs); }
    function _fund(address core, address token) internal {
        vm.etch(token, address(new MockERC20()).code);
        shares = MockERC20(token);
        shares.mint(operator, 100);
        address[4] memory who = [operator, alice, bob, dave];
        for (uint256 i; i < who.length; i++) {
            pay.mint(who[i], 10_000_000e6);
            vm.startPrank(who[i]);
            pay.approve(core, type(uint256).max);
            shares.approve(core, type(uint256).max);
            vm.stopPrank();
        }
    }
}

/// @notice Each test demonstrates a loophole that exists in the deployed Core v1. They pass because v1 is exploitable.
contract CoreV1LoopholeTest is LoopholeBase {
    PortionCore core;

    function setUp() public {
        pay = new MockERC20();
        core = new PortionCore(address(pay), treasury, 1);
        _fund(address(core), address(core.shareToken(ASSET)));
    }
    function _create(uint256 forSale, uint256 minimum) private {
        vm.prank(operator);
        core.create(PortionCore.Terms(ASSET, 100, forSale, 7 days, 10e6, minimum, 50e6, keccak256("terms")));
    }

    /// C1: a 1-unit minimum and 1-unit deposits keep a 1,000 pUSD raise "on time" for a year.
    function test_C1_tokenDepositKeepsListingOnTime() public {
        _create(100, 1);
        vm.prank(alice); core.buy(ASSET, 100);
        for (uint256 week; week < 52; week++) {
            _skip(7 days);
            vm.prank(operator); core.deposit(ASSET, 1);
            assertEq(core.health(ASSET), 0);
        }
    }

    /// C2: the operator stakes its 90 retained shares; a 100 pUSD "deposit" returns 89.55 to it.
    function test_C2_operatorFakesRevenueThroughOwnStake() public {
        _create(10, 20e6);
        vm.prank(alice); core.buy(ASSET, 10);
        vm.prank(operator); core.stake(ASSET, 90);
        uint256 before = pay.balanceOf(operator);
        vm.prank(operator); core.deposit(ASSET, 100e6);
        vm.prank(operator); core.claim(ASSET);
        assertEq(core.listing(ASSET).revenue, 99_500_000, "record shows 99.5 pUSD of revenue");
        assertEq(before - pay.balanceOf(operator), 10_450_000, "it cost the operator 10.45 pUSD");
    }

    /// C3a: holders unstake, the operator cannot deposit, defaults, and the bond goes to the treasury.
    function test_C3_forcedDefaultSendsBondToTreasury() public {
        _create(100, 20e6);
        vm.prank(alice); core.buy(ASSET, 100);
        vm.prank(alice); core.unstake(ASSET, 100);
        vm.prank(operator); vm.expectRevert(PortionCore.Invalid.selector); core.deposit(ASSET, 20e6);
        _skip(14 days + 1);
        uint256 before = pay.balanceOf(treasury);
        vm.prank(bob); core.slash(ASSET);
        assertEq(pay.balanceOf(treasury) - before, 49_500_000);
    }

    /// C3b: with nothing staked the operator winds down at once and later takes the bond back.
    function test_C3_operatorExitsWithBondWhenNothingStaked() public {
        _create(100, 20e6);
        vm.prank(alice); core.buy(ASSET, 100);
        vm.prank(alice); core.unstake(ASSET, 100);
        vm.prank(operator); core.windDown(ASSET);
        vm.prank(alice); vm.expectRevert(PortionCore.Closed.selector); core.stake(ASSET, 100);
        _skip(14 days);
        uint256 before = pay.balanceOf(operator);
        vm.prank(operator); core.withdrawBond(ASSET);
        assertEq(pay.balanceOf(operator) - before, 50e6);
        assertEq(shares.balanceOf(alice), 100, "alice still holds every share, with no income or bond");
    }

    /// C4: a holder who unstaked cannot restake in default and receives none of the bond.
    function test_C4_unstakedHolderLosesBond() public {
        _create(100, 20e6);
        vm.prank(alice); core.buy(ASSET, 50);
        vm.prank(bob); core.buy(ASSET, 50);
        vm.prank(bob); core.unstake(ASSET, 50);
        _skip(14 days + 1);
        vm.prank(bob); vm.expectRevert(PortionCore.Protected.selector); core.stake(ASSET, 50);
        core.slash(ASSET);
        assertEq(core.pending(ASSET, alice), 49_500_000);
        assertEq(core.pending(ASSET, bob), 0);
    }

    /// C7: once the operator key is lost, no other address can keep the listing on time.
    function test_C7_lostOperatorKeyCannotBeReplaced() public {
        _create(100, 20e6);
        vm.prank(alice); core.buy(ASSET, 100);
        _skip(8 days);
        vm.prank(dave); core.deposit(ASSET, 20e6);
        _skip(7 days);
        assertEq(core.health(ASSET), 2, "a deposit from the replacement key never qualifies");
    }
}

/// @notice The same scenarios against the local v2 candidate, plus regressions of v1 behaviour that must survive.
contract PortionCoreV2Test is LoopholeBase {
    PortionCoreV2 core;
    uint256 constant MIN = 20e6;

    function setUp() public {
        pay = new MockERC20();
        core = new PortionCoreV2(address(pay), treasury, 1);
        _fund(address(core), address(core.shareToken(ASSET)));
    }
    function _terms(uint256 forSale, uint256 minimum, address recovery) private pure returns (PortionCoreV2.Terms memory) {
        return PortionCoreV2.Terms(ASSET, 100, forSale, 7 days, 10e6, minimum, 50e6, keccak256("terms"), recovery);
    }
    function _create(uint256 forSale) private { vm.prank(operator); core.create(_terms(forSale, MIN, carol)); }
    function _buy(address who, uint256 n) private { vm.prank(who); core.buy(ASSET, n); }
    function _deposit(address who, uint256 v) private { vm.prank(who); core.deposit(ASSET, v); }

    // ── C1 ──────────────────────────────────────────────────────────────────
    function test_C1_minimumMustAnnualiseToTwoPercentOfOffer() public {
        // Offer 100 × 10 pUSD = 1,000; 2% a year at a weekly cadence is 0.383562 pUSD per week.
        vm.startPrank(operator);
        vm.expectRevert(PortionCoreV2.Invalid.selector); core.create(_terms(100, 1, carol));
        vm.expectRevert(PortionCoreV2.Invalid.selector); core.create(_terms(100, 383_561, carol));
        core.create(_terms(100, 383_562, carol));
        vm.stopPrank();
    }
    function test_C1_tokenDepositsNoLongerKeepListingOnTime() public {
        _create(100); _buy(alice, 100);
        _skip(7 days); _deposit(operator, 1);
        _skip(7 days + 1); _deposit(operator, 1);
        assertEq(core.health(ASSET), 2);
    }

    // ── C2 ──────────────────────────────────────────────────────────────────
    function test_C2_operatorCannotStakeOrBuyOwnListing() public {
        _create(10);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Unauthorized.selector); core.stake(ASSET, 90);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Unauthorized.selector); core.buy(ASSET, 1);
    }
    function test_C2_everyOperatorDepositReachesOutsideHolders() public {
        _create(10); _buy(alice, 10);
        _deposit(operator, 100e6);
        assertEq(core.pending(ASSET, alice), 99_500_000);
        assertEq(core.listing(ASSET).revenue, 99_500_000);
    }
    function test_C2_thirdPartyDepositsAreNotTrackRecord() public {
        _create(100); _buy(alice, 10);
        _deposit(dave, 20e6);
        PortionCoreV2.Listing memory l = core.listing(ASSET);
        assertEq(l.revenue, 0);
        assertEq(l.otherDeposits, 19_900_000);
        assertEq(core.pending(ASSET, alice), 19_900_000);
    }

    // ── C3 ──────────────────────────────────────────────────────────────────
    function test_C3_depositWithNothingStakedIsHeldForHolders() public {
        _create(100); _buy(alice, 100);
        vm.prank(alice); core.unstake(ASSET, 100);
        _skip(7 days); _deposit(operator, MIN);
        assertEq(core.health(ASSET), 0, "the operator can still meet its obligation");
        assertEq(core.listing(ASSET).reserve, 19_900_000);
        vm.prank(alice); core.stake(ASSET, 100);
        assertEq(core.pending(ASSET, alice), 0, "the reserve is released with the next deposit, not on stake");
        _deposit(operator, MIN);
        assertEq(core.pending(ASSET, alice), 39_800_000);
        assertEq(core.listing(ASSET).reserve, 0);
    }
    function test_C3_slashWithNothingStakedNeverPaysTreasury() public {
        _create(100); _buy(alice, 100);
        vm.prank(alice); core.unstake(ASSET, 100);
        _skip(21 days + 1);
        uint256 before = pay.balanceOf(treasury);
        vm.prank(bob); core.slash(ASSET);
        assertEq(pay.balanceOf(treasury), before, "no bond reaches the treasury");
        assertEq(core.listing(ASSET).reserve, 49_500_000);
        vm.prank(alice); core.stake(ASSET, 100);
        _deposit(operator, MIN);
        assertEq(core.pending(ASSET, alice), 49_500_000 + 19_900_000);
    }
    function test_C3_windDownNeedsNoticeAndHoldersCanBlockIt() public {
        _create(100); _buy(alice, 100);
        vm.prank(alice); core.unstake(ASSET, 100);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Protected.selector); core.windDown(ASSET);
        vm.prank(operator); core.noticeWindDown(ASSET);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Invalid.selector); core.noticeWindDown(ASSET);
        _skip(7 days); _deposit(operator, MIN);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Protected.selector); core.windDown(ASSET);
        vm.prank(alice); core.stake(ASSET, 100);
        _skip(7 days); _deposit(operator, MIN);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Protected.selector); core.windDown(ASSET);
    }
    function test_C3_reserveBlocksWindDown() public {
        _create(100); _buy(alice, 100);
        vm.prank(alice); core.unstake(ASSET, 100);
        _deposit(operator, MIN);
        vm.prank(operator); core.noticeWindDown(ASSET);
        _skip(7 days); _deposit(operator, MIN);
        _skip(7 days); _deposit(operator, MIN);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Protected.selector); core.windDown(ASSET);
    }
    function test_C3_unsoldListingWindsDownAfterNotice() public {
        _create(100);
        vm.prank(operator); core.noticeWindDown(ASSET);
        _skip(14 days);
        vm.prank(operator); core.windDown(ASSET);
        assertEq(shares.balanceOf(operator), 100);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Closed.selector); core.deposit(ASSET, MIN);
        _skip(14 days);
        uint256 before = pay.balanceOf(operator);
        vm.prank(operator); core.withdrawBond(ASSET);
        assertEq(pay.balanceOf(operator) - before, 50e6);
    }

    // ── C4 ──────────────────────────────────────────────────────────────────
    function test_C4_unstakedHolderCanRestakeBeforeSlash() public {
        _create(100); _buy(alice, 50); _buy(bob, 50);
        vm.prank(bob); core.unstake(ASSET, 50);
        _skip(14 days + 1);
        assertEq(core.health(ASSET), 2);
        vm.prank(dave); vm.expectRevert(PortionCoreV2.Protected.selector); core.buy(ASSET, 1);
        vm.expectRevert(PortionCoreV2.Protected.selector); core.slash(ASSET);
        vm.prank(bob); core.stake(ASSET, 50);
        _skip(7 days);
        core.slash(ASSET);
        assertEq(core.pending(ASSET, alice), 24_750_000);
        assertEq(core.pending(ASSET, bob), 24_750_000);
        vm.expectRevert(PortionCoreV2.Protected.selector); core.slash(ASSET);
    }
    function test_C4_operatorCanCureBeforeSlash() public {
        _create(100); _buy(alice, 100);
        _skip(20 days);
        _deposit(operator, MIN);
        assertEq(core.health(ASSET), 0);
        _skip(21 days);
        vm.expectRevert(PortionCoreV2.Protected.selector); core.slash(ASSET);
    }

    // ── C7 ──────────────────────────────────────────────────────────────────
    function test_C7_recoveryReplacesOperatorAfterNotice() public {
        _create(100); _buy(alice, 100);
        vm.prank(carol); core.proposeOperator(ASSET, dave);
        vm.prank(dave); vm.expectRevert(PortionCoreV2.Protected.selector); core.acceptOperator(ASSET);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Protected.selector); core.proposeOperator(ASSET, bob);
        _skip(7 days);
        vm.prank(bob); vm.expectRevert(PortionCoreV2.Unauthorized.selector); core.acceptOperator(ASSET);
        vm.prank(dave); core.acceptOperator(ASSET);
        assertEq(core.listing(ASSET).operator, dave);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Unauthorized.selector); core.topUp(ASSET, 1);
        _skip(1 days);
        _deposit(dave, MIN);
        assertEq(core.listing(ASSET).lastDepositAt, vm.getBlockTimestamp(), "the new operator's deposit qualifies");
    }
    function test_C7_recoveryOverridesOperatorProposal() public {
        _create(100);
        vm.prank(operator); core.proposeOperator(ASSET, bob);
        vm.prank(carol); core.proposeOperator(ASSET, dave);
        _skip(7 days);
        vm.prank(bob); vm.expectRevert(PortionCoreV2.Unauthorized.selector); core.acceptOperator(ASSET);
        vm.prank(dave); core.acceptOperator(ASSET);
    }
    function test_C7_holderWithStakeCannotBecomeOperator() public {
        _create(100); _buy(alice, 10);
        vm.prank(operator); core.proposeOperator(ASSET, alice);
        _skip(7 days);
        vm.prank(alice); vm.expectRevert(PortionCoreV2.Protected.selector); core.acceptOperator(ASSET);
    }
    function test_C7_recoveryCannotBeTheOperator() public {
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Invalid.selector); core.create(_terms(100, MIN, operator));
    }

    // ── Regressions of v1 behaviour ─────────────────────────────────────────
    function test_feesSaleAndClaimMatchV1() public {
        _create(100);
        uint256 before = pay.balanceOf(operator);
        _buy(alice, 10);
        assertEq(pay.balanceOf(operator) - before, 99e6);
        assertEq(pay.balanceOf(treasury), 1e6);
        _deposit(operator, MIN);
        assertEq(core.pending(ASSET, alice), 19_900_000);
        vm.prank(alice); core.claim(ASSET);
        vm.prank(alice); vm.expectRevert(PortionCoreV2.Empty.selector); core.claim(ASSET);
        assertEq(pay.balanceOf(address(core)), 50e6);
    }
    function test_lateJoinerCannotClaimEarlierIncome() public {
        _create(100); _buy(alice, 10); _deposit(operator, MIN); _buy(bob, 10); _deposit(operator, MIN);
        assertEq(core.pending(ASSET, alice), 29_850_000);
        assertEq(core.pending(ASSET, bob), 9_950_000);
    }
    function test_defaultedListingCannotWindDownWithBond() public {
        _create(100);
        vm.prank(operator); core.noticeWindDown(ASSET);
        _skip(14 days + 1);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Protected.selector); core.windDown(ASSET);
    }

    /// Whatever the sequence, the contract holds enough to pay every claim, the reserve and the bond.
    function testFuzz_contractCoversObligations(uint8 a, uint8 b, uint64 d1, uint64 d2, bool unstakeA, bool slashIt) public {
        a = uint8(bound(a, 1, 60)); b = uint8(bound(b, 1, 40));
        d1 = uint64(bound(d1, MIN, 1_000_000e6)); d2 = uint64(bound(d2, MIN, 1_000_000e6));
        _create(100); _buy(alice, a); _buy(bob, b);
        _deposit(operator, d1);
        if (unstakeA) { vm.prank(alice); core.unstake(ASSET, a); }
        _deposit(dave, d2);
        if (slashIt) { _skip(21 days + 1); core.slash(ASSET); }
        PortionCoreV2.Listing memory l = core.listing(ASSET);
        uint256 owed = core.pending(ASSET, alice) + core.pending(ASSET, bob) + l.reserve + l.bond;
        assertLe(owed, pay.balanceOf(address(core)));
        assertLe(pay.balanceOf(address(core)) - owed, 4, "only rounding dust is left over");
    }
}
