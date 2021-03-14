// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


contract CurveVoterProxy {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public constant mintr = address(0xd061D61a4d941c39E5453435B6345Dc261C2fcE0);
    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);

    address public constant escrow = address(0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2);
    address public constant gaugeController = address(0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB);
    
    address public owner;
    address public operator;
    address public depositor;
    
    mapping (address => bool) private stashPool;

    constructor() public {
        owner = msg.sender;
    }

    function getName() external pure returns (string memory) {
        return "CurveVoterProxy";
    }

    function setOwner(address _owner) external {
        require(msg.sender == owner, "!auth");
        owner = _owner;
    }

    function setOperator(address _operator) external {
        require(msg.sender == owner, "!auth");
        require(operator == address(0) || IDeposit(operator).isShutdown() == true, "needs shutdown");
        
        operator = _operator;
    }

    function setDepositor(address _depositor) external {
        require(msg.sender == owner, "!auth");

        depositor = _depositor;
    }

    function setStashAccess(address _stash, bool _status) external{
        require(msg.sender == operator, "!auth");
        stashPool[_stash] = _status;
    }

    function deposit(address _token, address _gauge) external {
        uint256 balance = IERC20(_token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(_token).safeApprove(_gauge, 0);
            IERC20(_token).safeApprove(_gauge, balance);
            ICurveGauge(_gauge).deposit(balance);
        }
    }

    //stash only function for pulling extra incentive reward tokens out
    function withdraw(IERC20 _asset) external returns (uint256 balance) {
        require(stashPool[msg.sender] == true, "!auth");
        balance = _asset.balanceOf(address(this));
        _asset.safeTransfer(msg.sender, balance);
    }

    // Withdraw partial funds
    function withdraw(address _token, address _gauge, uint256 _amount) public {
        require(msg.sender == operator, "!auth");
        uint256 _balance = IERC20(_token).balanceOf(address(this));
        if (_balance < _amount) {
            _amount = _withdrawSome(_gauge, _amount.sub(_balance));
            _amount = _amount.add(_balance);
        }
        IERC20(_token).safeTransfer(msg.sender, _amount);
    }

     function withdrawAll(address _token, address _gauge) external {
        require(msg.sender == operator, "!auth");
        uint256 amount = balanceOfPool(_gauge);
        withdraw(_token, _gauge, amount);
    }

    function _withdrawSome(address _gauge, uint256 _amount) internal returns (uint256) {
        ICurveGauge(_gauge).withdraw(_amount);
        return _amount;
    }

    function createLock(uint256 _value, uint256 _unlockTime) external {
        require(msg.sender == depositor, "!auth");
        IERC20(crv).safeApprove(escrow, 0);
        IERC20(crv).safeApprove(escrow, _value);
        ICurveVoteEscrow(escrow).create_lock(_value, _unlockTime);
    }

    function increaseAmount(uint256 _value) external {
        require(msg.sender == depositor, "!auth");
        IERC20(crv).safeApprove(escrow, 0);
        IERC20(crv).safeApprove(escrow, _value);
        ICurveVoteEscrow(escrow).increase_amount(_value);
    }

    function increaseTime(uint256 _value) external {
        require(msg.sender == depositor, "!auth");
        ICurveVoteEscrow(escrow).increase_unlock_time(_value);
    }

    function release() external {
        require(msg.sender == depositor, "!auth");
        ICurveVoteEscrow(escrow).withdraw();
    }

    function vote(uint256 _voteId, address _votingAddress, bool _support) external {
        require(msg.sender == operator, "!auth");
        IVoting(_votingAddress).vote(_voteId,_support,false);
    }

    function voteGaugeWeight(address _gauge, uint256 _weight) external {
        require(msg.sender == operator, "!auth");

        //vote
        IVoting(gaugeController).vote_for_gauge_weights(_gauge, _weight);
    }

    function claimCrv(address _gauge) external returns (uint256){
        require(msg.sender == operator, "!auth");
        IMinter(mintr).mint(_gauge);
        uint256 _balance = IERC20(crv).balanceOf(address(this));
        IERC20(crv).safeTransfer(operator, _balance);
        return _balance;
    }

    function claimRewards(address _gauge) external{
        require(msg.sender == operator, "!auth");
        ICurveGauge(_gauge).claim_rewards();
    }

    function claimFees(address _distroContract, address _token) external returns (uint256){
        require(msg.sender == operator, "!auth");
        IFeeDistro(_distroContract).claim();
        uint256 _balance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(operator, _balance);
        return _balance;
    }    

    function balanceOfPool(address _gauge) public view returns (uint256) {
        return ICurveGauge(_gauge).balanceOf(address(this));
    }

}