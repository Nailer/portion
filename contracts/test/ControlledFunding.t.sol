// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ControlledFunding} from "../src/candidates/ControlledFunding.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @dev Standalone token that can be switched to return false, or to call back into the funding contract.
contract HostileToken {
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public failTransfers;
    address public reenterTarget;
    bytes public reenterData;
    bytes4 public lastRevert;
    function mint(address to, uint256 v) external { totalSupply += v; balanceOf[to] += v; }
    function approve(address s, uint256 v) external returns (bool) { allowance[msg.sender][s] = v; return true; }
    function setFail(bool v) external { failTransfers = v; }
    function setReenter(address target, bytes calldata data) external { reenterTarget = target; reenterData = data; }
    function transfer(address to, uint256 v) external returns (bool) {
        if (failTransfers) return false;
        require(balanceOf[msg.sender] >= v, "bal");
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
        if (reenterTarget != address(0)) { (bool ok, bytes memory ret) = reenterTarget.call(reenterData); require(!ok, "reentered"); lastRevert = bytes4(ret); }
        return true;
    }
    function transferFrom(address f, address to, uint256 v) external returns (bool) {
        require(allowance[f][msg.sender] >= v && balanceOf[f] >= v, "allow");
        allowance[f][msg.sender] -= v; balanceOf[f] -= v; balanceOf[to] += v;
        return true;
    }
}

contract ControlledFundingTest is Test {
    ControlledFunding f;
    MockERC20 pay;
    address operator = address(0x0A);
    address reviewer = address(0x0B);
    address rep = address(0x0C);
    address vendorA = address(0xA1);
    address vendorB = address(0xA2);
    address vendorC = address(0xA3);
    address alice = address(0xE1); // 60% of a 1_000 raise
    address bob = address(0xE2);   // 30%
    address carol = address(0xE3); // 10%
    uint64 constant WINDOW = 1 days;
    uint64 constant LIFE = 7 days;

    function setUp() public {
        pay = new MockERC20();
        f = new ControlledFunding(address(pay));
        address[3] memory who = [alice, bob, carol];
        for (uint256 i; i < 3; i++) {
            pay.mint(who[i], 1_000_000);
            vm.prank(who[i]);
            pay.approve(address(f), type(uint256).max);
        }
    }

    function _create(uint256 target, uint256 cap) private returns (uint256 id) {
        address[] memory b = new address[](3);
        b[0] = vendorA; b[1] = vendorB; b[2] = vendorC;
        uint16[] memory s = new uint16[](3);
        s[0] = 3333; s[1] = 3333; s[2] = 3334;
        vm.prank(operator);
        id = f.create(reviewer, rep, target, cap, uint64(block.timestamp + 10 days), WINDOW, LIFE, b, s);
    }
    function _fund(uint256 id) private {
        vm.prank(alice); f.contribute(id, 600);
        vm.prank(bob); f.contribute(id, 300);
        vm.prank(carol); f.contribute(id, 100);
    }
    function _active() private returns (uint256 id) {
        id = _create(500, 1_000);
        _fund(id);
        f.finalize(id); // cap reached, no need to wait
    }
    function _propose(uint256 id) private { vm.prank(operator); f.propose(id, keccak256("invoice")); }
    function _approveBoth(uint256 id) private { vm.prank(reviewer); f.approve(id); vm.prank(rep); f.approve(id); }
    function _release(uint256 id) private { _propose(id); _approveBoth(id); vm.warp(block.timestamp + WINDOW); f.release(id); }
    function _sumHeld() private view returns (uint256 total) { for (uint256 i = 1; i <= f.campaignCount(); i++) total += f.held(i); }

    // ── creation rules ─────────────────────────────────────────────────────────
    function testCreateRejectsOperatorAsApproverOrBeneficiary() public {
        address[] memory b = new address[](1); b[0] = vendorA;
        uint16[] memory s = new uint16[](1); s[0] = 10_000;
        uint64 dl = uint64(block.timestamp + 1 days);
        vm.startPrank(operator);
        vm.expectRevert(ControlledFunding.Invalid.selector); f.create(operator, rep, 1, 1, dl, WINDOW, LIFE, b, s);
        vm.expectRevert(ControlledFunding.Invalid.selector); f.create(reviewer, operator, 1, 1, dl, WINDOW, LIFE, b, s);
        vm.expectRevert(ControlledFunding.Invalid.selector); f.create(reviewer, reviewer, 1, 1, dl, WINDOW, LIFE, b, s);
        b[0] = operator;
        vm.expectRevert(ControlledFunding.Invalid.selector); f.create(reviewer, rep, 1, 1, dl, WINDOW, LIFE, b, s);
        vm.stopPrank();
    }
    function testCreateRejectsBadSharesWindowsAndTargets() public {
        address[] memory b = new address[](2); b[0] = vendorA; b[1] = vendorB;
        uint16[] memory s = new uint16[](2); s[0] = 5000; s[1] = 4999;
        uint64 dl = uint64(block.timestamp + 1 days);
        vm.startPrank(operator);
        vm.expectRevert(ControlledFunding.Invalid.selector); f.create(reviewer, rep, 1, 1, dl, WINDOW, LIFE, b, s); // shares sum to 9999
        s[1] = 5000;
        vm.expectRevert(ControlledFunding.Invalid.selector); f.create(reviewer, rep, 0, 1, dl, WINDOW, LIFE, b, s);
        vm.expectRevert(ControlledFunding.Invalid.selector); f.create(reviewer, rep, 5, 4, dl, WINDOW, LIFE, b, s);
        vm.expectRevert(ControlledFunding.Invalid.selector); f.create(reviewer, rep, 1, 1, uint64(block.timestamp), WINDOW, LIFE, b, s);
        vm.expectRevert(ControlledFunding.Invalid.selector); f.create(reviewer, rep, 1, 1, dl, 1 minutes, LIFE, b, s);
        vm.expectRevert(ControlledFunding.Invalid.selector); f.create(reviewer, rep, 1, 1, dl, WINDOW, WINDOW, b, s); // life must exceed the window
        vm.stopPrank();
    }

    // ── funding ────────────────────────────────────────────────────────────────
    function testOperatorAndReviewerCannotFundTheirOwnRaise() public {
        uint256 id = _create(500, 1_000);
        pay.mint(operator, 100); pay.mint(reviewer, 100);
        vm.startPrank(operator); pay.approve(address(f), 100); vm.expectRevert(ControlledFunding.Invalid.selector); f.contribute(id, 100); vm.stopPrank();
        vm.startPrank(reviewer); pay.approve(address(f), 100); vm.expectRevert(ControlledFunding.Invalid.selector); f.contribute(id, 100); vm.stopPrank();
    }
    function testCapAndDeadlineAreEnforced() public {
        uint256 id = _create(500, 1_000);
        vm.prank(alice); f.contribute(id, 1_000);
        vm.prank(bob); vm.expectRevert(ControlledFunding.Invalid.selector); f.contribute(id, 1); // over cap
        uint256 id2 = _create(500, 1_000);
        vm.warp(block.timestamp + 10 days + 1);
        vm.prank(alice); vm.expectRevert(ControlledFunding.Closed.selector); f.contribute(id2, 1);
    }
    function testFinalizeWaitsForDeadlineUnlessCapReached() public {
        uint256 id = _create(500, 1_000);
        vm.prank(alice); f.contribute(id, 600);
        vm.expectRevert(ControlledFunding.Protected.selector); f.finalize(id);
        vm.warp(block.timestamp + 10 days + 1);
        f.finalize(id);
        assertEq(uint8(f.campaign(id).phase), uint8(ControlledFunding.Phase.Active));
    }
    function testMissedTargetRefundsEveryoneInFullAndHoldsNothing() public {
        uint256 id = _create(900, 1_000);
        vm.prank(alice); f.contribute(id, 300);
        vm.prank(bob); f.contribute(id, 200);
        vm.warp(block.timestamp + 10 days + 1);
        f.finalize(id);
        assertEq(uint8(f.campaign(id).phase), uint8(ControlledFunding.Phase.Refunding));
        vm.prank(alice); assertEq(f.refund(id), 300);
        vm.prank(bob); assertEq(f.refund(id), 200);
        assertEq(pay.balanceOf(address(f)), 0);
        assertEq(f.held(id), 0);
        vm.prank(alice); vm.expectRevert(ControlledFunding.Closed.selector); f.refund(id); // no double refund
    }
    function testNoMoneyMovesToOperatorOnFunding() public {
        uint256 id = _active();
        assertEq(pay.balanceOf(operator), 0);
        assertEq(pay.balanceOf(address(f)), 1_000);
        assertEq(f.held(id), 1_000);
    }

    // ── release rules ──────────────────────────────────────────────────────────
    function testHappyPathPaysFixedBeneficiariesExactlyAndCompletes() public {
        uint256 id = _active();
        _release(id); // 1_000 * 3333 / 10_000 = 333
        _release(id); // 333
        assertEq(pay.balanceOf(vendorA), 333);
        assertEq(pay.balanceOf(vendorB), 333);
        _release(id); // last takes the remainder: 1_000 - 666 = 334
        assertEq(pay.balanceOf(vendorC), 334);
        assertEq(pay.balanceOf(address(f)), 0);
        assertEq(f.held(id), 0);
        assertEq(uint8(f.campaign(id).phase), uint8(ControlledFunding.Phase.Completed));
    }
    function testOnlyOperatorProposesAndOnlyNamedApproversApprove() public {
        uint256 id = _active();
        vm.prank(alice); vm.expectRevert(ControlledFunding.Unauthorized.selector); f.propose(id, keccak256("x"));
        _propose(id);
        vm.prank(operator); vm.expectRevert(ControlledFunding.Unauthorized.selector); f.approve(id); // operator cannot approve itself
        vm.prank(alice); vm.expectRevert(ControlledFunding.Unauthorized.selector); f.approve(id);
    }
    function testCannotReleaseWithoutBothApprovalsOrBeforeTheChallengeWindow() public {
        uint256 id = _active();
        _propose(id);
        vm.warp(block.timestamp + WINDOW);
        vm.expectRevert(ControlledFunding.Protected.selector); f.release(id); // no approvals
        vm.prank(reviewer); f.approve(id);
        vm.expectRevert(ControlledFunding.Protected.selector); f.release(id); // only one
        vm.prank(rep); f.approve(id);
        vm.expectRevert(ControlledFunding.Protected.selector); f.release(id); // window not yet elapsed
        vm.warp(block.timestamp + WINDOW - 1);
        vm.expectRevert(ControlledFunding.Protected.selector); f.release(id);
        vm.warp(block.timestamp + 1);
        f.release(id);
    }
    function testExpiredProposalCannotBeApprovedOrReleased() public {
        uint256 id = _active();
        _propose(id);
        _approveBoth(id);
        vm.warp(block.timestamp + LIFE + 1);
        vm.expectRevert(ControlledFunding.Protected.selector); f.release(id);
        vm.prank(reviewer); vm.expectRevert(ControlledFunding.Protected.selector); f.approve(id);
    }
    function testSameMilestoneCannotPayTwiceAndBeneficiaryCannotChange() public {
        uint256 id = _active();
        _release(id);
        vm.expectRevert(ControlledFunding.Invalid.selector); f.release(id); // proposal cleared
        _propose(id);
        _approveBoth(id);
        vm.warp(block.timestamp + WINDOW);
        f.release(id);
        assertEq(pay.balanceOf(vendorA), 333); // paid once, to the address fixed at creation
        assertEq(pay.balanceOf(vendorB), 333);
        assertEq(f.milestones(id)[0].beneficiary, vendorA);
    }
    function testAnyoneCanTriggerReleaseButMoneyOnlyGoesToTheBeneficiary() public {
        uint256 id = _active();
        _propose(id); _approveBoth(id);
        vm.warp(block.timestamp + WINDOW);
        vm.prank(address(0xBEEF)); f.release(id);
        assertEq(pay.balanceOf(address(0xBEEF)), 0);
        assertEq(pay.balanceOf(vendorA), 333);
    }

    // ── challenge, lapse and refund ────────────────────────────────────────────
    function testDustHolderCannotChallengeButTenPercentHolderCan() public {
        uint256 id = _create(500, 1_000);
        vm.prank(alice); f.contribute(id, 995);
        vm.prank(carol); f.contribute(id, 5); // 0.5%
        f.finalize(id); // raised == cap? no: 1_000 == cap
        _propose(id);
        vm.prank(carol); vm.expectRevert(ControlledFunding.Unauthorized.selector); f.challenge(id);
        vm.prank(alice); f.challenge(id);
        _approveBoth2Revert(id);
    }
    function _approveBoth2Revert(uint256 id) private {
        vm.prank(reviewer); vm.expectRevert(ControlledFunding.Protected.selector); f.approve(id);
    }
    function testChallengedProposalCannotReleaseAndTwoFailuresOpenRefunds() public {
        uint256 id = _active();
        _propose(id); _approveBoth(id);
        vm.prank(bob); f.challenge(id); // 30%
        vm.warp(block.timestamp + WINDOW);
        vm.expectRevert(ControlledFunding.Protected.selector); f.release(id);
        f.lapse(id);
        assertEq(f.campaign(id).lapses, 1);
        _propose(id); // operator may try again once
        vm.prank(bob); f.challenge(id);
        f.lapse(id);
        assertEq(uint8(f.campaign(id).phase), uint8(ControlledFunding.Phase.Refunding));
        vm.prank(alice); assertEq(f.refund(id), 600);
        vm.prank(bob); assertEq(f.refund(id), 300);
        vm.prank(carol); assertEq(f.refund(id), 100);
        assertEq(pay.balanceOf(address(f)), 0);
    }
    function testUnavailableApproversEndInRefundNotInTrappedFunds() public {
        uint256 id = _active();
        _propose(id);
        vm.expectRevert(ControlledFunding.Protected.selector); f.lapse(id); // still within its life
        vm.warp(block.timestamp + LIFE + 1);
        f.lapse(id);
        _propose(id);
        vm.warp(block.timestamp + LIFE + 1);
        f.lapse(id);
        assertEq(uint8(f.campaign(id).phase), uint8(ControlledFunding.Phase.Refunding));
        vm.prank(alice); f.refund(id);
        assertEq(pay.balanceOf(alice), 1_000_000); // made whole: nothing was released
    }
    function testRefundAfterPartialReleaseReturnsOnlyTheUnreleasedShareProRata() public {
        uint256 id = _active();
        _release(id); // 333 spent
        vm.prank(operator); f.cancel(id);
        assertEq(f.campaign(id).refundPool, 667);
        vm.prank(alice); assertEq(f.refund(id), 400); // 667 * 600 / 1000 = 400
        vm.prank(bob); assertEq(f.refund(id), 200);   // 667 * 300 / 1000 = 200
        vm.prank(carol); assertEq(f.refund(id), 66);  // 667 * 100 / 1000 = 66
        assertEq(pay.balanceOf(address(f)), 1); // one unit of rounding dust stays, never more than contributors * 1
        assertEq(f.held(id), 1);
    }
    function testReleasedMoneyIsNotRefundable() public {
        uint256 id = _active();
        _release(id);
        assertEq(pay.balanceOf(vendorA), 333);
        vm.prank(operator); f.cancel(id);
        vm.prank(alice); f.refund(id);
        assertEq(pay.balanceOf(vendorA), 333); // the vendor keeps it
    }
    function testNonContributorHasNothingToRefund() public {
        uint256 id = _active();
        vm.prank(operator); f.cancel(id);
        vm.prank(address(0xDEAD)); vm.expectRevert(ControlledFunding.Empty.selector); f.refund(id);
    }
    function testBalancesStaySeparatedAcrossCampaigns() public {
        uint256 a = _active();
        uint256 b = _create(500, 1_000);
        vm.prank(alice); f.contribute(b, 700);
        _release(a);
        assertEq(_sumHeld(), pay.balanceOf(address(f)));
        assertEq(f.held(b), 700); // a release on one campaign never touches another
        vm.prank(operator); f.cancel(b);
        vm.prank(alice); f.refund(b);
        assertEq(_sumHeld(), pay.balanceOf(address(f)));
    }

    // ── hostile tokens ─────────────────────────────────────────────────────────
    function testTokenTransferFailureDoesNotMarkTheMilestonePaid() public {
        HostileToken t = new HostileToken();
        ControlledFunding g = new ControlledFunding(address(t));
        t.mint(alice, 1_000);
        vm.prank(alice); t.approve(address(g), type(uint256).max);
        address[] memory b = new address[](1); b[0] = vendorA;
        uint16[] memory s = new uint16[](1); s[0] = 10_000;
        vm.prank(operator); uint256 id = g.create(reviewer, rep, 1_000, 1_000, uint64(block.timestamp + 1 days), WINDOW, LIFE, b, s);
        vm.prank(alice); g.contribute(id, 1_000);
        g.finalize(id);
        vm.prank(operator); g.propose(id, keccak256("e"));
        vm.prank(reviewer); g.approve(id); vm.prank(rep); g.approve(id);
        vm.warp(block.timestamp + WINDOW);
        t.setFail(true);
        vm.expectRevert(); g.release(id);
        assertFalse(g.milestones(id)[0].released);
        assertEq(g.campaign(id).released, 0);
        t.setFail(false);
        g.release(id); // the same milestone can still be paid once the token works
        assertEq(t.balanceOf(vendorA), 1_000);
    }
    function testReentrancyThroughTheTokenIsBlocked() public {
        HostileToken t = new HostileToken();
        ControlledFunding g = new ControlledFunding(address(t));
        t.mint(alice, 1_000);
        vm.prank(alice); t.approve(address(g), type(uint256).max);
        address[] memory b = new address[](1); b[0] = vendorA;
        uint16[] memory s = new uint16[](1); s[0] = 10_000;
        vm.prank(operator); uint256 id = g.create(reviewer, rep, 1_000, 1_000, uint64(block.timestamp + 1 days), WINDOW, LIFE, b, s);
        vm.prank(alice); g.contribute(id, 1_000);
        g.finalize(id);
        vm.prank(operator); g.cancel(id);
        t.setReenter(address(g), abi.encodeCall(ControlledFunding.refund, (id)));
        vm.prank(alice); g.refund(id); // the nested call is rejected by the guard itself, not by incidental state
        assertEq(t.lastRevert(), ControlledFunding.Reentrancy.selector);
        assertEq(t.balanceOf(alice), 1_000);
    }

    // ── conservation under arbitrary amounts ───────────────────────────────────
    function testFuzzRefundsNeverExceedWhatWasHeld(uint96 a, uint96 b, uint96 c, uint8 releases) public {
        a = uint96(bound(a, 1, 300_000)); b = uint96(bound(b, 1, 300_000)); c = uint96(bound(c, 1, 300_000));
        uint256 raised = uint256(a) + b + c;
        uint256 id = _create(1, raised);
        vm.prank(alice); f.contribute(id, a);
        vm.prank(bob); f.contribute(id, b);
        vm.prank(carol); f.contribute(id, c);
        f.finalize(id);
        uint256 n = bound(releases, 0, 2);
        for (uint256 i; i < n; i++) _release(id);
        vm.prank(operator); f.cancel(id);
        uint256 before = pay.balanceOf(address(f));
        uint256 out;
        address[3] memory who = [alice, bob, carol];
        for (uint256 i; i < 3; i++) {
            vm.prank(who[i]);
            try f.refund(id) returns (uint256 amt) { out += amt; } catch {}
        }
        assertLe(out, before);                       // never pay out more than is held
        assertEq(pay.balanceOf(address(f)), before - out);
        assertEq(f.held(id), pay.balanceOf(address(f)));
        assertLe(before - out, 3);                   // at most one unit of dust per contributor
    }
}
