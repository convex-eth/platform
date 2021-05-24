// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/math/SafeMath.sol';

interface IExchange {
    function swapExactTokensForTokens(
        uint256,
        uint256,
        address[] calldata,
        address,
        uint256
    ) external;
}

interface I3CurveFi {
    function get_virtual_price() external view returns (uint256);


    function add_liquidity(
        // sBTC pool
        uint256[3] calldata amounts,
        uint256 min_mint_amount
    ) external;
    
}

interface I2CurveFi {
    function get_virtual_price() external view returns (uint256);

    function add_liquidity(
        // eurs pool
        uint256[2] calldata amounts,
        uint256 min_mint_amount
    ) external;
    
    function claimable_tokens(address) external view returns (uint256);    
    function claimable_rewards(address,address) external view returns (uint256);    
}

interface ISPool {
    function get_virtual_price() external view returns (uint256);

    function add_liquidity(
        // susd pool
        uint256[4] calldata amounts,
        uint256 min_mint_amount
    ) external;
    
    function claimable_tokens(address) external view returns (uint256);    
    function claimable_reward(address) external view returns (uint256);
    function claim_rewards(address) external;
}

interface ICurveGaugeDebug {
    function claim_rewards(address) external;
    function claimable_tokens(address) external view returns (uint256);    
    function claimable_reward(address,address) external view returns (uint256);   
    function rewards_receiver(address) external view returns(address);
}

interface IWalletCheckerDebug{
    function approveWallet(address) external;
    function check(address) external view returns (bool);
}

interface IVoteStarter{
    function newVote(bytes calldata, string calldata, bool, bool) external returns (uint256);
    function votesLength() external view returns (uint256);
}

interface IBurner{
    function withdraw_admin_fees(address) external;
    function burn(address) external;
    function execute() external;
}

interface IEscro{
    function locked__end(address) external view returns(uint256);
}

interface IGaugeController{
    function vote_user_slopes(address,address) external view returns(uint256,uint256,uint256);//slope,power,end
}

interface ISnxRewards{
    function notifyRewardAmount(uint256) external;
}

interface IUniswapV2Router01 {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);

    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
      external
      payable
      returns (uint[] memory amounts);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}


interface Multicaller{
    struct Call {
        address target;
        bytes callData;
    }

    function aggregate(Call[] memory calls) external returns (uint256 blockNumber, bytes[] memory returnData);
}



interface MulticallerView{
    struct Call {
        address target;
        bytes callData;
    }
    function aggregate(Call[] memory calls) external view returns (uint256 blockNumber, bytes[] memory returnData);
}