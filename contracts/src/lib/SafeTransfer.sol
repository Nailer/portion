// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../interfaces/IERC20.sol";

/// @dev Tolerates tokens that return nothing as well as tokens that return a bool.
library SafeTransfer {
    error TransferFailed();

    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
        _call(address(token), abi.encodeCall(IERC20.transfer, (to, amount)));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        _call(address(token), abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
    }

    function _call(address token, bytes memory data) private {
        (bool ok, bytes memory ret) = token.call(data);
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }
}
