// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IRescueStash {
    function setDistribution(address _distributor, address _rewardDeposit, address _treasury) external;
    function setExtraReward(address _token, uint256 _option) external;
    function claimRewardToken(address _token) external returns (bool);
}