// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';


//Dummy token for master chef plugin
contract ChefToken is ERC20 {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public operator;

    constructor()
        public
        ERC20(
            "Chef Token",
            "cvxCT"
        ){
        operator =  msg.sender;
    }
    
    function create() external {
        require(msg.sender == operator, "!authorized");
        
        _mint(operator, 1e18);
        operator = address(0);
    }

}