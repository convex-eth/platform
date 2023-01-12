// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/IRewardStaking.sol";
import "../interfaces/IConvexDeposits.sol";
import "../interfaces/IRewardHook.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


//Wrapper for staked cvxcrv that allows other incentives and user reward weighting

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
        uint8 reward_group;
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
    address public constant threeCrv = address(0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490);
    address public constant treasury = address(0x1389388d01708118b497f59521f6943Be2541bb7);
    uint256 private constant WEIGHT_PRECISION = 10000;
    uint256 private constant MAX_REWARD_COUNT = 10;

    //rewards
    RewardType[] public rewards;
    mapping(address => uint256) public registeredRewards;
    address public rewardHook;
    mapping (address => uint256) public userRewardWeight;
    uint256 public supplyWeight;

    //management
    bool public isShutdown;
    address public owner;

    event Deposited(address indexed _user, address indexed _account, uint256 _amount, bool _isCrv);
    event Withdrawn(address indexed _user, uint256 _amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RewardInvalidated(address _rewardToken);
    event RewardGroupSet(address _rewardToken, uint256 _rewardGroup);
    event HookSet(address _rewardToken);
    event IsShutdown();
    event RewardPaid(address indexed _user, address indexed _token, uint256 _amount, address _receiver);

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

    function shutdown() external onlyOwner nonReentrant{
        isShutdown = true;
        emit IsShutdown();
    }

    function reclaim() external onlyOwner nonReentrant{
        require(isShutdown,"!shutdown");

        //reclaim extra staked cvxcrv tokens and return to treasury if this wrapper is shutdown
        //in order that the extra staking weight can be migrated
        uint256 extraTokens = IRewardStaking(cvxCrvStaking).balanceOf(address(this)) - totalSupply();
        IRewardStaking(cvxCrvStaking).withdraw(extraTokens, false);
        IERC20(cvxCrv).safeTransfer(treasury, extraTokens);
    }

    function setApprovals() public {
        IERC20(crv).safeApprove(crvDepositor, 0);
        IERC20(crv).safeApprove(crvDepositor, uint256(-1));
        IERC20(cvxCrv).safeApprove(cvxCrvStaking, 0);
        IERC20(cvxCrv).safeApprove(cvxCrvStaking, uint256(-1));
    }

    function addRewards() internal {

        if (rewards.length == 0) {
            rewards.push(
                RewardType({
                    reward_token: crv,
                    reward_integral: 0,
                    reward_remaining: 0,
                    reward_group: 0
                })
            );
            rewards.push(
                RewardType({
                    reward_token: cvx,
                    reward_integral: 0,
                    reward_remaining: 0,
                    reward_group: 0
                })
            );
            rewards.push(
                RewardType({
                    reward_token: threeCrv,
                    reward_integral: 0,
                    reward_remaining: 0,
                    reward_group: 1
                })
            );
            registeredRewards[crv] = 1; //mark registered at index+1
            registeredRewards[cvx] = 2; //mark registered at index+1
            registeredRewards[threeCrv] = 3; //mark registered at index+1
            //send to self to warmup state
            IERC20(crv).transfer(address(this),0);
            //send to self to warmup state
            IERC20(cvx).transfer(address(this),0);
            //send to self to warmup state
            IERC20(threeCrv).transfer(address(this),0);

            emit RewardGroupSet(crv, 0);
            emit RewardGroupSet(cvx, 0);
            emit RewardGroupSet(threeCrv, 1);
        }
    }

    function addTokenReward(address _token, uint256 _rewardGroup) public onlyOwner nonReentrant{
        require(_token != address(0) && _token != cvxCrvStaking && _token != address(this) && _token != cvxCrv,"invalid address");

        //check if already registered
        if(registeredRewards[_token] == 0){
            //limit reward count
            require(rewards.length < MAX_REWARD_COUNT, "max rewards");
            //new token, add token to list
            rewards.push(
                RewardType({
                    reward_token: _token,
                    reward_integral: 0,
                    reward_remaining: 0,
                    reward_group: _rewardGroup > 0 ? uint8(1) : uint8(0)
                })
            );
            //add to registered map
            registeredRewards[_token] = rewards.length; //mark registered at index+1
            //send to self to warmup state
            IERC20(_token).transfer(address(this),0);   

            emit RewardGroupSet(_token, _rewardGroup);
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

    //set reward group
    function setRewardGroup(address _token, uint256 _rewardGroup) public onlyOwner {
        //checkpoint
        _checkpoint([address(msg.sender),address(0)]);

        uint256 index = registeredRewards[_token];
        if(index > 0){
            //index is registered rewards minus one
            RewardType storage reward = rewards[index-1];
            reward.reward_group = _rewardGroup > 0 ? uint8(1) : uint8(0);
            emit RewardGroupSet(_token, _rewardGroup);
        }
    }

    function setHook(address _hook) external onlyOwner{
        rewardHook = _hook;
        emit HookSet(_hook);
    }

    function rewardLength() external view returns(uint256) {
        return rewards.length;
    }


    function _calcRewardIntegral(uint256 _index, address[2] memory _accounts, uint256[2] memory _balances, uint256 _supply, bool _isClaim) internal{
         RewardType storage reward = rewards[_index];
         //skip invalidated rewards
         //if a reward token starts throwing an error, calcRewardIntegral needs a way to exit
         if(reward.reward_token == address(0)){
            return;
         }

        //get difference in balance and remaining rewards
        //getReward is unguarded so we use reward_remaining to keep track of how much was actually claimed
        uint256 bal = IERC20(reward.reward_token).balanceOf(address(this));
        

        if (bal.sub(reward.reward_remaining) > 0) {
            //adjust supply based on reward group
            if(reward.reward_group == 0){
                //use inverse (supplyWeight can never be more than _supply)
                _supply = (_supply - supplyWeight);
            }else{
                //use supplyWeight
                _supply = supplyWeight;
            }

            if(_supply > 0){
                reward.reward_integral = reward.reward_integral + uint128(bal.sub(reward.reward_remaining).mul(1e20).div(_supply));
            }
        }

        //update user integrals
        for (uint256 u = 0; u < _accounts.length; u++) {
            //do not give rewards to address 0
            if (_accounts[u] == address(0)) continue;
            if(_isClaim && u != 0) continue; //if claiming, only update/claim for first address and use second as forwarding

            //adjust user balance based on reward group
            uint256 userb = _balances[u];
            if(reward.reward_group == 0){
                //use userRewardWeight inverse: weight of 0 should be full reward group 0
                userb = userb * (WEIGHT_PRECISION - userRewardWeight[_accounts[u]]) / WEIGHT_PRECISION;
            }else{
                //use userRewardWeight: weight of 10,000 should be full reward group 1
                userb = userb * userRewardWeight[_accounts[u]] / WEIGHT_PRECISION;
            }

            uint userI = reward.reward_integral_for[_accounts[u]];
            if(_isClaim || userI < reward.reward_integral){
                if(_isClaim){
                    uint256 receiveable = reward.claimable_reward[_accounts[u]].add(userb.mul( uint256(reward.reward_integral).sub(userI)).div(1e20));
                    if(receiveable > 0){
                        reward.claimable_reward[_accounts[u]] = 0;
                        //cheat for gas savings by transfering to the second index in accounts list
                        //if claiming only the 0 index will update so 1 index can hold forwarding info
                        //guaranteed to have an address in u+1 so no need to check
                        IERC20(reward.reward_token).safeTransfer(_accounts[u+1], receiveable);
                        emit RewardPaid(_accounts[u], reward.reward_token, receiveable, _accounts[u+1]);
                        bal = bal.sub(receiveable);
                    }
                }else{
                    reward.claimable_reward[_accounts[u]] = reward.claimable_reward[_accounts[u]].add(userb.mul( uint256(reward.reward_integral).sub(userI)).div(1e20));
                }
                reward.reward_integral_for[_accounts[u]] = reward.reward_integral;
            }
        }

        //update remaining reward here since balance could have changed if claiming
        if(_supply > 0 && bal != reward.reward_remaining){
            reward.reward_remaining = uint128(bal);
        }
    }

    function _checkpoint(address[2] memory _accounts) internal nonReentrant{

        uint256 supply = totalSupply();
        uint256[2] memory depositedBalance;
        depositedBalance[0] = balanceOf(_accounts[0]);
        depositedBalance[1] = balanceOf(_accounts[1]);
        
        //claim normal cvxcrv staking rewards
        IRewardStaking(cvxCrvStaking).getReward(address(this), true);
        //claim outside staking rewards
        _claimExtras();

        uint256 rewardCount = rewards.length;
        for (uint256 i = 0; i < rewardCount; i++) {
           _calcRewardIntegral(i,_accounts,depositedBalance,supply,false);
        }
    }

    function _checkpointAndClaim(address[2] memory _accounts) internal nonReentrant{

        uint256 supply = totalSupply();
        uint256[2] memory depositedBalance;
        depositedBalance[0] = balanceOf(_accounts[0]); //only do first slot
        
        //claim normal cvxcrv staking rewards
        IRewardStaking(cvxCrvStaking).getReward(address(this), true);
        //claim outside staking rewards
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

    function user_checkpoint(address _account) external returns(bool) {
        _checkpoint([_account, address(0)]);
        return true;
    }

    //run earned as a mutable function to claim everything before calculating earned rewards
    function earned(address _account) external returns(EarnedData[] memory claimable) {
        _checkpoint([_account, address(0)]);
        return _earned(_account);
    }

    //because we are doing a mutative earned(), we can just simulate checkpointing a user and looking at recorded claimables
    //thus no need to look at each reward contract's claimable tokens or cvx minting equations etc
    function _earned(address _account) internal view returns(EarnedData[] memory claimable) {
        
        uint256 rewardCount = rewards.length;
        claimable = new EarnedData[](rewardCount);

        for (uint256 i = 0; i < rewardCount; i++) {
            RewardType storage reward = rewards[i];

            //skip invalidated rewards
            if(reward.reward_token == address(0)){
                continue;
            }
    
            claimable[i].amount = reward.claimable_reward[_account];
            claimable[i].token = reward.reward_token;
        }
        return claimable;
    }

    //set a user's reward weight to determine how much of each reward group to receive
    function setRewardWeight(uint256 _weight) external{
        require(_weight <= WEIGHT_PRECISION, "!invalid");

        //checkpoint user
         _checkpoint([address(msg.sender), address(0)]);

        //set user weight and new supply weight
        //supply weight defined as amount of weight for reward group 1
        //..which means reward group 0 will be the inverse (real supply - weight)
        uint256 sweight = supplyWeight;
        //remove old user weight
        sweight -= balanceOf(msg.sender) * userRewardWeight[msg.sender] / WEIGHT_PRECISION;
        //add new user weight
        sweight += balanceOf(msg.sender) * _weight / WEIGHT_PRECISION;
        //store
        supplyWeight = sweight;
        userRewardWeight[msg.sender] = _weight;
    }

    //get user's weighted balance for specified reward group
    function userRewardBalance(address _address, uint256 _rewardGroup) external view returns(uint256){
        uint256 userb = balanceOf(_address);
        if(_rewardGroup == 0){
            //userRewardWeight of 0 should be full weight for reward group 0
            userb = userb * (WEIGHT_PRECISION - userRewardWeight[_address]) / WEIGHT_PRECISION;
        }else{
            // userRewardWeight of 10,000 should be full weight for reward group 1
            userb = userb * userRewardWeight[_address] / WEIGHT_PRECISION;
        }
        return userb;
    }

    //get weighted supply for specified reward group
    function rewardSupply(uint256 _rewardGroup) public view returns(uint256){
        //if group 0, return inverse of supplyWeight
        if(_rewardGroup == 0){
            return (totalSupply() - supplyWeight);
        }

        //else return supplyWeight
        return supplyWeight;
    }

    //claim
    function getReward(address _account) external {
        //claim directly in checkpoint logic to save a bit of gas
        _checkpointAndClaim([_account, _account]);
    }

    //claim and forward
    function getReward(address _account, address _forwardTo) external {
        //if forwarding, require caller is self
        require(msg.sender == _account, "!self");
        //claim directly in checkpoint logic to save a bit of gas
        //pack forwardTo into account array to save gas so that a proxy etc doesnt have to double transfer
        _checkpointAndClaim([_account,_forwardTo]);
    }

    //deposit vanilla crv
    function deposit(uint256 _amount, address _to) external {
        require(!isShutdown, "shutdown");

        //dont need to call checkpoint since _mint() will

        if (_amount > 0) {
            //deposit
            _mint(_to, _amount);
            IERC20(crv).safeTransferFrom(msg.sender, address(this), _amount);
            IConvexDeposits(crvDepositor).deposit(_amount, false, cvxCrvStaking);
        }

        emit Deposited(msg.sender, _to, _amount, true);
    }

    //stake cvxcrv
    function stake(uint256 _amount, address _to) public {
        require(!isShutdown, "shutdown");

        //dont need to call checkpoint since _mint() will

        if (_amount > 0) {
            //deposit
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
    function withdraw(uint256 _amount) external {
        
        //dont need to call checkpoint since _burn() will

        if (_amount > 0) {
            //withdraw
            _burn(msg.sender, _amount);
            IRewardStaking(cvxCrvStaking).withdraw(_amount, false);
            IERC20(cvxCrv).safeTransfer(msg.sender, _amount);
        }

        emit Withdrawn(msg.sender, _amount);
    }

    function _beforeTokenTransfer(address _from, address _to, uint256 _amount) internal override {
        _checkpoint([_from, _to]);

        if(_from != _to){
            //adjust supply weight assuming post transfer balances
            uint256 sweight = supplyWeight;
            if(_from != address(0)){
                sweight -= balanceOf(_from) * userRewardWeight[_from] / WEIGHT_PRECISION;
                sweight += balanceOf(_from).sub(_amount) * userRewardWeight[_from] / WEIGHT_PRECISION;
            }
            if(_to != address(0)){
                sweight -= balanceOf(_to) * userRewardWeight[_to] / WEIGHT_PRECISION;
                sweight += balanceOf(_to).add(_amount) * userRewardWeight[_to] / WEIGHT_PRECISION;
            }

            //write new supply weight
            supplyWeight = sweight;
        }
    }
}