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
import "./interfaces/MathUtil.sol";
import "./interfaces/ISushiRewarder.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


interface IMasterChefV2 {
    function lpToken(uint i) external view returns (IERC20);
}

interface IConvexChef{
    function userInfo(uint256 _pid, address _account) external view returns(uint256,uint256);
    function claim(uint256 _pid, address _account) external;
    function deposit(uint256 _pid, uint256 _amount) external;
}


contract ConvexRewarder is ISushiRewarder{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public immutable rewardToken;
    IERC20 public immutable stakingToken;
    uint256 public constant duration = 5 days;

    address public immutable rewardManager;
    address public immutable sushiMasterChef;
    address public immutable convexMasterChef;
    uint256 public immutable chefPid;

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public currentRewards = 0;
    uint256 private _totalSupply;
    uint256 public sushiPid;
    uint256 public previousRewardDebt = 0;
    bool public isInit = false;

    mapping(address => uint256) private _balances;
    mapping(address => uint256) private _sushiBalances;
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
        address rewardManager_,
        address sushiMasterChef_,
        address convexMasterChef_,
        uint256 chefPid_
    ) public {
        stakingToken = IERC20(stakingToken_);
        rewardToken = IERC20(rewardToken_);
        rewardManager = rewardManager_;
        sushiMasterChef = sushiMasterChef_;
        convexMasterChef = convexMasterChef_;
        chefPid = chefPid_;
    }

    //stake a dummy token into convex chef to start earning rewards
    //initiate a week's worth of awards
    function init(IERC20 dummyToken) external {
        require(!isInit,"already init");
        isInit = true;
        uint256 balance = dummyToken.balanceOf(msg.sender);
        require(balance != 0, "Balance must exceed 0");
        dummyToken.safeTransferFrom(msg.sender, address(this), balance);
        dummyToken.approve(convexMasterChef, balance);
        IConvexChef(convexMasterChef).deposit(chefPid, balance);
        initRewards();
    }

    //claim from convex master chef and add to rewards
    function harvestFromMasterChef() public {
        IConvexChef(convexMasterChef).claim(chefPid, address(this));
        notifyRewardAmount();
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account].add(_sushiBalances[account]);
    }

    function localBalanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function sushiBalanceOf(address account) public view returns (uint256) {
        return _sushiBalances[account];
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

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return MathUtil.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable()
                    .sub(lastUpdateTime)
                    .mul(rewardRate)
                    .mul(1e18)
                    .div(supply)
            );
    }

    function earned(address account) public view returns (uint256) {
        return
            _balances[account].add(_sushiBalances[account])
                .mul(rewardPerToken().sub(userRewardPerTokenPaid[account]))
                .div(1e18)
                .add(rewards[account]);
    }

    function stake(uint256 _amount)
        public
        updateReward(msg.sender)
    {
        require(_amount > 0, 'RewardPool : Cannot stake 0');

        //check if new rewards should be pulled from convex chef
        checkHarvest();

        //also stake to linked rewards
        uint256 length = extraRewards.length;
        for(uint i=0; i < length; i++){
            IRewards(extraRewards[i]).stake(msg.sender, _amount);
        }

        //add supply
        _totalSupply = _totalSupply.add(_amount);
        //add to sender balance sheet
        _balances[msg.sender] = _balances[msg.sender].add(_amount);
        //take tokens from sender
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        emit Staked(msg.sender, _amount);
    }

    function stakeAll() external{
        uint256 balance = stakingToken.balanceOf(msg.sender);
        stake(balance);
    }

    function stakeFor(address _for, uint256 _amount)
        public
        updateReward(_for)
    {
        require(_amount > 0, 'RewardPool : Cannot stake 0');

        //check if new rewards should be pulled from convex chef
        checkHarvest();

        //also stake to linked rewards
        uint256 length = extraRewards.length;
        for(uint i=0; i < length; i++){
            IRewards(extraRewards[i]).stake(_for, _amount);
        }

         //add supply
        _totalSupply = _totalSupply.add(_amount);
        //add to _for's balance sheet
        _balances[_for] = _balances[_for].add(_amount);
        //take tokens from sender
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        emit Staked(msg.sender, _amount);
    }

    function withdraw(uint256 _amount, bool claim)
        public
        updateReward(msg.sender)
    {
        require(_amount > 0, 'RewardPool : Cannot withdraw 0');

        //also withdraw from linked rewards
        uint256 length = extraRewards.length;
        for(uint i=0; i < length; i++){
            IRewards(extraRewards[i]).withdraw(msg.sender, _amount);
        }

        _totalSupply = _totalSupply.sub(_amount);
        _balances[msg.sender] = _balances[msg.sender].sub(_amount);
        stakingToken.safeTransfer(msg.sender, _amount);
        emit Withdrawn(msg.sender, _amount);

        if(claim){
            getReward(msg.sender,true);
        }
    }

    function withdrawAll(bool claim) external{
        withdraw(_balances[msg.sender],claim);
    }

    function getReward(address _account, bool _claimExtras) public updateReward(_account){

        uint256 reward = earned(_account);
        if (reward > 0) {
            rewards[_account] = 0;
            rewardToken.safeTransfer(_account, reward);
            emit RewardPaid(_account, reward);
        }

        //also get rewards from linked rewards
        if(_claimExtras){
            uint256 length = extraRewards.length;
            for(uint i=0; i < length; i++){
                IRewards(extraRewards[i]).getReward(_account);
            }
        }

        //check if new rewards should be pulled from convex chef
        checkHarvest();
    }

    function getReward() external{
        getReward(msg.sender,true);
    }

    function checkHarvest() internal{
        //if getting close to the end of the period
        //claim and extend
        if (periodFinish > 0 && block.timestamp >= periodFinish.sub(1 days)  ) {
            harvestFromMasterChef();
        }
    }

    //initialize the period of rewards
    //since the reward rate should be same as speed as rewards coming in from the chef
    // it will never catch up unless there is a seed
    // (or if it mines for a week with 0 distribution)
    function initRewards() internal updateReward(address(0)){
        uint256 reward = rewardToken.balanceOf(address(this));
        
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
    }

    function notifyRewardAmount()
        internal
        updateReward(address(0))
    {
        if(!isInit){
            //return smoothly if not init yet.
            //allow stakers to join but dont start distribution
            return;
        }
        //convex chef allows anyone to claim, so we have to look at reward debt difference
        //so that we know how much we have claimed since previous notifyRewardAmount()
        (,uint256 rewardDebt) = IConvexChef(convexMasterChef).userInfo(chefPid, address(this));
        uint256 reward = rewardDebt.sub(previousRewardDebt);
        previousRewardDebt = rewardDebt;
        if(reward == 0) return;
        
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
    }

    function onSushiReward(
        uint256 pid,
        address user,
        address recipient,
        uint256 sushiAmount,
        uint256 newLpAmount
    )
        override
        external
        updateReward(user)
    {
        require(msg.sender == sushiMasterChef);
      
        // On the first call, validate that the pid correctly maps to our stakingToken
        // Sushi MasterChef does not allow modifying a pid after it has been set, so we can trust
        // this to be safe in the future. If we did not validate the pid going forward, there
        // could be an attack vector by setting this contract as rewardContract on a 2nd pid
        uint256 _sushiPid = sushiPid;
        if (_sushiPid == 0) {
            require(IMasterChefV2(msg.sender).lpToken(pid) == stakingToken);
            sushiPid = pid;
        } else {
            require(pid == _sushiPid);
        }

        if (sushiAmount > 0) {
            // if sushiAmount > 0 the call is claiming sushi and should also claim other rewards

            //sushi allows claiming for user and transferring to recipient, but we do not.
            //just claim to original account
            getReward(user,true);
        }

        uint256 userBalance = _sushiBalances[user];
        if (newLpAmount > userBalance) {
            // reported balance in sushi > internal accounting, user has deposited
            uint256 amount = newLpAmount.sub(userBalance);
            uint256 length = extraRewards.length;
            for(uint i=0; i < length; i++){
                IRewards(extraRewards[i]).stake(user, amount);
            }
            _totalSupply = _totalSupply.add(amount);
            _sushiBalances[user] = newLpAmount;

        } else if (newLpAmount < userBalance) {
            // reported balance in sushi < internal accounting, user has withdrawn
            uint256 amount = userBalance.sub(newLpAmount);
            uint256 length = extraRewards.length;
            for(uint i=0; i < length; i++){
                IRewards(extraRewards[i]).withdraw(msg.sender, amount);
            }
            _totalSupply = _totalSupply.sub(amount);
            _sushiBalances[user] = newLpAmount;
        }
    }

    function pendingTokens(
        uint256 pid,
        address user,
        uint256 sushiAmount
    )
        override
        external
        view
        returns (IERC20[] memory, uint256[] memory)
    {
        //extra rewards length
        uint256 length = extraRewards.length;

        //combine base and extras
        IERC20[] memory rewardTokens = new IERC20[](1+length);
        rewardTokens[0] = rewardToken;
        for(uint i=0; i < length; i++){
           rewardTokens[1+i] = IERC20(IRewards(extraRewards[i]).rewardToken());
        }
        uint256[] memory earnedAmounts = new uint256[](1+length);
        earnedAmounts[0] = earned(user);
        for(uint i=0; i < length; i++){
            earnedAmounts[1+i] = IRewards(extraRewards[i]).earned(user);
        }
        return (rewardTokens,earnedAmounts);
    }
}