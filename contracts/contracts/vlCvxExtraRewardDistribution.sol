// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./interfaces/ILockedCvx.sol";
import "./interfaces/BoringMath.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


//Distribution various rewards to locked cvx holders
contract vlCvxExtraRewardDistribution {
    using SafeERC20
    for IERC20;
    using BoringMath
    for uint256;

    ILockedCvx public constant cvxlocker = ILockedCvx(0xD18140b4B819b895A3dba5442F959fA44994AF50);
    uint256 public constant rewardsDuration = 86400 * 7;

    mapping(address => mapping(uint256 => uint256)) public rewardData; // token -> epoch -> amount
    mapping(address => uint256[]) public rewardEpochs; // token -> epochList
    mapping(address => mapping(address => uint256)) public userClaims; //token -> account -> last claimed epoch index

    constructor() public {}


    function rewardEpochsCount(address _token) external view returns(uint256) {
        return rewardEpochs[_token].length;
    }

    //add a reward to a specific epoch
    function addRewardToEpoch(address _token, uint256 _amount, uint256 _epoch) external {
        //checkpoint locker
        cvxlocker.checkpointEpoch();


        //if adding a reward to a specific epoch, make sure it's
        //a.) an epoch older than the current (in which case use addReward)
        //b.) more recent than the previous reward
        //this means addRewardToEpoch can only be called *once* for a specific reward for a specific epoch
        //because they will be claimable immediately and amount shouldnt change after claiming begins
        //
        //conversely rewards can be piled up with addReward() because claiming is only available to completed epochs
        require(_epoch < cvxlocker.epochCount() - 1, "!prev epoch");
        uint256 l = rewardEpochs[_token].length;
        require(l == 0 || rewardEpochs[_token][l - 1] < _epoch, "old epoch");

        _addReward(_token, _amount, _epoch);
    }

    //add a reward to the current epoch. can be called multiple times for the same reward token
    function addReward(address _token, uint256 _amount) external {
        //checkpoint locker
        cvxlocker.checkpointEpoch();

        //current epoch
        uint256 currentEpoch = cvxlocker.epochCount() - 1;

        _addReward(_token, _amount, currentEpoch);
    }

    function _addReward(address _token, uint256 _amount, uint256 _epoch) internal {
        //convert to reward per token
        uint256 supply = cvxlocker.totalSupplyAtEpoch(_epoch);
        uint256 rPerT = _amount.mul(1e20).div(supply);
        rewardData[_token][_epoch] = rewardData[_token][_epoch].add(rPerT);

        //add epoch to list
        uint256 l = rewardEpochs[_token].length;
        if (l == 0 || rewardEpochs[_token][l - 1] < _epoch) {
            rewardEpochs[_token].push(_epoch);
        }

        //pull
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
    }

    //get claimable rewards for a specific token
    function claimableRewards(address _account, address _token) external view returns(uint256) {
        return _allClaimableRewards(_account, _token);
    }

    //get claimable rewards for a token at a specific epoch
    function claimableRewardsAtEpoch(address _account, address _token, uint256 _epoch) external view returns(uint256) {
        return _claimableRewards(_account, _token, _epoch);
    }

    //get all claimable rewards
    function _allClaimableRewards(address _account, address _token) internal view returns(uint256) {
        uint256 epochIndex = userClaims[_token][_account];
        uint256 currentEpoch = cvxlocker.epochCount() - 1;
        uint256 claimableTokens = 0;
        for (uint256 i = epochIndex; i < rewardEpochs[_token].length; i++) {
            if (rewardEpochs[_token][i] < currentEpoch) {
                claimableTokens = claimableTokens.add(_claimableRewards(_account, _token, rewardEpochs[_token][i]));
            }
        }
        return claimableTokens;
    }

    //get claimable rewards for a token at a specific epoch
    function _claimableRewards(address _account, address _token, uint256 _epoch) internal view returns(uint256) {
        //get balance and calc share
        uint256 balance = cvxlocker.balanceAtEpochOf(_epoch, _account);
        return balance.mul(rewardData[_token][_epoch]).div(1e20);
    }

    //get rewards for a specific token at a specific epoch
    function getReward(address _account, address _token) external {
        //get claimable tokens
        uint256 claimableTokens = _allClaimableRewards(_account, _token);

        if (claimableTokens > 0) {
            //set claim checkpoint. next claim starts from claimed index+1 so set as length
            userClaims[_token][_account] = rewardEpochs[_token].length;

            //send
            IERC20(_token).safeTransfer(_account, claimableTokens);
        }
    }


    //Because claims cycle through all periods that a specific reward was given
    //there becomes a situation where, for example, a new user could lock
    //2 years from now and try to claim a token that was given out every week prior.
    //This would result in a 2mil gas checkpoint.(about 20k gas * 52 weeks * 2 years)
    //
    //allow a user to set their claimed index forward without claiming rewards
    function forfeitRewards(address _token, uint256 _index) external {
        require(_index > 0 && _index < rewardEpochs[_token].length-1, "!past");
        require(_index >= userClaims[_token][msg.sender], "already claimed");

        //set claim checkpoint. next claim starts from index+1
        userClaims[_token][msg.sender] = _index + 1;
    }

}