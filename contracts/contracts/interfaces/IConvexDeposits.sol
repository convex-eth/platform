// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IConvexDeposits {
    function deposit(uint256 _pid, uint256 _amount, bool _stake) external returns(bool);
    function deposit(uint256 _amount, bool _lock, address _stakeAddress) external;
}