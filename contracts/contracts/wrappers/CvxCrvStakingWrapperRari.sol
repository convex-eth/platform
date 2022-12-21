// // SPDX-License-Identifier: MIT
// pragma solidity 0.6.12;
// pragma experimental ABIEncoderV2;

// import "../interfaces/IRewardStaking.sol";
// import "../interfaces/IConvexDeposits.sol";
// import "../interfaces/CvxMining.sol";
// import "../interfaces/IRariToken.sol";
// import "./CvxCrvStakingWrapper.sol";
// import '@openzeppelin/contracts/math/SafeMath.sol';
// import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
// import '@openzeppelin/contracts/utils/Address.sol';
// import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
// import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
// import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";


// //Tokenized cvxCrv staked position for Rari's Fuse platform
// //Based on Curve.fi's gauge wrapper implementations at https://github.com/curvefi/curve-dao-contracts/tree/master/contracts/gauges/wrappers
// contract CvxCrvRari is CvxCrvStakingWrapper {
//     using SafeERC20
//     for IERC20;
//     using Address
//     for address;
//     using SafeMath
//     for uint256;

//     constructor() public{}

//     function initialize(address _vault)
//     override external {
//         require(!isInit,"already init");
//         owner = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB); //default to convex multisig
//         emit OwnershipTransferred(address(0), owner);

//         _tokenname = "Staked CvxCrv Rari";
//         _tokensymbol = "stkCvxCrv-rari";
//         isShutdown = false;
//         isInit = true;
//         collateralVault = _vault;

//         //add rewards
//         addRewards();
//         setApprovals();
//     }

//     function setVault(address _vault) external onlyOwner{
//         require(collateralVault == address(0),"!0"); //immutable once set
//         collateralVault = _vault;
//     }

    
//     function _getDepositedBalance(address _account) internal override view returns(uint256) {
//         if (_account == address(0) || _account == collateralVault) {
//             return 0;
//         }

//         if(collateralVault == address(0)){
//             return balanceOf(_account);
//         }
        
//         //get underlying balance
//         uint256 underlying = IRariToken(collateralVault).balanceOfUnderlying(_account);

//         //add to balance of this token
//         return balanceOf(_account).add(underlying);
//     }

//     function _getTotalSupply() internal override view returns(uint256){
//         uint256 tSupply = totalSupply();


//         //MEMO: if ONLY used as collateral, total supply doesnt have to take into account borrowing
//         //get outstanding supply by exchangeRate*supply - cash
//         // uint256 exchange = IRariToken(collateralVault).exchangeRateCurrent();
//         // uint256 fsupply = IRariToken(collateralVault).totalSupply();
//         // uint256 cash = IRariToken(collateralVault).getCash()();
//         // uint256 outstanding = exchange.mul(fsupply).sub(cash);
//         // //add the outstanding supply to this token's supply
//         // tSupply = tSupply.add(outstanding);

        
//         return tSupply;
//     }

// }