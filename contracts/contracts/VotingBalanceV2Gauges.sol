// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;


import "./interfaces/ILockedCvx.sol";

contract VotingBalanceV2Gauges{

    address public constant oldlocker = address(0xD18140b4B819b895A3dba5442F959fA44994AF50);
    address public constant locker = address(0x72a19342e8F1838460eBFCCEf09F6585e32db86E);
    uint256 public constant rewardsDuration = 86400 * 7;
    uint256 public constant lockDuration = rewardsDuration * 17;

    bool public UseOldLocker = true;
    address public constant owner = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB);

    constructor() public {
    }

    function setUseOldLocker(bool _use) external{
        require(msg.sender == owner, "!auth");

        UseOldLocker = _use;
    }

    function balanceOf(address _account) external view returns(uint256){

        //compute to find previous epoch
        uint256 currentEpoch = block.timestamp / rewardsDuration * rewardsDuration;
        uint256 epochindex = ILockedCvx(locker).epochCount() - 1;

        //there may or may not have been a checkpoint in the new epoch
        //thus get date of latest epoch and compare to block.timestamp
        //if epoch.date >= current epoch then there was a checkpoint and need to move index back to get prev
        (, uint32 _date) = ILockedCvx(locker).epochs(epochindex);
        if(_date >= currentEpoch){
            //if end date is already the current epoch,  minus 1 to get the previous
            epochindex--;
        }

        //check again because new locker has an extra epoch for the following week
        // note: the epochindex-- above can not be -= 2 because there may have been 0 locks for a given week
        //       thus best to check one at a time
        // length -1 = next
        // length -2 = current
        // length -3 = previous
        (, _date) = ILockedCvx(locker).epochs(epochindex);
        if(_date >= currentEpoch){
            //if end date is already the current epoch,  minus 1 to get the previous
            epochindex--;
        }

        //get balances of previous epoch
        uint256 balanceAtPrev = ILockedCvx(locker).balanceAtEpochOf(epochindex, _account);

        //get pending
        uint256 pending = ILockedCvx(locker).pendingLockAtEpochOf(epochindex, _account);

        //if using old locker for grace period
        if(UseOldLocker){
            //check if tokens have not been withdrawn yet
            if(ILockedCvx(oldlocker).lockedBalanceOf(_account) > 0){
                uint256 eindex = ILockedCvx(oldlocker).epochCount() - 1;
                (, uint32 _edate) = ILockedCvx(oldlocker).epochs(eindex);
                if(_edate >= currentEpoch){
                    //if end date is already the current epoch,  minus 1 to get the previous
                    eindex--;
                }
                //add to current balance
                pending += ILockedCvx(oldlocker).balanceAtEpochOf(eindex, _account);
            }
        }

        return balanceAtPrev + pending;
    }

    function totalSupply() view external returns(uint256){
        return ILockedCvx(locker).totalSupply();
    }
}