// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

library Math {
    /**
     * @dev Returns the smallest of two numbers.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}

interface IBasicRewards{
    function getReward(address _account, bool _claimExtras) external;
    function stakeFor(address, uint256) external;
}

interface ICvxRewards{
    function getReward(address _account, bool _claimExtras, bool _stake) external;
}

interface IChefRewards{
    function claim(uint256 _pid, address _account) external;
}

interface ICvxCrvDeposit{
    function deposit(uint256, bool) external;
}

contract ClaimZap{
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public constant cvxCrv = address(0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7);
    address public constant crvDeposit = address(0x8014595F2AB54cD7c604B00E9fb932176fDc86Ae);
    address public constant cvxCrvRewards = address(0x3Fe65692bfCD0e6CF84cB1E7d24108E434A7587e);
    address public constant cvxRewards = address(0xCF50b810E57Ac33B91dCF525C6ddd9881B139332);

    address public immutable owner;
    address public chefRewards;

    constructor() public {
        owner = msg.sender;
        chefRewards = address(0x5F465e9fcfFc217c5849906216581a657cd60605);
    }

    function setChefRewards(address _rewards) external {
        require(msg.sender == owner, "!auth");
        chefRewards = _rewards;
    }

    function setApprovals() external {
        require(msg.sender == owner, "!auth");
        IERC20(crv).safeApprove(crvDeposit, 0);
        IERC20(crv).safeApprove(crvDeposit, uint256(-1));
        IERC20(cvx).safeApprove(cvxRewards, 0);
        IERC20(cvx).safeApprove(cvxRewards, uint256(-1));
        IERC20(cvxCrv).safeApprove(cvxCrvRewards, 0);
        IERC20(cvxCrv).safeApprove(cvxCrvRewards, uint256(-1));
    }

    function claimRewards(
        address[] calldata rewardContracts,
        uint256[] calldata chefIds,
        bool claimCvx,
        bool claimCvxStake,
        bool claimcvxCrv,
        uint256 depositCrvMaxAmount,
        uint256 depositCvxMaxAmount
        ) external{

        //claim from main curve LP pools
        for(uint256 i = 0; i < rewardContracts.length; i++){
            if(rewardContracts[i] == address(0)) break;
            IBasicRewards(rewardContracts[i]).getReward(msg.sender,true);
        }

        //claim from master chef
        for(uint256 i = 0; i < chefIds.length; i++){
            IChefRewards(chefRewards).claim(chefIds[i],msg.sender);
        }

        //claim (and stake) from cvx rewards
        if(claimCvxStake){
            ICvxRewards(cvxRewards).getReward(msg.sender,true,true);
        }else if(claimCvx){
            ICvxRewards(cvxRewards).getReward(msg.sender,true,false);
        }

        //claim from cvxCrv rewards
        if(claimcvxCrv){
            IBasicRewards(cvxCrvRewards).getReward(msg.sender,true);
        }

        //lock upto given amount of crv and stake
        if(depositCrvMaxAmount > 0){
            uint256 crvBalance = IERC20(crv).balanceOf(msg.sender);
            crvBalance = Math.min(crvBalance, depositCrvMaxAmount);
            if(crvBalance > 0){
                //pull crv
                IERC20(crv).safeTransferFrom(msg.sender, address(this), crvBalance);
                //deposit
                ICvxCrvDeposit(crvDeposit).deposit(crvBalance,true);
                //get cvxamount
                uint256 cvxCrvBalance = IERC20(cvxCrv).balanceOf(address(this));
                //stake for msg.sender
                IBasicRewards(cvxCrvRewards).stakeFor(msg.sender, cvxCrvBalance);
            }
        }

        //stake upto given amount of cvx
        if(depositCvxMaxAmount > 0){
            uint256 cvxBalance = IERC20(cvx).balanceOf(msg.sender);
            cvxBalance = Math.min(cvxBalance, depositCvxMaxAmount);
            if(cvxBalance > 0){
                //pull cvx
                IERC20(cvx).safeTransferFrom(msg.sender, address(this), cvxBalance);
                //stake for msg.sender
                IBasicRewards(cvxRewards).stakeFor(msg.sender, cvxBalance);
            }
        }
    }
}