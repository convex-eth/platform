// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;


import "./interfaces/ILockedCvx.sol";
import "./interfaces/IVotingEligibility.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';

contract VotingBalanceMax{
    using SafeMath for uint256;

    address public constant locker = address(0xD18140b4B819b895A3dba5442F959fA44994AF50);
    address public immutable eligiblelist;
    uint256 public constant rewardsDuration = 86400 * 7;
    uint256 public constant lockDuration = rewardsDuration * 17;

    constructor(address _eligiblelist) public {
        eligiblelist = _eligiblelist;
    }

    function balanceOf(address _account) external view returns(uint256){

        //check eligibility list
        if(!IVotingEligibility(eligiblelist).isEligible(_account)){
            return 0;
        }

        //compute to find previous epoch
        uint256 currentEpoch = block.timestamp.div(rewardsDuration).mul(rewardsDuration);
        uint256 epochindex = ILockedCvx(locker).epochCount() - 1;
        (, uint32 _enddate) = ILockedCvx(locker).epochs(epochindex);
        if(_enddate >= currentEpoch){
            //if end date is already the current epoch,  minus 1 to get the previous
            epochindex -= 1;
        }
        //get balances of current and previous
        uint256 balanceAtPrev = ILockedCvx(locker).balanceAtEpochOf(epochindex, _account);
        uint256 currentBalance = ILockedCvx(locker).balanceOf(_account);

        //return greater balance
        return max(balanceAtPrev, currentBalance);
    }

    function pendingBalanceOf(address _account) external view returns(uint256){

        //check eligibility list
        if(!IVotingEligibility(eligiblelist).isEligible(_account)){
            return 0;
        }

        //determine when current epoch would end
        uint256 currentEpochUnlock = block.timestamp.div(rewardsDuration).mul(rewardsDuration).add(lockDuration);

        //grab account lock list
        (,,,ILockedCvx.LockedBalance[] memory balances) = ILockedCvx(locker).lockedBalances(_account);
        
        //if most recent lock is current epoch, then lock amount is pending balance
        uint256 pending;
        if(balances[balances.length-1].unlockTime == currentEpochUnlock){
            pending = balances[balances.length-1].boosted;
        }

        return pending;
    }

    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }

    function totalSupply() view external returns(uint256){
        return ILockedCvx(locker).totalSupply();
    }
}