// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


//This is currently only a test contract to test extra rewards on master chef
contract ChefExtraRewards{
    using SafeERC20 for IERC20;
    
    IERC20 public rewardToken;
    address public chef;

    constructor(
        address chef_,
        address reward_
    ) public {
        chef = chef_;
        rewardToken = IERC20(reward_);
    }

    function pendingTokens(uint256 _pid, address _account, uint256 _sushiAmount) external view returns (IERC20[] memory, uint256[] memory) {
        IERC20[] memory tokens = new IERC20[](1);
        tokens[0] = rewardToken;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _sushiAmount;
        return (tokens,amounts);
    }


    function onReward(uint256 _pid, address _account, address _recipient, uint256 _sushiAmount, uint256 _newLpAmount) external{
        require(msg.sender == chef,"!auth");

        safeRewardTransfer(_recipient,_sushiAmount);
    }

    function safeRewardTransfer(address _to, uint256 _amount) internal {
        uint256 bal = rewardToken.balanceOf(address(this));
        if (_amount > bal) {
            rewardToken.safeTransfer(_to, bal);
        } else {
            rewardToken.safeTransfer(_to, _amount);
        }
    }

}