// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

contract RedirectableGauge{
    using SafeERC20 for IERC20;
    using Address for address;

    
    mapping(address => address) public redirectMap;

    constructor() public {
    }

    function deposit(uint256 _amount) external{

    }

    function balanceOf(address _account) external view returns (uint256){
        return 0;
    }

    function withdraw(uint256 _amount) external{

    }

    function claim_rewards() external{

    }

    function reward_tokens(uint256 _token) external view returns(address){
        return address(0);
    }

    function set_rewards_receiver(address _receiver) external returns(bool){
        redirectMap[msg.sender] = _receiver;
        return true;
    }
}