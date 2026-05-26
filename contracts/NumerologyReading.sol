// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev Minimal ERC-20 interface — only transferFrom is needed.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title  NumerologyReading
/// @notice On-chain payment gateway for MiniPay Numerology on Celo.
///         Stores advanced-reading unlock state and total chat-credits purchased
///         so they persist independently of the off-chain server.
contract NumerologyReading {
    IERC20  public immutable usdc;
    address public immutable treasury;
    uint256 public immutable advancedPrice;    // USDC 6-decimal units (e.g. 500000 = $0.50)
    uint256 public immutable creditsPrice;     // USDC 6-decimal units per pack (e.g. 200000 = $0.20)
    uint256 public constant  CREDITS_PER_PACK = 20;

    /// @notice Whether a wallet has unlocked the advanced reading.
    mapping(address => bool) public hasAdvanced;

    /// @notice Cumulative chat credits purchased by a wallet (never decremented).
    ///         The server tracks how many have been consumed.
    mapping(address => uint256) public creditsPurchased;

    event AdvancedUnlocked(address indexed user);
    event CreditsPurchased(address indexed user, uint256 credits);

    error AlreadyUnlocked();
    error InvalidPacks();
    error TransferFailed();

    constructor(
        address _usdc,
        address _treasury,
        uint256 _advancedPrice,
        uint256 _creditsPrice
    ) {
        usdc          = IERC20(_usdc);
        treasury      = _treasury;
        advancedPrice = _advancedPrice;
        creditsPrice  = _creditsPrice;
    }

    /// @notice Pay advancedPrice USDC to permanently unlock the advanced numerology reading.
    function unlockAdvanced() external {
        if (hasAdvanced[msg.sender]) revert AlreadyUnlocked();
        if (!usdc.transferFrom(msg.sender, treasury, advancedPrice)) revert TransferFailed();
        hasAdvanced[msg.sender] = true;
        emit AdvancedUnlocked(msg.sender);
    }

    /// @notice Buy `packs` × CREDITS_PER_PACK chat credits for `packs × creditsPrice` USDC.
    /// @param packs Number of credit packs (1–10).
    function buyCredits(uint256 packs) external {
        if (packs == 0 || packs > 10) revert InvalidPacks();
        if (!usdc.transferFrom(msg.sender, treasury, creditsPrice * packs)) revert TransferFailed();
        creditsPurchased[msg.sender] += CREDITS_PER_PACK * packs;
        emit CreditsPurchased(msg.sender, CREDITS_PER_PACK * packs);
    }
}
