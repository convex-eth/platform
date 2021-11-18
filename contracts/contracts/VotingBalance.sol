// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;


import "./interfaces/ILockedCvx.sol";
import '@openzeppelin/contracts/utils/Address.sol';
import "@openzeppelin/contracts/access/Ownable.sol";

contract VotingBalance is Ownable{
    using Address for address;

    address public constant locker = address(0xD18140b4B819b895A3dba5442F959fA44994AF50);

    mapping(address => bool) blockList;
    mapping(address => bool) allowedList;
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

    function balanceOf(address _account) external view returns(uint256){
        if(useBlock){
            if(blockList[_account]){
                return 0;
            }
        }

        if(useAllow){
            if(Address.isContract(_account) && !allowedList[_account]){
                return 0;
            }
        }

        return ILockedCvx(locker).balanceOf(_account);
    }

    function totalSupply() view external returns(uint256){
        return ILockedCvx(locker).totalSupply();
    }
}