// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


contract ExtraRewardStashV2 {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    uint256 private constant maxRewards = 8;

    uint256 public pid;
    address public operator;
    address public staker;
    address public gauge;
    address public rewardFactory;
   

    struct TokenInfo {
        address token;
        address rewardAddress;
    }
    TokenInfo[] public tokenInfo;

    constructor(uint256 _pid, address _operator, address _staker, address _gauge, address _rFactory) public {
        pid = _pid;
        operator = _operator;
        staker = _staker;
        gauge = _gauge;
        rewardFactory = _rFactory;
    }

    //v2 gauges can have multiple incentive tokens
    function tokenCount() public view returns (uint256) {
        uint256 length = tokenInfo.length;
        if(length > 0 && tokenInfo[0].token != address(0)){
            return length;
        }
        return 0;
    }

    //can try claiming if there are reward tokens registered
    function canClaimRewards() external returns (bool) {
        //this is updateable in v2 gauges now so must check each time.
        checkForNewRewardTokens();

        return tokenCount() > 0;
    }

    function getName() external pure returns (string memory) {
        return "ExtraRewardStashV2";
    }

    //check if gauge rewards have changed
    function checkForNewRewardTokens() internal {
        for(uint256 i = 0; i < maxRewards; i++){
            address token = ICurveGauge(gauge).reward_tokens(i);

            //replace or grow list
            if(i < tokenInfo.length){
                setToken(i,token);
            }else{
                addToken(token);   
            }
        }
    }

    //add a new token to token list
    function addToken(address _token) internal {
    	if(_token == address(0)) return;

        //get address of main rewards of pool
         (,,,address mainRewardContract,,) = IDeposit(operator).poolInfo(pid);

         //create a new reward contract for this extra reward token
        address rewardContract = IRewardFactory(rewardFactory).CreateTokenRewards(
        	_token,
        	mainRewardContract,
        	address(this));

        //add to token list
        tokenInfo.push(
            TokenInfo({
                token: _token,
                rewardAddress: rewardContract
            })
        );
    }

    //replace a token on token list
    function setToken(uint256 _tid, address _token) internal {
        if(tokenInfo[_tid].token != _token){
            //set token address
            tokenInfo[_tid].token = _token;

            if(_token == address(0)){
                //nullify reward address
            	tokenInfo[_tid].rewardAddress = address(0);
            }else{
	            //create new reward contract
	             (,,,address mainRewardContract,,) = IDeposit(operator).poolInfo(pid);
	        	address rewardContract = IRewardFactory(rewardFactory).CreateTokenRewards(
		        	_token,
		        	mainRewardContract,
		        	address(this));
	            tokenInfo[_tid].rewardAddress = rewardContract;
        	}
        }
    }

    //pull assigned tokens from staker to stash
    function stashRewards() external returns(bool){
        require(msg.sender == operator, "!authorized");

        //after depositing/withdrawing, extra incentive tokens are transfered to the staking contract
        //need to pull them off and stash here.
        for(uint i=0; i < tokenInfo.length; i++){
            address token = tokenInfo[i].token;
            if(token == address(0)) continue;
            IStaker(staker).withdraw(token);
        }
        return true;
    }

    //send all extra rewards to their reward contracts
    function processStash() external returns(bool){
        require(msg.sender == operator, "!authorized");

        for(uint i=0; i < tokenInfo.length; i++){
            address token = tokenInfo[i].token;
            if(token == address(0)) continue;
            uint256 amount = IERC20(token).balanceOf(address(this));
            if (amount > 0) {
            	//add to reward contract
            	address rewards = tokenInfo[i].rewardAddress;
            	if(rewards == address(0)) continue;
            	IERC20(token).safeTransfer(rewards, amount);
            	IRewards(rewards).queueNewRewards(amount);
            }
        }
        return true;
    }

}