// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../interfaces/IRewardStaking.sol";
import "../interfaces/IConvexDeposits.sol";
import "../interfaces/CvxMining.sol";
import "../interfaces/IRariToken.sol";
import "./CvxCrvStakingWrapper.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


//Tokenized cvxCrv staked position for Rari's Fuse platform
//Based on Curve.fi's gauge wrapper implementations at https://github.com/curvefi/curve-dao-contracts/tree/master/contracts/gauges/wrappers
contract CvxCrvRari is CvxCrvStakingWrapper {
    using SafeERC20
    for IERC20;
    using Address
    for address;
    using SafeMath
    for uint256;

    //NOTE: the collateralVault (rari's ftoken) MUST be modified to call checkpoint([from,to]) when doing transfers

    //TODO: check with Rari team if this is the proper way to handle everything.

    constructor(address _vault)
    public CvxCrvStakingWrapper(_vault," Rari", "-rari"){}

    
    function _getDepositedBalance(address _account) internal override view returns(uint256) {

        //get underlying balance
        uint256 underlying = IRariToken(collateralVault).balanceOfUnderlying(_account);

        //add to balance of this token
        return balanceOf(_account).add(underlying);
    }

    function _getTotalSupply() internal override view returns(uint256){

        //get difference of underlying balance of the rari token and the supply of the rari token
        //to get outstanding interest
        uint256 cash = IRariToken(collateralVault).getCash();
        uint256 borrows = IRariToken(collateralVault).totalBorrows();
        uint256 reserves = IRariToken(collateralVault).totalReserves();
        uint256 fsupply = IRariToken(collateralVault).totalSupply();
        uint256 outstanding = cash.add(borrows).sub(reserves).sub(fsupply);

        //add the outstanding interest to this token's supply
        return totalSupply().add(outstanding);
    }

}