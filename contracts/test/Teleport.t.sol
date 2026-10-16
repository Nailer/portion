// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Teleport, IBridgedToken} from "../src/Teleport.sol";
import {WrappedToken} from "../src/WrappedToken.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract TeleportTest is Test {
    uint256 constant HOME_CHAIN = 420420777; // Portaldot V3 testnet
    uint256 constant REMOTE_CHAIN = 97; // BNB Chain testnet

    Teleport home;
    Teleport remote;
    MockERC20 pusd;
    WrappedToken wpusd;

    uint256[3] pk;
    address[3] relayer;
    address user = address(0xA11CE);
    address friend = address(0xF00D);

    function setUp() public {
        for (uint256 i; i < 3; i++) {
            pk[i] = uint256(keccak256(abi.encode("relayer", i)));
            relayer[i] = vm.addr(pk[i]);
        }

        pusd = new MockERC20();
        wpusd = new WrappedToken("Wrapped Portion Dollar", "wpUSD", 6);

        vm.chainId(HOME_CHAIN);
        home = new Teleport(IERC20(address(pusd)), false, 10_000e6, 50_000e6);
        vm.chainId(REMOTE_CHAIN);
        remote = new Teleport(IERC20(address(wpusd)), true, 10_000e6, 50_000e6);
        wpusd.setBridge(address(remote));

        _configure(home, REMOTE_CHAIN);
        _configure(remote, HOME_CHAIN);

        pusd.mint(address(this), 1_000_000e6);
        pusd.approve(address(home), type(uint256).max);
        vm.chainId(HOME_CHAIN);
        home.addLiquidity(500_000e6);
        pusd.mint(user, 5_000e6);
    }

    function _configure(Teleport t, uint256 other) internal {
        address[] memory list = new address[](3);
        for (uint256 i; i < 3; i++) list[i] = relayer[i];
        t.setRelayers(list, 2);
        t.setSupportedChain(other, true);
    }

    function _sign(Teleport dst, Teleport.Message memory m, uint256[] memory keys) internal view returns (bytes[] memory sigs) {
        bytes32 digest = dst.hashMessage(m);
        sigs = new bytes[](keys.length);
        for (uint256 i; i < keys.length; i++) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(keys[i], digest);
            sigs[i] = abi.encodePacked(r, s, v);
        }
    }

    /// signers ordered by ascending address, as the contract requires
    function _pair(uint256 a, uint256 b) internal view returns (uint256[] memory keys) {
        keys = new uint256[](2);
        if (vm.addr(pk[a]) < vm.addr(pk[b])) {
            keys[0] = pk[a];
            keys[1] = pk[b];
        } else {
            keys[0] = pk[b];
            keys[1] = pk[a];
        }
    }

    function _msg(uint256 src, uint256 dst, uint256 n, address to, uint256 amt) internal pure returns (Teleport.Message memory) {
        return Teleport.Message(src, dst, n, to, amt);
    }

    // ───────── Home → Remote ─────────
    function test_homeToRemote_locksThenMints() public {
        vm.chainId(HOME_CHAIN);
        vm.startPrank(user);
        pusd.approve(address(home), 1_000e6);
        uint256 n = home.bridgeOut(REMOTE_CHAIN, friend, 1_000e6);
        vm.stopPrank();
        assertEq(n, 0);
        assertEq(pusd.balanceOf(user), 4_000e6);
        assertEq(pusd.balanceOf(address(home)), 500_000e6 + 1_000e6);

        vm.chainId(REMOTE_CHAIN);
        Teleport.Message memory m = _msg(HOME_CHAIN, REMOTE_CHAIN, 0, friend, 1_000e6);
        remote.bridgeIn(m, _sign(remote, m, _pair(0, 1)));
        assertEq(wpusd.balanceOf(friend), 1_000e6);
        assertEq(wpusd.totalSupply(), 1_000e6);
    }

    function test_remoteToHome_burnsThenReleases() public {
        // seed wrapped balance via a valid inbound transfer first
        vm.chainId(REMOTE_CHAIN);
        Teleport.Message memory seed = _msg(HOME_CHAIN, REMOTE_CHAIN, 0, user, 2_000e6);
        remote.bridgeIn(seed, _sign(remote, seed, _pair(0, 2)));

        vm.startPrank(user);
        wpusd.approve(address(remote), 500e6);
        remote.bridgeOut(HOME_CHAIN, friend, 500e6);
        vm.stopPrank();
        assertEq(wpusd.balanceOf(user), 1_500e6);
        assertEq(wpusd.totalSupply(), 1_500e6);

        vm.chainId(HOME_CHAIN);
        Teleport.Message memory m = _msg(REMOTE_CHAIN, HOME_CHAIN, 0, friend, 500e6);
        home.bridgeIn(m, _sign(home, m, _pair(1, 2)));
        assertEq(pusd.balanceOf(friend), 500e6);
    }

    // ───────── signature rules ─────────
    function test_revert_replay() public {
        vm.chainId(REMOTE_CHAIN);
        Teleport.Message memory m = _msg(HOME_CHAIN, REMOTE_CHAIN, 7, friend, 10e6);
        bytes[] memory sigs = _sign(remote, m, _pair(0, 1));
        remote.bridgeIn(m, sigs);
        vm.expectRevert(Teleport.AlreadyProcessed.selector);
        remote.bridgeIn(m, sigs);
    }

    function test_revert_belowThreshold() public {
        vm.chainId(REMOTE_CHAIN);
        Teleport.Message memory m = _msg(HOME_CHAIN, REMOTE_CHAIN, 1, friend, 10e6);
        uint256[] memory one = new uint256[](1);
        one[0] = pk[0];
        bytes[] memory sigs = _sign(remote, m, one);
        vm.expectRevert(Teleport.BadSignatures.selector);
        remote.bridgeIn(m, sigs);
    }

    function test_revert_duplicateSigner() public {
        vm.chainId(REMOTE_CHAIN);
        Teleport.Message memory m = _msg(HOME_CHAIN, REMOTE_CHAIN, 1, friend, 10e6);
        uint256[] memory keys = new uint256[](2);
        keys[0] = pk[0];
        keys[1] = pk[0];
        bytes[] memory sigs = _sign(remote, m, keys);
        vm.expectRevert(Teleport.BadSignatures.selector);
        remote.bridgeIn(m, sigs);
    }

    function test_revert_unsortedSigners() public {
        vm.chainId(REMOTE_CHAIN);
        Teleport.Message memory m = _msg(HOME_CHAIN, REMOTE_CHAIN, 1, friend, 10e6);
        uint256[] memory asc = _pair(0, 1);
        uint256[] memory desc = new uint256[](2);
        desc[0] = asc[1];
        desc[1] = asc[0];
        bytes[] memory sigs = _sign(remote, m, desc);
        vm.expectRevert(Teleport.BadSignatures.selector);
        remote.bridgeIn(m, sigs);
    }

    function test_revert_nonRelayerSigner() public {
        vm.chainId(REMOTE_CHAIN);
        Teleport.Message memory m = _msg(HOME_CHAIN, REMOTE_CHAIN, 1, friend, 10e6);
        uint256[] memory keys = new uint256[](2);
        uint256 rogue = uint256(keccak256("rogue"));
        keys[0] = pk[0];
        keys[1] = rogue;
        if (vm.addr(keys[0]) > vm.addr(keys[1])) (keys[0], keys[1]) = (keys[1], keys[0]);
        bytes[] memory sigs = _sign(remote, m, keys);
        vm.expectRevert(Teleport.BadSignatures.selector);
        remote.bridgeIn(m, sigs);
    }

    function test_revert_signedForDifferentContract() public {
        // a signature over the HOME domain is useless on the REMOTE contract
        vm.chainId(HOME_CHAIN);
        Teleport.Message memory m = _msg(REMOTE_CHAIN, HOME_CHAIN, 1, friend, 10e6);
        bytes[] memory forHome = _sign(home, m, _pair(0, 1));
        vm.chainId(REMOTE_CHAIN);
        Teleport.Message memory m2 = _msg(HOME_CHAIN, REMOTE_CHAIN, 1, friend, 10e6);
        vm.expectRevert(Teleport.BadSignatures.selector);
        remote.bridgeIn(m2, forHome);
    }

    function test_revert_wrongDestinationChain() public {
        vm.chainId(REMOTE_CHAIN);
        Teleport.Message memory m = _msg(HOME_CHAIN, 12345, 1, friend, 10e6);
        bytes[] memory sigs = _sign(remote, m, _pair(0, 1));
        vm.expectRevert(Teleport.WrongDestination.selector);
        remote.bridgeIn(m, sigs);
    }

    function test_revert_amountTampered() public {
        vm.chainId(REMOTE_CHAIN);
        Teleport.Message memory m = _msg(HOME_CHAIN, REMOTE_CHAIN, 1, friend, 10e6);
        bytes[] memory sigs = _sign(remote, m, _pair(0, 1));
        m.amount = 9_000e6;
        vm.expectRevert(Teleport.BadSignatures.selector);
        remote.bridgeIn(m, sigs);
    }

    // ───────── safety rails ─────────
    function test_revert_overTxCap() public {
        vm.chainId(HOME_CHAIN);
        pusd.mint(user, 100_000e6);
        vm.startPrank(user);
        pusd.approve(address(home), type(uint256).max);
        vm.expectRevert(Teleport.OverTxCap.selector);
        home.bridgeOut(REMOTE_CHAIN, friend, 10_001e6);
        vm.stopPrank();
    }

    function test_dailyCapResetsAfterWindow() public {
        vm.chainId(HOME_CHAIN);
        pusd.mint(user, 100_000e6);
        vm.startPrank(user);
        pusd.approve(address(home), type(uint256).max);
        for (uint256 i; i < 5; i++) home.bridgeOut(REMOTE_CHAIN, friend, 10_000e6);
        vm.expectRevert(Teleport.OverDailyCap.selector);
        home.bridgeOut(REMOTE_CHAIN, friend, 1e6);
        vm.warp(block.timestamp + 1 days);
        home.bridgeOut(REMOTE_CHAIN, friend, 1e6);
        vm.stopPrank();
    }

    function test_pauseBlocksBothDirections() public {
        vm.chainId(HOME_CHAIN);
        home.setPaused(true);
        vm.prank(user);
        vm.expectRevert(Teleport.Paused.selector);
        home.bridgeOut(REMOTE_CHAIN, friend, 1e6);

        Teleport.Message memory m = _msg(REMOTE_CHAIN, HOME_CHAIN, 3, friend, 1e6);
        bytes[] memory sigs = _sign(home, m, _pair(0, 1));
        vm.expectRevert(Teleport.Paused.selector);
        home.bridgeIn(m, sigs);
    }

    function test_revert_unsupportedChain() public {
        vm.chainId(HOME_CHAIN);
        vm.prank(user);
        vm.expectRevert(Teleport.UnsupportedChain.selector);
        home.bridgeOut(999, friend, 1e6);
    }

    function test_onlyOwnerAdmin() public {
        vm.prank(user);
        vm.expectRevert(Teleport.NotOwner.selector);
        home.setPaused(true);
        vm.prank(user);
        vm.expectRevert(Teleport.NotOwner.selector);
        home.setSupportedChain(1, true);

        address[] memory list = new address[](2);
        list[0] = relayer[0];
        list[1] = relayer[0];
        vm.expectRevert(Teleport.BadConfig.selector); // duplicate relayer
        home.setRelayers(list, 1);
        list[1] = relayer[1];
        vm.expectRevert(Teleport.BadConfig.selector); // threshold above set size
        home.setRelayers(list, 3);
    }

    function test_wrappedToken_onlyBridgeMintsAndBurns() public {
        vm.expectRevert(WrappedToken.NotBridge.selector);
        wpusd.mint(user, 1);
        vm.expectRevert(WrappedToken.NotBridge.selector);
        wpusd.burnFrom(user, 1);
        vm.expectRevert(WrappedToken.BridgeAlreadySet.selector);
        wpusd.setBridge(address(1));
    }

    function test_domainBindsContractAndChain() public {
        vm.chainId(HOME_CHAIN);
        bytes32 a = home.domainSeparator();
        vm.chainId(REMOTE_CHAIN);
        assertTrue(a != home.domainSeparator());
        assertTrue(remote.domainSeparator() != home.domainSeparator());
    }
}
