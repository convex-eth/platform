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
//other considerations: might be worth refactoring to use earned() during checkpoints instead of claiming rewards each time

//Based on Curve.fi's gauge wrapper implementations at https://github.com/curvefi/curve-dao-contracts/tree/master/contracts/gauges/wrappers
contract CvxCrvStakingWrapper is ERC20, ReentrancyGuard, Ownable {
    using SafeERC20
    for IERC20;
    using Address
    for address;
    using SafeMath
    for uint256;

    struct RewardType {
        address reward_token;
        address reward_pool;
        uint256 reward_integral;
        mapping(address => uint256) reward_integral_for;
        mapping(address => uint256) claimable_reward;
    }

    uint256 public cvx_reward_integral;
    mapping(address => uint256) public cvx_reward_integral_for;
    mapping(address => uint256) public cvx_claimable_reward;

    //constants/immutables
    address public constant crvDepositor = address(0x8014595F2AB54cD7c604B00E9fb932176fDc86Ae);
    address public constant cvxCrvStaking = address(0x3Fe65692bfCD0e6CF84cB1E7d24108E434A7587e);
    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public constant cvxCrv = address(0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7);

    address public immutable collateralVault;

    //rewards
    RewardType[] public rewards;

    //management
    bool public isShutdown = false;

    event Deposited(address indexed _user, address indexed _account, uint256 _amount, bool _wrapped);
    event Withdrawn(address indexed _user, uint256 _amount, bool _unwrapped);

    constructor(address _vault)
    public
    ERC20(
        string(
            abi.encodePacked("Staked ", ERC20(cvxCrv).name())
        ),
        string(abi.encodePacked("stk", ERC20(cvxCrv).symbol()))
    ) Ownable() {
        collateralVault = _vault;
    }

    function shutdown() external onlyOwner {
        isShutdown = true;
    }

    function setApprovals() external {
        IERC20(crv).safeApprove(crvDepositor, 0);
        IERC20(crv).safeApprove(crvDepositor, uint256(-1));
        IERC20(cvxCrv).safeApprove(cvxCrvStaking, 0);
        IERC20(cvxCrv).safeApprove(cvxCrvStaking, uint256(-1));
    }

    function addRewards() external {

        if (rewards.length == 0) {
            rewards.push(
                RewardType({
                    reward_token: crv,
                    reward_pool: cvxCrvStaking,
                    reward_integral: 0
                })
            );
        }

        uint256 extraCount = IRewardStaking(cvxCrvStaking).extraRewardsLength();
        uint256 startIndex = rewards.length - 1;
        for (uint256 i = startIndex; i < extraCount; i++) {
            address extraPool = IRewardStaking(cvxCrvStaking).extraRewards(i);
            rewards.push(
                RewardType({
                    reward_token: IRewardStaking(extraPool).rewardToken(),
                    reward_pool: extraPool,
                    reward_integral: 0
                })
            );
        }
    }

    function rewardLength() external view returns(uint256) {
        return rewards.length;
    }

    function _getDepositedBalance(address _account) internal view returns(uint256) {

        //get balance from collateralVault

        return balanceOf(_account);
    }

    function _calcCvxIntegral(address[2] memory _accounts, uint256[2] memory _balances, uint256 _beforeAmount, uint256 _supply) internal {

        uint256 d_cvxreward = IERC20(cvx).balanceOf(address(this)).sub(_beforeAmount);
        uint256 cvx_dI;
        if (_supply > 0) {
            cvx_dI = d_cvxreward.mul(1e20).div(_supply);
        }
        uint256 cvx_I = cvx_reward_integral + cvx_dI;
        cvx_reward_integral = cvx_I;
        //update user integrals for cvx
        for (uint256 u = 0; u < _accounts.length; u++) {
            //do not give rewards to address 0
            if (_accounts[u] == address(0)) continue;
            if (_accounts[u] == collateralVault) continue;

            cvx_claimable_reward[_accounts[u]] = cvx_claimable_reward[_accounts[u]].add(_balances[u].mul(cvx_I.sub(cvx_reward_integral_for[_accounts[u]])).div(1e20));
            cvx_reward_integral_for[_accounts[u]] = cvx_I;
        }
    }

    function _calcRewardIntegral(uint256 _index, address[2] memory _accounts, uint256[2] memory _balances, uint256 _supply) internal{
         RewardType storage reward = rewards[_index];

        //update global integral
        //address token = reward.reward_token;
        uint256 d_reward = IERC20(reward.reward_token).balanceOf(address(this));
        if (reward.reward_token == crv) {
            uint256 d_cvxreward = IERC20(cvx).balanceOf(address(this));
            IRewardStaking(reward.reward_pool).getReward(address(this), false);
            //crv claims cvx so do cvx integral too
            _calcCvxIntegral(_accounts, _balances, d_cvxreward, _supply);
        } else {
            IRewardStaking(reward.reward_pool).getReward();
        }
        d_reward = IERC20(reward.reward_token).balanceOf(address(this)).sub(d_reward);

        uint256 dI;
        if (_supply > 0) {
            dI = d_reward.mul(1e20).div(_supply);
        }
        uint256 I = reward.reward_integral + dI;
        reward.reward_integral = I;

        //update user integrals
        for (uint256 u = 0; u < _accounts.length; u++) {
            //do not give rewards to address 0
            if (_accounts[u] == address(0)) continue;
            if (_accounts[u] == collateralVault) continue;

            reward.claimable_reward[_accounts[u]] = reward.claimable_reward[_accounts[u]].add(_balances[u].mul(I.sub(reward.reward_integral_for[_accounts[u]])).div(1e20));
            reward.reward_integral_for[_accounts[u]] = I;
        }
    }

    function _checkpoint(address[2] memory _accounts) internal {

        //total supply may need to be modified in a debt based set up
        uint256 supply = totalSupply();
        uint256[2] memory depositedBalance;
        depositedBalance[0] = _getDepositedBalance(_accounts[0]);
        if (_accounts[1] != address(0) && _accounts[1] != collateralVault) {
            depositedBalance[1] = _getDepositedBalance(_accounts[1]);
        }
        uint256 rewardCount = rewards.length;
        for (uint256 i = 0; i < rewardCount; i++) {
           _calcRewardIntegral(i,_accounts,depositedBalance,supply);
        }
    }

    function user_checkpoint(address[2] calldata _accounts) external returns(bool) {
        _checkpoint([_accounts[0], _accounts[1]]);
        return true;
    }

    function earned(address _account) external view returns(uint256[] memory claimable) {
        uint256 supply = totalSupply();
        //uint256 depositedBalance = _getDepositedBalance(_account);
        uint256 rewardCount = rewards.length;
        claimable = new uint256[](rewardCount + 1);

        for (uint256 i = 0; i < rewardCount; i++) {
            RewardType storage reward = rewards[i];

            uint256 d_reward = IRewardStaking(reward.reward_pool).earned(address(this));

            uint256 dI;
            if (supply > 0) {
                dI = d_reward.mul(1e20).div(supply);
            }
            uint256 I = reward.reward_integral + dI;
            uint256 newlyClaimable = _getDepositedBalance(_account).mul(I.sub(reward.reward_integral_for[_account])).div(1e20);
            claimable[i] = reward.claimable_reward[_account].add(newlyClaimable);

            //calc cvx here
            if(reward.reward_token == crv){
                claimable[rewardCount] = cvx_claimable_reward[_account].add(CvxMining.ConvertCrvToCvx(newlyClaimable));
            }
        }
    }

    function getReward(address _account) external {
        _checkpoint([_account, address(0)]);

        uint256 rewardCount = rewards.length;
        for (uint256 i = 0; i < rewardCount; i++) {
            RewardType storage reward = rewards[i];
            uint256 amount = reward.claimable_reward[_account];
            if (amount > 0) {
                IERC20(reward.reward_token).safeTransfer(_account, amount);
                reward.claimable_reward[_account] = 0;
            }
        }
        uint256 cvxAmount = cvx_claimable_reward[_account];
        if (cvxAmount > 0) {
            IERC20(cvx).safeTransfer(_account, cvxAmount);
            cvx_claimable_reward[_account] = 0;
        }
    }

    //deposit a curve token
    function deposit(uint256 _amount, address _to) external nonReentrant {
        require(!isShutdown, "shutdown");

        _checkpoint([_to, address(0)]);
        if (_amount > 0) {
            _mint(_to, _amount);
            IERC20(crv).safeTransferFrom(msg.sender, address(this), _amount);
            IConvexDeposits(crvDepositor).deposit(_amount, false, cvxCrvStaking);
        }

        emit Deposited(msg.sender, _to, _amount, true);
    }

    //stake a convex token
    function stake(uint256 _amount, address _to) external nonReentrant {
        require(!isShutdown, "shutdown");

        _checkpoint([_to, address(0)]);

        if (_amount > 0) {
            _mint(_to, _amount);
            IERC20(cvxCrv).safeTransferFrom(msg.sender, address(this), _amount);
            IRewardStaking(cvxCrvStaking).stake(_amount);
        }

        emit Deposited(msg.sender, _to, _amount, false);
    }

    //withdraw to convex deposit token
    function withdraw(uint256 _amount) external nonReentrant {
        _checkpoint([address(msg.sender), address(0)]);

        if (_amount > 0) {
            _burn(msg.sender, _amount);
            IRewardStaking(cvxCrvStaking).withdraw(_amount, false);
            IERC20(cvxCrv).safeTransfer(msg.sender, _amount);
        }

        emit Withdrawn(msg.sender, _amount, false);
    }

    function _beforeTokenTransfer(address _from, address _to, uint256 _amount) internal override {
        _checkpoint([_from, _to]);
    }
}