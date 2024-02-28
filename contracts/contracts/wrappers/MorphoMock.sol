// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/IMorpho.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';


contract MorphoMock{
    using SafeERC20
    for IERC20;
    using SafeMath
    for uint256;

    mapping(bytes32 => mapping(address => IMorpho.Position)) public position;
    mapping(bytes32 => IMorpho.MarketParams) public market;
    uint256 internal constant MARKET_PARAMS_BYTES_LENGTH = 5 * 32;
    address immutable public owner;

    constructor() public{
        owner = msg.sender;
    }

    function id(IMorpho.MarketParams memory /*marketParams*/) public pure returns (bytes32 marketParamsId) {
        marketParamsId = "test";
    }

    function addMarket(IMorpho.MarketParams memory marketParams) external{
        market[id(marketParams)] = marketParams;
    }

    function supplyCollateral(IMorpho.MarketParams memory marketParams, uint256 assets, address onBehalf, bytes memory /*data*/) external{
        //change local state first
        position[id(marketParams)][onBehalf].collateral += uint128(assets);

        //transfer last
        IERC20(marketParams.collateralToken).safeTransferFrom(msg.sender, address(this), assets);
    }

    function withdrawCollateral(IMorpho.MarketParams memory marketParams, uint256 assets, address receiver) external{
        bytes32 marketid = id(marketParams);

        //change local state first
        position[marketid][msg.sender].collateral -= uint128(assets);

        //transfer last
        IERC20(marketParams.collateralToken).safeTransfer(receiver, assets);
    }

    function liquidate(
        IMorpho.MarketParams memory marketParams,
        address borrower,
        uint256 reduceCollateral
    ) external{
        bytes32 marketid = id(marketParams);
        
        //change local state first
        position[marketid][borrower].collateral -= uint128(reduceCollateral);

        //send to liquidator
        IERC20(marketParams.collateralToken).safeTransfer(msg.sender, reduceCollateral);
    }


    function idToMarketParams(bytes32 _id) external view returns(IMorpho.MarketParams memory mp){
        return market[_id];
    }
}