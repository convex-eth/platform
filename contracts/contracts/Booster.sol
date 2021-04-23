// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

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
    address public constant voteOwnership = address(0xE478de485ad2fe566d49342Cbd03E49ed7DB3356);
    address public constant voteParameter = address(0xBCfF8B0b9419b9A88c44546519b1e909cF330399);

    uint256 public lockIncentive = 1000; //incentive to crv stakers
    uint256 public stakerIncentive = 450; //incentive to native token stakers
    uint256 public earmarkIncentive = 50; //incentive to users who spend gas to make calls
    uint256 public platformFee = 0; //possible fee to build treasury
    uint256 public constant MaxFees = 2000;
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public owner;
    address public feeManager;
    address public poolManager;
    address public immutable staker;
    address public immutable minter;
    address public rewardFactory;
    address public stashFactory;
    address public tokenFactory;
    address public rewardArbitrator;
    address public voteDelegate;
    address public treasury;
    address public stakerRewards;
    address public lockRewards;
    address public lockFees;
    address public feeDistro;
    address public feeToken;
    uint256 public immutable mintStart;

    bool public isShutdown;

    struct PoolInfo {
        address lptoken;
        address token;
        address gauge;
        address crvRewards;
        address stash;
        bool shutdown;
    }

    //index(pid) -> pool
    PoolInfo[] public poolInfo;
    

    event Deposited(address indexed user, uint256 indexed poolid, uint256 amount);
    event Withdrawn(address indexed user, uint256 indexed poolid, uint256 amount);

    constructor(address _staker, address _minter, uint256 _mintStart) public {
        isShutdown = false;
        staker = _staker;
        owner = msg.sender;
        voteDelegate = msg.sender;
        feeManager = msg.sender;
        poolManager = msg.sender;
        feeDistro = address(0); //address(0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc);
        feeToken = address(0); //address(0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490);
        treasury = address(0);
        minter = _minter;
        mintStart = _mintStart;
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

    function setPoolManager(address _poolM) external {
        require(msg.sender == poolManager, "!auth");
        poolManager = _poolM;
    }

    function setFactories(address _rfactory, address _sfactory, address _tfactory) external {
        require(msg.sender == owner, "!auth");
        
        //reward factory only allow this to be called once even if owner
        //removes ability to inject malicious staking contracts
        //token factory can also be immutable
        if(rewardFactory == address(0)){
            rewardFactory = _rfactory;
            tokenFactory = _tfactory;
        }

        //stash factory should be considered more safe to change
        //at worst a "bad" stash could take extra rewards like snx etc.
        //but updating may be required to handle new types of gauges
        stashFactory = _sfactory;
    }

    function setArbitrator(address _arb) external {
        require(msg.sender==owner, "!auth");
        rewardArbitrator = _arb;
    }

    function setVoteDelegate(address _voteDelegate) external {
        require(msg.sender==voteDelegate, "!auth");
        voteDelegate = _voteDelegate;
    }

    function setRewardContracts(address _rewards, address _stakerRewards) external {
        require(msg.sender == owner, "!auth");
        
        //reward contracts are immutable or else the owner
        //has a means to redeploy and mint cvx via rewardClaimed()
        if(lockRewards == address(0)){
            lockRewards = _rewards;
            stakerRewards = _stakerRewards;
        }
    }

    // Set reward token and claim contract
    // this could change via a curve dao vote thus needs an access role to change.
    // however to stop malicious reward contracts from being deployed,
    // the fee reward contract is always created via the factory, and not assigned directly.
    function setFeeInfo(address _feeDistro, address _feeToken) external {
        require(msg.sender==feeManager, "!auth");
    
        if(feeToken != _feeToken){
            //create a new reward contract for the new token
           lockFees = IRewardFactory(rewardFactory).CreateTokenRewards(_feeToken,lockRewards,address(this));
        }

        feeToken = _feeToken;
        feeDistro = _feeDistro;
    }

    function setFees(uint256 _lockFees, uint256 _stakerFees, uint256 _callerFees, uint256 _platform) external{
        require(msg.sender==feeManager, "!auth");

        uint256 total = _lockFees.add(_stakerFees).add(_callerFees).add(_platform);
        require(total <= MaxFees, ">MaxFees");

        //if statements to reduce contract size        
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

    //create a new pool
    function addPool(address _lptoken, address _gauge, uint256 _stashVersion) external returns(bool){
        require(msg.sender==poolManager && !isShutdown, "!add");
        require(_gauge != address(0) && _lptoken != address(0),"!param");

        //the next pool's pid
        uint256 pid = poolInfo.length;

        //create a tokenized deposit
        address token = ITokenFactory(tokenFactory).CreateDepositToken(_lptoken);
        //create a reward contract for crv rewards
        address newRewardPool = IRewardFactory(rewardFactory).CreateCrvRewards(pid,token);
        //create a stash to handle extra incentives
        address stash = IStashFactory(stashFactory).CreateStash(pid,_gauge,staker,_stashVersion);

        //add the new pool
        poolInfo.push(
            PoolInfo({
                lptoken: _lptoken,
                token: token,
                gauge: _gauge,
                crvRewards: newRewardPool,
                stash: stash,
                shutdown: false
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
        return true;
    }

    //shutdown pool
    function shutdownPool(uint256 _pid) external returns(bool){
        require(msg.sender==poolManager, "!auth");
        PoolInfo storage pool = poolInfo[_pid];

        //withdraw from gauge
        try IStaker(staker).withdrawAll(pool.lptoken,pool.gauge){
        }catch{}

        //remove stash rights
        IStaker(staker).setStashAccess(pool.stash,false);

        pool.shutdown = true;
        return true;
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
            PoolInfo storage pool = poolInfo[i];
            if (pool.shutdown) continue;

            address token = pool.lptoken;
            address gauge = pool.gauge;
            address stash = pool.stash;

            //withdraw from gauge
            try IStaker(staker).withdrawAll(token,gauge){
            }catch{}
            
            if(_claimRewards){
                //earmark remaining rewards
                _earmarkRewards(i);
            }

            //remove stash rights
            IStaker(staker).setStashAccess(stash,false);
        }
    }


    //deposit lp tokens and stake
    function deposit(uint256 _pid, uint256 _amount, bool _stake) public returns(bool){
        require(!isShutdown,"shutdown");
        PoolInfo storage pool = poolInfo[_pid];
        require(pool.shutdown == false, "pool is closed");

        //send to proxy to stake
        address lptoken = pool.lptoken;
        IERC20(lptoken).safeTransferFrom(msg.sender, staker, _amount);

        //stake
        address gauge = pool.gauge;
        require(gauge != address(0),"!gauge setting");
        IStaker(staker).deposit(lptoken,gauge);

        //some gauges claim rewards when depositing, stash them in a seperate contract until next claim
        address stash = pool.stash;
        if(stash != address(0)){
            IStash(stash).stashRewards();
        }

        address token = pool.token;
        if(_stake){
            //mint here and send to rewards on user behalf
            ITokenMinter(token).mint(address(this),_amount);
            address rewardContract = pool.crvRewards;
            IERC20(token).safeApprove(rewardContract,0);
            IERC20(token).safeApprove(rewardContract,_amount);
            IRewards(rewardContract).stakeFor(msg.sender,_amount);
        }else{
            //add user balance directly
            ITokenMinter(token).mint(msg.sender,_amount);
        }

        
        emit Deposited(msg.sender, _pid, _amount);
        return true;
    }

    //deposit all lp tokens and stake
    function depositAll(uint256 _pid, bool _stake) external returns(bool){
        address lptoken = poolInfo[_pid].lptoken;
        uint256 balance = IERC20(lptoken).balanceOf(msg.sender);
        deposit(_pid,balance,_stake);
        return true;
    }

    //withdraw lp tokens
    function _withdraw(uint256 _pid, uint256 _amount, address _from, address _to) internal {
        PoolInfo storage pool = poolInfo[_pid];
        address lptoken = pool.lptoken;
        address gauge = pool.gauge;

        //remove lp balance
        address token = pool.token;
        ITokenMinter(token).burn(_from,_amount);

        //pull from gauge if not shutdown
        // if shutdown tokens will be in this contract
        if (!pool.shutdown) {
            IStaker(staker).withdraw(lptoken,gauge, _amount);
        }

        //some gauges claim rewards when withdrawing, stash them in a seperate contract until next claim
        //do not call if shutdown since stashes wont have access
        address stash = pool.stash;
        if(stash != address(0) && !isShutdown && !pool.shutdown){
            IStash(stash).stashRewards();
        }
        
        //return lp tokens
        IERC20(lptoken).safeTransfer(_to, _amount);

        emit Withdrawn(_to, _pid, _amount);
    }

    //withdraw lp tokens
    function withdraw(uint256 _pid, uint256 _amount) public returns(bool){
        _withdraw(_pid,_amount,msg.sender,msg.sender);
        return true;
    }

    //withdraw all lp tokens
    function withdrawAll(uint256 _pid) public returns(bool){
        address token = poolInfo[_pid].token;
        uint256 userBal = IERC20(token).balanceOf(msg.sender);
        withdraw(_pid, userBal);
        return true;
    }

    //allow reward contracts to send here and withdraw to user
    function withdrawTo(uint256 _pid, uint256 _amount, address _to) external returns(bool){
        address rewardContract = poolInfo[_pid].crvRewards;
        require(msg.sender == rewardContract,"!auth");

        _withdraw(_pid,_amount,address(this),_to);
        return true;
    }


    //delegate address votes on dao
    function vote(uint256 _voteId, address _votingAddress, bool _support) external returns(bool){
        require(msg.sender == voteDelegate, "!auth");
        require(_votingAddress == voteOwnership || _votingAddress == voteParameter, "!voteAddr");
        
        IStaker(staker).vote(_voteId,_votingAddress,_support);
        return true;
    }

    function voteGaugeWeight(address[] calldata _gauge, uint256[] calldata _weight ) external returns(bool){
        require(msg.sender == voteDelegate, "!auth");

        for(uint256 i = 0; i < _gauge.length; i++){
            IStaker(staker).voteGaugeWeight(_gauge[i],_weight[i]);
        }
        return true;
    }

    function claimRewards(uint256 _pid, address _gauge) external returns(bool){
        address stash = poolInfo[_pid].stash;
        require(msg.sender == stash,"!auth");

        IStaker(staker).claimRewards(_gauge);
        return true;
    }

    //claim crv and extra rewards, convert extra to crv, disperse to reward contracts
    function _earmarkRewards(uint256 _pid) internal {
        PoolInfo storage pool = poolInfo[_pid];
        require(pool.shutdown == false, "pool is closed");

        address gauge = pool.gauge;

        //claim crv
        IStaker(staker).claimCrv(gauge);

        //check if there are extra rewards
        address stash = pool.stash;
        if(stash != address(0)){
            //claim extra rewards
            IStash(stash).claimRewards();
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
            if(treasury != address(0) && treasury != address(this) && platformFee > 0){
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
            address rewardContract = pool.crvRewards;
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

    function earmarkRewards(uint256 _pid) external returns(bool){
        require(!isShutdown,"shutdown");
        _earmarkRewards(_pid);
        return true;
    }

    //claim fees from curve distro contract, put in lockers' reward contract
    function earmarkFees() external returns(bool){
        //require(!isShutdown,"shutdown");
        //claim fee rewards
        IStaker(staker).claimFees(feeDistro, feeToken);
        //send fee rewards to reward contract
        uint256 _balance = IERC20(feeToken).balanceOf(address(this));
        IERC20(feeToken).safeTransfer(lockFees, _balance);
        IRewards(lockFees).queueNewRewards(_balance);
        return true;
    }

    //callback from reward contract when crv is received.
    function rewardClaimed(uint256 _pid, address _address, uint256 _amount) external returns(bool){
        address rewardContract = poolInfo[_pid].crvRewards;
        require(msg.sender == lockRewards||msg.sender == rewardContract,"!auth");

        if(block.timestamp >= mintStart){
            //mint reward tokens
            ITokenMinter(minter).mint(_address,_amount);
        }
        return true;
    }

}