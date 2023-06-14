// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IStashTokenWrapper {
    function init(address _token, address _rewardpool) external;
    function isInvalid() external returns(bool);
    function setInvalid(bool _isInvalid) external;
}