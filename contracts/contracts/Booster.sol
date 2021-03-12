// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "./Interfaces.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


contract Booster{
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address constant public chi = address(0x0000000000004946c0e9F43F4Dee607b0eF1fA1c);
    address public constant escrow = address(0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2);
    address public constant registry = address(0x0000000022D53366457F9d5E68Ec105046FC4383);


    uint256 public lockIncentive = 1000; //incentive to crv stakers
    uint256 public stakerIncentive = 450; //incentive to native token stakers
    uint256 public earmarkIncentive = 50; //incentive to users who spend gas to make calls
    uint256 public platformFee = 0; //possible fee to build treasury
    uint256 public constant MaxFees = 2000;
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public owner;
    address public feeManager;
    address public staker;
    address public minter;
    address public rewardFactory;
    address public stashFactory;
    address public voteDelegate;
    address public treasury;
    address public stakerRewards;
    address public lockRewards;
    address public lockFees;
    address public feeDistro;
    address public feeToken;
    uint256 public mintStart;

    bool public isShutdown;

    struct UserInfo {
        uint256 amount;
    }

    struct PoolInfo {
        address lptoken;
        address gauge;
        address crvRewards;
        address stash;
    }

    //index(pid) -> pool
    PoolInfo[] public poolInfo;
    //pid -> user address -> user info
    mapping (uint256 => mapping (address => UserInfo)) public userPoolInfo;

    event Deposited(address indexed user, uint256 indexed poolid, uint256 amount);
    event Withdrawn(address indexed user, uint256 indexed poolid, uint256 amount);

    constructor(address _staker) public {
        isShutdown = false;
        staker = _staker;
        owner = msg.sender;
        voteDelegate = msg.sender;
        feeManager = msg.sender;
        feeDistro = address(0); //address(0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc);
        feeToken = address(0); //address(0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490);
        treasury = address(0);
        mintStart = block.timestamp + (86400*7);
    }


    /// SETTER SECTION ///

    function setOwner(address _owner) external {
        require(msg.sender == owner, "!auth");
        owner = _owner;
    }

    function setFeeManager(address _feeM) external {
        require(msg.sender == feeManager, "!auth");
        feeManager = _feeM;
    }

    function setMinter(address _minter) external {
        require(msg.sender == owner, "!auth");
        minter = _minter;
    }

    function setMintStart(uint256 _mintStart) external{
        require(msg.sender == owner, "!auth");
        mintStart = _mintStart;
    }

    function setFactories(address _rfactory, address _sfactory) external {
        require(msg.sender == owner, "!auth");
        rewardFactory = _rfactory;
        stashFactory = _sfactory;
    }

    function setVoteDelegate(address _voteDelegate) external {
        require(msg.sender==voteDelegate, "!auth");
        voteDelegate = _voteDelegate;
    }

    function setRewardContracts(address _rewards, address _stakerRewards) external {
        require(msg.sender == owner, "!auth");
        lockRewards = _rewards;
        stakerRewards = _stakerRewards;
    }

    // Set reward token and claim contract
    // this could change via a curve dao vote thus needs an access role to change.
    // however to stop malicious reward contracts from being deployed,
    // the fee reward contract is always created via the factory, and not assigned directly.
    function setFeeInfo(address _feeDistro, address _feeToken) external {
        require(msg.sender==feeManager, "!auth");
        //require(lockRewards != address(0),"set locker rewards first");
        
        if(feeToken != _feeToken){
            //create a new reward contract for the new token
           lockFees = IRewardFactory(rewardFactory).CreateTokenRewards(_feeToken,lockRewards,address(this));
        }

        feeToken = _feeToken;
        feeDistro = _feeDistro;
    }

    function setFees(uint256 _lockFees, uint256 _stakerFees, uint256 _callerFees, uint256 _platform) external{
        require(msg.sender==feeManager, "!auth");
        // require(_lockFees >= 1000 && _lockFees <= 1500, "fee range error");
        // require(_stakerFees >= 300 && _stakerFees <= 600, "fee range error");
        // require(_callerFees >= 25 && _callerFees <= 100, "fee range error");
        uint256 total = _lockFees.add(_stakerFees).add(_callerFees).add(_platform);
        require(total <= MaxFees, ">MaxFees");
        
        if(_lockFees >= 1000 && _lockFees <= 1500
            && _stakerFees >= 300 && _stakerFees <= 600
            && _callerFees >= 25 && _callerFees <= 100
            && _platform <= 200){
            lockIncentive = _lockFees;
            stakerIncentive = _stakerFees;
            earmarkIncentive = _callerFees;
            platformFee = _platform;
       }
    }

    function setTreasury(address _treasury) external {
        require(msg.sender==feeManager, "!auth");
        treasury = _treasury;
    }

    /// END SETTER SECTION ///


    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    //add a new curve pool to the system.
    //gauge must be on curve's registry, thus anyone can call
    function addPool(address _swap, address _gauge, uint256 _stashVersion) external {
        
        //get curve's registery
        address mainReg = IRegistry(registry).get_registry();
        
        //get lp token and gauge list from swap address
        address lptoken = IRegistry(mainReg).get_lp_token(_swap);

        (address[10] memory gaugeList,) = IRegistry(mainReg).get_gauges(_swap);

        //confirm the gauge passed in calldata is in the list
        //  a passed gauge address is needed if there is ever multiple gauges
        //  as the fact that an array is returned implies.
        bool found = false;
        for(uint256 i = 0; i < gaugeList.length; i++){
            if(gaugeList[i] == _gauge){
                found = true;
                break;
            }
        }
        require(found, "!registry");

        //now make sure this pool/gauge hasnt been added before
        found = false;
        for(uint256 i = 0; i < poolInfo.length; i++){
            if(poolInfo[i].gauge == _gauge){
                found = true;
                break;
            }
        }
        require(!found, "already registered");
        
        //the next pool's pid
        uint256 pid = poolInfo.length;

        //create a reward contract for crv rewards
        address newRewardPool = IRewardFactory(rewardFactory).CreateCrvRewards(pid);
        //create a stash to handle extra incentives
        address stash = IStashFactory(stashFactory).CreateStash(pid,_gauge,staker,_stashVersion);
        
        //add the new pool
        poolInfo.push(
            PoolInfo({
                lptoken: lptoken,
                gauge: _gauge,
                crvRewards: newRewardPool,
                stash: stash
            })
        );

        //give stashes access to rewardfactory and voteproxy
        //   voteproxy so it can grab the incentive tokens off the contract after claiming rewards
        //   reward factory so that stashes can make new extra reward contracts if a new incentive is added to the gauge
        if(stash != address(0)){
            poolInfo[pid].stash = stash;
            IStaker(staker).setStashAccess(stash,true);
            IRewardFactory(rewardFactory).setAccess(stash,true);
        }
    }

    //shutdown this contract.
    //  unstake and pull all lp tokens to this address
    //  only allow withdrawals
    //  claim final rewards because stashes could have tokens on them
    //  remove stash access after final claim
    function shutdownSystem(bool _claimRewards) external{
        require(msg.sender == owner, "!auth");
        isShutdown = true;

        for(uint i=0; i < poolInfo.length; i++){
            address token = poolInfo[i].lptoken;
            address gauge = poolInfo[i].gauge;
            address stash = poolInfo[i].stash;

            //withdraw from gauge
            try IStaker(staker).withdrawAll(token,gauge){
            }catch{}
            
            if(_claimRewards){
                //earmark remaining rewards
                _earmarkRewards(i);
            }

            //remove stash rights
            if(stash != address(0)){
                IStaker(staker).setStashAccess(stash,false);
            }
        }
    }


    //stake coins on the staker account
    function stakeTokens(uint256 _pid) private {
        address token = poolInfo[_pid].lptoken;
        uint256 bal = IERC20(token).balanceOf(address(this));

        //send to proxy to stake
        IERC20(token).safeTransfer(staker, bal);

        //stake
        address gauge = poolInfo[_pid].gauge;
        require(gauge != address(0),"!gauge setting");
        IStaker(staker).deposit(token,gauge);

        //some gauges claim rewards when depositing, stash them in a seperate contract until next claim
        address stash = poolInfo[_pid].stash;
        if(stash != address(0)){
            IStash(stash).stashRewards();
        }
    }

    //deposit lp tokens and stake
    function deposit(uint256 _pid, uint256 _amount) public{
        require(!isShutdown,"shutdown");
        address token = poolInfo[_pid].lptoken;
        IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);

        //add user balance
        uint256 userBal = _amount.add(userPoolInfo[_pid][msg.sender].amount);
        userPoolInfo[_pid][msg.sender].amount = userBal;
        
        //add amount to rewards
        address rewardContract = poolInfo[_pid].crvRewards;
        IRewards(rewardContract).stake(msg.sender, _amount);

        //stake
        stakeTokens(_pid);

        emit Deposited(msg.sender, _pid, _amount);
    }

    //deposit all lp tokens and stake
    function depositAll(uint256 _pid) external {
        address token = poolInfo[_pid].lptoken;
        uint256 balance = IERC20(token).balanceOf(msg.sender);
        deposit(_pid,balance);
    }

    //withdraw lp tokens
    function withdraw(uint256 _pid, uint256 _amount, bool _claimRewards) public {
        address token = poolInfo[_pid].lptoken;
        address gauge = poolInfo[_pid].gauge;
        uint256 before = IERC20(token).balanceOf(address(this));

        //pull whats needed from gauge
        //  should always be full amount unless we withdrew everything to shutdown this contract
        if (before < _amount) {
            IStaker(staker).withdraw(token,gauge, _amount.sub(before));
        }

        //some gauges claim rewards when withdrawing, stash them in a seperate contract until next claim
        //do not call if shutdown since stashes wont have access
        address stash = poolInfo[_pid].stash;
        if(stash != address(0) && !isShutdown){
            IStash(stash).stashRewards();
        }
        
        //reward contract for the pool
        address rewardContract = poolInfo[_pid].crvRewards;

        //if withdraw+claim
        //mostly a what-if reward claiming doesnt work
        if(_claimRewards){
            //get remaining rewards
            IRewards(rewardContract).getReward(msg.sender);
        }

        //update balance on reward contracts
        IRewards(rewardContract).withdraw(msg.sender, _amount);

        //remove lp balance
        uint256 userBal = userPoolInfo[_pid][msg.sender].amount;
        userBal = userBal.sub(_amount);
        userPoolInfo[_pid][msg.sender].amount = userBal;

        //return lp tokens
        IERC20(token).safeTransfer(msg.sender, _amount);

        emit Withdrawn(msg.sender, _pid, _amount);
    }

     function withdraw(uint256 _pid, uint256 _amount) public {
        withdraw(_pid,_amount,true);
     }

    //withdraw all lp tokens
    function withdrawAll(uint256 _pid, bool _claimRewards) public {
        uint256 userBal = userPoolInfo[_pid][msg.sender].amount;
        withdraw(_pid, userBal, _claimRewards);
    }

    function withdrawAll(uint256 _pid) external {
        withdrawAll(_pid, true);
    }

    //delegate address votes on dao
    function vote(uint256 _voteId, address _votingAddress, bool _support) external {
        require(msg.sender == voteDelegate, "!auth");
        IStaker(staker).vote(_voteId,_votingAddress,_support);
    }

    function voteGaugeWeight(address _gauge, uint256 _weight ) external {
        require(msg.sender == voteDelegate, "!auth");
        IStaker(staker).voteGaugeWeight(_gauge,_weight);
    }

    //claim crv and extra rewards, convert extra to crv, disperse to reward contracts
    function _earmarkRewards(uint256 _pid) internal {
        address gauge = poolInfo[_pid].gauge;

        //claim crv
        IStaker(staker).claimCrv(gauge);

        //check if there are extra rewards
        address stash = poolInfo[_pid].stash;
        if(stash != address(0) && IStash(stash).canClaimRewards()){
            //claim extra rewards
            IStaker(staker).claimRewards(gauge);
            //move rewards from staker to stash
            IStash(stash).stashRewards();
            //process extra rewards
            IStash(stash).processStash();
        }

        //crv balance
        uint256 crvBal = IERC20(crv).balanceOf(address(this));

        if (crvBal > 0) {
            uint256 _lockIncentive = crvBal.mul(lockIncentive).div(FEE_DENOMINATOR);
            uint256 _stakerIncentive = crvBal.mul(stakerIncentive).div(FEE_DENOMINATOR);
            uint256 _callIncentive = crvBal.mul(earmarkIncentive).div(FEE_DENOMINATOR);
            
            //send treasury
            if(treasury != address(0) && treasury != address(this)){
                //only subtract after address condition check
                uint256 _platform = crvBal.mul(platformFee).div(FEE_DENOMINATOR);
                crvBal = crvBal.sub(_platform);
                IERC20(crv).safeTransfer(treasury, _platform);
            }

            //remove incentives from balance
            crvBal = crvBal.sub(_lockIncentive).sub(_callIncentive).sub(_stakerIncentive);

            //send incentives for calling
            IERC20(crv).safeTransfer(msg.sender, _callIncentive);          

            //send crv to lp provider reward contract
            address rewardContract = poolInfo[_pid].crvRewards;
            IERC20(crv).safeTransfer(rewardContract, crvBal);
            IRewards(rewardContract).queueNewRewards(crvBal);

            //send lockers' share of crv to reward contract
            IERC20(crv).safeTransfer(lockRewards, _lockIncentive);
            IRewards(lockRewards).queueNewRewards(_lockIncentive);

            //send stakers's share of crv to reward contract
            IERC20(crv).safeTransfer(stakerRewards, _stakerIncentive);
            IRewards(stakerRewards).queueNewRewards(_stakerIncentive);
        }
    }

    function earmarkRewards(uint256 _pid) external {
        // require(!isShutdown,"shutdown");
        _earmarkRewards(_pid);
    }

    //claim fees from curve distro contract, put in lockers' reward contract
    function earmarkFees() external{
       // require(!isShutdown,"shutdown");
        //claim fee rewards
        IStaker(staker).claimFees(feeDistro, feeToken);
        //send fee rewards to reward contract
        uint256 _balance = IERC20(feeToken).balanceOf(address(this));
        IERC20(feeToken).safeTransfer(lockFees, _balance);
        IRewards(lockFees).queueNewRewards(_balance);
    }

    //callback from reward contract when crv is received.
    function rewardClaimed(uint256 _pid, address _address, uint256 _amount) external{
        address rewardContract = poolInfo[_pid].crvRewards;
        require(msg.sender == lockRewards||msg.sender == rewardContract,"!auth");

        if(block.timestamp >= mintStart){
            //mint reward tokens
            ITokenMinter(minter).mint(_address,_amount);
        }
    }

}