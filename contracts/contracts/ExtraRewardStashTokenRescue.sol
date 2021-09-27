// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


//Rescue erc20 tokens off the voter proxy
//can only collect non-LP and non-gauge tokens

interface IRewardDeposit {
    function addReward(address _token, uint256 _amount) external;
}

contract ExtraRewardStashTokenRescue {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 public pid;
    address public operator;
    address public staker;
    address public gauge;
    address public rewardFactory;

    address public distributor;
    address public rewardDeposit;
    address public treasuryDeposit;
   
    //active tokens that can be claimed
    mapping(address => bool) public activeTokens;

    constructor() public {
    }

    function initialize(uint256 _pid, address _operator, address _staker, address _gauge, address _rFactory) external {
        require(gauge == address(0),"!init");
        pid = _pid;
        operator = _operator;
        staker = _staker;
        gauge = _gauge;
        rewardFactory = _rFactory;
    }

    function getName() external pure returns (string memory) {
        return "ExtraRewardStashTokenRescue";
    }

    //try claiming if there are reward tokens registered
    function claimRewards() external pure returns (bool) {
        return true;
    }

    function claimRewardToken(address _token) public returns (bool) {
        require(distributor == address(0) || msg.sender == distributor, "!distributor");
        require(rewardDeposit != address(0) || treasuryDeposit != address(0), "!deposit set");
        require(activeTokens[_token],"!active");
        
        uint256 onstaker = IERC20(_token).balanceOf(staker);
        if(onstaker > 0){
            IStaker(staker).withdraw(_token);
        }

        uint256 amount = IERC20(_token).balanceOf(address(this));
        if (amount > 0) {
            if(rewardDeposit != address(0)){
                IRewardDeposit(rewardDeposit).addReward(_token,amount);
            }else{
                //if reward deposit not set, send directly to treasury address
                IERC20(_token).safeTransfer(treasuryDeposit,amount);
            }
        }
        return true;
    }
   

    function setDistribution(address _distributor, address _rewardDeposit, address _treasury) external{
        require(IDeposit(operator).owner() == msg.sender, "!owner");
        distributor = _distributor;
        rewardDeposit = _rewardDeposit;
        treasuryDeposit = _treasury;
    }

    //register an extra reward token to be handled
    function setExtraReward(address _token, bool _active) external{
        //owner of booster can set extra rewards
        require(IDeposit(operator).owner() == msg.sender, "!owner");
        
        activeTokens[_token] = _active;
        if(_active && rewardDeposit != address(0)){
            IERC20(_token).safeApprove(rewardDeposit,0);
            IERC20(_token).safeApprove(rewardDeposit,uint256(-1));
        }
        emit TokenSet(_token, _active);
    }

    //pull assigned tokens from staker to stash
    function stashRewards() external pure returns(bool){
        return true;
    }

    //send all extra rewards to their reward contracts
    function processStash() external pure returns(bool){
        return true;
    }

    /* ========== EVENTS ========== */
    event TokenSet(address indexed _token, bool _active);
}