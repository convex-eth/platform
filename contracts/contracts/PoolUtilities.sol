// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./interfaces/ICvxMining.sol";
import "./interfaces/IStakingWrapper.sol";
import "./interfaces/IRewardHookExtended.sol";
import "./interfaces/IExtraRewardPool.sol";
import "./interfaces/IRewardStaking.sol";
import "./interfaces/IBooster.sol";
import "./interfaces/ITokenWrapper.sol";

/*
This is a utility library which is mainly used for off chain calculations
*/
contract PoolUtilities{

    address public constant booster = address(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public constant cvxMining = address(0x3c75BFe6FbfDa3A94E7E7E8c2216AFc684dE5343);


    constructor() public{
    }


    //get apr with given rates and prices
    function apr(uint256 _rate, uint256 _priceOfReward, uint256 _priceOfDeposit) external view returns(uint256 _apr){
        return _rate * 365 days * _priceOfReward / _priceOfDeposit; 
    }

    //get reward rates for each token based on weighted reward group supply and wrapper's boosted cvxcrv rates
    //%return = rate * timeFrame * price of reward / price of LP / 1e18
    function rewardRates(uint256 _pid) external view returns (address[] memory tokens, uint256[] memory rates) {
        (, , , address _crvRewards, , ) = IBooster(booster).poolInfo(_pid);


        //get staked supply
        uint256 stakedSupply = IRewardStaking(_crvRewards).totalSupply();

        //get reward count
        uint256 extraCount = IRewardStaking(_crvRewards).extraRewardsLength();

        //add 2 for crv/cvx
        tokens = new address[](extraCount + 2);
        rates = new uint256[](extraCount + 2);

        //first get crv
        uint256 crvrate;
        if(block.timestamp <= IRewardStaking(_crvRewards).periodFinish()){
            crvrate = IRewardStaking(_crvRewards).rewardRate();
        }
        if(stakedSupply > 0){
            crvrate = crvrate * 1e18 / stakedSupply;
        }
        tokens[0] = crv;
        rates[0] = crvrate;
        tokens[1] = cvx;
        rates[1] = ICvxMining(cvxMining).ConvertCrvToCvx(crvrate);

        //loop through all reward contracts
        for (uint256 i = 0; i < extraCount; i++) {
            address extraPool = IRewardStaking(_crvRewards).extraRewards(i);
            uint256 rate;

            if(block.timestamp <= IRewardStaking(extraPool).periodFinish()){
                rate = IRewardStaking(extraPool).rewardRate();
            }

            //rate per 1 staked lp
            if(stakedSupply > 0){
                rate = rate * 1e18 / stakedSupply;
            }

            tokens[i+2] = IRewardStaking(extraPool).rewardToken();
            if(_pid >= 151){
                //151 and beyond must get token() from the wrapped reward
                tokens[i+2] = ITokenWrapper(tokens[i+2]).token();
            }

            rates[i+2] = rate;
        }
    }
}
