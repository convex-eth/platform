// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IBoosterAdmin {
    function owner() external view returns(address);
    function stashRewardManager() external view returns(address);
    function setStashRewardManager(address _mng) external;
    function acceptStashRewardManager() external;
    function setStashExtraReward(uint256 _pid, address _token) external;
    function setStashRewardHook(uint256 _pid, address _hook) external;
    function setStashTokenIsValid(address stashToken, bool isValid) external;
}