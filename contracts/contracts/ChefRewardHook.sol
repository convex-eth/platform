// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./interfaces/IRewardHook.sol";
import "./interfaces/IChef.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


//Receive rewards from chef for distribution to a pool
contract ChefRewardHook is IRewardHook{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public constant rewardToken = IERC20(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    
    address public constant chef = address(0x5F465e9fcfFc217c5849906216581a657cd60605);
    address public immutable distributor;
    uint256 public immutable pid;
    IERC20 public immutable cheftoken;

    //address to call for other reward pulls
    address public rewardHook;
    address public owner = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB);

    constructor(address _distributor, uint256 _pid, IERC20 _token) public {
        distributor = _distributor;
        pid = _pid;
        cheftoken = _token;
    }

    function deposit() external{
        uint256 balance = cheftoken.balanceOf(msg.sender);
        require(balance != 0, "Balance must exceed 0");
        cheftoken.safeTransferFrom(msg.sender, address(this), balance);
        cheftoken.approve(chef, balance);
        IChef(chef).deposit(pid, balance);
    }

    function setRewardHook(address _hook) external{
        require(msg.sender == owner, "!auth");

        rewardHook = _hook;
    }
    
    function onRewardClaim() override external{
        require(msg.sender == distributor,"!auth");

        IChef(chef).claim(pid,address(this));

        uint256 bal = rewardToken.balanceOf(address(this));
        if(bal > 0){
            rewardToken.safeTransfer(distributor,bal);
        }

        if(rewardHook != address(0)){
            try IRewardHook(rewardHook).onRewardClaim(){
            }catch{}
        }
    }

}