// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./interfaces/IVoterProxy.sol";

//minimal placehodler contract that has isShutdown interface
contract BoosterPlaceholder{

    address public constant voterproxy = address(0x989AEb4d175e16225E39E87d0D97A3360524AD80);

    bool public isShutdown;

    constructor() public {
    }

    modifier onlyOwner() {
        require(IVoterProxy(voterproxy).owner() == msg.sender, "!owner");
        _;
    }

    function shutdownSystem(bool _isShutdown) external onlyOwner{
        isShutdown = _isShutdown;
    }
}