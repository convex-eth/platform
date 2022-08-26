// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/IRewardStaking.sol";
import "../interfaces/IConvexDeposits.sol";
import "../interfaces/CvxMining.sol";
import "../interfaces/IERC4626.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


//Ohm pool wrapper to allow Olympus to mint and sync into a curve pool

//Based on Curve.fi's gauge wrapper implementations at https://github.com/curvefi/curve-dao-contracts/tree/master/contracts/gauges/wrappers
contract ConvexStakingWrapperOhmSync is ERC20, ReentrancyGuard, IERC4626 {
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
    address public constant convexBooster = address(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public constant ohm = address(0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5);
    address public constant curveToken = address(0x3660BD168494d61ffDac21E403d0F6356cF90fD7);
    address public constant curveSwap = address(0x6ec38b3228251a0C5D491Faf66858e2E23d7728B);
    address public constant convexToken = address(0x9bB0dAF4361e1b84F5A44914595c46f07e9d12a4);
    address public constant convexPool = address(0xd683C7051a28fA150EB3F4BD92263865D4a67778);
    uint256 public constant convexPoolId = 92;
    uint256 private constant CRV_INDEX = 0;
    uint256 private constant CVX_INDEX = 1;

    //rewards
    RewardType[] public rewards;
    mapping(address => uint256) public registeredRewards;

    //management
    bool public isShutdown;
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    event Deposit(
        address indexed sender,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    event Withdraw(
        address indexed sender,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 share
    );


    /// Constructor and setup ///
    constructor() public
        ERC20(
            "StakedConvexOhmEth",
            "stkcvxOhmEth"
        ){
        owner = msg.sender;
        addRewards();
        setApprovals();
    }

     function setApprovals() public {
        IERC20(curveToken).safeApprove(convexBooster, 0);
        IERC20(curveToken).safeApprove(convexBooster, uint256(-1));
        IERC20(convexToken).safeApprove(convexPool, 0);
        IERC20(convexToken).safeApprove(convexPool, uint256(-1));
    }

    ///  ownership ///

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


    ///  special management ///
    function sync() external{
        //any vanilla lp tokens resting directly on this contract can be absorbed to all user's shares
        uint256 lpbal = IERC20(curveToken).balanceOf(address(this));

        if(lpbal > 0){
            //first checkpoint
            address[2] memory check;
            _checkpoint(check);

            //deposit
            IConvexDeposits(convexBooster).deposit(convexPoolId, lpbal, true);
        }
    }

    function stakedOhm() external view returns(uint256 ohmAmount){
        uint256 stakedLpTokens = totalAssets();
        uint256 totalLpTokens = IERC20(curveToken).totalSupply();
        uint256 ohmInCurvePool = IERC20(ohm).balanceOf(curveSwap);

        if(totalLpTokens > 0){
            ohmAmount = ohmInCurvePool.mul(stakedLpTokens).div(totalLpTokens);
        }
    }

    ///  IERC 4626 ///

    function asset() external override view returns (address){
        return curveToken;
    }

    function totalAssets() public override view returns (uint256){
        return IRewardStaking(convexPool).balanceOf(address(this));
    }

    function convertToShares(uint256 _assets) public override view returns (uint256 shares){
        if (totalSupply() == 0) {
            shares = _assets;
        } else {
            shares = (_assets.mul(totalSupply())).div(totalAssets());
        }
    }
    function convertToAssets(uint256 _shares) public override view returns (uint256 assets){
        if(totalSupply() > 0){
            assets = (totalAssets().mul(_shares)).div(totalSupply());
        }else{
            assets = _shares;
        }
    }
    function maxDeposit(address _receiver) external override view returns (uint256){
        return uint256(-1);
    }
    function maxMint(address _receiver) external override view returns (uint256){
        return uint256(-1);
    }
    function previewDeposit(uint256 _amount) external override view returns (uint256){
        return _amount;
    }
    function previewMint(uint256 _shares) external override view returns (uint256){
        return _shares;
    }
    function maxWithdraw(address _owner) external override view returns (uint256){
        return uint256(-1);
    }
    function previewWithdraw(uint256 _amount) external override view returns (uint256){
        return _amount;
    }
    function maxRedeem(address _owner) external override view returns (uint256){
        return uint256(-1);
    }
    function previewRedeem(uint256 _shares) external override view returns (uint256){
        return _shares;
    }

    //deposit curve lp tokens via shares
    function mint(uint256 _shares, address _receiver) external override returns (uint256 assets){
        require(!isShutdown, "shutdown");

        //dont need to call checkpoint since _mint() will

        if (_shares > 0) {
            assets = convertToAssets(_shares);
            if(assets > 0){
                _mint(_receiver, _shares);
                IERC20(curveToken).safeTransferFrom(msg.sender, address(this), assets);
                IConvexDeposits(convexBooster).deposit(convexPoolId, assets, true);
                emit Deposit(msg.sender, _receiver, assets, _shares);
            }
        }
    }


    //deposit curve lp tokens via amount
    function deposit(uint256 _amount, address _receiver) external override returns (uint256 shares){
        require(!isShutdown, "shutdown");

        //dont need to call checkpoint since _mint() will

        if (_amount > 0) {
            shares = convertToShares(_amount);
            if(shares > 0){
                _mint(_receiver, shares);
                IERC20(curveToken).safeTransferFrom(msg.sender, address(this), _amount);
                IConvexDeposits(convexBooster).deposit(convexPoolId, _amount, true);
                emit Deposit(msg.sender, _receiver, _amount, shares);
            }
        }
    }

    //stake a convex token via amount
    function stake(uint256 _amount, address _receiver) external returns (uint256 shares){
        require(!isShutdown, "shutdown");

        //dont need to call checkpoint since _mint() will

        if (_amount > 0) {
            shares = convertToShares(_amount);
            if(shares > 0){
                _mint(_receiver, shares);
                IERC20(convexToken).safeTransferFrom(msg.sender, address(this), _amount);
                IRewardStaking(convexPool).stake(_amount);
                emit Deposit(msg.sender, _receiver, _amount, shares);
            }
        }
    }


    //withdraw to curve lp token via shares
    function redeem(uint256 _shares) external returns (uint256 assets){
        assets = redeem(_shares, msg.sender, msg.sender);
    }

    function redeem(uint256 _shares, address _receiver, address _owner) public override returns (uint256 assets){
        //dont need to call checkpoint since _burn() will

        if (_shares > 0) {
            assets = convertToAssets(_shares);
            _burn(msg.sender, _shares);
            IRewardStaking(convexPool).withdrawAndUnwrap(assets, false);
            IERC20(curveToken).safeTransfer(_receiver, assets);
            emit Withdraw(msg.sender, _receiver, msg.sender, _shares, assets);
        }
    }

    //withdraw to curve lp token via amount
    function withdraw(uint256 _amount) external returns(uint256 shares) {
        shares = withdraw(_amount, msg.sender, msg.sender);
    }

    function withdraw(uint256 _amount, address _receiver, address _owner) public override returns(uint256 shares){

        //dont need to call checkpoint since _burn() will

        if (_amount > 0) {
            shares = convertToShares(_amount);
            _burn(msg.sender, shares);
            IRewardStaking(convexPool).withdrawAndUnwrap(_amount, false);
            IERC20(curveToken).safeTransfer(_receiver, _amount);
            emit Withdraw(msg.sender, _receiver, msg.sender, shares, _amount);
        }
    }

    //mimic other convex wrappers to keep the same interface
    function withdrawAndUnwrap(uint256 _amount) external returns(uint256 shares){
        shares = withdraw(_amount, msg.sender, msg.sender);
    }


    /////  Reward mechanics ////
    function addRewards() public {
        address mainPool = convexPool;

        if (rewards.length == 0) {
            rewards.push(
                RewardType({
                    reward_token: crv,
                    reward_pool: mainPool,
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
        }

        uint256 extraCount = IRewardStaking(mainPool).extraRewardsLength();
        for (uint256 i = 0; i < extraCount; i++) {
            address extraPool = IRewardStaking(mainPool).extraRewards(i);
            address extraToken = IRewardStaking(extraPool).rewardToken();
            if(extraToken == cvx){
                //update cvx reward pool address
                rewards[CVX_INDEX].reward_pool = extraPool;
            }else if(registeredRewards[extraToken] == 0){
                //add new token to list
                rewards.push(
                    RewardType({
                        reward_token: IRewardStaking(extraPool).rewardToken(),
                        reward_pool: extraPool,
                        reward_integral: 0,
                        reward_remaining: 0
                    })
                );
                registeredRewards[extraToken] = rewards.length; //mark registered at index+1
            }
        }
    }

    function rewardLength() external view returns(uint256) {
        return rewards.length;
    }

    function _getDepositedBalance(address _account) internal virtual view returns(uint256) {
        
        //can override this if there is a collateral vault that needs special handling

        return balanceOf(_account);
    }

    function _getTotalSupply() internal virtual view returns(uint256){

        //can override and add any supply needed (interest based growth etc?)

        return totalSupply();
    }

    function _calcRewardIntegral(uint256 _index, address[2] memory _accounts, uint256[2] memory _balances, uint256 _supply, bool _isClaim) internal{
         RewardType storage reward = rewards[_index];

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
            // if (_accounts[u] == collateralVault) continue;
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

    function _checkpoint(address[2] memory _accounts) internal nonReentrant{
        //if shutdown, no longer checkpoint in case there are problems
        if(isShutdown) return;

        uint256 supply = _getTotalSupply();
        uint256[2] memory depositedBalance;
        depositedBalance[0] = _getDepositedBalance(_accounts[0]);
        depositedBalance[1] = _getDepositedBalance(_accounts[1]);
        
        IRewardStaking(convexPool).getReward(address(this), true);

        uint256 rewardCount = rewards.length;
        for (uint256 i = 0; i < rewardCount; i++) {
           _calcRewardIntegral(i,_accounts,depositedBalance,supply,false);
        }
    }

    function _checkpointAndClaim(address[2] memory _accounts) internal nonReentrant{

        uint256 supply = _getTotalSupply();
        uint256[2] memory depositedBalance;
        depositedBalance[0] = _getDepositedBalance(_accounts[0]); //only do first slot
        
        IRewardStaking(convexPool).getReward(address(this), true);

        uint256 rewardCount = rewards.length;
        for (uint256 i = 0; i < rewardCount; i++) {
           _calcRewardIntegral(i,_accounts,depositedBalance,supply,true);
        }
    }

    function user_checkpoint(address[2] calldata _accounts) external returns(bool) {
        _checkpoint([_accounts[0], _accounts[1]]);
        return true;
    }

    function totalBalanceOf(address _account) external view returns(uint256){
        return _getDepositedBalance(_account);
    }

    function earned(address _account) external view returns(EarnedData[] memory claimable) {
        uint256 supply = _getTotalSupply();
        // uint256 depositedBalance = _getDepositedBalance(_account);
        uint256 rewardCount = rewards.length;
        claimable = new EarnedData[](rewardCount);

        for (uint256 i = 0; i < rewardCount; i++) {
            RewardType storage reward = rewards[i];

            if(reward.reward_pool == address(0)){
                //cvx reward may not have a reward pool yet
                //so just add whats already been checkpointed
                claimable[i].amount = claimable[i].amount.add(reward.claimable_reward[_account]);
                claimable[i].token = reward.reward_token;
                continue;
            }

            //change in reward is current balance - remaining reward + earned
            uint256 bal = IERC20(reward.reward_token).balanceOf(address(this));
            uint256 d_reward = bal.sub(reward.reward_remaining);
            d_reward = d_reward.add(IRewardStaking(reward.reward_pool).earned(address(this)));

            uint256 I = reward.reward_integral;
            if (supply > 0) {
                I = I + d_reward.mul(1e20).div(supply);
            }

            uint256 newlyClaimable = _getDepositedBalance(_account).mul(I.sub(reward.reward_integral_for[_account])).div(1e20);
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
                newlyClaimable = _getDepositedBalance(_account).mul(I.sub(reward.reward_integral_for[_account])).div(1e20);
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

    

    function _beforeTokenTransfer(address _from, address _to, uint256 _amount) internal override {
        _checkpoint([_from, _to]);
    }
}