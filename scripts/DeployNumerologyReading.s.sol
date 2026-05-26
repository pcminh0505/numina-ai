// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {NumerologyReading} from "../contracts/NumerologyReading.sol";

contract DeployNumerologyReading is Script {
    function run() external {
        address usdc     = vm.envAddress("DEPLOY_USDC");
        address treasury = vm.envAddress("X402_TREASURY_ADDRESS");
        uint256 advanced = vm.envUint("X402_ADVANCED_PRICE");
        uint256 credits  = vm.envUint("X402_CREDITS_PRICE");

        // owner = the API server wallet (same private key used to broadcast)
        vm.startBroadcast();
        address owner = msg.sender;
        NumerologyReading reading = new NumerologyReading(usdc, treasury, advanced, credits, owner);
        vm.stopBroadcast();

        console.log("Deployed to:", address(reading));
        console.log("Owner (server wallet):", owner);
    }
}
