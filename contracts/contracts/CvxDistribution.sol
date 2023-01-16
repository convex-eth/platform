// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
/**
 *Submitted for verification at Etherscan.io on 2020-07-17
 */

/*
   ____            __   __        __   _
  / __/__ __ ___  / /_ / /  ___  / /_ (_)__ __
 _\ \ / // // _ \/ __// _ \/ -_)/ __// / \ \ /
/___/ \_, //_//_/\__//_//_/\__/ \__//_/ /_\_\
     /___/

* Synthetix: BaseRewardPool.sol
*
* Docs: https://docs.synthetix.io/
*
*
* MIT License
* ===========
*
* Copyright (c) 2020 Synthetix
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
*/

import "./interfaces/MathUtil.sol";
import "./interfaces/IBooster.sol";
import "./interfaces/IExtraRewardPool.sol";
import "./interfaces/IRewardHook.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';


interface IRewardReciever{
    function queueNewRewards(uint256 _amount) external returns(bool);
}

/*
 Cvx distribution
*/
contract CvxDistribution {
    using SafeERC20 for IERC20;

    enum DistributType{
        Transfer,
        QueueNewRewards,

        TypeCount
    }

    address public rewardToken = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B); //cvx
    uint256 public constant duration = 7 days;


    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public queuedRewards;
    uint256 public currentRewards;
    address public owner;

    address public immutable chefhook;
    
    uint256 private _totalSupply;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => bool) public operators;
    mapping(address => DistributType) public distributionType;
    mapping(address => uint256) private _balances;

    event RewardAdded(uint256 reward);
    event WeightSet(address indexed user, uint256 oldWeight, uint256 newWeight);
    event RewardPaid(address indexed user, uint256 reward);
    event AddOperator(address indexed _op, bool _valid);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address _chefhook) public{
        owner = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB); //default to convex multisig
        emit OwnershipTransferred(address(0), owner);
        chefhook = _chefhook;
    }

    function poolType() external pure returns(IExtraRewardPool.PoolType){
        return IExtraRewardPool.PoolType.Single;
    }

    function poolVersion() external pure returns(uint256){
        return 1;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");
        _;
    }

    modifier onlyOperators() {
        require(operators[msg.sender] || owner == msg.sender, "!operator");
        _;
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    //set operator
    function setOperators(address _op, bool _valid) external onlyOwner{
        operators[_op] = _valid;
        emit AddOperator(_op, _valid);
    }

    function pullChef(bool _force) internal{
        if(_force || (block.timestamp + 1 days) > periodFinish){
            uint256 b = IERC20(rewardToken).balanceOf(address(this));
            IRewardHook(chefhook).onRewardClaim();
            b = IERC20(rewardToken).balanceOf(address(this)) - b;
            notifyRewardAmount(b);
        }
    }

    //total supply
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    //balance of an account
    function balanceOf(address _account) public view returns (uint256) {
        return _balances[_account];
    }

    //checkpoint earned rewards modifier
    modifier updateReward(address _account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (_account != address(0)) {
            rewards[_account] = earned(_account);
            userRewardPerTokenPaid[_account] = rewardPerTokenStored;
        }
        _;
    }

    //checkpoint a given user
    function user_checkpoint(address _account) public updateReward(_account){

    }

    //claim time to period finish
    function lastTimeRewardApplicable() public view returns (uint256) {
        return MathUtil.min(block.timestamp, periodFinish);
    }

    //rewards per weight
    function rewardPerToken() public view returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored + ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18 / totalSupply());
    }

    //earned rewards for given account
    function earned(address _account) public view returns (uint256) {
        return rewards[_account] + (balanceOf(_account) * (rewardPerToken() - userRewardPerTokenPaid[_account]) / 1e18);
    }

    function setDistributionType(address _account, DistributType _dt) external onlyOperators returns(bool){
        require(_dt < DistributType.TypeCount, "!valid type");
        distributionType[_account] = _dt;
    }


    //increase reward weight for a given pool
    //used by reward manager
    function setWeight(address _account, uint256 _amount) external onlyOperators returns(bool){
        return _setWeight(_account, _amount);
    }

    //increase reward weight for a list of pools
    //used by reward manager
    function setWeights(address[] calldata _account, uint256[] calldata _amount) external onlyOperators{

        for(uint256 i = 0; i < _account.length; i++){
            _setWeight(_account[i], _amount[i]);
        }
    }

    //internal set weight
    function _setWeight(address _account, uint256 _amount)
        internal
        updateReward(_account)
        returns(bool)
    {
        require(_account != address(0),"!valid addr");
        emit WeightSet(_account, _balances[_account], _amount);

        uint256 tsupply = _totalSupply;
        tsupply -= _balances[_account]; //remove current from temp supply
        _balances[_account] = _amount; //set new account balance
        tsupply += _amount; //add new to temp supply
        _totalSupply = tsupply; //set supply

        return true;
    }

    //get reward for given account (unguarded)
    function getReward(address _account) public updateReward(_account) returns(bool){
        uint256 reward = earned(_account);
        if (reward > 0) {
            rewards[_account] = 0;
            DistributType dt = distributionType[_account];
            if(dt == DistributType.QueueNewRewards){
                //approve and call queue new rewards
                IERC20(rewardToken).approve(_account, reward);
                IRewardReciever(_account).queueNewRewards(reward);
            }else{
                //type == Transfer
                IERC20(rewardToken).safeTransfer(_account, reward);
            }
            
            emit RewardPaid(_account, reward);
        }

        //check if chef should be pulled
        pullChef(false);
        return true;
    }

    //outside address add to rewards
    function donate(uint256 _amount) external returns(bool){
        IERC20(rewardToken).safeTransferFrom(msg.sender, address(this), _amount);
        queuedRewards += _amount;
        return true;
    }

    //force pull chef
    function queueNewRewards() external returns(bool){
        pullChef(true);
        return true;
    }


    //internal: start new reward cycle
    function notifyRewardAmount(uint256 reward)
        internal
        updateReward(address(0))
    {
        if(queuedRewards > 0){
            reward = reward + queuedRewards;
            queuedRewards = 0;
        }

        if (block.timestamp >= periodFinish) {
            rewardRate = reward / duration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            reward += leftover;
            rewardRate = reward / duration;
        }
        currentRewards = reward;
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + duration;
        emit RewardAdded(reward);
    }
}