// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./interfaces/IRewardStaking.sol";
import "./interfaces/ICvxCrvStaking.sol";
import "./interfaces/IConvexDeposits.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';



interface ICvxCrvExchange {

    function exchange(
        int128,
        int128,
        uint256,
        uint256,
        address
    ) external returns (uint256);

    function calc_token_amount(uint256[2] calldata _amounts, bool _isDeposit) external view returns(uint256);
    function calc_withdraw_one_coin(uint256 _amount, int128 _index) external view returns(uint256);
    function add_liquidity(uint256[2] calldata _amounts, uint256 _min_mint_amount, address _receiver) external returns(uint256);
    function remove_liquidity(uint256 _amount, uint256[2] calldata _min_amounts, address _receiver) external returns(uint256[2] calldata);
    function remove_liquidity_one_coin(uint256 _amount, int128 _index, uint256 _min_amount, address _receiver) external returns(uint256);
}


contract TreasurySwap{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public constant cvxCrv = address(0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7);
    address public constant cvxCrvRewards = address(0x3Fe65692bfCD0e6CF84cB1E7d24108E434A7587e);
    address public constant treasury = address(0x1389388d01708118b497f59521f6943Be2541bb7);
    address public constant exchange = address(0x9D0464996170c6B9e75eED71c68B99dDEDf279e8);
    address public constant booster = address(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    address public constant lprewards = address(0x0392321e86F42C2F94FBb0c6853052487db521F0);
    uint256 public constant pid = 41;

    address public immutable owner;


    mapping(address => bool) operators;
    address public stakedCvxcrv;
    uint256 public slippage;


    constructor() public {
        owner = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB);
        operators[msg.sender] = true;

        slippage = 999 * 1e15;
        IERC20(cvxCrv).safeApprove(cvxCrvRewards, uint256(-1));
        IERC20(crv).safeApprove(exchange, uint256(-1));
        IERC20(cvxCrv).safeApprove(exchange, uint256(-1));
        IERC20(exchange).safeApprove(booster, uint256(-1));
    }


    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");
        _;
    }

    modifier onlyOperator() {
        require(operators[msg.sender] || owner == msg.sender, "!operator");
        _;
    }

    function setStakeAddress(address _stake) external onlyOwner{
        stakedCvxcrv = _stake;
        IERC20(cvxCrv).safeApprove(_stake, 0);
        IERC20(cvxCrv).safeApprove(_stake, uint256(-1));
    }

    function setOperator(address _op, bool _active) external onlyOwner{
        operators[_op] = _active;
    }

    function setSlippageAllowance(uint256 _slip) external onlyOwner{
        require(_slip > 0, "!valid slip");
        slippage = _slip;
    }

    function withdrawTo(IERC20 _asset, uint256 _amount, address _to) external onlyOwner{
        _asset.safeTransfer(_to, _amount);
    }

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external onlyOwner returns (bool, bytes memory) {

        (bool success, bytes memory result) = _to.call{value:_value}(_data);

        return (success, result);
    }

    function calc_minOut_swap(uint256 _amount) external view returns(uint256){
        uint256[2] memory amounts = [_amount,0];
        uint256 tokenOut = ICvxCrvExchange(exchange).calc_token_amount(amounts, false);
        tokenOut = tokenOut * slippage / 1e18;
        return tokenOut;
    }

    function calc_minOut_deposit(uint256 _crvamount, uint256 _cvxcrvamount) external view returns(uint256){
        uint256[2] memory amounts = [_crvamount,_cvxcrvamount];
        uint256 tokenOut = ICvxCrvExchange(exchange).calc_token_amount(amounts, true);
        tokenOut = tokenOut * slippage / 1e18;
        return tokenOut;
    }

    function calc_withdraw_one_coin(uint256 _amount) external view returns(uint256){
        uint256 tokenOut = ICvxCrvExchange(exchange).calc_withdraw_one_coin(_amount, 1);
        tokenOut = tokenOut * slippage / 1e18;
        return tokenOut;
    }

    function swap(uint256 _amount, uint256 _minAmountOut) external onlyOperator{
        require(_minAmountOut > 0, "!min_out");

        //pull
        IERC20(crv).safeTransferFrom(treasury,address(this),_amount);
        
        //swap and return to treasury
        ICvxCrvExchange(exchange).exchange(0,1,_amount,_minAmountOut, treasury);
    }

    function stake(uint256 _amount) external onlyOperator{
        require(stakedCvxcrv != address(0),"!stkAddress");

        //pull
        IERC20(cvxCrv).safeTransferFrom(treasury,address(this),_amount);

        //stake for treasury
        IRewardStaking(stakedCvxcrv).stakeFor(treasury, IERC20(cvxCrv).balanceOf(address(this)));
    }

    function burn(uint256 _amount) external onlyOperator{
        //pull
        IERC20(cvxCrv).safeTransferFrom(treasury,address(this),_amount);

        //burn
        IRewardStaking(cvxCrvRewards).stakeFor(stakedCvxcrv, IERC20(cvxCrv).balanceOf(address(this)));
    }

    function swapAndStake(uint256 _amount, uint256 _minAmountOut) external onlyOperator{
        require(_minAmountOut > 0, "!min_out");
        require(stakedCvxcrv != address(0),"!stkAddress");

        //pull
        IERC20(crv).safeTransferFrom(treasury,address(this),_amount);

        //swap
        ICvxCrvExchange(exchange).exchange(0,1,_amount,_minAmountOut, address(this));
        //stake for treasury
        IRewardStaking(stakedCvxcrv).stakeFor(treasury, IERC20(cvxCrv).balanceOf(address(this)));
    }

    function swapAndBurn(uint256 _amount, uint256 _minAmountOut) external onlyOperator{
        require(_minAmountOut > 0, "!min_out");
        require(stakedCvxcrv != address(0),"!stkAddress");

        //pull
        IERC20(crv).safeTransferFrom(treasury,address(this),_amount);

        //swap
        ICvxCrvExchange(exchange).exchange(0,1,_amount,_minAmountOut, address(this));
        //burn
        IRewardStaking(cvxCrvRewards).stakeFor(stakedCvxcrv, IERC20(cvxCrv).balanceOf(address(this)));
    }


    function  unstake(uint256 _amount) external onlyOperator{
        require(stakedCvxcrv != address(0),"!stkAddress");

        //pull staked tokens
        IERC20(stakedCvxcrv).safeTransferFrom(treasury,address(this),_amount);
        //unstake
        ICvxCrvStaking(stakedCvxcrv).withdraw(_amount);
        //transfer to treasury
        IERC20(cvxCrv).safeTransfer(treasury, IERC20(cvxCrv).balanceOf(address(this)));
        //get rewards for treasury
        ICvxCrvStaking(stakedCvxcrv).getReward(treasury);
    }

    function  unstakeAndBurn(uint256 _amount) external onlyOperator{
        require(stakedCvxcrv != address(0),"!stkAddress");

        //pull staked tokens
        IERC20(stakedCvxcrv).safeTransferFrom(treasury,address(this),_amount);
        //unstake
        ICvxCrvStaking(stakedCvxcrv).withdraw(_amount);
        //burn
        IRewardStaking(cvxCrvRewards).stakeFor(stakedCvxcrv, IERC20(cvxCrv).balanceOf(address(this)));
        //get rewards for treasury
        ICvxCrvStaking(stakedCvxcrv).getReward(treasury);
    }

    function addToPool(uint256 _crvamount, uint256 _cvxcrvamount, uint256 _minAmountOut) external onlyOperator{
        require(_minAmountOut > 0, "!min_out");

        //pull
        IERC20(crv).safeTransferFrom(treasury,address(this),_crvamount);
        IERC20(cvxCrv).safeTransferFrom(treasury,address(this),_cvxcrvamount);

        //add lp
        uint256[2] memory amounts = [_crvamount,_cvxcrvamount];
        ICvxCrvExchange(exchange).add_liquidity(amounts, _minAmountOut, address(this));

        //add to convex
        IConvexDeposits(booster).deposit(pid, IERC20(exchange).balanceOf(address(this)), true);
    }

    function removeFromPool(uint256 _amount, uint256 _minAmountOut) external onlyOperator{
        require(_minAmountOut > 0, "!min_out");

        //remove from convex
        IRewardStaking(lprewards).withdrawAndUnwrap(_amount, true);

        //remove from LP with treasury as receiver
        ICvxCrvExchange(exchange).remove_liquidity_one_coin(IERC20(exchange).balanceOf(address(this)), 1, _minAmountOut, treasury);

        uint256 bal = IERC20(crv).balanceOf(address(this));
        if(bal > 0){
            //transfer to treasury
            IERC20(crv).safeTransfer(treasury, bal);
        }

        bal = IERC20(cvxCrv).balanceOf(address(this));
        if(bal > 0){
            //transfer to treasury
            IERC20(cvxCrv).safeTransfer(treasury, bal);
        }

        bal = IERC20(cvx).balanceOf(address(this));
        if(bal > 0){
            //transfer to treasury
            IERC20(cvx).safeTransfer(treasury, bal);
        }

    }

}