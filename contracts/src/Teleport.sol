// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {SafeTransfer} from "./lib/SafeTransfer.sol";

interface IBridgedToken is IERC20 {
    function mint(address to, uint256 value) external;
    function burnFrom(address from, uint256 value) external;
}

/// @title Teleport
/// @notice Two-way stablecoin bridge between Portaldot V3 and another EVM chain (BNB Chain testnet).
///
/// Deployed once per chain:
///  - HOME mode (Portaldot): the token is the native pUSD asset seen as an ERC-20. Teleporting *out* locks it
///    here, teleporting *in* releases it from the pool.
///  - REMOTE mode (foreign chain): the token is a `WrappedToken`. Teleporting out burns, in mints.
///
/// A transfer is released on the destination chain only with `threshold` distinct relayer signatures over an
/// EIP-712 message bound to the destination chain id and this contract's address. Replays are blocked by
/// (srcChainId, nonce). Per-transfer and rolling-day caps bound the damage of a compromised relayer set.
///
/// Trust model v0 (disclosed): an owner-managed relayer quorum. The roadmap replaces it with verification of
/// Portaldot's BEEFY/MMR commitments (the runtime already produces them) so the foreign chain trusts the
/// validator set instead of a relayer committee.
contract Teleport {
    using SafeTransfer for IERC20;

    struct Message {
        uint256 srcChainId;
        uint256 dstChainId;
        uint256 nonce;
        address recipient;
        uint256 amount;
    }

    error NotOwner();
    error Paused();
    error UnsupportedChain();
    error AmountZero();
    error OverTxCap();
    error OverDailyCap();
    error AlreadyProcessed();
    error WrongDestination();
    error BadSignatures();
    error BadConfig();

    bytes32 public constant MESSAGE_TYPEHASH =
        keccak256("Message(uint256 srcChainId,uint256 dstChainId,uint256 nonce,address recipient,uint256 amount)");
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    IERC20 public immutable token;
    bool public immutable remote;

    address public owner;
    bool public paused;
    uint256 public nonce;
    uint256 public threshold;
    uint256 public maxPerTx;
    uint256 public dailyCap;
    uint256 public windowStart;
    uint256 public windowUsed;
    address[] private _relayers;

    mapping(address => bool) public isRelayer;
    mapping(uint256 => bool) public supportedChain;
    mapping(uint256 => mapping(uint256 => bool)) public processed;

    event BridgeOut(uint256 indexed nonce, uint256 indexed dstChainId, address indexed sender, address recipient, uint256 amount);
    event BridgeIn(uint256 indexed srcChainId, uint256 indexed nonce, address indexed recipient, uint256 amount);
    event RelayersSet(address[] relayers, uint256 threshold);
    event Liquidity(address indexed from, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IERC20 token_, bool remote_, uint256 maxPerTx_, uint256 dailyCap_) {
        token = token_;
        remote = remote_;
        owner = msg.sender;
        maxPerTx = maxPerTx_;
        dailyCap = dailyCap_;
    }

    // ───────────────────────────── user flow ──────────────────────────

    function bridgeOut(uint256 dstChainId, address recipient, uint256 amount) external returns (uint256 n) {
        if (paused) revert Paused();
        if (!supportedChain[dstChainId]) revert UnsupportedChain();
        if (amount == 0) revert AmountZero();
        _spendCap(amount);

        n = nonce++;
        if (remote) IBridgedToken(address(token)).burnFrom(msg.sender, amount);
        else token.safeTransferFrom(msg.sender, address(this), amount);

        emit BridgeOut(n, dstChainId, msg.sender, recipient, amount);
    }

    /// @param sigs 65-byte signatures (r,s,v), ordered by ascending signer address.
    function bridgeIn(Message calldata m, bytes[] calldata sigs) external {
        if (paused) revert Paused();
        if (m.dstChainId != block.chainid) revert WrongDestination();
        if (!supportedChain[m.srcChainId]) revert UnsupportedChain();
        if (processed[m.srcChainId][m.nonce]) revert AlreadyProcessed();
        if (m.amount == 0) revert AmountZero();
        _spendCap(m.amount);

        bytes32 digest = hashMessage(m);
        uint256 t = threshold;
        if (t == 0 || sigs.length < t) revert BadSignatures();
        address last;
        for (uint256 i; i < t; i++) {
            address signer = _recover(digest, sigs[i]);
            if (!isRelayer[signer] || signer <= last) revert BadSignatures();
            last = signer;
        }

        processed[m.srcChainId][m.nonce] = true;
        if (remote) IBridgedToken(address(token)).mint(m.recipient, m.amount);
        else token.safeTransfer(m.recipient, m.amount);

        emit BridgeIn(m.srcChainId, m.nonce, m.recipient, m.amount);
    }

    /// @notice Add liquidity to a HOME-mode pool so inbound transfers can be released.
    function addLiquidity(uint256 amount) external {
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Liquidity(msg.sender, amount);
    }

    // ───────────────────────────── views ──────────────────────────────

    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256("PortionTeleport"), keccak256("1"), block.chainid, address(this))
        );
    }

    function hashMessage(Message calldata m) public view returns (bytes32) {
        bytes32 structHash =
            keccak256(abi.encode(MESSAGE_TYPEHASH, m.srcChainId, m.dstChainId, m.nonce, m.recipient, m.amount));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    function relayers() external view returns (address[] memory) {
        return _relayers;
    }

    // ───────────────────────────── admin ──────────────────────────────

    function setRelayers(address[] calldata list, uint256 threshold_) external onlyOwner {
        if (threshold_ == 0 || threshold_ > list.length) revert BadConfig();
        for (uint256 i; i < _relayers.length; i++) isRelayer[_relayers[i]] = false;
        delete _relayers;
        for (uint256 i; i < list.length; i++) {
            if (list[i] == address(0) || isRelayer[list[i]]) revert BadConfig();
            isRelayer[list[i]] = true;
            _relayers.push(list[i]);
        }
        threshold = threshold_;
        emit RelayersSet(list, threshold_);
    }

    function setSupportedChain(uint256 chainId, bool on) external onlyOwner {
        supportedChain[chainId] = on;
    }

    function setCaps(uint256 maxPerTx_, uint256 dailyCap_) external onlyOwner {
        maxPerTx = maxPerTx_;
        dailyCap = dailyCap_;
    }

    function setPaused(bool p) external onlyOwner {
        paused = p;
    }

    function transferOwnership(address o) external onlyOwner {
        if (o == address(0)) revert BadConfig();
        owner = o;
    }

    // ───────────────────────────── internals ──────────────────────────

    function _spendCap(uint256 amount) private {
        if (amount > maxPerTx) revert OverTxCap();
        if (block.timestamp >= windowStart + 1 days) {
            windowStart = block.timestamp;
            windowUsed = 0;
        }
        if (windowUsed + amount > dailyCap) revert OverDailyCap();
        windowUsed += amount;
    }

    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address) {
        if (sig.length != 65) revert BadSignatures();
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        // reject malleable signatures
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) revert BadSignatures();
        address a = ecrecover(digest, v, r, s);
        if (a == address(0)) revert BadSignatures();
        return a;
    }
}
