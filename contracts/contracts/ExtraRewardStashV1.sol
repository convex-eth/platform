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
    TokenInfo public tokenInfo;

    constructor(uint256 _pid, address _operator, address _staker, address _gauge, address _rFactory) public {
        pid = _pid;
        operator = _operator;
        staker = _staker;
        gauge = _gauge;
        rewardFactory = _rFactory;
    }

    function canClaimRewards() external returns (bool) {
        if(tokenInfo.token == address(0)){
            setToken();
        }
        return tokenInfo.rewardAddress != address(0);
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
            (,,,address mainRewardContract,) = IDeposit(operator).poolInfo(pid);
        	address rewardContract = IRewardFactory(rewardFactory).CreateTokenRewards(
	        	token,
	        	mainRewardContract,
	        	address(this));
            tokenInfo.rewardAddress = rewardContract;
        }
    }

    //pull assigned tokens from staker to stash
    function stashRewards() external view {
        //stashRewards() is also called on deposit
        //so dont need to try withdrawing here for v1
        // -> move withdraw() call to processStash() which is only called during reward claiming
    }

    //send all extra rewards to their reward contracts
    function processStash() external {
        require(msg.sender == operator, "!authorized");

        address token = tokenInfo.token;
        if(token == address(0)) return;

        //take off voter proxy
        IStaker(staker).withdraw(token);

        //send to rewards
        uint256 amount = IERC20(token).balanceOf(address(this));
        if (amount > 0) {
        	//add to reward contract
        	address rewards = tokenInfo.rewardAddress;
        	if(rewards == address(0)) return;
        	IERC20(token).safeTransfer(rewards, amount);
        	IRewards(rewards).queueNewRewards(amount);
        }
       
    }
}