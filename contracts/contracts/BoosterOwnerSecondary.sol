// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;


import { IPools, IStash, IStashFactory } from "./Interfaces.sol";
import "./interfaces/IBooster.sol";
import "./interfaces/IRescueStash.sol";
import "./interfaces/IStashTokenWrapper.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IBoosterOwner {
    //booster owner
    function setVoteDelegate(address _voteDelegate) external;
    function setFeeManager(address _feeM) external;
    function transferOwnership(address _owner) external;
    function setFactories(address _rfactory, address _sfactory, address _tfactory) external;
    function setArbitrator(address _arb) external;
    function shutdownSystem() external;
    function queueForceShutdown() external;
    function forceShutdownSystem() external;
    function setStashFactoryImplementation(address _v1, address _v2, address _v3) external;
    function execute(address _to, uint256 _value, bytes calldata _data) external returns (bool, bytes memory);
    function setRescueTokenDistribution(address _distributor, address _rewardDeposit, address _treasury) external;
    function setRescueTokenReward(address _token, uint256 _option) external;
    function acceptOwnership() external;
    function setStashExtraReward(address _stash, address _token) external;
    function setStashRewardHook(address _stash, address _hook) external;

    //stash token
    function setInvalid(bool _isInvalid) external;

    //pool manager
    function shutdownPool(uint256 _pid) external returns(bool);
}

interface IProxyOwner{
    function owner() external view returns(address);
    function operator() external view returns(address);
    function retireBooster() external;
}

/*
Secondary Booster Owner Layer
*/
contract BoosterOwnerSecondary{

    address public constant voterproxy = address(0x989AEb4d175e16225E39E87d0D97A3360524AD80);
    address public constant booster = address(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    address public constant boosterOwner = address(0x3cE6408F923326f81A7D7929952947748180f1E6);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    uint256 public constant allowRewardPid = 151;
    
    
    address public owner;
    address public pendingowner;
    address public stashRewardManager;
    address public pendingstashRewardManager;
    address public rescueManager;
    address public pendingrescueManager;
    address public poolManager;

    bool public isSealed;
    bool public sealStashImplementation;

    event ShutdownStarted(uint256 executableTimestamp);
    event ShutdownExecuted();
    event TransferOwnership(address pendingOwner);
    event AcceptedOwnership(address newOwner);
    event SetRewardManager(address newManager);
    event SetRescueManager(address newManager);
    event AddProtectedPool(uint256 poolId);
    event OwnershipSealed();
    event SealStashImplementation();

    constructor() public {
        //default to multisig
        owner = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB);
        stashRewardManager = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB);
        rescueManager = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB);
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");
        _;
    }

    modifier isRewardManager(){
        require(stashRewardManager == msg.sender, "!owner");
        _;
    }

    modifier isRescueManager(){
        require(rescueManager == msg.sender, "!owner");
        _;
    }

    function transferOwnership(address _owner) external onlyOwner{
        pendingowner = _owner;
        emit TransferOwnership(_owner);
    }

    function acceptOwnership() external {
        require(pendingowner == msg.sender, "!pendingowner");
        owner = pendingowner;
        pendingowner = address(0);
        emit AcceptedOwnership(owner);
    }

    function acceptOwnershipBoosterOwner() external onlyOwner{
        IBoosterOwner(boosterOwner).acceptOwnership();
    }

    function sealOwnership() external onlyOwner{
        isSealed = true;
        emit OwnershipSealed();
    }

    function setSealStashImplementation() external onlyOwner {
        sealStashImplementation = true;
        emit SealStashImplementation();
    }

    function setBoosterOwner() external onlyOwner{
        //allow reverting ownership until sealed
        require(!isSealed, "ownership sealed");

        //transfer booster ownership to this owner
        IBoosterOwner(boosterOwner).transferOwnership(owner);
    }

    function setPoolManager(address _mng) external onlyOwner {
        require(poolManager == address(0),"sealed");
        poolManager = _mng;
    }

    function setStashRewardManager(address _mng) external isRewardManager {
        pendingstashRewardManager = _mng;
    }

    function acceptStashRewardManager() external{
        require(pendingstashRewardManager == msg.sender, "!pendingstashRewardManager");
        stashRewardManager = pendingstashRewardManager;
        pendingstashRewardManager = address(0);
        emit SetRewardManager(stashRewardManager);
    }

    function setRescueManager(address _mng) external isRescueManager {
        pendingrescueManager = _mng;
    }

    function acceptRescueManager() external{
        require(pendingrescueManager == msg.sender, "!pendingrescueManager");
        rescueManager = pendingrescueManager;
        pendingrescueManager = address(0);
        emit SetRescueManager(rescueManager);
    }

    //sealed
    function setFactories(address _rfactory, address _sfactory, address _tfactory) external onlyOwner{
        // IBoosterOwner(boosterOwner).setFactories(_rfactory, _sfactory, _tfactory);
    }

    function setArbitrator(address _arb) external onlyOwner{
        IBoosterOwner(boosterOwner).setArbitrator(_arb);
    }

    function setFeeManager(address _feeM) external onlyOwner{
        IBoosterOwner(boosterOwner).setFeeManager(_feeM);
    }

    function setVoteDelegate(address _voteDelegate) external onlyOwner{
        IBoosterOwner(boosterOwner).setVoteDelegate(_voteDelegate);
    }

    function shutdownSystem(uint256[] calldata additionalPools) external onlyOwner{

        //1 - get pool count, fee distro, current balance
        uint256 poolCount = IBooster(booster).poolLength();
        address lockFees = IBooster(booster).lockFees();
        address feeToken = IBooster(booster).feeToken();
        uint256 feeBalance = IERC20(feeToken).balanceOf(lockFees);

        //2 - shutdown remaining pools
        //can be used to override any checks preventing the pool from being shutdown
        //in which case the pool is fine to shutdown now as booster will be replaced
        //with the retireBooster() call at the end of this call
        for(uint i=0; i < additionalPools.length; i++){
            IBoosterOwner(poolManager).shutdownPool(additionalPools[i]);
        }

        //3 - call shutdown on first owner
        IBoosterOwner(boosterOwner).shutdownSystem();

        //4 - check pool count hasnt changed
        require(poolCount == IBooster(booster).poolLength(), "pCnt changed");

        //4 - make sure the vote proxy operator hasnt changed
        // (a vote proxy owner layer will insure same operator cant be set twice )
        require(IProxyOwner(voterproxy).operator() == booster, "booster changed");

        //5 - change vote proxy operator to place holder
        IProxyOwner( IProxyOwner(voterproxy).owner() ).retireBooster();

        //6 - determine earmark fees was not called
        require( lockFees == IBooster(booster).lockFees(), "fee change");
        require( feeToken == IBooster(booster).feeToken(), "fee change");
        require( feeBalance == IERC20(feeToken).balanceOf(lockFees), "fee change");

        emit ShutdownExecuted();
    }


    //queue a forced shutdown that does not require pools to already be shutdown
    //this should only be needed if a pool is broken and withdrawAll() does not
    //correctly return enough lp tokens
    function queueForceShutdown() external onlyOwner{
        IBoosterOwner(boosterOwner).queueForceShutdown();
    }

    //force shutdown the system after timer has expired
    function forceShutdownSystem() external onlyOwner{
        address lockFees = IBooster(booster).lockFees();
        address feeToken = IBooster(booster).feeToken();
        uint256 feeBalance = IERC20(feeToken).balanceOf(lockFees);

        //1 force shutdown system
        IBoosterOwner(boosterOwner).forceShutdownSystem();

        //2 make sure booster wasnt changed
        require(IProxyOwner(voterproxy).operator() == booster, "booster changed");

        //3 change vote proxy operator to place holder
        IProxyOwner( IProxyOwner(voterproxy).owner() ).retireBooster();

        //4 determine earmark fees was not called
        require( lockFees == IBooster(booster).lockFees(), "fee change");
        require( feeToken == IBooster(booster).feeToken(), "fee change");
        require( feeBalance == IERC20(feeToken).balanceOf(lockFees), "fee change");

        emit ShutdownExecuted();
    }

    function setStashFactoryImplementation(address _v1, address _v2, address _v3) external onlyOwner{
        require(!sealStashImplementation, "sealed");
        IBoosterOwner(boosterOwner).setStashFactoryImplementation(_v1, _v2, _v3);
    }

    //allow arbitrary calls to primary booster owner. some function signatures are blocked
    function execute(
        address _to,
        uint256 _value,
        bytes memory _data
    ) external onlyOwner returns (bool, bytes memory) {
        bytes4 sig;
        assembly {
            sig := mload(add(_data, 32))
        }

        require(
            sig != IBoosterOwner.setFactories.selector &&  //seal factories
            sig != IBoosterOwner.setRescueTokenDistribution.selector &&  //must use roled helper function
            sig != IBoosterOwner.setRescueTokenReward.selector &&  //must use roled helper function
            sig != IBoosterOwner.setStashExtraReward.selector &&  //must use roled helper function
            sig != IBoosterOwner.setStashRewardHook.selector &&  //must use roled helper function
            sig != IBoosterOwner.setInvalid.selector &&  //must use roled helper function
            sig != IStashFactory.setImplementation.selector && //seal stash implementation
            sig != IBoosterOwner.shutdownPool.selector && //only call during shutdown sequence
            sig != IRescueStash.setDistribution.selector && //must use rescue manager
            sig != IRescueStash.setExtraReward.selector && //must use rescue manager
            sig != IStashTokenWrapper.setInvalid.selector && //must use reward manager
            sig != IStash.setRewardHook.selector && //must use reward manager
            sig != IStash.setExtraReward.selector, //must use reward manager
            "!allowed"
        );

        (bool success, bytes memory result) = IBoosterOwner(boosterOwner).execute(_to, _value, _data);
        require(success, "!success");
        return (success, result);
    }

    //allow arbitrary calls to any contract other than the primary booster owner
    function executeDirect(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external onlyOwner returns (bool, bytes memory) {
        require(_to != boosterOwner, "!invalid target");

        (bool success, bytes memory result) = _to.call{value:_value}(_data);

        return (success, result);
    }


    // --- Roled functions for other systems ---

    //TokenRescue setDistribution
    function setRescueTokenDistribution(address _distributor, address _rewardDeposit, address _treasury) external isRescueManager{
        IBoosterOwner(boosterOwner).setRescueTokenDistribution(_distributor, _rewardDeposit, _treasury);
    }

    //TokenRescue setExtraReward
    function setRescueTokenReward(address _token, uint256 _option) external isRescueManager{
        IBoosterOwner(boosterOwner).setRescueTokenReward(_token, _option);
    }

    //stash v3 - set extra reward
    function setStashExtraReward(uint256 _pid, address _token) external isRewardManager{
        //allow cvx on any stash, allow any token on new stashes
        require(_token == cvx || _pid >= allowRewardPid, "!allowed");
        (, , , , address stash, ) = IBooster(booster).poolInfo(_pid);

        //check reward count on older stashes
        if(_pid < allowRewardPid){
            require(IStash(stash).tokenCount() < 10, "tknCnt");
        }

        IBoosterOwner(boosterOwner).setStashExtraReward(stash, _token);
    }

    //stash v3 - set reward hook
    function setStashRewardHook(uint256 _pid, address _hook) external isRewardManager{
        (, , , , address stash, ) = IBooster(booster).poolInfo(_pid);
        IBoosterOwner(boosterOwner).setStashRewardHook(stash, _hook);
    }

    function setStashTokenIsValid(address stashToken, bool isValid) external isRewardManager {
        bytes memory data = abi.encodeWithSignature("setInvalid(bool)", isValid); 
        (bool success, ) = IBoosterOwner(boosterOwner).execute(stashToken, 0, data);
        require(success, "!success");
    }
}