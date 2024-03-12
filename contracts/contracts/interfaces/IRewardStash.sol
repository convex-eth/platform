// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IRewardStash{
    function rewardHook() external view returns(address);
    function setRewardHook(address _hook) external;
    function setExtraReward(address _token) external;

}