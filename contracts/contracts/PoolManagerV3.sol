// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "./interfaces/IGaugeController.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

/*
Pool Manager v3

Changes:
- pass through pool manager proxy
*/

contract PoolManagerV3{
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public constant gaugeController = address(0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB);
    address public immutable pools;

    address public operator;
    
    constructor(address _pools) public {
        //default to multisig
        operator = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB);
        pools = _pools;
    }

    function setOperator(address _operator) external {
        require(msg.sender == operator, "!auth");
        operator = _operator;
    }

    //add a new curve pool to the system. (default stash to v3)
    function addPool(address _gauge) external returns(bool){
        _addPool(_gauge,3);
        return true;
    }

    //add a new curve pool to the system.
    function addPool(address _gauge, uint256 _stashVersion) external returns(bool){
        _addPool(_gauge,_stashVersion);
        return true;
    }

    function _addPool(address _gauge, uint256 _stashVersion) internal{

        uint256 weight = IGaugeController(gaugeController).get_gauge_weight(_gauge);
        require(weight > 0, "must have weight");
        address lptoken = ICurveGauge(_gauge).lp_token();

        //gauge/lptoken address checks will happen in the next call
        IPools(pools).addPool(lptoken,_gauge,_stashVersion);
    }

    function shutdownPool(uint256 _pid) external returns(bool){
        require(msg.sender==operator, "!auth");

        IPools(pools).shutdownPool(_pid);
        return true;
    }

}