// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


contract ExtraRewardStashV1 {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    uint256 private constant WEEK = 7 * 86400;
    uint256 private constant maxRewards = 8;

    uint256 public pid;
    address public operator;
    address public staker;
    address public gauge;
    address public rewardFactory;
   
    uint256 public historicalRewards = 0;

    struct TokenInfo {
        address token;
        address rewardAddress;
        uint256 lastActiveTime;
    }
    TokenInfo public tokenInfo;

    constructor(uint256 _pid, address _operator, address _staker, address _gauge, address _rFactory) public {
        pid = _pid;
        operator = _operator;
        staker = _staker;
        gauge = _gauge;
        rewardFactory = _rFactory;
    }


    function getName() external pure returns (string memory) {
        return "ExtraRewardStashV1";
    }

    function setToken() internal {
        address token = ICurveGauge(gauge).rewarded_token();

        if(token != address(0)){
            //set token address
            tokenInfo.token = token;

            //create new reward contract
            (,,,address mainRewardContract,,) = IDeposit(operator).poolInfo(pid);
        	address rewardContract = IRewardFactory(rewardFactory).CreateTokenRewards(
	        	token,
	        	mainRewardContract,
	        	address(this));
            tokenInfo.rewardAddress = rewardContract;
            tokenInfo.lastActiveTime = block.timestamp;
        }
    }

    function claimRewards() external returns (bool) {
        require(msg.sender == operator, "!authorized");
        //first time init
        if(tokenInfo.token == address(0)){
            setToken();
        }

        if(tokenInfo.token != address(0)){
            uint256 before = IERC20(tokenInfo.token).balanceOf(staker);
            IDeposit(operator).claimRewards(pid,gauge);
            uint256 newbalance = IERC20(tokenInfo.token).balanceOf(staker);
            if(newbalance > before){
                IStaker(staker).withdraw(tokenInfo.token);
                tokenInfo.lastActiveTime = block.timestamp;

                //make sure this pool is in active list,
                IRewardFactory(rewardFactory).addActiveReward(tokenInfo.token,pid);

                //check if other stashes are also active, and if so, send to arbitrator
                //do this here because processStash will have tokens from the arbitrator
                uint256 activeCount = IRewardFactory(rewardFactory).activeRewardCount(tokenInfo.token);
                if(activeCount > 1){
                    //send to arbitrator
                    address arb = IDeposit(operator).rewardArbitrator();
                    if(arb != address(0)){
                        IERC20(tokenInfo.token).safeTransfer(arb, newbalance);
                    }
                }

            }else{
                //check if this reward has been inactive too long
                if(block.timestamp > tokenInfo.lastActiveTime + WEEK){
                    //set as inactive
                    IRewardFactory(rewardFactory).removeActiveReward(tokenInfo.token,pid);
                }else{
                    //edge case around reward ending periods
                    if(newbalance > 0){
                        // - recently active pool
                        // - rewards claimed to staker contract via someone manually calling claim_rewards() on the gauge
                        // - rewards ended before the above call, which claimed the last available tokens
                        // - thus claimRewards doesnt see any new rewards, but there are rewards on the staker contract
                        // - i think its safe to assume claim will be called within the timeframe, or else these rewards
                        //     will be unretrievable until some pool starts rewards again 

                        //claim the tokens
                        IStaker(staker).withdraw(tokenInfo.token);

                        uint256 activeCount = IRewardFactory(rewardFactory).activeRewardCount(tokenInfo.token);
                        if(activeCount > 1){
                            //send to arbitrator
                            address arb = IDeposit(operator).rewardArbitrator();
                            if(arb != address(0)){
                                IERC20(tokenInfo.token).safeTransfer(arb, newbalance);
                            }
                        }
                    }
                }
            }
        }
        return true;
    }

    //pull assigned tokens from staker to stash
    function stashRewards() external pure returns(bool){
        //stashRewards() is also called on deposit
        //so dont need to try withdrawing here for v1
        // -> move withdraw() call to processStash() which is only called during reward claiming
        return true;
    }

    //send all extra rewards to their reward contracts
    function processStash() external returns(bool){
        require(msg.sender == operator, "!authorized");

        address token = tokenInfo.token;
        if(token == address(0)) return true;

        //send to rewards
        uint256 amount = IERC20(token).balanceOf(address(this));
        if (amount > 0) {
            historicalRewards = historicalRewards.add(amount);
        	//add to reward contract
        	address rewards = tokenInfo.rewardAddress;
        	if(rewards == address(0)) return true;
        	IERC20(token).safeTransfer(rewards, amount);
        	IRewards(rewards).queueNewRewards(amount);
        }
        return true;
    }
}