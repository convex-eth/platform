// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import '@openzeppelin/contracts/utils/Address.sol';

interface IBasicRewards{
    function getReward(address _account, bool _claimExtras) external;
}

interface ICvxRewards{
    function getReward(address _account, bool _claimExtras, bool _stake) external;
}

contract ClaimZap{
    using Address for address;

    address public owner;
    address public cvxRewards;
    address public cvxCrvRewards;

    constructor() public {
        owner = msg.sender;
    }

    function setCvxRewards(address _rewards) external {
        require(msg.sender == owner, "!auth");
        cvxRewards = _rewards;
    }

    function setCvxCrvRewards(address _rewards) external {
        require(msg.sender == owner, "!auth");
        cvxCrvRewards = _rewards;
    }

    function claimRewards(address[] calldata rewardContracts, bool claimCvx, bool claimCvxStake, bool claimcvxCrv) external{
        for(uint256 i = 0; i < rewardContracts.length; i++){
            if(rewardContracts[i] == address(0)) break;
            IBasicRewards(rewardContracts[i]).getReward(msg.sender,true);
        }
        if(claimCvxStake){
            ICvxRewards(cvxRewards).getReward(msg.sender,true,true);
        }else if(claimCvx){
            ICvxRewards(cvxRewards).getReward(msg.sender,true,false);
        }

        if(claimcvxCrv){
            IBasicRewards(cvxCrvRewards).getReward(msg.sender,true);
        }
    }
}