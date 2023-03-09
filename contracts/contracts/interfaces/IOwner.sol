// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IOwner {
    function setPendingOwner(address _powner) external;
    function acceptPendingOwner() external;
    function owner() external view returns(address);
    function pendingOwner() external view returns(address);
}