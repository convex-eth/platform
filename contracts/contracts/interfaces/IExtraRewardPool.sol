// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IExtraRewardPool{
    enum PoolType{
        Single,
        Multi
    }
    function rewardToken() external view returns(address);
    function periodFinish() external view returns(uint256);
    function rewardRate() external view returns(uint256);
    function totalSupply() external view returns(uint256);
    function balanceOf(address _account) external view returns(uint256);
    function poolType() external view returns(PoolType);
    function poolVersion() external view returns(uint256);
}