// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IChef {
    function userInfo(uint256 _pid, address _account) external view returns(uint256,uint256);
    function claim(uint256 _pid, address _account) external;
    function deposit(uint256 _pid, uint256 _amount) external;
}