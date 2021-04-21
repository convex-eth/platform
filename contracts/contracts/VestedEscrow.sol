// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

/*
Rewrite of Curve Finance's Vested Escrow
found at https://github.com/curvefi/curve-dao-contracts/blob/master/contracts/VestingEscrow.vy

Changes:
- no disable methods
- only one fund admin
- add claim and stake
*/
import "./Interfaces.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';



contract VestedEscrow is ReentrancyGuard{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public rewardToken;
    address public admin;
    address public fundAdmin;
    address public stakeContract;
    
    uint256 public startTime;
    uint256 public endTime;
    uint256 public totalTime;
    uint256 public initialLockedSupply;
    uint256 public unallocatedSupply;

    mapping(address => uint256) public initialLocked;
    mapping(address => uint256) public totalClaimed;

    address[] public extraRewards;

    event Fund(address indexed recipient, uint256 reward);
    event Claim(address indexed user, uint256 amount);

    constructor(
        address rewardToken_,
        uint256 starttime_,
        uint256 endtime_,
        address stakeContract_,
        address fundAdmin_
    ) public {
        require(starttime_ >= block.timestamp,"start must be future");
        require(endtime_ > starttime_,"end must be greater");

        rewardToken = IERC20(rewardToken_);
        startTime = starttime_;
        endTime = endtime_;
        totalTime = endTime.sub(startTime);
        admin = msg.sender;
        fundAdmin = fundAdmin_;
        stakeContract = stakeContract_;
    }

    function setAdmin(address _admin) external {
        require(msg.sender == admin, "!auth");
        admin = _admin;
    }

    function setFundAdmin(address _fundadmin) external {
        require(msg.sender == admin, "!auth");
        fundAdmin = _fundadmin;
    }

    function addTokens(uint256 _amount) external returns(bool){
        require(msg.sender == admin, "!auth");

        rewardToken.safeTransferFrom(msg.sender, address(this), _amount);
        unallocatedSupply = unallocatedSupply.add(_amount);
        return true;
    }
    
    function fund(address[] calldata _recipient, uint256[] calldata _amount) external nonReentrant returns(bool){
        require(msg.sender == fundAdmin || msg.sender == admin, "!auth");

        uint256 totalAmount = 0;
        for(uint256 i = 0; i < _recipient.length; i++){
            uint256 amount = _amount[i];
            initialLocked[_recipient[i]] = initialLocked[_recipient[i]].add(amount);
            totalAmount = totalAmount.add(amount);
            emit Fund(_recipient[i],amount);
        }

        initialLockedSupply = initialLockedSupply.add(totalAmount);
        unallocatedSupply = unallocatedSupply.sub(totalAmount);
        return true;
    }

    function _totalVestedOf(address _recipient, uint256 _time) internal view returns(uint256){
        if(_time < startTime){
            return 0;
        }
        uint256 locked = initialLocked[_recipient];
        uint256 elapsed = _time.sub(startTime);
        uint256 total = MathUtil.min(locked * elapsed / totalTime, locked );
        return total;
    }

    function _totalVested() internal view returns(uint256){
        uint256 _time = block.timestamp;
        if(_time < startTime){
            return 0;
        }
        uint256 locked = initialLockedSupply;
        uint256 elapsed = _time.sub(startTime);
        uint256 total = MathUtil.min(locked * elapsed / totalTime, locked );
        return total;
    }

    function vestedSupply() external view returns(uint256){
        return _totalVested();
    }

    function lockedSupply() external view returns(uint256){
        return initialLockedSupply.sub(_totalVested());
    }

    function vestedOf(address _recipient) external view returns(uint256){
        return _totalVestedOf(_recipient, block.timestamp);
    }

    function balanceOf(address _recipient) external view returns(uint256){
        uint256 vested = _totalVestedOf(_recipient, block.timestamp);
        return vested.sub(totalClaimed[_recipient]);
    }

    function lockedOf(address _recipient) external view returns(uint256){
        uint256 vested = _totalVestedOf(_recipient, block.timestamp);
        return initialLocked[_recipient].sub(vested);
    }

    function claim(address _recipient) public nonReentrant{
        uint256 vested = _totalVestedOf(_recipient, block.timestamp);
        uint256 claimable = vested.sub(totalClaimed[_recipient]);

        totalClaimed[_recipient] = totalClaimed[_recipient].add(claimable);
        rewardToken.safeTransfer(_recipient, claimable);

        emit Claim(msg.sender, claimable);
    }

    function claim() external{
        claim(msg.sender);
    }

    function claimAndStake(address _recipient) public nonReentrant{
        require(stakeContract != address(0),"no staking contract");
        require(IRewards(stakeContract).stakingToken() == address(rewardToken),"stake token mismatch");
        
        uint256 vested = _totalVestedOf(_recipient, block.timestamp);
        uint256 claimable = vested.sub(totalClaimed[_recipient]);

        totalClaimed[_recipient] = totalClaimed[_recipient].add(claimable);
        
        IRewards(stakeContract).stakeFor(_recipient, claimable);

        emit Claim(msg.sender, claimable);
    }

    function claimAndStake() external{
        claim(msg.sender);
    }
}