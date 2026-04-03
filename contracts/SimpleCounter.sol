// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SimpleCounter
/// @notice A minimal on-chain counter for testing contract interactions in MiniPay.
/// @dev Deploy to Celo Sepolia testnet and set VITE_COUNTER_CONTRACT_ADDRESS in .env
contract SimpleCounter {
    uint256 private _count;

    event CounterChanged(uint256 newCount, address indexed changedBy);

    function getCount() external view returns (uint256) {
        return _count;
    }

    function increment() external {
        _count++;
        emit CounterChanged(_count, msg.sender);
    }

    function decrement() external {
        require(_count > 0, "SimpleCounter: already at zero");
        _count--;
        emit CounterChanged(_count, msg.sender);
    }

    function reset() external {
        _count = 0;
        emit CounterChanged(_count, msg.sender);
    }
}
