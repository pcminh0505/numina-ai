// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {NumerologyReading} from "../contracts/NumerologyReading.sol";

/// @dev Minimal mock USDC — no decimals or events needed for tests.
contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (allowance[from][msg.sender] < amount) return false;
        if (balanceOf[from] < amount) return false;
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract NumerologyReadingTest is Test {
    // Mirror events for expectEmit assertions
    event AdvancedUnlocked(address indexed user);
    event CreditsPurchased(address indexed user, uint256 credits);

    NumerologyReading public reading;
    MockUSDC          public usdc;

    address public treasury     = address(0xFee);
    address public alice        = address(0xA11ce);
    address public bob          = address(0xB0b);
    address public serverOwner  = address(0x5afe);   // simulates the API server wallet

    uint256 constant ADVANCED_PRICE = 500_000; // $0.50 USDC (6 dec)
    uint256 constant CREDITS_PRICE  = 200_000; // $0.20 USDC (6 dec)

    function setUp() public {
        usdc    = new MockUSDC();
        reading = new NumerologyReading(
            address(usdc), treasury, ADVANCED_PRICE, CREDITS_PRICE, serverOwner
        );
        usdc.mint(alice, 10_000_000);
        usdc.mint(bob,   10_000_000);
    }

    // ── unlockAdvanced ──────────────────────────────────────────────────────

    function test_unlockAdvanced_happy() public {
        vm.startPrank(alice);
        usdc.approve(address(reading), ADVANCED_PRICE);
        reading.unlockAdvanced();
        vm.stopPrank();

        assertTrue(reading.hasAdvanced(alice));
        assertEq(usdc.balanceOf(treasury), ADVANCED_PRICE);
    }

    function test_unlockAdvanced_revert_double() public {
        vm.startPrank(alice);
        usdc.approve(address(reading), ADVANCED_PRICE * 2);
        reading.unlockAdvanced();
        vm.expectRevert(NumerologyReading.AlreadyUnlocked.selector);
        reading.unlockAdvanced();
        vm.stopPrank();
    }

    function test_unlockAdvanced_revert_no_approval() public {
        vm.prank(alice);
        vm.expectRevert(NumerologyReading.TransferFailed.selector);
        reading.unlockAdvanced();
    }

    function test_unlockAdvanced_does_not_affect_other_user() public {
        vm.startPrank(alice);
        usdc.approve(address(reading), ADVANCED_PRICE);
        reading.unlockAdvanced();
        vm.stopPrank();

        assertFalse(reading.hasAdvanced(bob));
    }

    // ── buyCredits ──────────────────────────────────────────────────────────

    function test_buyCredits_one_pack() public {
        vm.startPrank(alice);
        usdc.approve(address(reading), CREDITS_PRICE);
        reading.buyCredits(1);
        vm.stopPrank();

        assertEq(reading.creditsPurchased(alice), 20);
        assertEq(usdc.balanceOf(treasury), CREDITS_PRICE);
    }

    function test_buyCredits_multiple_packs() public {
        vm.startPrank(alice);
        usdc.approve(address(reading), CREDITS_PRICE * 3);
        reading.buyCredits(3);
        vm.stopPrank();

        assertEq(reading.creditsPurchased(alice), 60);
        assertEq(usdc.balanceOf(treasury), CREDITS_PRICE * 3);
    }

    function test_buyCredits_accumulates() public {
        vm.startPrank(alice);
        usdc.approve(address(reading), CREDITS_PRICE * 2);
        reading.buyCredits(1);
        reading.buyCredits(1);
        vm.stopPrank();

        assertEq(reading.creditsPurchased(alice), 40);
    }

    function test_buyCredits_max_packs() public {
        vm.startPrank(alice);
        usdc.approve(address(reading), CREDITS_PRICE * 10);
        reading.buyCredits(10);
        vm.stopPrank();

        assertEq(reading.creditsPurchased(alice), 200);
    }

    function test_buyCredits_revert_zero_packs() public {
        vm.prank(alice);
        vm.expectRevert(NumerologyReading.InvalidPacks.selector);
        reading.buyCredits(0);
    }

    function test_buyCredits_revert_too_many_packs() public {
        vm.startPrank(alice);
        usdc.approve(address(reading), CREDITS_PRICE * 11);
        vm.expectRevert(NumerologyReading.InvalidPacks.selector);
        reading.buyCredits(11);
        vm.stopPrank();
    }

    function test_buyCredits_revert_no_approval() public {
        vm.prank(alice);
        vm.expectRevert(NumerologyReading.TransferFailed.selector);
        reading.buyCredits(1);
    }

    // ── independence between users ──────────────────────────────────────────

    function test_users_are_independent() public {
        vm.startPrank(alice);
        usdc.approve(address(reading), ADVANCED_PRICE + CREDITS_PRICE);
        reading.unlockAdvanced();
        reading.buyCredits(1);
        vm.stopPrank();

        assertFalse(reading.hasAdvanced(bob));
        assertEq(reading.creditsPurchased(bob), 0);
    }

    // ── recordAdvancedUnlock (server-gated) ─────────────────────────────────

    function test_recordAdvancedUnlock_happy() public {
        vm.prank(serverOwner);
        reading.recordAdvancedUnlock(alice);
        assertTrue(reading.hasAdvanced(alice));
    }

    function test_recordAdvancedUnlock_revert_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert(NumerologyReading.Unauthorized.selector);
        reading.recordAdvancedUnlock(alice);
    }

    function test_recordAdvancedUnlock_revert_double() public {
        vm.prank(serverOwner);
        reading.recordAdvancedUnlock(alice);
        vm.prank(serverOwner);
        vm.expectRevert(NumerologyReading.AlreadyUnlocked.selector);
        reading.recordAdvancedUnlock(alice);
    }

    // ── recordCreditsPurchase (server-gated) ─────────────────────────────────

    function test_recordCreditsPurchase_happy() public {
        vm.prank(serverOwner);
        reading.recordCreditsPurchase(alice, 1);
        assertEq(reading.creditsPurchased(alice), 20);
    }

    function test_recordCreditsPurchase_accumulates() public {
        vm.prank(serverOwner);
        reading.recordCreditsPurchase(alice, 2);
        vm.prank(serverOwner);
        reading.recordCreditsPurchase(alice, 1);
        assertEq(reading.creditsPurchased(alice), 60);
    }

    function test_recordCreditsPurchase_revert_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert(NumerologyReading.Unauthorized.selector);
        reading.recordCreditsPurchase(alice, 1);
    }

    function test_recordCreditsPurchase_revert_zero_packs() public {
        vm.prank(serverOwner);
        vm.expectRevert(NumerologyReading.InvalidPacks.selector);
        reading.recordCreditsPurchase(alice, 0);
    }

    // ── events ──────────────────────────────────────────────────────────────

    function test_unlockAdvanced_emits_event() public {
        vm.startPrank(alice);
        usdc.approve(address(reading), ADVANCED_PRICE);
        vm.expectEmit(true, false, false, false);
        emit AdvancedUnlocked(alice);
        reading.unlockAdvanced();
        vm.stopPrank();
    }

    function test_buyCredits_emits_event() public {
        vm.startPrank(alice);
        usdc.approve(address(reading), CREDITS_PRICE);
        vm.expectEmit(true, false, false, true);
        emit CreditsPurchased(alice, 20);
        reading.buyCredits(1);
        vm.stopPrank();
    }
}
