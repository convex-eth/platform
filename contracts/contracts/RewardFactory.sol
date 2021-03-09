// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "./Interfaces.sol";
import "./ManagedRewardPool.sol";
import "./VirtualBalanceRewardPool.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


contract RewardFactory {
    using Address for address;

    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);

    address public operator;
    mapping (address => bool) private rewardAccess;

    constructor(address _operator) public {
        operator = _operator;
    }

    //stash contracts need access to create new Virtual balance pools for extra gauge incentives(ex. snx)
    function setAccess(address _stash, bool _status) external{
        require(msg.sender == operator, "!auth");
        rewardAccess[_stash] = _status;
    }

    //Create a Managed Reward Pool to handle distribution of all crv mined in a pool
    function CreateCrvRewards(uint256 _pid) external returns (address) {
        require(msg.sender == operator, "!auth");

        //operator = booster(deposit) contract so that new crv can be added and distributed
        //reward manager = this factory so that extra incentive tokens(ex. snx) can be linked to the main managed reward pool
        ManagedRewardPool rewardPool = new ManagedRewardPool(_pid,crv,block.timestamp,operator, address(this));
        return address(rewardPool);
    }

    //create a virtual balance reward pool that mimicks the balance of a pool's main reward contract
    //used for extra incentive tokens(ex. snx) as well as vecrv fees
    function CreateTokenRewards(address _token, address _mainRewards, address _operator) external returns (address) {
        require(msg.sender == operator || rewardAccess[msg.sender] == true, "!auth");

        //create new pool, use main pool for balance lookup
        VirtualBalanceRewardPool rewardPool = new VirtualBalanceRewardPool(_mainRewards,_token,block.timestamp,_operator);
        //add the new pool to main pool's list of extra rewards, assuming this factory has "reward manager" role
        IRewards(_mainRewards).addExtraReward(address(rewardPool));
        //return new pool's address
        return address(rewardPool);
    }
}
