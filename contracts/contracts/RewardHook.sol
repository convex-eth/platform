// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';


/*
   Test Reward hook for stash
*/
contract RewardHook{
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;


    address public immutable rewardToken;
    address public immutable stash;


    constructor(address _stash, address _reward) public {
        stash = _stash;
        rewardToken = _reward;
    }


    function onRewardClaim() external{

        //get balance
        uint256 bal = IERC20(rewardToken).balanceOf(address(this));

        //send
        IERC20(rewardToken).safeTransfer(stash,bal);
    }
}