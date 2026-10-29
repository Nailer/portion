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

/// @notice The same scenarios against the local v2 candidate, the new escrow, reviewer and pause rules,
///         and regressions of v1 behaviour that must survive.
contract PortionCoreV2Test is LoopholeBase {
    PortionCoreV2 core;
    address rev = address(0x2E71E3);
    address gal = address(0x6A11);
    uint256 constant MIN = 20e6;
    bytes32 constant EV = keccak256("evidence");

    function setUp() public {
        pay = new MockERC20();
        core = new PortionCoreV2(address(pay), treasury, gal, 1);
        _fund(address(core), address(core.shareToken(ASSET)));
    }
    function _terms(uint256 minimum, uint256 minSold) private view returns (PortionCoreV2.Terms memory t) {
        uint16[] memory parts = new uint16[](2);
        parts[0] = 5000; parts[1] = 5000;
        t = PortionCoreV2.Terms(ASSET, 100, 100, 7 days, 10e6, minimum, 50e6, keccak256("terms"), carol, rev, minSold,
            vm.getBlockTimestamp() + 30 days, parts);
    }
    function _launch(uint256 minSold) private {
        vm.prank(operator); core.create(_terms(MIN, minSold));
        vm.prank(rev); core.attest(ASSET, EV);
    }
    function _buy(address who, uint256 n) private { vm.prank(who); core.buy(ASSET, n); }
    function _deposit(address who, uint256 v) private { vm.prank(who); core.deposit(ASSET, v); }
    /// Sells a to alice and b to bob, then settles the raise (waiting for the deadline if not sold out).
    function _active(uint256 a, uint256 b) private {
        _launch(1);
        if (a > 0) _buy(alice, a);
        if (b > 0) _buy(bob, b);
        if (a + b < 100) _skip(30 days + 1);
        core.finalize(ASSET);
        assertTrue(core.listing(ASSET).activated);
    }
    function _approveTranche() private {
        vm.prank(operator); core.propose(ASSET, EV);
        vm.prank(rev); core.approve(ASSET);
    }

    // ── C1 ──────────────────────────────────────────────────────────────────
    function test_C1_minimumMustAnnualiseToTwoPercentOfOffer() public {
        // Offer 100 × 10 pUSD = 1,000; 2% a year at a weekly cadence is 0.383562 pUSD per week.
        vm.startPrank(operator);
        vm.expectRevert(PortionCoreV2.Invalid.selector); core.create(_terms(1, 1));
        vm.expectRevert(PortionCoreV2.Invalid.selector); core.create(_terms(383_561, 1));
        core.create(_terms(383_562, 1));
        vm.stopPrank();
    }
    function test_C1_tokenDepositsNoLongerKeepListingOnTime() public {
        _active(100, 0);
        _skip(7 days); _deposit(operator, 1);
        _skip(7 days + 1); _deposit(operator, 1);
        assertEq(core.health(ASSET), 2);
    }

    // ── C2 ──────────────────────────────────────────────────────────────────
    function test_C2_operatorAndReviewerCannotBuyOrStake() public {
        _launch(1);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Unauthorized.selector); core.buy(ASSET, 1);
        vm.prank(rev); vm.expectRevert(PortionCoreV2.Invalid.selector); core.buy(ASSET, 1);
        _buy(alice, 100); core.finalize(ASSET);
        vm.prank(alice); core.unstake(ASSET, 10);
        vm.prank(alice); shares.transfer(operator, 10);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Unauthorized.selector); core.stake(ASSET, 10);
    }
    function test_C2_thirdPartyDepositsAreNotTrackRecord() public {
        _active(10, 0);
        _deposit(dave, 20e6);
        PortionCoreV2.Listing memory l = core.listing(ASSET);
        assertEq(l.revenue, 0);
        assertEq(l.otherDeposits, 19_900_000);
        assertEq(core.pending(ASSET, alice), 19_900_000);
    }

    // ── C3 ──────────────────────────────────────────────────────────────────
    function test_C3_depositWithNothingStakedIsHeldForHolders() public {
        _active(100, 0);
        vm.prank(alice); core.unstake(ASSET, 100);
        _skip(7 days); _deposit(operator, MIN);
        assertEq(core.health(ASSET), 0, "the operator can still meet its obligation");
        assertEq(core.listing(ASSET).reserve, 19_900_000);
        vm.prank(alice); core.stake(ASSET, 100);
        assertEq(core.pending(ASSET, alice), 0, "the reserve is released with the next deposit, not on stake");
        _deposit(operator, MIN);
        assertEq(core.pending(ASSET, alice), 39_800_000);
    }
    function test_C3_slashWithNothingStakedNeverPaysTreasury() public {
        _active(100, 0);
        vm.prank(alice); core.unstake(ASSET, 100);
        _skip(21 days + 1);
        uint256 before = pay.balanceOf(treasury);
        vm.prank(bob); core.slash(ASSET);
        assertEq(pay.balanceOf(treasury), before, "no bond reaches the treasury");
        assertEq(core.listing(ASSET).reserve, 49_500_000);
    }
    function test_C3_windDownNeedsNoticeAndHoldersCanBlockIt() public {
        _active(100, 0);
        vm.prank(alice); core.unstake(ASSET, 100);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Protected.selector); core.windDown(ASSET);
        vm.prank(operator); core.noticeWindDown(ASSET);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Invalid.selector); core.noticeWindDown(ASSET);
        _skip(7 days);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Protected.selector); core.windDown(ASSET);
        vm.prank(alice); core.stake(ASSET, 100);
        _skip(7 days); _deposit(operator, MIN);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Protected.selector); core.windDown(ASSET);
    }
    function test_C3_reserveBlocksWindDown() public {
        _active(100, 0);
        vm.prank(alice); core.unstake(ASSET, 100);
        _deposit(operator, MIN);
        vm.prank(operator); core.noticeWindDown(ASSET);
        _skip(7 days); _deposit(operator, MIN);
        _skip(7 days); _deposit(operator, MIN);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Protected.selector); core.windDown(ASSET);
    }

    // ── C4 ──────────────────────────────────────────────────────────────────
    function test_C4_unstakedHolderCanRestakeBeforeSlash() public {
        _active(50, 50);
        vm.prank(bob); core.unstake(ASSET, 50);
        _skip(14 days + 1);
        assertEq(core.health(ASSET), 2);
        vm.expectRevert(PortionCoreV2.Protected.selector); core.slash(ASSET);
        vm.prank(bob); core.stake(ASSET, 50);
        _skip(7 days);
        core.slash(ASSET);
        assertEq(core.pending(ASSET, alice), 24_750_000);
        assertEq(core.pending(ASSET, bob), 24_750_000);
        vm.expectRevert(PortionCoreV2.Protected.selector); core.slash(ASSET);
    }
    function test_C4_operatorCanCureBeforeSlash() public {
        _active(100, 0);
        _skip(20 days); _deposit(operator, MIN);
        assertEq(core.health(ASSET), 0);
        _skip(21 days);
        vm.expectRevert(PortionCoreV2.Protected.selector); core.slash(ASSET);
    }

    // ── C5 escrow ───────────────────────────────────────────────────────────
    function test_C5_purchaseMoneyIsHeldNotPaidToOperator() public {
        _launch(50);
        uint256 before = pay.balanceOf(operator);
        _buy(alice, 10);
        assertEq(pay.balanceOf(operator), before, "nothing reaches the operator at purchase");
        assertEq(core.escrowed(ASSET), 100e6);
        vm.prank(alice); vm.expectRevert(PortionCoreV2.Protected.selector); core.unstake(ASSET, 10);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Protected.selector); core.deposit(ASSET, MIN);
    }
    function test_C5_failedRaiseRefundsInFullAndReturnsShares() public {
        _launch(50);
        _buy(alice, 10);
        vm.expectRevert(PortionCoreV2.Protected.selector); core.finalize(ASSET);
        _skip(30 days + 1);
        vm.prank(dave); vm.expectRevert(PortionCoreV2.Closed.selector); core.buy(ASSET, 1);
        core.finalize(ASSET);
        assertEq(shares.balanceOf(operator), 90, "unsold shares return at once");
        uint256 before = pay.balanceOf(alice);
        vm.prank(alice); core.refund(ASSET);
        assertEq(pay.balanceOf(alice) - before, 100e6, "made whole");
        assertEq(shares.balanceOf(operator), 100, "the refunded buyer's shares go back too");
        vm.prank(alice); vm.expectRevert(PortionCoreV2.Closed.selector); core.refund(ASSET);
        vm.prank(operator); core.withdrawBond(ASSET);
        assertEq(pay.balanceOf(address(core)), 0);
    }
    function test_C5_tranchesNeedReviewerAndChallengeWindow() public {
        _active(60, 40);
        vm.prank(operator); core.propose(ASSET, EV);
        vm.expectRevert(PortionCoreV2.Protected.selector); core.release(ASSET);
        vm.prank(alice); vm.expectRevert(PortionCoreV2.Unauthorized.selector); core.approve(ASSET);
        vm.prank(rev); core.approve(ASSET);
        vm.expectRevert(PortionCoreV2.Protected.selector); core.release(ASSET);
        _skip(7 days); _deposit(operator, MIN);
        uint256 op = pay.balanceOf(operator); uint256 fees = pay.balanceOf(treasury);
        core.release(ASSET);
        assertEq(pay.balanceOf(operator) - op, 495e6);
        assertEq(pay.balanceOf(treasury) - fees, 5e6 + 0, "1% of the tranche; the deposit fee was taken earlier");
        assertEq(core.escrowed(ASSET), 500e6);
        _approveTranche(); _skip(7 days); _deposit(operator, MIN);
        core.release(ASSET);
        assertEq(core.escrowed(ASSET), 0);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Invalid.selector); core.propose(ASSET, EV);
    }
    /// Waits past the challenge window so that only the missing approval can stop the release.
    function test_C5_unapprovedTrancheNeverReleases() public {
        _active(100, 0);
        vm.prank(operator); core.propose(ASSET, EV);
        _skip(7 days + 1); _deposit(operator, MIN);
        vm.expectRevert(PortionCoreV2.Protected.selector); core.release(ASSET);
        vm.prank(rev); core.approve(ASSET);
        vm.expectRevert(PortionCoreV2.Protected.selector); core.release(ASSET);
        _skip(7 days); _deposit(operator, MIN);
        core.release(ASSET);
        assertEq(core.escrowed(ASSET), 500e6);
    }
    function test_C5_defaultedOperatorGetsNoTranche() public {
        _active(100, 0);
        _skip(13 days);
        _approveTranche();
        _skip(7 days);
        assertEq(core.health(ASSET), 2);
        vm.expectRevert(PortionCoreV2.Protected.selector); core.release(ASSET);
    }
    function test_C5_twoChallengedTranchesRefundUnreleasedProRata() public {
        _active(60, 40);
        _approveTranche(); _skip(7 days); _deposit(operator, MIN); core.release(ASSET);
        vm.prank(operator); core.propose(ASSET, EV);
        vm.prank(bob); core.challenge(ASSET);
        vm.prank(rev); vm.expectRevert(PortionCoreV2.Protected.selector); core.approve(ASSET);
        core.lapse(ASSET);
        vm.prank(operator); core.propose(ASSET, EV);
        vm.prank(bob); core.challenge(ASSET);
        core.lapse(ASSET);
        assertEq(uint8(core.listing(ASSET).phase), uint8(PortionCoreV2.Phase.Refunding));
        uint256 a = pay.balanceOf(alice); uint256 b = pay.balanceOf(bob);
        vm.prank(alice); core.refund(ASSET);
        vm.prank(bob); core.refund(ASSET);
        assertEq(pay.balanceOf(alice) - a, 300e6);
        assertEq(pay.balanceOf(bob) - b, 200e6);
        assertEq(core.escrowed(ASSET), 0);
    }
    function test_C5_smallHolderCannotChallenge() public {
        _launch(1); _buy(alice, 95); _buy(dave, 5); core.finalize(ASSET);
        vm.prank(operator); core.propose(ASSET, EV);
        vm.prank(dave); vm.expectRevert(PortionCoreV2.Unauthorized.selector); core.challenge(ASSET);
    }
    function test_C5_operatorCancelAfterActivationReturnsUnreleased() public {
        _active(100, 0);
        vm.prank(operator); core.cancel(ASSET);
        uint256 before = pay.balanceOf(alice);
        vm.prank(alice); core.refund(ASSET);
        assertEq(pay.balanceOf(alice) - before, 1000e6);
        assertEq(shares.balanceOf(alice), 0, "shares stay staked; income continues");
        _deposit(operator, MIN);
        assertEq(core.pending(ASSET, alice), 19_900_000);
    }

    // ── C6 ──────────────────────────────────────────────────────────────────
    function test_C6_slashAlsoReturnsUnreleasedEscrow() public {
        _active(60, 40);
        _approveTranche(); _skip(7 days); _deposit(operator, MIN); core.release(ASSET);
        _skip(21 days + 1);
        core.slash(ASSET);
        assertEq(uint8(core.listing(ASSET).phase), uint8(PortionCoreV2.Phase.Refunding));
        uint256 a = pay.balanceOf(alice);
        vm.prank(alice); core.refund(ASSET);
        vm.prank(alice); core.claim(ASSET);
        // 60% of the 500 unreleased, plus 60% of the 49.5 slashed bond and of one 19.9 deposit.
        assertEq(pay.balanceOf(alice) - a, 300e6 + 29_700_000 + 11_940_000);
    }

    // ── C7 ──────────────────────────────────────────────────────────────────
    function test_C7_recoveryReplacesOperatorAfterNotice() public {
        _active(100, 0);
        vm.prank(carol); core.proposeOperator(ASSET, dave);
        vm.prank(dave); vm.expectRevert(PortionCoreV2.Protected.selector); core.acceptOperator(ASSET);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Protected.selector); core.proposeOperator(ASSET, bob);
        _skip(7 days);
        vm.prank(bob); vm.expectRevert(PortionCoreV2.Unauthorized.selector); core.acceptOperator(ASSET);
        vm.prank(dave); core.acceptOperator(ASSET);
        assertEq(core.listing(ASSET).operator, dave);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Unauthorized.selector); core.topUp(ASSET, 1);
        _skip(1 days); _deposit(dave, MIN);
        assertEq(core.listing(ASSET).lastDepositAt, vm.getBlockTimestamp(), "the new operator's deposit qualifies");
    }
    function test_C7_recoveryOverridesOperatorProposal() public {
        _launch(1);
        vm.prank(operator); core.proposeOperator(ASSET, bob);
        vm.prank(carol); core.proposeOperator(ASSET, dave);
        _skip(7 days);
        vm.prank(bob); vm.expectRevert(PortionCoreV2.Unauthorized.selector); core.acceptOperator(ASSET);
        vm.prank(dave); core.acceptOperator(ASSET);
    }
    function test_C7_stakeholderOrReviewerCannotBecomeOperator() public {
        _active(10, 0);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Invalid.selector); core.proposeOperator(ASSET, rev);
        vm.prank(operator); core.proposeOperator(ASSET, alice);
        _skip(7 days);
        vm.prank(alice); vm.expectRevert(PortionCoreV2.Protected.selector); core.acceptOperator(ASSET);
    }

    // ── C8 pause ────────────────────────────────────────────────────────────
    function test_C8_pauseStopsNewMoneyButNeverClaimsOrRefunds() public {
        _active(100, 0);
        _deposit(operator, MIN);
        vm.prank(alice); vm.expectRevert(PortionCoreV2.Unauthorized.selector); core.pause();
        vm.prank(gal); core.pause();
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Paused.selector); core.propose(ASSET, EV);
        _deposit(operator, MIN);
        vm.prank(alice); core.claim(ASSET);
        vm.prank(alice); core.unstake(ASSET, 1);
        vm.prank(operator); core.cancel(ASSET);
        vm.prank(alice); core.refund(ASSET);
        _skip(7 days);
        vm.prank(gal); vm.expectRevert(PortionCoreV2.Protected.selector); core.pause();
        _skip(7 days);
        vm.prank(gal); core.pause();
        vm.prank(gal); core.unpause();
    }
    function test_C8_pausedCreationAndBuying() public {
        vm.prank(gal); core.pause();
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Paused.selector); core.create(_terms(MIN, 1));
        _skip(7 days);
        _launch(1);
        vm.prank(gal); vm.expectRevert(PortionCoreV2.Protected.selector); core.pause();
    }
    function test_C8_lapseDuringPauseDoesNotCount() public {
        _active(100, 0);
        vm.prank(operator); core.propose(ASSET, EV);
        vm.prank(gal); core.pause();
        _skip(21 days + 1);
        core.lapse(ASSET);
        assertEq(core.listing(ASSET).lapses, 0);
    }
    function test_C8_noGuardianMeansNoPause() public {
        PortionCoreV2 open = new PortionCoreV2(address(pay), treasury, address(0), 1);
        vm.expectRevert(PortionCoreV2.Unauthorized.selector); open.pause();
    }

    // ── C9 reviewer ─────────────────────────────────────────────────────────
    function test_C9_noSaleBeforeNamedReviewerAttests() public {
        vm.prank(operator); core.create(_terms(MIN, 1));
        vm.prank(alice); vm.expectRevert(PortionCoreV2.Closed.selector); core.buy(ASSET, 1);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Unauthorized.selector); core.attest(ASSET, EV);
        vm.prank(rev); vm.expectRevert(PortionCoreV2.Invalid.selector); core.attest(ASSET, bytes32(0));
        vm.prank(rev); core.attest(ASSET, EV);
        _buy(alice, 1);
        vm.prank(rev); vm.expectRevert(PortionCoreV2.Invalid.selector); core.attest(ASSET, EV);
    }
    function test_C9_reviewerMustBeIndependent() public {
        PortionCoreV2.Terms memory t = _terms(MIN, 1);
        t.reviewer = operator;
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Invalid.selector); core.create(t);
        t.reviewer = carol; // the recovery address
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Invalid.selector); core.create(t);
        t.reviewer = address(0);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Invalid.selector); core.create(t);
    }
    function test_trancheScheduleMustSumToWhole() public {
        PortionCoreV2.Terms memory t = _terms(MIN, 1);
        t.tranches[1] = 4999;
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Invalid.selector); core.create(t);
    }

    // ── Regressions of v1 behaviour ─────────────────────────────────────────
    function test_depositFeeAndClaimMatchV1() public {
        _active(10, 0);
        _deposit(operator, MIN);
        assertEq(core.pending(ASSET, alice), 19_900_000);
        vm.prank(alice); core.claim(ASSET);
        vm.prank(alice); vm.expectRevert(PortionCoreV2.Empty.selector); core.claim(ASSET);
    }
    function test_lateJoinerCannotClaimEarlierIncome() public {
        _active(10, 10);
        vm.prank(bob); core.unstake(ASSET, 10);
        _deposit(operator, MIN);
        vm.prank(bob); core.stake(ASSET, 10);
        _deposit(operator, MIN);
        assertEq(core.pending(ASSET, alice), 29_850_000);
        assertEq(core.pending(ASSET, bob), 9_950_000);
    }
    function test_defaultedListingCannotWindDownWithBond() public {
        _active(100, 0);
        vm.prank(operator); core.noticeWindDown(ASSET);
        _skip(14 days + 1);
        vm.prank(operator); vm.expectRevert(PortionCoreV2.Protected.selector); core.windDown(ASSET);
    }

    /// Whatever the sequence, the contract holds enough for every claim, the reserve, the bond and the escrow.
    function testFuzz_contractCoversObligations(uint8 a, uint8 b, uint8 minSold, uint64 d1, bool unstakeA, bool releaseOne, bool slashIt) public {
        a = uint8(bound(a, 1, 60)); b = uint8(bound(b, 1, 40)); minSold = uint8(bound(minSold, 1, 100));
        d1 = uint64(bound(d1, MIN, 1_000_000e6));
        _launch(minSold); _buy(alice, a); _buy(bob, b);
        if (a + b < 100) _skip(30 days + 1);
        core.finalize(ASSET);
        if (core.listing(ASSET).activated) {
            _deposit(operator, d1);
            if (unstakeA) { vm.prank(alice); core.unstake(ASSET, a); }
            if (releaseOne) { _approveTranche(); _skip(7 days); _deposit(operator, d1); core.release(ASSET); }
            _deposit(dave, d1);
            if (slashIt) { _skip(21 days + 1); core.slash(ASSET); }
        }
        if (uint8(core.listing(ASSET).phase) == uint8(PortionCoreV2.Phase.Refunding)) {
            vm.prank(alice); core.refund(ASSET);
        }
        PortionCoreV2.Listing memory l = core.listing(ASSET);
        uint256 owed = core.pending(ASSET, alice) + core.pending(ASSET, bob) + l.reserve + l.bond + core.escrowed(ASSET);
        assertLe(owed, pay.balanceOf(address(core)));
        assertLe(pay.balanceOf(address(core)) - owed, 6, "only rounding dust is left over");
    }
}
