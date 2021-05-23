// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "./ExtraRewardStashV1.sol";
import "./ExtraRewardStashV2.sol";
import "./ExtraRewardStashV3.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


contract StashFactory {
    using Address for address;

    bytes4 private constant rewarded_token = 0x16fa50b1; //rewarded_token()
    bytes4 private constant reward_tokens = 0x54c49fe9; //reward_tokens(uint256)
    bytes4 private constant rewards_receiver = 0x01ddabf1; //rewards_receiver(address)

    address public operator;
    address public rewardFactory;

    constructor(address _operator, address _rewardFactory) public {
        operator = _operator;
        rewardFactory = _rewardFactory;
    }

    //Create a stash contract for the given gauge.
    //function calls are different depending on the version of curve gauges so determine which stash type is needed
    function CreateStash(uint256 _pid, address _gauge, address _staker, uint256 _stashVersion) external returns(address){
        require(msg.sender == operator, "!authorized");

        if(_stashVersion == uint256(3) && IsV3(_gauge)){
            //v3
            ExtraRewardStashV3 stash = new ExtraRewardStashV3(_pid,operator,_staker,_gauge,rewardFactory);
            return address(stash);
        }else if(_stashVersion == uint256(1) && IsV1(_gauge)){
            //v1
            ExtraRewardStashV1 stash = new ExtraRewardStashV1(_pid,operator,_staker,_gauge,rewardFactory);
            return address(stash);
        }else if(_stashVersion == uint256(2) && !IsV3(_gauge) && IsV2(_gauge)){
            //v2
            ExtraRewardStashV2 stash = new ExtraRewardStashV2(_pid,operator,_staker,_gauge,rewardFactory);
            return address(stash);
        }
        bool isV1 = IsV1(_gauge);
        bool isV2 = IsV2(_gauge);
        bool isV3 = IsV3(_gauge);
        require(!isV1 && !isV2 && !isV3,"stash version mismatch");
        return address(0);
    }

    function IsV1(address _gauge) private returns(bool){
        bytes memory data = abi.encode(rewarded_token);
        (bool success,) = _gauge.call(data);
        return success;
    }

    function IsV2(address _gauge) private returns(bool){
        bytes memory data = abi.encodeWithSelector(reward_tokens,uint256(0));
        (bool success,) = _gauge.call(data);
        return success;
    }

    function IsV3(address _gauge) private returns(bool){
        bytes memory data = abi.encodeWithSelector(rewards_receiver,address(0));
        (bool success,) = _gauge.call(data);
        return success;
    }
}
