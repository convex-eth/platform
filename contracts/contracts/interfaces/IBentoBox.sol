// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IBentoBox {
    function toAmount(address _token, uint256 _share, bool _roundUp) external view returns (uint);
}