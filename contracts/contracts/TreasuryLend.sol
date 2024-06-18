// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./interfaces/IRewardStaking.sol";
import "./interfaces/IERC4626.sol";
import "./interfaces/IConvexDeposits.sol";
import "./interfaces/IBooster.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';




contract TreasuryLend{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public constant crvusd = address(0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E);
    address public constant treasury = address(0x1389388d01708118b497f59521f6943Be2541bb7);
    address public constant booster = address(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);

    mapping(uint256 => address) public pidVault;//pid to vault

    address public immutable owner;
    mapping(address => bool) public operators;

    event OperatorSet(address indexed _op, bool _active);
    event Swap(uint256 _amountIn, uint256 _amountOut);
    event Convert(uint256 _amount);
    event Burn(uint256 _amount);
    event Stake(uint256 _amount);
    event Unstake(uint256 _amount);
    event AddedToLP(uint256 _lpamount);
    event RemovedFromLp(uint256 _lpamount);
    event ClaimedReward(address indexed _token, uint256 _amount);

    constructor() public {
        owner = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB);
        operators[msg.sender] = true;
    }


    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");
        _;
    }

    modifier onlyOperator() {
        require(operators[msg.sender] || owner == msg.sender, "!operator");
        _;
    }

    function treasuryBalance() external view returns(uint256){
        return IERC20(crvusd).balanceOf(treasury);
    }

    function setPidToVault(uint256 _pid, address _vault) external onlyOwner{
        pidVault[_pid] = _vault;
        IERC20(crvusd).safeApprove(_vault, 0);
        IERC20(_vault).safeApprove(booster, 0);
        IERC20(crvusd).safeApprove(_vault, uint256(-1));
        IERC20(_vault).safeApprove(booster, uint256(-1));
    }

    function setOperator(address _op, bool _active) external onlyOwner{
        operators[_op] = _active;
        emit OperatorSet(_op, _active);
    }

    function withdrawTo(IERC20 _asset, uint256 _amount, address _to) external onlyOwner{
        _asset.safeTransfer(_to, _amount);
    }

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external onlyOwner returns (bool, bytes memory) {

        (bool success, bytes memory result) = _to.call{value:_value}(_data);

        return (success, result);
    }

    function sharesOfPool(uint256 _pid) external view returns(uint256){
        address vault = pidVault[_pid];
        require(vault != address(0), "!vault");

        //remove from convex
        (,,, address _crvRewards, , ) = IBooster(booster).poolInfo(_pid);
        return IRewardStaking(_crvRewards).balanceOf(address(this));
    }

    function assetsOfPool(uint256 _pid) external view returns(uint256){
        address vault = pidVault[_pid];
        require(vault != address(0), "!vault");

        //remove from convex
        (,,, address _crvRewards, , ) = IBooster(booster).poolInfo(_pid);
        uint256 shares = IRewardStaking(_crvRewards).balanceOf(address(this));
        return IERC4626(vault).convertToAssets(shares);
    }

    function addToPool(uint256 _pid, uint256 _crvusdamount) external onlyOperator{
        address vault = pidVault[_pid];
        require(vault != address(0), "!vault");

        if(_crvusdamount > 0){
            //pull
            IERC20(crvusd).safeTransferFrom(treasury,address(this),_crvusdamount);

            //add vault
            IERC4626(vault).deposit(_crvusdamount, address(this));
        }

        //add to convex
        uint256 vBalance = IERC20(vault).balanceOf(address(this));
        IConvexDeposits(booster).deposit(_pid, vBalance, true);

        emit AddedToLP(vBalance);
    }

    function removeFromPool(uint256 _pid, uint256 _shares) external onlyOperator{
        address vault = pidVault[_pid];
        require(vault != address(0), "!vault");

        //remove from convex
        (,,, address _crvRewards, , ) = IBooster(booster).poolInfo(_pid);
        IRewardStaking(_crvRewards).withdrawAndUnwrap(_shares, true);

        //remove from vault with treasury as receiver
        IERC4626(vault).redeem(_shares, treasury, address(this));

        uint256 bal = IERC20(crv).balanceOf(address(this));
        if(bal > 0){
            //transfer to treasury
            IERC20(crv).safeTransfer(treasury, bal);
            emit ClaimedReward(crv,bal);
        }

        bal = IERC20(cvx).balanceOf(address(this));
        if(bal > 0){
            //transfer to treasury
            IERC20(cvx).safeTransfer(treasury, bal);
            emit ClaimedReward(cvx,bal);
        }

        emit RemovedFromLp(_shares);
    }

    
    function claimRewards(uint256 _pid) external onlyOperator{
        //claim from convex
        address vault = pidVault[_pid];
        require(vault != address(0), "!vault");

        //remove from convex
        (,,, address _crvRewards, , ) = IBooster(booster).poolInfo(_pid);
        IRewardStaking(_crvRewards).getReward();

        uint256 bal = IERC20(crv).balanceOf(address(this));
        if(bal > 0){
            //transfer to treasury
            IERC20(crv).safeTransfer(treasury, bal);
            emit ClaimedReward(crv,bal);
        }

        bal = IERC20(cvx).balanceOf(address(this));
        if(bal > 0){
            //transfer to treasury
            IERC20(cvx).safeTransfer(treasury, bal);
            emit ClaimedReward(cvx,bal);
        }
    }

}