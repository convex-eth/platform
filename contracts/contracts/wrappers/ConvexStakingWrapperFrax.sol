// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./ConvexStakingWrapper.sol";

interface IFraxFarm {
    function lockedLiquidityOf(address account) external view returns (uint256 amount);
}

//Staking wrapper for Frax Finance platform
//use convex LP positions as collateral while still receiving rewards
contract ConvexStakingWrapperFrax is ConvexStakingWrapper {
    using SafeERC20
    for IERC20;
    using Address
    for address;
    using SafeMath
    for uint256;

    constructor() public{}

    function initialize(address _curveToken, address _convexToken, address _convexPool, uint256 _poolId, address _vault)
    override external {
        require(!isInit,"already init");
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
        _tokenname = string(abi.encodePacked("Staked ", ERC20(_convexToken).name(), " Frax" ));
        _tokensymbol = string(abi.encodePacked("stk", ERC20(_convexToken).symbol(), "-frax"));
        isShutdown = false;
        isInit = true;
        curveToken = _curveToken;
        convexToken = _convexToken;
        convexPool = _convexPool;
        convexPoolId = _poolId;

        //set vault later
        // collateralVault = _vault;


        //add rewards
        addRewards();
        setApprovals();
    }

    function setVault(address _vault) external onlyOwner{
        require(collateralVault != address(0), "already set");

        collateralVault = _vault;
    }

    function _getDepositedBalance(address _account) internal override view returns(uint256) {
        if (_account == address(0) || _account == collateralVault) {
            return 0;
        }

        uint256 collateral;
        if(collateralVault != address(0)){
           collateral = IFraxFarm(collateralVault).lockedLiquidityOf(address(this));
        }
    }
}