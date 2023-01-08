// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IPoolAddHook {
    function poolAdded(address _gauge, uint256 _stashVersion, uint256 _poolId) external;
}