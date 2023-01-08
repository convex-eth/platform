// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IStakingWrapper {
    function rewardHook() external view returns(address);
    function totalSupply() external view returns(uint256);
    function balanceOf(address _account) external view returns (uint256);
}