// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface ICvxCrvStaking {
    function userRewardBalance(address _address, uint256 _rewardGroup) external view returns(uint256);
    function rewardSupply(uint256 _rewardGroup) external view returns(uint256);
    function userRewardWeight(address _address) external view returns(uint256);
    function registeredRewards(address _address) external view returns(uint256);
    function rewards(uint256 _index) external view returns(address _token, uint8 _group, uint128 _reward_integral, uint128 _reward_remaining);
    function withdraw(uint256 _amount) external;
    function getReward(address _account) external;
    function balanceOf(address _account) external view returns (uint256);
}