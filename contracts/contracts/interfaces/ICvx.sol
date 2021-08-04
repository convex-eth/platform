// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface ICvx {
    function reductionPerCliff() external view returns(uint256);
    function totalSupply() external view returns(uint256);
    function totalCliffs() external view returns(uint256);
    function maxSupply() external view returns(uint256);
}