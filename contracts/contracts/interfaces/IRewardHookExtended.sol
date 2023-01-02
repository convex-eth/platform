// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IRewardHookExtended {
    function onRewardClaim() external;
    function poolRewardLength(address _pool) external view returns(uint256);
    function poolRewardList(address _pool, uint256 _index) external view returns(address _rewardContract);
}