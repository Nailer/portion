// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "../interfaces/IERC20.sol";
library CoreTransfer {
    error TransferFailed();
    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
        assembly ("memory-safe") {
            let p := mload(0x40)
            mstore(p, shl(224, 0xa9059cbb))
            mstore(add(p, 4), and(to, 0xffffffffffffffffffffffffffffffffffffffff))
            mstore(add(p, 36), amount)
            let ok := call(gas(), token, 0, p, 68, 0, 32)
            if iszero(and(ok, or(iszero(returndatasize()), and(gt(returndatasize(), 31), eq(mload(0), 1))))) {
                mstore(0, shl(224, 0x90b8ec18)) revert(0, 4)
            }
        }
    }
    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        assembly ("memory-safe") {
            let p := mload(0x40)
            mstore(p, shl(224, 0x23b872dd))
            mstore(add(p, 4), and(from, 0xffffffffffffffffffffffffffffffffffffffff))
            mstore(add(p, 36), and(to, 0xffffffffffffffffffffffffffffffffffffffff))
            mstore(add(p, 68), amount)
            let ok := call(gas(), token, 0, p, 100, 0, 32)
            if iszero(and(ok, or(iszero(returndatasize()), and(gt(returndatasize(), 31), eq(mload(0), 1))))) {
                mstore(0, shl(224, 0x90b8ec18)) revert(0, 4)
            }
        }
    }
}
