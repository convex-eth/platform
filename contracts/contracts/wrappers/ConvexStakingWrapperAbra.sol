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

    address[] public cauldrons;

    constructor() public{}

    function initialize(address _curveToken, address _convexToken, address _convexPool, uint256 _poolId, address _vault)
    override external {
        require(!isInit,"already init");
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
        _tokenname = string(abi.encodePacked("Staked ", ERC20(_convexToken).name(), " Abra" ));
        _tokensymbol = string(abi.encodePacked("stk", ERC20(_convexToken).symbol(), "-abra"));
        isShutdown = false;
        isInit = true;
        curveToken = _curveToken;
        convexToken = _convexToken;
        convexPool = _convexPool;
        convexPoolId = _poolId;
        collateralVault = address(0xF5BCE5077908a1b7370B9ae04AdC565EBd643966);
    
        if(_vault != address(0)){
            cauldrons.push(_vault);
        }

        //add rewards
        addRewards();
        setApprovals();
    }

    function cauldronsLength() external view returns (uint256) {
        return cauldrons.length;
    }

    function setCauldron(address _cauldron) external onlyOwner{
        //allow settings and changing cauldrons that receive staking rewards.
        require(_cauldron != address(0), "invalid cauldron");

        //do not allow doubles
        for(uint256 i = 0; i < cauldrons.length; i++){
            require(cauldrons[i] != _cauldron, "already added");
        }

        //IMPORTANT: when adding a cauldron,
        // it should be added to this list BEFORE anyone starts using it
        // or else a user may receive more than what they should
        cauldrons.push(_cauldron);
    }

    function _getDepositedBalance(address _account) internal override view returns(uint256) {
        if (_account == address(0) || _account == collateralVault) {
            return 0;
        }

        if(cauldrons.length == 0){
            return balanceOf(_account);
        }
        
        //add up all shares of all cauldrons
        uint256 share;
        for(uint256 i = 0; i < cauldrons.length; i++){
            try ICauldron(cauldrons[i]).userCollateralShare(_account) returns(uint256 _share){
                share = share.add(_share);
            }catch{}
        }

        //convert shares to balance amount via bento box
        uint256 collateral = IBentoBox(collateralVault).toAmount(address(this), share, false);
        
        //add to balance of this token
        return balanceOf(_account).add(collateral);
    }
}