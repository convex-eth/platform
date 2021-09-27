// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

//Dummy token for master chef plugin
contract ChefToken is ERC20 {

    bool public isInit;

    constructor()
        public
        ERC20(
            "Chef Token",
            "cvxCT"
        ){
    }
    
    function create() external {
        require(!isInit, "init");
        
        _mint(msg.sender, 1e18);
        isInit = true;
    }

}