// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

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
}

interface ICurveGaugeDebug {
    function claim_rewards(address) external;
    function claimable_tokens(address) external view returns (uint256);    
    function claimable_reward(address,address) external view returns (uint256);   
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