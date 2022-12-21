// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/IRewardStaking.sol";
import "../interfaces/IConvexDeposits.sol";
import "../interfaces/CvxMining.sol";
import "../interfaces/IBooster.sol";
import "../interfaces/IRewardHook.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


//Wrapper for staked cvxcrv that allows other incentives to be added

//Based on Curve.fi's gauge wrapper implementations at https://github.com/curvefi/curve-dao-contracts/tree/master/contracts/gauges/wrappers
contract CvxCrvStakingWrapper is ERC20, ReentrancyGuard {
    using SafeERC20
    for IERC20;
    using SafeMath
    for uint256;

    struct EarnedData {
        address token;
        uint256 amount;
    }

    struct RewardType {
        address reward_token;
        address reward_pool;
        uint128 reward_integral;
        uint128 reward_remaining;
        mapping(address => uint256) reward_integral_for;
        mapping(address => uint256) claimable_reward;
    }

    //constants/immutables
    address public constant crvDepositor = address(0x8014595F2AB54cD7c604B00E9fb932176fDc86Ae);
    address public constant cvxCrvStaking = address(0x3Fe65692bfCD0e6CF84cB1E7d24108E434A7587e);
    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public constant cvxCrv = address(0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7);

    //rewards
    uint256 private constant CRV_INDEX = 0;
    uint256 private constant CVX_INDEX = 1;
    RewardType[] public rewards;
    mapping(address => uint256) public registeredRewards;
    address public rewardHook;

    //management
    bool public isShutdown;
    bool public isInit;
    address public owner;

    // string internal _tokenname;
    // string internal _tokensymbol;

    event Deposited(address indexed _user, address indexed _account, uint256 _amount, bool _isCrv);
    event Withdrawn(address indexed _user, uint256 _amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RewardInvalidated(address _rewardToken);

    constructor() public
        ERC20(
            "Staked CvxCrv",
            "stkCvxCrv"
        ){

        owner = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB); //default to convex multisig
        emit OwnershipTransferred(address(0), owner);

        addRewards();
        setApprovals();
    }


    function decimals() public view override returns (uint8) {
        return 18;
    }

     modifier onlyOwner() {
        require(owner == msg.sender, "Ownable: caller is not the owner");
        _;
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function renounceOwnership() public virtual onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    function shutdown() external onlyOwner {
        isShutdown = true;
    }

    function setApprovals() public {
        IERC20(crv).safeApprove(crvDepositor, 0);
        IERC20(crv).safeApprove(crvDepositor, uint256(-1));
        IERC20(cvxCrv).safeApprove(cvxCrvStaking, 0);
        IERC20(cvxCrv).safeApprove(cvxCrvStaking, uint256(-1));
    }

    function addRewards() public {

        if (rewards.length == 0) {
            rewards.push(
                RewardType({
                    reward_token: crv,
                    reward_pool: cvxCrvStaking,
                    reward_integral: 0,
                    reward_remaining: 0
                })
            );
            rewards.push(
                RewardType({
                    reward_token: cvx,
                    reward_pool: address(0),
                    reward_integral: 0,
                    reward_remaining: 0
                })
            );
            registeredRewards[crv] = CRV_INDEX+1; //mark registered at index+1
            registeredRewards[cvx] = CVX_INDEX+1; //mark registered at index+1
            //send to self to warmup state
            IERC20(crv).transfer(address(this),0);
            //send to self to warmup state
            IERC20(cvx).transfer(address(this),0);
        }

        uint256 extraCount = IRewardStaking(cvxCrvStaking).extraRewardsLength();
        uint256 startIndex = rewards.length - 1;
        for (uint256 i = startIndex; i < extraCount; i++) {
            address extraPool = IRewardStaking(cvxCrvStaking).extraRewards(i);
            address extraToken = IRewardStaking(extraPool).rewardToken();
            if(registeredRewards[extraToken] == 0){
                rewards.push(
                    RewardType({
                        reward_token: extraToken,
                        reward_pool: extraPool,
                        reward_integral: 0,
                        reward_remaining: 0
                    })
                );
                registeredRewards[extraToken] = rewards.length; //mark registered at index+1
            }
        }
    }

    function addTokenReward(address _token) public onlyOwner {

        //check if already registered
        if(registeredRewards[_token] == 0){
            //add new token to list
            rewards.push(
                RewardType({
                    reward_token: _token,
                    reward_pool: address(0),
                    reward_integral: 0,
                    reward_remaining: 0
                })
            );
            //add to registered map
            registeredRewards[_token] = rewards.length; //mark registered at index+1
            //send to self to warmup state
            IERC20(_token).transfer(address(this),0);   
        }else{
            //get previous used index of given token
            //this ensures that reviving can only be done on the previous used slot
            uint256 index = registeredRewards[_token];
            if(index > 0){
                //index is registeredRewards minus one
                RewardType storage reward = rewards[index-1];
                //check if it was invalidated
                if(reward.reward_token == address(0)){
                    //revive
                    reward.reward_token = _token;
                }
            }
        }
    }

    //allow invalidating a reward if the token causes trouble in calcRewardIntegral
    function invalidateReward(address _token) public onlyOwner {
        uint256 index = registeredRewards[_token];
        if(index > 0){
            //index is registered rewards minus one
            RewardType storage reward = rewards[index-1];
            require(reward.reward_token == _token, "!mismatch");
            //set reward token address to 0, integral calc will now skip
            reward.reward_token = address(0);
            emit RewardInvalidated(_token);
        }
    }

    function setHook(address _hook) external onlyOwner{
        rewardHook = _hook;
    }

    function rewardLength() external view returns(uint256) {
        return rewards.length;
    }


    function _calcRewardIntegral(uint256 _index, address[2] memory _accounts, uint256[2] memory _balances, uint256 _supply, bool _isClaim) internal{
         RewardType storage reward = rewards[_index];
         if(reward.reward_token == address(0)){
            return;
         }

        //get difference in balance and remaining rewards
        //getReward is unguarded so we use reward_remaining to keep track of how much was actually claimed
        uint256 bal = IERC20(reward.reward_token).balanceOf(address(this));
        // uint256 d_reward = bal.sub(reward.reward_remaining);

        if (_supply > 0 && bal.sub(reward.reward_remaining) > 0) {
            reward.reward_integral = reward.reward_integral + uint128(bal.sub(reward.reward_remaining).mul(1e20).div(_supply));
        }

        //update user integrals
        for (uint256 u = 0; u < _accounts.length; u++) {
            //do not give rewards to address 0
            if (_accounts[u] == address(0)) continue;
            if(_isClaim && u != 0) continue; //only update/claim for first address and use second as forwarding

            uint userI = reward.reward_integral_for[_accounts[u]];
            if(_isClaim || userI < reward.reward_integral){
                if(_isClaim){
                    uint256 receiveable = reward.claimable_reward[_accounts[u]].add(_balances[u].mul( uint256(reward.reward_integral).sub(userI)).div(1e20));
                    if(receiveable > 0){
                        reward.claimable_reward[_accounts[u]] = 0;
                        //cheat for gas savings by transfering to the second index in accounts list
                        //if claiming only the 0 index will update so 1 index can hold forwarding info
                        //guaranteed to have an address in u+1 so no need to check
                        IERC20(reward.reward_token).safeTransfer(_accounts[u+1], receiveable);
                        bal = bal.sub(receiveable);
                    }
                }else{
                    reward.claimable_reward[_accounts[u]] = reward.claimable_reward[_accounts[u]].add(_balances[u].mul( uint256(reward.reward_integral).sub(userI)).div(1e20));
                }
                reward.reward_integral_for[_accounts[u]] = reward.reward_integral;
            }
        }

        //update remaining reward here since balance could have changed if claiming
        if(bal != reward.reward_remaining){
            reward.reward_remaining = uint128(bal);
        }
    }

    function _checkpoint(address[2] memory _accounts) internal {
        //if shutdown, no longer checkpoint in case there are problems
        if(isShutdown) return;

        uint256 supply = totalSupply();
        uint256[2] memory depositedBalance;
        depositedBalance[0] = balanceOf(_accounts[0]);
        depositedBalance[1] = balanceOf(_accounts[1]);
        
        IRewardStaking(cvxCrvStaking).getReward(address(this), true);

        _claimExtras();

        uint256 rewardCount = rewards.length;
        for (uint256 i = 0; i < rewardCount; i++) {
           _calcRewardIntegral(i,_accounts,depositedBalance,supply,false);
        }
    }

    function _checkpointAndClaim(address[2] memory _accounts) internal {

        uint256 supply = totalSupply();
        uint256[2] memory depositedBalance;
        depositedBalance[0] = balanceOf(_accounts[0]); //only do first slot
        
        IRewardStaking(cvxCrvStaking).getReward(address(this), true);

        _claimExtras();

        uint256 rewardCount = rewards.length;
        for (uint256 i = 0; i < rewardCount; i++) {
           _calcRewardIntegral(i,_accounts,depositedBalance,supply,true);
        }
    }

    //claim any rewards not part of the convex pool
    function _claimExtras() internal {
        //claim via hook if exists
        if(rewardHook != address(0)){
            try IRewardHook(rewardHook).onRewardClaim(){
            }catch{}
        }
    }

    function user_checkpoint(address[2] calldata _accounts) external returns(bool) {
        _checkpoint([_accounts[0], _accounts[1]]);
        return true;
    }

    //run earned as a mutable function to claim everything before calculating earned rewards
    function earned(address _account) external returns(EarnedData[] memory claimable) {
        IRewardStaking(cvxCrvStaking).getReward(address(this), true);
        _claimExtras();
        return _earned(_account);
    }

    //run earned as a non-mutative function that may not claim everything, but should report standard convex rewards
    function earnedView(address _account) external view returns(EarnedData[] memory claimable) {
        return _earned(_account);
    }

    function _earned(address _account) internal view returns(EarnedData[] memory claimable) {
        uint256 supply = totalSupply();
        uint256 rewardCount = rewards.length;
        claimable = new EarnedData[](rewardCount);

        for (uint256 i = 0; i < rewardCount; i++) {
            RewardType storage reward = rewards[i];
            if(reward.reward_token == address(0)){
                continue;
            }

            //change in reward is current balance - remaining reward + earned
            uint256 bal = IERC20(reward.reward_token).balanceOf(address(this));
            uint256 d_reward = bal.sub(reward.reward_remaining);

            //some rewards (like minted cvx) may not have a reward pool directly on the convex pool so check if it exists
            if(reward.reward_pool != address(0)){
                //add earned from the convex reward pool for the given token
                d_reward = d_reward.add(IRewardStaking(reward.reward_pool).earned(address(this)));
            }

            uint256 I = reward.reward_integral;
            if (supply > 0) {
                I = I + d_reward.mul(1e20).div(supply);
            }

            uint256 newlyClaimable = balanceOf(_account).mul(I.sub(reward.reward_integral_for[_account])).div(1e20);
            claimable[i].amount = claimable[i].amount.add(reward.claimable_reward[_account].add(newlyClaimable));
            claimable[i].token = reward.reward_token;

            //calc cvx minted from crv and add to cvx claimables
            //note: crv is always index 0 so will always run before cvx
            if(i == CRV_INDEX){
                //because someone can call claim for the pool outside of checkpoints, need to recalculate crv without the local balance
                I = reward.reward_integral;
                if (supply > 0) {
                    I = I + IRewardStaking(reward.reward_pool).earned(address(this)).mul(1e20).div(supply);
                }
                newlyClaimable = balanceOf(_account).mul(I.sub(reward.reward_integral_for[_account])).div(1e20);
                claimable[CVX_INDEX].amount = CvxMining.ConvertCrvToCvx(newlyClaimable);
                claimable[CVX_INDEX].token = cvx;
            }
        }
        return claimable;
    }

    function getReward(address _account) external {
        //claim directly in checkpoint logic to save a bit of gas
        _checkpointAndClaim([_account, _account]);
    }

    function getReward(address _account, address _forwardTo) external {
        require(msg.sender == _account, "!self");
        //claim directly in checkpoint logic to save a bit of gas
        //pack forwardTo into account array to save gas so that a proxy etc doesnt have to double transfer
        _checkpointAndClaim([_account,_forwardTo]);
    }

    //deposit vanilla crv
    function deposit(uint256 _amount, address _to) external nonReentrant {
        require(!isShutdown, "shutdown");

        //dont need to call checkpoint since _mint() will

        if (_amount > 0) {
            _mint(_to, _amount);
            IERC20(crv).safeTransferFrom(msg.sender, address(this), _amount);
            IConvexDeposits(crvDepositor).deposit(_amount, false, cvxCrvStaking);
        }

        emit Deposited(msg.sender, _to, _amount, true);
    }

    //stake cvxcrv
    function stake(uint256 _amount, address _to) public nonReentrant {
        require(!isShutdown, "shutdown");

        //dont need to call checkpoint since _mint() will

        if (_amount > 0) {
            _mint(_to, _amount);
            IERC20(cvxCrv).safeTransferFrom(msg.sender, address(this), _amount);
            IRewardStaking(cvxCrvStaking).stake(_amount);
        }

        emit Deposited(msg.sender, _to, _amount, false);
    }

    //backwards compatibility for other systems (note: amount and address reversed)
    function stakeFor(address _to, uint256 _amount) external {
        stake(_amount, _to);
    }

    //withdraw to convex deposit token
    function withdraw(uint256 _amount) external nonReentrant {
        
        //dont need to call checkpoint since _burn() will

        if (_amount > 0) {
            _burn(msg.sender, _amount);
            IRewardStaking(cvxCrvStaking).withdraw(_amount, false);
            IERC20(cvxCrv).safeTransfer(msg.sender, _amount);
        }

        emit Withdrawn(msg.sender, _amount);
    }

    function _beforeTokenTransfer(address _from, address _to, uint256 _amount) internal override {
        _checkpoint([_from, _to]);
    }
}