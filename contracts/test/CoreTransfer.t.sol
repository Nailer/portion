// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {CoreTransfer} from "../src/lib/CoreTransfer.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
contract TransferHarness {
    using CoreTransfer for IERC20;
    function send(address token) external { IERC20(token).safeTransfer(address(0xABCD), 123); }
    function pull(address token) external { IERC20(token).safeTransferFrom(address(0xCAFE), address(0xABCD), 123); }
}
contract ReturnToken {
    uint256 immutable mode;
    bytes public received;
    constructor(uint256 mode_) { mode = mode_; }
    fallback() external {
        received = msg.data;
        uint256 m = mode;
        assembly ("memory-safe") {
            switch m
            case 0 { return(0, 0) }
            case 1 { mstore(0, 1) return(0, 32) }
            case 2 { mstore(0, 0) return(0, 32) }
            case 3 { mstore(0, 1) return(31, 1) }
            case 4 { mstore(0, 2) return(0, 32) }
            default { revert(0, 0) }
        }
    }
}
contract CoreTransferTest is Test {
    function test_acceptsCanonicalTrueAndEmptyReturnsWithExactArguments() public {
        TransferHarness h = new TransferHarness();
        for (uint256 mode; mode < 2; mode++) {
            ReturnToken token = new ReturnToken(mode);
            h.send(address(token));
            assertEq(token.received(), abi.encodeCall(IERC20.transfer, (address(0xABCD), 123)));
            h.pull(address(token));
            assertEq(token.received(), abi.encodeCall(IERC20.transferFrom, (address(0xCAFE), address(0xABCD), 123)));
        }
    }
    function test_rejectsFalseShortNonBooleanAndRevertedCalls() public {
        TransferHarness h = new TransferHarness();
        for (uint256 mode = 2; mode < 6; mode++) {
            ReturnToken token = new ReturnToken(mode);
            vm.expectRevert(CoreTransfer.TransferFailed.selector); h.send(address(token));
            vm.expectRevert(CoreTransfer.TransferFailed.selector); h.pull(address(token));
        }
    }
}
