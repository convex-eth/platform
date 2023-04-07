// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IStakingWrapper {
    function initialize(uint256 _poolId) external;
    function setExtraReward(address) external;
    function setRewardHook(address) external;
    function getReward(address) external;
    function getReward(address,address) external;
    function user_checkpoint(address) external;
    function rewardLength() external view returns(uint256);
    function rewardHook() external view returns(address);
    function totalSupply() external view returns(uint256);
    function balanceOf(address _account) external view returns (uint256);
}