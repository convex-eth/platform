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

    address public owner;
    address public cvx;
    address public cvxRewards;
    address public cvxCrvRewards;
    address public chefRewards;
    address public crvDeposit;
    address public cvxCrv;

    constructor(address _cvxRewards, address _cvxCrvRewards, address _chefRewards, address _cvx, address _cvxCrv, address _crvDeposit) public {
        owner = msg.sender;
        cvxRewards = _cvxRewards;
        cvxCrvRewards = _cvxCrvRewards;
        chefRewards = _chefRewards;
        cvx = _cvx;
        cvxCrv = _cvxCrv;
        crvDeposit = _crvDeposit;
    }

    function setCvxRewards(address _rewards) external {
        require(msg.sender == owner, "!auth");
        cvxRewards = _rewards;
        IERC20(cvx).safeApprove(cvxRewards, 0);
        IERC20(cvx).safeApprove(cvxRewards, uint256(-1));
    }

    function setCvxCrvRewards(address _rewards) external {
        require(msg.sender == owner, "!auth");
        cvxCrvRewards = _rewards;
        IERC20(cvxCrv).safeApprove(cvxCrvRewards, 0);
        IERC20(cvxCrv).safeApprove(cvxCrvRewards, uint256(-1));
    }

    function setChefRewards(address _rewards) external {
        require(msg.sender == owner, "!auth");
        chefRewards = _rewards;
    }

    function setApprovals() external {
        require(msg.sender == owner, "!auth");
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