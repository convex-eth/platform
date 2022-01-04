// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import '@openzeppelin/contracts/utils/Address.sol';
import "@openzeppelin/contracts/access/Ownable.sol";

contract VotingEligibility is Ownable{
    using Address for address;

    mapping(address => bool) public blockList;
    mapping(address => bool) public allowedList;
    bool public useBlock = true;
    bool public useAllow = false;

    event changeBlock(address indexed _account, bool _state);
    event changeAllow(address indexed _account, bool _state);

    constructor() public {}

    function setUseBlock(bool _b) external onlyOwner{
        useBlock = _b;
    }

    function setUseAllow(bool _a) external onlyOwner{
        useAllow = _a;
    }

    function setAccountBlock(address _account, bool _block) external onlyOwner{
        blockList[_account] = _block;
        emit changeBlock(_account, _block);
    }

    function setAccountAllow(address _account, bool _allowed) external onlyOwner{
        allowedList[_account] = _allowed;
        emit changeAllow(_account, _allowed);
    }

    function isEligible(address _account) external view returns(bool){

        if(useBlock){
            if(blockList[_account]){
                return false;
            }
        }

        if(useAllow){
            if(Address.isContract(_account) && !allowedList[_account]){
                return false;
            }
        }

        return true;
    }
}