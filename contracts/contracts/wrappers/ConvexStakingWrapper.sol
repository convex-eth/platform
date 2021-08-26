// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../interfaces/IRewardStaking.sol";
import "../interfaces/IConvexDeposits.sol";
import "../interfaces/CvxMining.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


//Example of a tokenize a convex staked position.
//if used as collateral some modifications will be needed to fit the specific platform

//Based on Curve.fi's gauge wrapper implementations at https://github.com/curvefi/curve-dao-contracts/tree/master/contracts/gauges/wrappers
contract ConvexStakingWrapper is ERC20, ReentrancyGuard, Ownable {
    using SafeERC20
    for IERC20;
    using Address
    for address;
    using SafeMath
    for uint256;

    struct RewardType {
        address reward_token;
        address reward_pool;
        uint128 reward_integral;
        uint128 reward_remaining;
        mapping(address => uint256) reward_integral_for;
        mapping(address => uint256) claimable_reward;
    }

    uint256 public cvx_reward_integral;
    uint256 public cvx_reward_remaining;
    mapping(address => uint256) public cvx_reward_integral_for;
    mapping(address => uint256) public cvx_claimable_reward;

    //constants/immutables
    address public constant convexBooster = address(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public immutable curveToken;
    address public immutable convexToken;
    address public immutable convexPool;
    uint256 public immutable convexPoolId;
    address public immutable collateralVault;

    //rewards
    RewardType[] public rewards;

    //management
    bool public isShutdown = false;

    event Deposited(address indexed _user, address indexed _account, uint256 _amount, bool _wrapped);
    event Withdrawn(address indexed _user, uint256 _amount, bool _unwrapped);

    constructor(address _curveToken, address _convexToken, address _convexPool, uint256 _poolId, address _vault, string memory _nameTag, string memory _symbolTag)
    public
    ERC20(
        string(
            abi.encodePacked("Staked ", ERC20(_convexToken).name(), _nameTag )
        ),
        string(abi.encodePacked("stk", ERC20(_convexToken).symbol(), _symbolTag))
    ) Ownable() {
        curveToken = _curveToken;
        convexToken = _convexToken;
        convexPool = _convexPool;
        convexPoolId = _poolId;
        collateralVault = _vault;
    }

    function shutdown() external onlyOwner {
        isShutdown = true;
    }

    function setApprovals() external {
        IERC20(curveToken).safeApprove(convexBooster, 0);
        IERC20(curveToken).safeApprove(convexBooster, uint256(-1));
        IERC20(convexToken).safeApprove(convexPool, 0);
        IERC20(convexToken).safeApprove(convexPool, uint256(-1));
    }

    function addRewards() external {
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
        }

        uint256 extraCount = IRewardStaking(mainPool).extraRewardsLength();
        uint256 startIndex = rewards.length - 1;
        for (uint256 i = startIndex; i < extraCount; i++) {
            address extraPool = IRewardStaking(mainPool).extraRewards(i);
            rewards.push(
                RewardType({
                    reward_token: IRewardStaking(extraPool).rewardToken(),
                    reward_pool: extraPool,
                    reward_integral: 0,
                    reward_remaining: 0
                })
            );
        }
    }

    function rewardLength() external view returns(uint256) {
        return rewards.length;
    }

    function _getDepositedBalance(address _account) internal virtual view returns(uint256) {
        if (_account == address(0) || _account == collateralVault) {
            return 0;
        }
        //get balance from collateralVault

        return balanceOf(_account);
    }

    function _getTotalSupply() internal virtual view returns(uint256){

        //override and add any supply needed (interest based growth)

        return totalSupply();
    }


    function _calcCvxIntegral(address[2] memory _accounts, uint256[2] memory _balances, uint256 _supply, bool _isClaim) internal {

        uint256 bal = IERC20(cvx).balanceOf(address(this));
        uint256 d_cvxreward = bal.sub(cvx_reward_remaining);

        if (_supply > 0) {
            cvx_reward_integral = cvx_reward_integral + d_cvxreward.mul(1e20).div(_supply);
        }

        
        //update user integrals for cvx
        for (uint256 u = 0; u < _accounts.length; u++) {
            //do not give rewards to address 0
            if (_accounts[u] == address(0)) continue;
            if (_accounts[u] == collateralVault) continue;

            uint256 receiveable = cvx_claimable_reward[_accounts[u]].add(_balances[u].mul(cvx_reward_integral.sub(cvx_reward_integral_for[_accounts[u]])).div(1e20));
            if(_isClaim){
                if(receiveable > 0){
                    cvx_claimable_reward[_accounts[u]] = 0;
                    IERC20(cvx).safeTransfer(_accounts[u], receiveable);
                    bal = bal.sub(receiveable);
                }
            }else{
                cvx_claimable_reward[_accounts[u]] = receiveable;
            }
            cvx_reward_integral_for[_accounts[u]] = cvx_reward_integral;
        }

        //update reward total
        cvx_reward_remaining = bal;
    }

    function _calcRewardIntegral(uint256 _index, address[2] memory _accounts, uint256[2] memory _balances, uint256 _supply, bool _isClaim) internal{
         RewardType storage reward = rewards[_index];

        //get difference in balance and remaining rewards
        //getReward is unguarded so we use reward_remaining to keep track of how much was actually claimed
        uint256 bal = IERC20(reward.reward_token).balanceOf(address(this));
        uint256 d_reward = bal.sub(reward.reward_remaining);

        if (_supply > 0) {
            reward.reward_integral = reward.reward_integral + uint128(d_reward.mul(1e20).div(_supply));
        }

        //update user integrals
        for (uint256 u = 0; u < _accounts.length; u++) {
            //do not give rewards to address 0
            if (_accounts[u] == address(0)) continue;
            if (_accounts[u] == collateralVault) continue;

            if(_isClaim){
                uint256 receiveable = reward.claimable_reward[_accounts[u]].add(_balances[u].mul( uint256(reward.reward_integral).sub(reward.reward_integral_for[_accounts[u]])).div(1e20));
                if(receiveable > 0){
                    reward.claimable_reward[_accounts[u]] = 0;
                    IERC20(reward.reward_token).safeTransfer(_accounts[u], receiveable);
                    bal = bal.sub(receiveable);
                }
            }else{
                reward.claimable_reward[_accounts[u]] = reward.claimable_reward[_accounts[u]].add(_balances[u].mul( uint256(reward.reward_integral).sub(reward.reward_integral_for[_accounts[u]])).div(1e20));
            }
            reward.reward_integral_for[_accounts[u]] = reward.reward_integral;
        }

        //update remaining reward here since balance could have changed if claiming
        reward.reward_remaining = uint128(bal);
    }

    function _checkpoint(address[2] memory _accounts) internal {

        uint256 supply = _getTotalSupply();
        uint256[2] memory depositedBalance;
        depositedBalance[0] = _getDepositedBalance(_accounts[0]);
        depositedBalance[1] = _getDepositedBalance(_accounts[1]);
        
        IRewardStaking(convexPool).getReward(address(this), true);

        uint256 rewardCount = rewards.length;
        for (uint256 i = 0; i < rewardCount; i++) {
           _calcRewardIntegral(i,_accounts,depositedBalance,supply,false);
        }
        _calcCvxIntegral(_accounts,depositedBalance,supply,false);
    }

    function _checkpointAndClaim(address[2] memory _accounts) internal {

        uint256 supply = _getTotalSupply();
        uint256[2] memory depositedBalance;
        depositedBalance[0] = _getDepositedBalance(_accounts[0]); //only do first slot
        
        IRewardStaking(convexPool).getReward(address(this), true);

        uint256 rewardCount = rewards.length;
        for (uint256 i = 0; i < rewardCount; i++) {
           _calcRewardIntegral(i,_accounts,depositedBalance,supply,true);
        }
        _calcCvxIntegral(_accounts,depositedBalance,supply,true);
    }

    function user_checkpoint(address[2] calldata _accounts) external returns(bool) {
        _checkpoint([_accounts[0], _accounts[1]]);
        return true;
    }

    function totalBalanceOf(address _account) external view returns(uint256){
        return _getDepositedBalance(_account);
    }

    function earned(address _account) external view returns(uint256[] memory claimable) {
        uint256 supply = _getTotalSupply();
        // uint256 depositedBalance = _getDepositedBalance(_account);
        uint256 rewardCount = rewards.length;
        claimable = new uint256[](rewardCount + 1);

        for (uint256 i = 0; i < rewardCount; i++) {
            RewardType storage reward = rewards[i];

            //change in reward is current balance - remaining reward + earned
            uint256 bal = IERC20(reward.reward_token).balanceOf(address(this));
            uint256 d_reward = bal.sub(reward.reward_remaining);
            d_reward = d_reward.add(IRewardStaking(reward.reward_pool).earned(address(this)));

            uint256 I = reward.reward_integral;
            if (supply > 0) {
                I = I + d_reward.mul(1e20).div(supply);
            }

            uint256 newlyClaimable = _getDepositedBalance(_account).mul(I.sub(reward.reward_integral_for[_account])).div(1e20);
            claimable[i] = reward.claimable_reward[_account].add(newlyClaimable);

            //calc cvx here
            if(reward.reward_token == crv){
                claimable[rewardCount] = cvx_claimable_reward[_account].add(CvxMining.ConvertCrvToCvx(newlyClaimable));
            }
        }
    }

    function getReward(address _account) external {
        //claim directly in checkpoint logic to save a bit of gas
        _checkpointAndClaim([_account, address(0)]);
    }

    //deposit a curve token
    function deposit(uint256 _amount, address _to) external nonReentrant {
        require(!isShutdown, "shutdown");

        //dont need to call checkpoint since _mint() will

        if (_amount > 0) {
            _mint(_to, _amount);
            IERC20(curveToken).safeTransferFrom(msg.sender, address(this), _amount);
            IConvexDeposits(convexBooster).deposit(convexPoolId, _amount, true);
        }

        emit Deposited(msg.sender, _to, _amount, true);
    }

    //stake a convex token
    function stake(uint256 _amount, address _to) external nonReentrant {
        require(!isShutdown, "shutdown");

        //dont need to call checkpoint since _mint() will

        if (_amount > 0) {
            _mint(_to, _amount);
            IERC20(convexToken).safeTransferFrom(msg.sender, address(this), _amount);
            IRewardStaking(convexPool).stake(_amount);
        }

        emit Deposited(msg.sender, _to, _amount, false);
    }

    //withdraw to convex deposit token
    function withdraw(uint256 _amount) external nonReentrant {

        //dont need to call checkpoint since _burn() will

        if (_amount > 0) {
            _burn(msg.sender, _amount);
            IRewardStaking(convexPool).withdraw(_amount, false);
            IERC20(convexToken).safeTransfer(msg.sender, _amount);
        }

        emit Withdrawn(msg.sender, _amount, false);
    }

    //withdraw to underlying curve lp token
    function withdrawAndUnwrap(uint256 _amount) external nonReentrant {
        
        //dont need to call checkpoint since _burn() will

        if (_amount > 0) {
            _burn(msg.sender, _amount);
            IRewardStaking(convexPool).withdrawAndUnwrap(_amount, false);
            IERC20(curveToken).safeTransfer(msg.sender, _amount);
        }

        //events
        emit Withdrawn(msg.sender, _amount, true);
    }

    function _beforeTokenTransfer(address _from, address _to, uint256 _amount) internal override {
        _checkpoint([_from, _to]);
    }
}