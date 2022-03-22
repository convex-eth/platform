// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./interfaces/IRewardStaking.sol";
import "./interfaces/ILockedCvx.sol";
import "./interfaces/IDelegation.sol";
import "./interfaces/ICrvDepositor.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


//Basic functionality to integrate with locking cvx
contract BasicCvxHolder{
    using SafeERC20 for IERC20;
    using Address for address;


    address public constant cvxCrv = address(0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7);
    address public constant cvxcrvStaking = address(0x3Fe65692bfCD0e6CF84cB1E7d24108E434A7587e);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant crvDeposit = address(0x8014595F2AB54cD7c604B00E9fb932176fDc86Ae);

    address public operator;
    ILockedCvx public immutable cvxlocker;

    constructor(address _cvxlocker) public {
        cvxlocker = ILockedCvx(_cvxlocker);
        operator = msg.sender;
    }

    function setApprovals() external {
        IERC20(cvxCrv).safeApprove(cvxcrvStaking, 0);
        IERC20(cvxCrv).safeApprove(cvxcrvStaking, uint256(-1));

        IERC20(cvx).safeApprove(address(cvxlocker), 0);
        IERC20(cvx).safeApprove(address(cvxlocker), uint256(-1));

        IERC20(crv).safeApprove(crvDeposit, 0);
        IERC20(crv).safeApprove(crvDeposit, uint256(-1));
    }

    function setOperator(address _op) external {
        require(msg.sender == operator, "!auth");
        operator = _op;
    }

    function setDelegate(address _delegateContract, address _delegate) external{
        require(msg.sender == operator, "!auth");
        // IDelegation(_delegateContract).setDelegate(keccak256("cvx.eth"), _delegate);
        IDelegation(_delegateContract).setDelegate("cvx.eth", _delegate);
    }

    function lock(uint256 _amount, uint256 _spendRatio) external{
        require(msg.sender == operator, "!auth");

        if(_amount > 0){
            IERC20(cvx).safeTransferFrom(msg.sender, address(this), _amount);
        }
        _amount = IERC20(cvx).balanceOf(address(this));

        cvxlocker.lock(address(this),_amount,_spendRatio);
    }

    function processExpiredLocks(bool _relock) external{
        require(msg.sender == operator, "!auth");

        cvxlocker.processExpiredLocks(_relock);
    }

    function processRewards() external{
        require(msg.sender == operator, "!auth");

        cvxlocker.getReward(address(this), true);
        IRewardStaking(cvxcrvStaking).getReward(address(this), true);

        uint256 crvBal = IERC20(crv).balanceOf(address(this));
        if (crvBal > 0) {
            ICrvDepositor(crvDeposit).deposit(crvBal, true);
        }

        uint cvxcrvBal = IERC20(cvxCrv).balanceOf(address(this));
        if(cvxcrvBal > 0){
            IRewardStaking(cvxcrvStaking).stake(cvxcrvBal);
        }
    }

    function withdrawCvxCrv(uint256 _amount, address _withdrawTo) external{
        require(msg.sender == operator, "!auth");
        require(_withdrawTo != address(0),"bad address");

        IRewardStaking(cvxcrvStaking).withdraw(_amount, true);
        uint cvxcrvBal = IERC20(cvxCrv).balanceOf(address(this));
        if(cvxcrvBal > 0){
            IERC20(cvxCrv).safeTransfer(_withdrawTo, cvxcrvBal);
        }
    }
    
    function withdrawTo(IERC20 _asset, uint256 _amount, address _to) external {
    	require(msg.sender == operator, "!auth");

        _asset.safeTransfer(_to, _amount);
    }

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool, bytes memory) {
        require(msg.sender == operator,"!auth");

        (bool success, bytes memory result) = _to.call{value:_value}(_data);

        return (success, result);
    }

}