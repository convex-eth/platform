// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

//Hold extra reward tokens on behalf of pools that have the same token as a reward
//Because anyone can call gauge.claim_rewards(address) for the convex staking contract, rewards
//could be forced to the wrong pool.
//hold tokens here and distribute fairly(or at least more fairly), to both pools at a later timing
contract ArbitratorVault{
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public operator;
    address public depositor;


    constructor(address _depositor)public
    {
        operator = msg.sender;
        depositor = _depositor;
    }

    function setOperator(address _op) external {
        require(msg.sender == operator, "!auth");
        operator = _op;
    }
    
    function distribute(address _token, uint256[] calldata _toPids, uint256[] calldata _amounts) external {
       require(msg.sender == operator, "!auth");

       for(uint256 i = 0; i < _toPids.length; i++){
        //get stash from pid
        (,,,,address stashAddress) = IDeposit(depositor).poolInfo(_toPids[i]);

        //transfer
        IERC20(_token).safeTransfer(stashAddress, _amounts[i]);
       }
    }

}