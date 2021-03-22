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

* Synthetix: cvxRewardPool.sol
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

import "./Interfaces.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


contract cvxRewardPool{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public rewardToken;
    IERC20 public stakingToken;
    uint256 public constant duration = 7 days;
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public operator;
    address public crvDeposits;
    IERC20 public cCrvToken;
    address public rewardManager;

    uint256 public starttime;
    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public queuedRewards = 0;
    uint256 public currentRewards = 0;
    uint256 public constant newRewardRatio = 750;
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    address[] public extraRewards;

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    constructor(
        address stakingToken_,
        address rewardToken_,
        address crvDeposits_,
        address cCrvToken_,
        uint256 starttime_,
        address operator_,
        address rewardManager_
    ) public {
        stakingToken = IERC20(stakingToken_);
        rewardToken = IERC20(rewardToken_);
        starttime = starttime_;
        operator = operator_;
        rewardManager = rewardManager_;
        crvDeposits = crvDeposits_;
        cCrvToken = IERC20(cCrvToken_);
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function extraRewardsLength() external view returns (uint256) {
        return extraRewards.length;
    }

    function addExtraReward(address _reward) external {
        require(msg.sender == rewardManager, "!authorized");
        require(_reward != address(0),"!reward setting");

        extraRewards.push(_reward);
    }
    function clearExtraRewards() external{
        require(msg.sender == rewardManager, "!authorized");
        delete extraRewards;
    }

    modifier checkStart() {
        require(block.timestamp >= starttime, 'RewardPool : not start');
        _;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earnedReward(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return MathUtil.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable()
                    .sub(lastUpdateTime)
                    .mul(rewardRate)
                    .mul(1e18)
                    .div(totalSupply())
            );
    }

    function earnedReward(address account) internal view returns (uint256) {
        return
            balanceOf(account)
                .mul(rewardPerToken().sub(userRewardPerTokenPaid[account]))
                .div(1e18)
                .add(rewards[account]);
    }

    function earned(address account) external view returns (uint256) {
        uint256 depositFeeRate = ICrvDeposit(crvDeposits).lockIncentive();

        uint256 r = earnedReward(account);
        uint256 fees = r.mul(depositFeeRate).div(FEE_DENOMINATOR);
        
        //fees dont apply until whitelist+vecrv lock begins so will report
        //slightly less value than what is actually received.
        return r.sub(fees);
    }

    function stake(uint256 _amount)
        public
        updateReward(msg.sender)
        checkStart
    {
        require(_amount > 0, 'RewardPool : Cannot stake 0');

        //add supply
        _totalSupply = _totalSupply.add(_amount);
        //add to sender balance sheet
        _balances[msg.sender] = _balances[msg.sender].add(_amount);
        //take tokens from sender
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        emit Staked(msg.sender, _amount);

        //also stake to linked rewards
        for(uint i=0; i < extraRewards.length; i++){
            IRewards(extraRewards[i]).stake(msg.sender, _amount);
        }
    }

    function stakeAll() external{
        uint256 balance = stakingToken.balanceOf(msg.sender);
        stake(balance);
    }

    function stakeFor(address _for, uint256 _amount)
        public
        updateReward(_for)
        checkStart
    {
        require(_amount > 0, 'RewardPool : Cannot stake 0');

         //add supply
        _totalSupply = _totalSupply.add(_amount);
        //add to _for's balance sheet
        _balances[_for] = _balances[_for].add(_amount);
        //take tokens from sender
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        emit Staked(msg.sender, _amount);

        //also stake to linked rewards
        for(uint i=0; i < extraRewards.length; i++){
            IRewards(extraRewards[i]).stake(_for, _amount);
        }
    }

    function withdraw(uint256 _amount)
        public
        updateReward(msg.sender)
        checkStart
    {
        require(_amount > 0, 'RewardPool : Cannot withdraw 0');
        _totalSupply = _totalSupply.sub(_amount);
        _balances[msg.sender] = _balances[msg.sender].sub(_amount);
        stakingToken.safeTransfer(msg.sender, _amount);
        emit Withdrawn(msg.sender, _amount);

        //also withdraw from linked rewards
        for(uint i=0; i < extraRewards.length; i++){
            IRewards(extraRewards[i]).withdraw(msg.sender, _amount);
        }
    }

    function exit() public {
        getReward(true);
        withdraw(balanceOf(msg.sender));
    }

    function getReward(bool _claimExtras) public updateReward(msg.sender) checkStart{
        uint256 reward = earnedReward(msg.sender);
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardToken.safeApprove(crvDeposits,0);
            rewardToken.safeApprove(crvDeposits,reward);
            ICrvDeposit(crvDeposits).deposit(reward,false);

            uint256 cCrvBalance = cCrvToken.balanceOf(address(this));
            cCrvToken.safeTransfer(msg.sender, cCrvBalance);
            emit RewardPaid(msg.sender, cCrvBalance);
        }

        //also get rewards from linked rewards
        if(_claimExtras){
            for(uint i=0; i < extraRewards.length; i++){
                IRewards(extraRewards[i]).getReward(msg.sender);
            }
        }
    }

    function getReward() external{
        getReward(true);
    }

    function queueNewRewards(uint256 _rewards) external{
        require(msg.sender == operator, "!authorized");

        _rewards = _rewards.add(queuedRewards);

        if (block.timestamp >= periodFinish) {
            notifyRewardAmount(_rewards);
            queuedRewards = 0;
            return;
        }

        uint256 queuedRatio = currentRewards.mul(1000).div(_rewards);
        if(queuedRatio < newRewardRatio){
            notifyRewardAmount(_rewards);
            queuedRewards = 0;
        }else{
            queuedRewards = _rewards;
        }
    }

    function notifyRewardAmount(uint256 reward)
        internal
        updateReward(address(0))
    {
       // require(msg.sender == operator, "!authorized");
        if (block.timestamp > starttime) {
            if (block.timestamp >= periodFinish) {
                rewardRate = reward.div(duration);
            } else {
                uint256 remaining = periodFinish.sub(block.timestamp);
                uint256 leftover = remaining.mul(rewardRate);
                reward = reward.add(leftover);
                rewardRate = reward.div(duration);
            }
            currentRewards = reward;
            lastUpdateTime = block.timestamp;
            periodFinish = block.timestamp.add(duration);
            emit RewardAdded(reward);
        } else {
            rewardRate = reward.div(duration);
            lastUpdateTime = starttime;
            periodFinish = starttime.add(duration);
            currentRewards = reward;
            emit RewardAdded(reward);
        }
    }
}