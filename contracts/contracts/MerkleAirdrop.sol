// SPDX-License-Identifier: APACHE
/**
 * Copyright (C) 2018  Smartz, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).
 */
/*
Changes by Convex
- update to solidity 0.6.12
- allow different types of claiming(transfer, mint, generic interaction with seperate contract)
*/

pragma solidity 0.6.12;

import "./Interfaces.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

contract MerkleAirdrop {
    using SafeERC20 for IERC20;
    using Address for address;

    address public owner;
    bytes32 public merkleRoot;

    address public rewardContract;
    address public rewardToken;
    address public mintToken;

    mapping (address => bool) spent;
    event Claim(address addr, uint256 num);

    constructor(address _owner) public {
        owner = _owner;
    }

    function setOwner(address _owner) external {
        require(msg.sender == owner);
        owner = _owner;
    }

    function setRewardContract(address _rewardContract) external {
        require(msg.sender == owner);
        rewardContract = _rewardContract;
    }

    function setRewardToken(address _rewardToken) external {
        require(msg.sender == owner);
        rewardToken = _rewardToken;
    }

    function setMintToken(address _mintToken) external {
        require(msg.sender == owner);
        mintToken = _mintToken;
    }

    function setRoot(bytes32 _merkleRoot) external {
        require(msg.sender == owner);
        merkleRoot = _merkleRoot;
    }

    function addressToAsciiString(address x) internal pure returns (string memory) {
        bytes memory s = new bytes(40);
        for (uint i = 0; i < 20; i++) {
            byte b = byte(uint8(uint(x) / (2**(8*(19 - i)))));
            byte hi = byte(uint8(b) / 16);
            byte lo = byte(uint8(b) - 16 * uint8(hi));
            s[2*i] = char(hi);
            s[2*i+1] = char(lo);
        }
        return string(s);
    }

    function char(byte b) internal pure returns (byte c) {
        if (uint8(b) < 10) return byte(uint8(b) + 0x30);
        else return byte(uint8(b) + 0x57);
    }

    function uintToStr(uint _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len;
        while (_i != 0) {
            k = k-1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

    function getLeaf(address _a, uint256 _n) internal pure returns(bytes32) {
        string memory prefix = "0x";
        string memory space = " ";

        return keccak256(abi.encodePacked(prefix,addressToAsciiString(_a),space,uintToStr(_n)));
    }


    function claim(bytes32[] calldata _proof, address _who, uint256 _amount) public returns(bool) {
        require(spent[_who] != true,"already claimed");
        require(_amount > 0);
        require(checkProof(_proof, getLeaf(_who, _amount)),"failed proof check");

        spent[_who] = true;

        if(rewardToken != address(0)){
            //send reward token directly
            IERC20(rewardToken).safeTransfer(_who, _amount);
        }else if(mintToken != address(0)){
            //mint tokens directly
            ITokenMinter(mintToken).mint(_who, _amount);
        }else{
            //inform a different reward contract that a claim has been made
            address[] memory recip = new address[](1);
            recip[0] = _who;
            uint256[] memory amounts = new uint256[](1);
            amounts[0] = _amount;
            IVestedEscrow(rewardContract).fund(recip,amounts);
        }

        emit Claim(_who, _amount);
        return true;
    }

    function checkProof(bytes32[] calldata _proof, bytes32 _hash) view internal returns (bool) {
        bytes32 el;
        bytes32 h = _hash;

        for (uint i = 0; i <= _proof.length - 1; i += 1) {
            el = _proof[i];

            if (h < el) {
                h = keccak256(abi.encodePacked(h, el));
            } else {
                h = keccak256(abi.encodePacked(el, h));
            }
        }

        return h == merkleRoot;
    }
}