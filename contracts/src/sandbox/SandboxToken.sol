// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Browser sandbox only. Stands in for a native asset's ERC-20 precompile so the real Core v2 bytecode can run
///      in an in-browser EVM. It has no constructor: the sandbox places its runtime code at each precompile address.
///      `mint` is open to anyone because sandbox tokens are pretend money with no value. Never deploy this contract.
contract SandboxToken {
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 v) external {
        totalSupply += v;
        balanceOf[to] += v;
    }

    function approve(address s, uint256 v) external returns (bool) {
        allowance[msg.sender][s] = v;
        return true;
    }

    function transfer(address to, uint256 v) external returns (bool) {
        require(balanceOf[msg.sender] >= v, "balance");
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
        return true;
    }

    function transferFrom(address f, address to, uint256 v) external returns (bool) {
        require(allowance[f][msg.sender] >= v, "allowance");
        require(balanceOf[f] >= v, "balance");
        allowance[f][msg.sender] -= v;
        balanceOf[f] -= v;
        balanceOf[to] += v;
        return true;
    }
}
