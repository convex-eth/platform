// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./interfaces/ICvxMining.sol";
import "./interfaces/IStakingWrapper.sol";
import "./interfaces/IRewardHookExtended.sol";
import "./interfaces/IExtraRewardPool.sol";
import "./interfaces/IRewardStaking.sol";
import "./interfaces/ICvxCrvStaking.sol";


contract DebugRegistry{


    constructor() public{
    }

    function token() external view returns(address){
        return address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    }
}
