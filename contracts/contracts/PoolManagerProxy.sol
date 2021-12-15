// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";

/*
Immutable pool manager proxy to enforce that there are no multiple pools of the same gauge
as well as new lp tokens are not gauge tokens
*/
contract PoolManagerProxy{

    address public constant pools = address(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    address public owner;
    address public operator;

    constructor() public {
        //default to multisig
        owner = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB);
        operator = msg.sender;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");
        _;
    }

    modifier onlyOperator() {
        require(operator == msg.sender, "!op");
        _;
    }

    function setOwner(address _owner) external onlyOwner{
        owner = _owner;
    }

    function setOperator(address _operator) external onlyOwner{
        operator = _operator;
    }

    // sealed to be immutable
    // function revertControl() external{
    // }

    //shutdown a pool - only OWNER
    function shutdownPool(uint256 _pid) external onlyOwner returns(bool){
        IPools(pools).shutdownPool(_pid);
        return true;
    }

    //add a new pool - only OPERATOR
    function addPool(address _lptoken, address _gauge, uint256 _stashVersion) external onlyOperator returns(bool){

        require(_gauge != address(0),"gauge is 0");
        require(_lptoken != address(0),"lp token is 0");

        //check if a pool with this gauge already exists
        bool gaugeExists = IPools(pools).gaugeMap(_gauge);
        require(!gaugeExists, "already registered gauge");

        //must also check that the lp token is not a registered gauge
        //because curve gauges are tokenized
        gaugeExists = IPools(pools).gaugeMap(_lptoken);
        require(!gaugeExists, "already registered lptoken");

        IPools(pools).addPool(_lptoken,_gauge,_stashVersion);

        return true;
    }
}