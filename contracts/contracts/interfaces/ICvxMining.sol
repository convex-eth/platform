// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface ICvxMining {
    function ConvertCrvToCvx(uint256 _amount) external view returns(uint256);
}