// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';


interface IExtraRewards{
    function queueNewRewards(uint256 _rewards) external;
}

interface ISwapExchange {
    function swapExactTokensForTokens(
        uint256,
        uint256,
        address[] calldata,
        address,
        uint256
    ) external;
}

contract Buybacker{
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public constant cvxCrv = address(0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7);
    address public constant crvDeposit = address(0x8014595F2AB54cD7c604B00E9fb932176fDc86Ae);
    address public constant cvxCrvRewards = address(0x3Fe65692bfCD0e6CF84cB1E7d24108E434A7587e);
    address public constant cvxRewards = address(0xCF50b810E57Ac33B91dCF525C6ddd9881B139332);

    address public constant exchange = address(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);
    address public immutable rewards;

    constructor(address _rewards) public {
        rewards = _rewards;
    }

    function setApprovals() external {
        IERC20(crv).safeApprove(exchange, 0);
        IERC20(crv).safeApprove(exchange, uint256(-1));
    }

    function buyback() external{

        //get crv balance
        uint256 crvBal = IERC20(crv).balanceOf(address(this));

        //exchange for cvxcrv
        address[] memory path = new address[](2);
        path[0] = crv;
        path[1] = cvxCrv;
        ISwapExchange(exchange).swapExactTokensForTokens(crvBal,0,path,address(this),now.add(1800));
        
        //cvxcrv bal
        uint256 cvxcrvBal = IERC20(cvxCrv).balanceOf(address(this));

        //send to rewards
        IERC20(cvxCrv).safeTransfer(rewards,cvxcrvBal);

        //update rewards
        IExtraRewards(rewards).queueNewRewards(cvxcrvBal);
    }
}