// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Wrapped stablecoin that lives on the *foreign* chain of a Teleport pair.
///         Only the Teleport contract can mint, and burning needs the holder's allowance.
contract WrappedToken {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    address public bridge;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event BridgeSet(address indexed bridge);

    error NotBridge();
    error NotOwner();
    error InsufficientBalance();
    error InsufficientAllowance();
    error BridgeAlreadySet();

    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        owner = msg.sender;
    }

    /// @notice One-shot wiring so the token and its bridge can be deployed in either order.
    function setBridge(address bridge_) external {
        if (msg.sender != owner) revert NotOwner();
        if (bridge != address(0)) revert BridgeAlreadySet();
        bridge = bridge_;
        emit BridgeSet(bridge_);
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        _spend(from, value);
        _transfer(from, to, value);
        return true;
    }

    function mint(address to, uint256 value) external {
        if (msg.sender != bridge) revert NotBridge();
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function burnFrom(address from, uint256 value) external {
        if (msg.sender != bridge) revert NotBridge();
        _spend(from, value);
        if (balanceOf[from] < value) revert InsufficientBalance();
        balanceOf[from] -= value;
        totalSupply -= value;
        emit Transfer(from, address(0), value);
    }

    function _spend(address from, uint256 value) private {
        if (from == msg.sender) return;
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) {
            if (a < value) revert InsufficientAllowance();
            allowance[from][msg.sender] = a - value;
        }
    }

    function _transfer(address from, address to, uint256 value) private {
        if (balanceOf[from] < value) revert InsufficientBalance();
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}
