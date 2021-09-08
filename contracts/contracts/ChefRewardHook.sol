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

    bool public isInit;

    constructor(address _distributor, uint256 _pid) public {
        distributor = _distributor;
        pid = _pid;
    }

    function init(IERC20 dummyToken) external {
        require(!isInit,"already init");
        isInit = true;
        uint256 balance = dummyToken.balanceOf(msg.sender);
        require(balance != 0, "Balance must exceed 0");
        dummyToken.safeTransferFrom(msg.sender, address(this), balance);
        dummyToken.approve(chef, balance);
        IChef(chef).deposit(pid, balance);
    }
    
    function onRewardClaim() override external{
        require(msg.sender == distributor,"!auth");

        IChef(chef).claim(pid,address(this));

        uint256 bal = rewardToken.balanceOf(address(this));
        if(bal > 0){
            rewardToken.safeTransfer(distributor,bal);
        }
    }

}