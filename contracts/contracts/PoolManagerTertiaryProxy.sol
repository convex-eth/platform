// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "./interfaces/IGaugeController.sol";
import "./interfaces/IBooster.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';


interface ISecondaryProxy{
    function setUsedAddress(address[] memory usedList) external;
    function shutdownSystem() external;
    function setOperator(address _operator) external;
}

/*
Immutable pool manager proxy 3

- seal add force pool
- get lptoken from gauge
- check protected pool list when shutting down
- allow booster owner to shutdown protected pools

note: this should become the owner of secondary proxy

*/
contract PoolManagerTertiaryProxy{
    using SafeMath for uint256;

    address public constant gaugeController = address(0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB);
    address public constant pools = address(0xD20904e5916113D11414F083229e9C8C6F91D1e1);
    address public constant booster = address(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    address public constant secondaryProxy = address(0xD20904e5916113D11414F083229e9C8C6F91D1e1);
    address public immutable protectedPoolManager;

    address public owner;
    address public operator;

    constructor(address _protectedPoolManager) public {
        //default to multisig
        owner = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB);
        operator = msg.sender;

        protectedPoolManager = _protectedPoolManager;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");
        _;
    }

    modifier onlyOperator() {
        require(operator == msg.sender, "!op");
        _;
    }

    modifier isOperatorOrPoolManager() {
        require(operator == msg.sender || protectedPoolManager == msg.sender, "!pm");
        _;
    }

    //set owner - only OWNER
    function setOwner(address _owner) external onlyOwner{
        owner = _owner;
    }

    //set operator - only OWNER
    function setOperator(address _operator) external onlyOwner{
        operator = _operator;
    }

    //make sure this contract can declare itself as operator
    function setSecondaryOperator() external onlyOwner{
        ISecondaryProxy(secondaryProxy).setOperator(address(this));
    }

    function setUsedAddress(address[] memory usedList) external onlyOwner{
        ISecondaryProxy(secondaryProxy).setUsedAddress(usedList);
    }

    //shutdown pool management and disallow new pools. change is immutable
    function shutdownSystem() external onlyOwner{
        ISecondaryProxy(secondaryProxy).shutdownSystem();
    }

    //shutdown a pool - only operator OR protected pool manager
    function shutdownPool(uint256 _pid) external isOperatorOrPoolManager returns(bool){
        //if not manager, check protected list
        if(msg.sender != protectedPoolManager){
            //check that the lp token of the pool is not the current fee token
            (address lptoken,,,,,) = IPools(booster).poolInfo(_pid);
            require(lptoken != IBooster(booster).feeToken(), "!shutdown fee token");
        }

        //shutdown pool
        IPools(pools).shutdownPool(_pid);

        return true;
    }

    //add a new pool if it has weight on the gauge controller - only OPERATOR
    function addPool(address _lptoken, address _gauge, uint256 _stashVersion) external onlyOperator returns(bool){
        //get lp token from gauge
        address lptoken = ICurveGauge(_gauge).lp_token();
        require(_lptoken == lptoken, "!lptoken");

        return _addPool(_lptoken, _gauge, _stashVersion);
    }

    //force add a new pool
    function forceAddPool(address _lptoken, address _gauge, uint256 _stashVersion) external onlyOperator returns(bool){
        //sealed
    }

    //internal add pool
    function _addPool(address _lptoken, address _gauge, uint256 _stashVersion) internal returns(bool){
        return IPools(pools).addPool(_lptoken,_gauge,_stashVersion);
    }
}