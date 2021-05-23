// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface EpsMerkel {
    function claim(
        uint256 merkleIndex,
        uint256 index,
        uint256 amount,
        bytes32[] calldata proof
    ) external;
}

interface EpsDistro{
    function exit() external;
}