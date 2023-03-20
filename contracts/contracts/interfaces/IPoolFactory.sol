// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IPoolFactory {
    function deploy_plain_pool(string calldata, string calldata, address[4] calldata, uint256, uint256, uint256, uint256, uint256) external returns(address);
}

// def deploy_plain_pool(
//     _name: String[32],
//     _symbol: String[10],
//     _coins: address[4],
//     _A: uint256,
//     _fee: uint256,
//     _asset_type: uint256 = 0,
//     _implementation_idx: uint256 = 0,
//     _ma_exp_time: uint256 = 600
// ) -> address: