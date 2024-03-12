// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IBoosterRewardManager {
    function defaultHook() external view returns(address);
    function initializePool(uint256 _pid) external;
    function setStashRewardManager(address _mng) external;
    function setStashExtraReward(uint256 _pid, address _token) external;
    function setStashRewardHook(uint256 _pid, address _hook) external;
    function setMultiStashRewardHook(uint256[] calldata _pids, address _hook) external;
    function setStashTokenIsValid(address stashToken, bool isValid) external;
}