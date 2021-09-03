// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IBentoBox {
    function toAmount(address _token, uint256 _share, bool _roundUp) external view returns (uint);
    function deposit(
        address token_,
        address from,
        address to,
        uint256 amount,
        uint256 share
    ) external returns (uint256 amountOut, uint256 shareOut);
}