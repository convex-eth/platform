// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/ICauldron.sol";
import "../interfaces/IBentoBox.sol";
import "./ConvexStakingWrapper.sol";

//Staking wrapper for Abracadabra platform
//use convex LP positions as collateral while still receiving rewards
contract ConvexStakingWrapperAbra is ConvexStakingWrapper {
    using SafeERC20
    for IERC20;
    using Address
    for address;
    using SafeMath
    for uint256;

    address public cauldron;

    constructor() public{}

    function initialize(address _curveToken, address _convexToken, address _convexPool, uint256 _poolId, address _vault)
    override external {
        require(!isInit,"already init");
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        _tokenname = string(abi.encodePacked("Staked ", ERC20(_convexToken).name(), " Abra" ));
        _tokensymbol = string(abi.encodePacked("stk", ERC20(_convexToken).symbol(), "-abra"));
        isShutdown = false;
        isInit = true;
        curveToken = _curveToken;
        convexToken = _convexToken;
        convexPool = _convexPool;
        convexPoolId = _poolId;
        cauldron = _vault;
        collateralVault = address(0xF5BCE5077908a1b7370B9ae04AdC565EBd643966);
    }

    function setCauldron(address _cauldron) external onlyOwner{
        require(cauldron == address(0),"!0");
        cauldron = _cauldron;
    }

    function _getDepositedBalance(address _account) internal override view returns(uint256) {
        if (_account == address(0) || _account == collateralVault) {
            return 0;
        }
        
        //get collateral balance
        uint256 collateral = ICauldron(cauldron).userCollateralShare(_account);
        collateral = IBentoBox(collateralVault).toAmount(address(this), collateral, false);

        //add to balance of this token
        return balanceOf(_account).add(collateral);
    }
}