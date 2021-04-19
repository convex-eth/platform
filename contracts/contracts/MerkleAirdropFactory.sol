// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./MerkleAirdrop.sol";
import '@openzeppelin/contracts/utils/Address.sol';

contract MerkleAirdropFactory {
    using Address for address;

    event Created(address indexed drop);

    function CreateMerkleAirdrop() external returns(address){
        MerkleAirdrop drop = new MerkleAirdrop(msg.sender);
        emit Created(address(drop));
        return address(drop);
    }
}
