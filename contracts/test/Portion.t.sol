// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Portion} from "../src/Portion.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract PortionTest is Test {
    Portion portion;
    MockERC20 pay; // stands in for pUSD (6 decimals)
    MockERC20 shares; // stands in for the native fraction asset

    address treasury = address(0xFEE);
    address operator = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0B);
    address carol = address(0xCA201);

    uint16 constant PREFIX = 1;
    uint32 constant ASSET = 7777;
    uint64 constant SHARES = 1000;
    uint64 constant FOR_SALE = 600;
    uint256 constant PRICE = 25e6; // 25 pUSD per share
    uint64 constant CADENCE = 7 days;

    function setUp() public {
        portion = new Portion(treasury, PREFIX);
        address payAddr = address(new MockERC20());
        pay = MockERC20(payAddr);

        address shareAddr = portion.shareToken(ASSET);
        vm.etch(shareAddr, address(new MockERC20()).code);
        shares = MockERC20(shareAddr);
        shares.mint(operator, SHARES);

        pay.mint(operator, 1_000_000e6);
        pay.mint(alice, 100_000e6);
        pay.mint(bob, 100_000e6);
        pay.mint(carol, 100_000e6);
    }

    // ───────── helpers ─────────
    function _params() internal view returns (Portion.CreateParams memory p) {
        p = Portion.CreateParams({
            assetId: ASSET,
            nftCollection: 1,
            nftItem: 42,
            category: 2,
            totalShares: SHARES,
            sharesForSale: FOR_SALE,
            cadence: CADENCE,
            payToken: address(pay),
            salePrice: PRICE,
            minPerPeriod: 100e6,
            bond: (uint256(FOR_SALE) * PRICE * 500) / 10_000,
            docHash: keccak256("doc"),
            coverHash: keccak256("cover"),
            name: "Yaba solar kiosk",
            summary: "Phone-charging kiosk, 40 customers a day"
        });
    }

    function _list() internal returns (uint256 id) {
        Portion.CreateParams memory p = _params();
        vm.startPrank(operator);
        shares.approve(address(portion), p.sharesForSale);
        pay.approve(address(portion), p.bond);
        id = portion.createListing(p);
        vm.stopPrank();
    }

    function _buy(address who, uint256 id, uint256 n) internal {
        vm.startPrank(who);
        pay.approve(address(portion), n * PRICE);
        portion.buy(id, n);
        vm.stopPrank();
    }

    function _deposit(address who, uint256 id, uint256 amt) internal {
        vm.startPrank(who);
        pay.approve(address(portion), amt);
        portion.deposit(id, amt, bytes32("week"));
        vm.stopPrank();
    }

    // ───────── address derivation ─────────
    function test_shareTokenAddressLayout() public view {
        // asset 1 with prefix 1 is the address we confirmed on the live testnet
        assertEq(portion.shareToken(1), 0x0000000100000000000000000000000000010000);
        assertEq(portion.shareToken(0xDEADBEEF), 0xDEAdbEEF00000000000000000000000000010000);
    }

    // ───────── create ─────────
    function test_createListing_escrowsSharesAndBond() public {
        uint256 id = _list();
        assertEq(id, 0);
        assertEq(portion.listingCount(), 1);
        assertEq(shares.balanceOf(address(portion)), FOR_SALE);
        assertEq(shares.balanceOf(operator), SHARES - FOR_SALE);
        (Portion.Listing memory l, Portion.Vault memory v, Portion.Health h) = portion.getListing(id);
        assertEq(l.operator, operator);
        assertEq(l.assetId, ASSET);
        assertTrue(l.saleOpen);
        assertEq(v.forSale, FOR_SALE);
        assertEq(v.bond, (uint256(FOR_SALE) * PRICE * 500) / 10_000);
        assertEq(uint8(h), uint8(Portion.Health.Healthy));
        (bool found, uint256 got) = portion.idOfAsset(ASSET);
        assertTrue(found);
        assertEq(got, 0);
    }

    function test_createListing_revertsOnSupplyMismatch() public {
        Portion.CreateParams memory p = _params();
        p.totalShares = SHARES + 1;
        vm.startPrank(operator);
        shares.approve(address(portion), p.sharesForSale);
        pay.approve(address(portion), p.bond);
        vm.expectRevert(Portion.ShareSupplyMismatch.selector);
        portion.createListing(p);
        vm.stopPrank();
    }

    function test_createListing_revertsOnSmallBond() public {
        Portion.CreateParams memory p = _params();
        p.bond -= 1;
        vm.startPrank(operator);
        shares.approve(address(portion), p.sharesForSale);
        pay.approve(address(portion), p.bond);
        vm.expectRevert(Portion.BondTooSmall.selector);
        portion.createListing(p);
        vm.stopPrank();
    }

    function test_createListing_revertsOnDuplicateAsset() public {
        _list();
        Portion.CreateParams memory p = _params();
        vm.startPrank(operator);
        shares.approve(address(portion), p.sharesForSale);
        pay.approve(address(portion), p.bond);
        vm.expectRevert(Portion.DuplicateAsset.selector);
        portion.createListing(p);
        vm.stopPrank();
    }

    function test_createListing_revertsOnBadParams() public {
        Portion.CreateParams memory p = _params();
        p.cadence = 10; // below minCadence
        vm.prank(operator);
        vm.expectRevert(Portion.BadParams.selector);
        portion.createListing(p);

        p = _params();
        p.name = "";
        vm.prank(operator);
        vm.expectRevert(Portion.BadParams.selector);
        portion.createListing(p);

        p = _params();
        p.sharesForSale = SHARES + 1;
        vm.prank(operator);
        vm.expectRevert(Portion.BadParams.selector);
        portion.createListing(p);
    }

    function test_createListing_failsWithoutAllowance() public {
        Portion.CreateParams memory p = _params();
        vm.prank(operator);
        vm.expectRevert(); // mock reverts "allow"; SafeTransfer rewraps as TransferFailed
        portion.createListing(p);
    }

    // ───────── primary sale ─────────
    function test_buy_splitsProceedsAndAutoStakes() public {
        uint256 id = _list();
        uint256 opBefore = pay.balanceOf(operator);
        _buy(alice, id, 100);

        uint256 cost = 100 * PRICE;
        uint256 fee = (cost * 100) / 10_000;
        assertEq(pay.balanceOf(operator) - opBefore, cost - fee);
        assertEq(pay.balanceOf(treasury), fee);
        assertEq(portion.stakeOf(id, alice), 100);
        (, Portion.Vault memory v,) = portion.getListing(id);
        assertEq(v.forSale, FOR_SALE - 100);
        assertEq(v.sold, 100);
        assertEq(v.totalStaked, 100);
    }

    function test_buy_closesSaleWhenSoldOut() public {
        uint256 id = _list();
        _buy(alice, id, FOR_SALE);
        (Portion.Listing memory l,,) = portion.getListing(id);
        assertFalse(l.saleOpen);
        vm.startPrank(bob);
        pay.approve(address(portion), PRICE);
        vm.expectRevert(Portion.SaleNotOpen.selector);
        portion.buy(id, 1);
        vm.stopPrank();
    }

    function test_buy_revertsWhenOverAvailable() public {
        uint256 id = _list();
        vm.startPrank(alice);
        pay.approve(address(portion), 10_000 * PRICE);
        vm.expectRevert(Portion.SoldOut.selector);
        portion.buy(id, FOR_SALE + 1);
        vm.expectRevert(Portion.SoldOut.selector);
        portion.buy(id, 0);
        vm.stopPrank();
    }

    function test_closeSale_returnsUnsoldShares() public {
        uint256 id = _list();
        _buy(alice, id, 100);
        vm.prank(operator);
        portion.closeSale(id);
        assertEq(shares.balanceOf(operator), (SHARES - FOR_SALE) + (FOR_SALE - 100));
        vm.prank(alice);
        vm.expectRevert(Portion.NotOperator.selector);
        portion.closeSale(id);
    }

    // ───────── revenue ─────────
    function test_revenue_isProRata() public {
        uint256 id = _list();
        _buy(alice, id, 300);
        _buy(bob, id, 100);

        _deposit(operator, id, 1_000e6);
        uint256 net = 1_000e6 - (1_000e6 * 50) / 10_000;
        assertApproxEqAbs(portion.pending(id, alice), (net * 3) / 4, 2);
        assertApproxEqAbs(portion.pending(id, bob), net / 4, 2);

        vm.prank(alice);
        uint256 got = portion.claim(id);
        assertApproxEqAbs(got, (net * 3) / 4, 2);
        assertEq(portion.pending(id, alice), 0);
        vm.prank(alice);
        vm.expectRevert(Portion.NothingToClaim.selector);
        portion.claim(id);
    }

    function test_revenue_lateJoinerDoesNotGetEarlierRevenue() public {
        uint256 id = _list();
        _buy(alice, id, 100);
        _deposit(operator, id, 1_000e6);
        _buy(bob, id, 100);
        assertEq(portion.pending(id, bob), 0);
        _deposit(operator, id, 1_000e6);
        uint256 net = 1_000e6 - (1_000e6 * 50) / 10_000;
        assertApproxEqAbs(portion.pending(id, bob), net / 2, 2);
        assertApproxEqAbs(portion.pending(id, alice), net + net / 2, 4);
    }

    function test_revenue_revertsWithNoStakers() public {
        uint256 id = _list();
        vm.startPrank(operator);
        pay.approve(address(portion), 100e6);
        vm.expectRevert(Portion.NoStakers.selector);
        portion.deposit(id, 100e6, bytes32(0));
        vm.stopPrank();
    }

    function test_revenue_feeGoesToTreasury() public {
        uint256 id = _list();
        _buy(alice, id, 10);
        uint256 t0 = pay.balanceOf(treasury);
        _deposit(operator, id, 2_000e6);
        assertEq(pay.balanceOf(treasury) - t0, (2_000e6 * 50) / 10_000);
    }

    function test_unstake_harvestsAndReturnsShares() public {
        uint256 id = _list();
        _buy(alice, id, 100);
        _deposit(operator, id, 500e6);
        uint256 owedBefore = portion.pending(id, alice);
        vm.prank(alice);
        portion.unstake(id, 40);
        assertEq(shares.balanceOf(alice), 40);
        assertEq(portion.stakeOf(id, alice), 60);
        assertEq(portion.pending(id, alice), owedBefore);
        vm.prank(alice);
        vm.expectRevert(Portion.InsufficientStake.selector);
        portion.unstake(id, 61);
    }

    function test_stake_sharesBoughtOffPlatform() public {
        uint256 id = _list();
        vm.prank(operator);
        shares.transfer(carol, 50); // e.g. carol bought them on the native DEX
        vm.startPrank(carol);
        shares.approve(address(portion), 50);
        portion.stake(id, 50);
        vm.stopPrank();
        _deposit(operator, id, 100e6);
        assertGt(portion.pending(id, carol), 0);
    }

    // ───────── accountability ─────────
    function test_cadenceClock_onlyQualifyingOperatorDepositsReset() public {
        uint256 id = _list();
        _buy(alice, id, 100);
        vm.warp(block.timestamp + CADENCE + 1);
        assertEq(uint8(portion.health(id)), uint8(Portion.Health.Late));

        // a third party paying does not reset the clock
        pay.mint(carol, 1_000e6);
        _deposit(carol, id, 1_000e6);
        assertEq(uint8(portion.health(id)), uint8(Portion.Health.Late));

        // a dust deposit by the operator does not either
        _deposit(operator, id, 1e6);
        assertEq(uint8(portion.health(id)), uint8(Portion.Health.Late));

        // a real one does
        _deposit(operator, id, 100e6);
        assertEq(uint8(portion.health(id)), uint8(Portion.Health.Healthy));
    }

    function test_slash_distributesBondToHolders() public {
        uint256 id = _list();
        _buy(alice, id, 300);
        _buy(bob, id, 100);
        (, Portion.Vault memory v0,) = portion.getListing(id);
        uint256 bond = v0.bond;

        vm.expectRevert(Portion.NotSlashable.selector);
        portion.slash(id);

        vm.warp(block.timestamp + 2 * CADENCE + 1);
        assertEq(uint8(portion.health(id)), uint8(Portion.Health.Defaulted));
        assertEq(portion.secondsUntilSlashable(id), 0);

        address keeper = address(0xBEEF);
        vm.prank(keeper);
        portion.slash(id);

        uint256 tip = (bond * 100) / 10_000;
        assertEq(pay.balanceOf(keeper), tip);
        uint256 toHolders = bond - tip;
        assertApproxEqAbs(portion.pending(id, alice), (toHolders * 3) / 4, 2);
        assertApproxEqAbs(portion.pending(id, bob), toHolders / 4, 2);

        (Portion.Listing memory l, Portion.Vault memory v,) = portion.getListing(id);
        assertEq(v.bond, 0);
        assertEq(l.strikes, 1);

        vm.expectRevert(Portion.NothingToSlash.selector);
        portion.slash(id);
    }

    function test_slash_withNoStakersGoesToTreasury() public {
        uint256 id = _list();
        (, Portion.Vault memory v0,) = portion.getListing(id);
        vm.warp(block.timestamp + 2 * CADENCE + 1);
        uint256 t0 = pay.balanceOf(treasury);
        vm.prank(address(0xBEEF));
        portion.slash(id);
        uint256 tip = (v0.bond * 100) / 10_000;
        assertEq(pay.balanceOf(treasury) - t0, v0.bond - tip);
    }

    function test_topUpBondRearms() public {
        uint256 id = _list();
        _buy(alice, id, 100);
        vm.warp(block.timestamp + 2 * CADENCE + 1);
        portion.slash(id);

        vm.startPrank(operator);
        pay.approve(address(portion), 500e6);
        portion.topUpBond(id, 500e6);
        vm.stopPrank();
        (, Portion.Vault memory v,) = portion.getListing(id);
        assertEq(v.bond, 500e6);

        vm.prank(alice);
        vm.expectRevert(Portion.NotOperator.selector);
        portion.topUpBond(id, 1);
    }

    function test_windDown_andWithdrawBondAfterTwoCadences() public {
        uint256 id = _list();
        _buy(alice, id, 100);
        (, Portion.Vault memory v0,) = portion.getListing(id);

        vm.prank(operator);
        vm.expectRevert(Portion.StillWindingDown.selector);
        portion.withdrawBond(id);

        vm.prank(operator);
        portion.windDown(id);
        assertEq(uint8(portion.health(id)), uint8(Portion.Health.WoundDown));

        vm.prank(operator);
        vm.expectRevert(Portion.AlreadyWoundDown.selector);
        portion.windDown(id);

        vm.prank(operator);
        vm.expectRevert(Portion.StillWindingDown.selector);
        portion.withdrawBond(id);

        vm.warp(block.timestamp + 2 * CADENCE);
        uint256 before_ = pay.balanceOf(operator);
        vm.prank(operator);
        portion.withdrawBond(id);
        assertEq(pay.balanceOf(operator) - before_, v0.bond);

        // holders can still claim revenue after wind-down
        _deposit(operator, id, 100e6);
        vm.prank(alice);
        portion.claim(id);
    }

    // ───────── views ─────────
    function test_positionsOf_listsOnlyActive() public {
        uint256 a = _list();
        // second listing on another asset
        uint32 asset2 = 8888;
        address sh2 = portion.shareToken(asset2);
        vm.etch(sh2, address(new MockERC20()).code);
        MockERC20(sh2).mint(operator, SHARES);
        Portion.CreateParams memory p = _params();
        p.assetId = asset2;
        vm.startPrank(operator);
        MockERC20(sh2).approve(address(portion), p.sharesForSale);
        pay.approve(address(portion), p.bond);
        uint256 b = portion.createListing(p);
        vm.stopPrank();

        _buy(alice, b, 10);
        Portion.Position[] memory pos = portion.positionsOf(alice, 0, 50);
        assertEq(pos.length, 1);
        assertEq(pos[0].id, b);
        assertEq(pos[0].staked, 10);
        assertEq(portion.positionsOf(bob, 0, 50).length, 0);
        assertEq(portion.positionsOf(alice, 99, 50).length, 0);
        assertEq(a, 0);
    }

    // ───────── admin ─────────
    function test_admin_onlyOwnerAndBounded() public {
        vm.prank(alice);
        vm.expectRevert(Portion.NotOwner.selector);
        portion.setFees(1, 1);
        vm.expectRevert(Portion.BadParams.selector);
        portion.setFees(501, 0);
        portion.setFees(200, 100);
        assertEq(portion.saleFeeBps(), 200);
        portion.setRules(300, 200, 120);
        assertEq(portion.minCadence(), 120);
        vm.expectRevert(Portion.BadParams.selector);
        portion.setRules(6000, 0, 1);
    }

    // ───────── fuzz: the vault never pays out more than it took in ─────────
    function testFuzz_vaultSolvency(uint96 a, uint96 b, uint96 c, uint96 d1, uint96 d2) public {
        uint256 id = _list();
        uint256 na = bound(a, 1, 200);
        uint256 nb = bound(b, 1, 200);
        uint256 nc = bound(c, 1, 200);
        _buy(alice, id, na);
        uint256 dep1 = bound(d1, 1e6, 50_000e6);
        _deposit(operator, id, dep1);
        _buy(bob, id, nb);
        uint256 dep2 = bound(d2, 1e6, 50_000e6);
        _deposit(operator, id, dep2);
        _buy(carol, id, nc);
        vm.prank(alice);
        portion.unstake(id, na / 2 == 0 ? 1 : na / 2);

        (, Portion.Vault memory v,) = portion.getListing(id);
        uint256 owed = portion.pending(id, alice) + portion.pending(id, bob) + portion.pending(id, carol);
        assertLe(owed, v.totalRevenue, "owes more than deposited");
        assertGe(owed + 10, v.totalRevenue - _undistributedDust(), "lost more than dust");

        uint256 held = pay.balanceOf(address(portion));
        // vault balance = revenue not yet claimed + bond
        assertGe(held, owed + v.bond);
    }

    function _undistributedDust() internal pure returns (uint256) {
        // revenue deposited while only some shares were staked is fully attributed; allow rounding dust
        return 0;
    }
}
