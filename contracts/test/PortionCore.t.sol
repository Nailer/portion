// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PortionCore} from "../src/PortionCore.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract PortionCoreTest is Test {
    PortionCore core;
    MockERC20 pay;
    MockERC20 shares;
    address operator = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0B);
    address treasury = address(0xFEE);
    uint32 constant ASSET = 7777;

    function setUp() public {
        pay = new MockERC20();
        core = new PortionCore(address(pay), treasury, 1);
        address token = address(core.shareToken(ASSET));
        vm.etch(token, address(new MockERC20()).code);
        shares = MockERC20(token);
        shares.mint(operator, 100);
        pay.mint(operator, 10_000_000e6);
        pay.mint(alice, 10_000_000e6);
        pay.mint(bob, 10_000_000e6);
        for (uint256 i; i < 3; i++) {
            address account = i == 0 ? operator : i == 1 ? alice : bob;
            vm.startPrank(account);
            pay.approve(address(core), type(uint256).max);
            shares.approve(address(core), type(uint256).max);
            vm.stopPrank();
        }
    }
    function terms() private pure returns (PortionCore.Terms memory) {
        return PortionCore.Terms(ASSET, 100, 100, 7 days, 10e6, 20e6, 50e6, keccak256("terms"));
    }
    function create() private { vm.prank(operator); core.create(terms()); }
    function buy(address who, uint256 amount) private { vm.prank(who); core.buy(ASSET, amount); }
    function deposit(address who, uint256 amount) private { vm.prank(who); core.deposit(ASSET, amount); }

    function test_listingEncodingPreservesEveryField() public {
        create(); buy(alice, 10); deposit(operator, 20e6);
        PortionCore.Listing memory l = core.listing(ASSET);
        assertEq(l.operator, operator); assertEq(l.cadence, 7 days); assertEq(l.totalShares, 100);
        assertEq(l.lastDepositAt, block.timestamp); assertEq(l.closedAt, 0); assertTrue(l.saleOpen);
        assertEq(l.docHash, keccak256("terms")); assertEq(l.minimum, 20e6); assertEq(l.price, 10e6);
        assertEq(l.forSale, 90); assertEq(l.staked, 10); assertEq(l.acc, 19_900_000 * 1e18 / 10);
        assertEq(l.bond, 50e6); assertEq(l.revenue, 19_900_000); assertEq(l.sold, 10);
        vm.prank(operator); core.closeSale(ASSET);
        assertEq(core.listing(ASSET).sold, 10); assertEq(core.listing(ASSET).forSale, 0);
    }
    function test_defaultPreventsNewBuyersAndStakers() public {
        create(); buy(alice, 10); vm.warp(block.timestamp + 14 days + 1);
        vm.prank(bob); vm.expectRevert(PortionCore.Protected.selector); core.buy(ASSET, 1);
        vm.prank(bob); vm.expectRevert(PortionCore.Protected.selector); core.stake(ASSET, 1);
    }
    function test_completeFundingPaymentAndClaim() public {
        create();
        assertEq(shares.balanceOf(address(core)), 100);
        uint256 before = pay.balanceOf(operator);
        buy(alice, 10);
        assertEq(pay.balanceOf(operator) - before, 99e6);
        assertEq(pay.balanceOf(treasury), 1e6);
        assertEq(core.listing(ASSET).staked, 10);
        deposit(operator, 20e6);
        assertEq(core.pending(ASSET, alice), 19_900_000);
        uint256 cash = pay.balanceOf(alice);
        vm.prank(alice); core.claim(ASSET);
        assertEq(pay.balanceOf(alice) - cash, 19_900_000);
        assertEq(core.pending(ASSET, alice), 0);
        assertEq(pay.balanceOf(address(core)), 50e6);
        vm.prank(alice); vm.expectRevert(PortionCore.Empty.selector); core.claim(ASSET);
    }
    function test_lateJoinerCannotClaimEarlierIncome() public {
        create(); buy(alice, 10); deposit(operator, 20e6); buy(bob, 10);
        assertEq(core.pending(ASSET, alice), 19_900_000);
        assertEq(core.pending(ASSET, bob), 0);
        deposit(operator, 20e6);
        assertEq(core.pending(ASSET, alice), 29_850_000);
        assertEq(core.pending(ASSET, bob), 9_950_000);
    }
    function test_onlyQualifyingOperatorPaymentResetsClock() public {
        create(); buy(alice, 10);
        uint256 start = core.listing(ASSET).lastDepositAt;
        vm.warp(block.timestamp + 8 days);
        deposit(bob, 20e6);
        assertEq(core.listing(ASSET).lastDepositAt, start);
        deposit(operator, 1e6);
        assertEq(core.health(ASSET), 1);
        assertEq(core.listing(ASSET).lastDepositAt, start);
        deposit(operator, 20e6);
        assertEq(core.health(ASSET), 0);
        assertEq(core.listing(ASSET).lastDepositAt, block.timestamp);
    }
    function test_operatorCannotCloseWithActiveStakes() public {
        create(); buy(alice, 10);
        vm.prank(operator); vm.expectRevert(PortionCore.Protected.selector); core.windDown(ASSET);
        assertEq(core.listing(ASSET).bond, 50e6);
    }
    function test_defaultCannotBeClosedToAvoidPenalty() public {
        create(); vm.warp(block.timestamp + 14 days + 1);
        vm.prank(operator); vm.expectRevert(PortionCore.Protected.selector); core.windDown(ASSET);
        core.slash(ASSET);
        assertEq(pay.balanceOf(treasury), 49_500_000);
        vm.prank(operator); core.windDown(ASSET);
        assertEq(core.health(ASSET), 3);
    }
    function test_slashCompensatesHoldersAndCannotRepeat() public {
        create(); buy(alice, 10); vm.warp(block.timestamp + 14 days + 1);
        uint256 before = pay.balanceOf(address(this));
        core.slash(ASSET);
        assertEq(pay.balanceOf(address(this)) - before, 500_000);
        assertEq(core.pending(ASSET, alice), 49_500_000);
        assertEq(core.listing(ASSET).bond, 0);
        vm.expectRevert(PortionCore.Protected.selector); core.slash(ASSET);
    }
    function test_pendingIncomeSurvivesUnstakeAndClosure() public {
        create(); buy(alice, 10); deposit(operator, 20e6);
        vm.prank(alice); core.unstake(ASSET, 10);
        assertEq(shares.balanceOf(alice), 10);
        vm.prank(operator); core.windDown(ASSET);
        vm.prank(alice); core.claim(ASSET);
        assertEq(core.pending(ASSET, alice), 0);
        assertEq(pay.balanceOf(address(core)), 50e6);
    }
    function test_bondWaitAndClosedListingRestrictions() public {
        create(); vm.prank(operator); core.windDown(ASSET);
        vm.prank(operator); vm.expectRevert(PortionCore.Protected.selector); core.withdrawBond(ASSET);
        vm.prank(alice); vm.expectRevert(PortionCore.Closed.selector); core.stake(ASSET, 1);
        vm.prank(operator); vm.expectRevert(PortionCore.Closed.selector); core.topUp(ASSET, 1);
        vm.prank(operator); vm.expectRevert(PortionCore.Closed.selector); core.windDown(ASSET);
        vm.warp(block.timestamp + 14 days);
        uint256 before = pay.balanceOf(operator);
        vm.prank(operator); core.withdrawBond(ASSET);
        assertEq(pay.balanceOf(operator) - before, 50e6);
        vm.prank(operator); vm.expectRevert(PortionCore.Empty.selector); core.withdrawBond(ASSET);
    }
    function test_topUpRearmsBondButDoesNotResetDeadline() public {
        create(); buy(alice, 10); vm.warp(block.timestamp + 14 days + 1);
        core.slash(ASSET);
        uint256 before = core.listing(ASSET).lastDepositAt;
        vm.prank(operator); core.topUp(ASSET, 25e6);
        assertEq(core.listing(ASSET).bond, 25e6);
        assertEq(core.listing(ASSET).lastDepositAt, before);
        core.slash(ASSET);
        assertEq(core.pending(ASSET, alice), 74_250_000);
    }
    function test_operatorActionsAreRestricted() public {
        create();
        vm.startPrank(alice);
        vm.expectRevert(PortionCore.Unauthorized.selector); core.closeSale(ASSET);
        vm.expectRevert(PortionCore.Unauthorized.selector); core.windDown(ASSET);
        vm.expectRevert(PortionCore.Unauthorized.selector); core.topUp(ASSET, 1);
        vm.expectRevert(PortionCore.Unauthorized.selector); core.withdrawBond(ASSET);
        vm.stopPrank();
    }
    function test_closeSaleReturnsOnlyUnsoldShares() public {
        create(); buy(alice, 10);
        vm.prank(operator); core.closeSale(ASSET);
        assertEq(shares.balanceOf(operator), 90);
        assertEq(shares.balanceOf(address(core)), 10);
        assertFalse(core.listing(ASSET).saleOpen);
        vm.prank(alice); core.unstake(ASSET, 10);
        assertEq(shares.balanceOf(alice), 10);
    }
    function test_externalSharesCanStakeWithoutPastIncome() public {
        create(); buy(alice, 10); deposit(operator, 20e6);
        vm.prank(alice); core.unstake(ASSET, 10);
        vm.prank(alice); shares.transfer(bob, 10);
        vm.prank(bob); core.stake(ASSET, 10);
        assertEq(core.pending(ASSET, bob), 0);
        deposit(operator, 20e6);
        assertEq(core.pending(ASSET, bob), 19_900_000);
        assertEq(core.pending(ASSET, alice), 19_900_000);
    }
    function test_invalidCreationAndDuplicateRejected() public {
        PortionCore.Terms memory t = terms();
        vm.startPrank(operator);
        t.bond = 49e6; vm.expectRevert(PortionCore.Invalid.selector); core.create(t);
        t = terms(); t.totalShares = 101; vm.expectRevert(PortionCore.Invalid.selector); core.create(t);
        t = terms(); t.docHash = bytes32(0); vm.expectRevert(PortionCore.Invalid.selector); core.create(t);
        t = terms(); core.create(t);
        vm.expectRevert(PortionCore.Invalid.selector); core.create(t);
        vm.stopPrank();
    }
    function test_failedPurchaseRollsBackAccounting() public {
        create(); vm.startPrank(alice);
        pay.approve(address(core), 0);
        vm.expectRevert(); core.buy(ASSET, 10);
        vm.stopPrank();
        assertEq(core.listing(ASSET).forSale, 100);
        assertEq(core.listing(ASSET).staked, 0);
        assertEq(core.pending(ASSET, alice), 0);
    }
    function test_zeroUnknownAndExcessAmountsRejected() public {
        vm.expectRevert(PortionCore.Invalid.selector); core.buy(9999, 1);
        create();
        vm.expectRevert(PortionCore.Invalid.selector); core.buy(ASSET, 0);
        vm.expectRevert(PortionCore.Invalid.selector); core.buy(ASSET, 101);
        vm.expectRevert(PortionCore.Invalid.selector); core.deposit(ASSET, 20e6);
        vm.expectRevert(PortionCore.Invalid.selector); core.stake(ASSET, 0);
        buy(alice, 10);
        vm.prank(alice); vm.expectRevert(PortionCore.Invalid.selector); core.unstake(ASSET, 11);
        vm.expectRevert(PortionCore.Protected.selector); core.slash(ASSET);
    }
    function test_defaultBoundaryRequiresMoreThanTwoPeriods() public {
        create(); buy(alice, 10);
        uint256 deadline = uint256(core.listing(ASSET).lastDepositAt) + 14 days;
        vm.warp(deadline);
        assertEq(core.health(ASSET), 1);
        vm.expectRevert(PortionCore.Protected.selector); core.slash(ASSET);
        vm.warp(deadline + 1);
        assertEq(core.health(ASSET), 2);
        core.slash(ASSET);
    }
    function test_paymentTokenCallbacksCannotReenterAccounting() public {
        ReenteringPayment token = new ReenteringPayment();
        core = new PortionCore(address(token), treasury, 1);
        token.configure(core);
        token.mint(operator, 1000e6);
        token.mint(alice, 1000e6);
        vm.startPrank(operator);
        shares.approve(address(core), type(uint256).max);
        core.create(terms());
        vm.stopPrank();
        token.arm();
        buy(alice, 10);
        deposit(operator, 20e6);
        vm.prank(alice); core.claim(ASSET);
        assertGe(token.blocked(), 5);
        assertEq(token.balanceOf(address(core)), 50e6);
        assertEq(core.pending(ASSET, alice), 0);
    }
    function testFuzz_depositsRemainSolvent(uint96 a, uint96 b, uint96 value) public {
        uint256 first = bound(a, 1, 99);
        uint256 second = bound(b, 1, 100 - first);
        uint256 amount = bound(value, 1, 1_000_000e6);
        create(); buy(alice, first); buy(bob, second); deposit(operator, amount);
        uint256 net = amount - amount / 200;
        uint256 pa = core.pending(ASSET, alice);
        uint256 pb = core.pending(ASSET, bob);
        assertLe(pa + pb, net);
        if (pa > 0) { vm.prank(alice); core.claim(ASSET); }
        if (pb > 0) { vm.prank(bob); core.claim(ASSET); }
        assertEq(pay.balanceOf(address(core)), 50e6 + net - pa - pb);
        vm.prank(alice); core.unstake(ASSET, first);
        vm.prank(bob); core.unstake(ASSET, second);
        assertEq(core.listing(ASSET).staked, 0);
        assertEq(shares.balanceOf(address(core)), core.listing(ASSET).forSale);
    }
}

/// @dev Test-only payment token that attempts a claim callback during each payment transfer.
contract ReenteringPayment {
    PortionCore private core;
    bool private armed;
    uint256 public blocked;
    mapping(address => uint256) public balanceOf;
    function configure(PortionCore target) external { core = target; }
    function arm() external { armed = true; }
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function transfer(address to, uint256 amount) external returns (bool) { return _move(msg.sender, to, amount); }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) { return _move(from, to, amount); }
    function _move(address from, address to, uint256 amount) private returns (bool) {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        if (armed) {
            (bool ok, bytes memory reason) = address(core).call(abi.encodeCall(PortionCore.claim, (7777)));
            require(!ok && bytes4(reason) == PortionCore.Reentrancy.selector, "callback was not blocked by guard");
            blocked++;
        }
        return true;
    }
}
