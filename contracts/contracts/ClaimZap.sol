// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import '@openzeppelin/contracts/utils/Address.sol';

interface IBasicRewards{
    function getReward(address _account, bool _claimExtras) external;
}

interface ICvxRewards{
    function getReward(address _account, bool _claimExtras, bool _stake) external;
}

interface IChefRewards{
    function claim(uint256 _pid, address _account) external;
}

contract ClaimZap{
    using Address for address;

    address public owner;
    address public cvxRewards;
    address public cvxCrvRewards;
    address public chefRewards;

    constructor(address _cvxRewards, address _cvxCrvRewards, address _chefRewards) public {
        owner = msg.sender;
        cvxRewards = _cvxRewards;
        cvxCrvRewards = _cvxCrvRewards;
        chefRewards = _chefRewards;
    }

    function setCvxRewards(address _rewards) external {
        require(msg.sender == owner, "!auth");
        cvxRewards = _rewards;
    }

    function setCvxCrvRewards(address _rewards) external {
        require(msg.sender == owner, "!auth");
        cvxCrvRewards = _rewards;
    }

    function setChefRewards(address _rewards) external {
        require(msg.sender == owner, "!auth");
        chefRewards = _rewards;
    }

    function claimRewards(address[] calldata rewardContracts, uint256[] calldata chefIds, bool claimCvx, bool claimCvxStake, bool claimcvxCrv) external{
        for(uint256 i = 0; i < rewardContracts.length; i++){
            if(rewardContracts[i] == address(0)) break;
            IBasicRewards(rewardContracts[i]).getReward(msg.sender,true);
        }
        for(uint256 i = 0; i < chefIds.length; i++){
            IChefRewards(chefRewards).claim(chefIds[i],msg.sender);
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