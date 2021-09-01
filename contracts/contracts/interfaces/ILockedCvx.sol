// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface ILockedCvx{
    function lock(address _account, uint256 _amount, uint256 _spendRatio) external;
    function processExpiredLocks(bool _relock, uint256 _spendRatio, address _withdrawTo) external;
    function getReward(address _account, bool _stake) external;
}