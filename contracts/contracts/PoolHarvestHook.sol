// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./interfaces/IBooster.sol";
import "./interfaces/IBoosterAdmin.sol";
import "./interfaces/IBoosterRewardManager.sol";
import "./interfaces/IRewards.sol";
import "./interfaces/IRewardHook.sol";
import "./interfaces/IPoolAddHook.sol";
import "./interfaces/IRewardHookExtended.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/*
    A Hook that forces harvests to happen once period finish is complete
*/
contract PoolHarvestHook is IRewardHook, IPoolAddHook{

    address public constant booster = address(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    address public constant boosterOwner = address(0x256e1bbA846611C37CF89844a02435E6C098b86D);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public immutable poolManager;
    address public immutable poolHook;
    address public immutable owner;

    mapping(address => bool) public operators;
    mapping(address => address) public stashMap;
    uint256 public timebuffer;

    bool private isOperator;

    event AddOperator(address indexed _op, bool _valid);
    event ChangeBuffer(uint256 _buffer);

    constructor(address _owner, address _poolManager, address _poolHook) public {
        owner = _owner;
        poolManager = _poolManager;
        poolHook = _poolHook;
        operators[msg.sender] = true;
        timebuffer = 1 hours;
        emit AddOperator(msg.sender, true);
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");
        _;
    }

    modifier onlyOperator() {
        require(operators[msg.sender] || owner == msg.sender, "!op");
        _;
    }

    //set operator
    function setOperators(address _op, bool _valid) external onlyOwner{
        operators[_op] = _valid;
        emit AddOperator(_op, _valid);
    }

    //set time buffer
    function setBuffer(uint256 _seconds) external onlyOwner{
        timebuffer = _seconds;
        emit ChangeBuffer(_seconds);
    }

    //disable hook by removing all crv on this address
    function disable() external onlyOwner{
        IERC20(crv).transfer(address(0x1389388d01708118b497f59521f6943Be2541bb7), IERC20(crv).balanceOf(address(this)));
    }

    function setStashMap(uint256 _pid) public{
        //get stash address and crvrewards address
        (,,,address crvRewards, address stash,) = IBooster(booster).poolInfo(_pid);

        //add mapping stash -> rewards
        stashMap[stash] = crvRewards;
    }

    function setMultiStashMap(uint256[] calldata _pids) public{
        uint256 l = _pids.length;
        for(uint256 p = 0; p < l; ++p){
            //get stash address and crvrewards address
            (,,,address crvRewards, address stash,) = IBooster(booster).poolInfo(_pids[p]);

            //add mapping stash -> rewards
            stashMap[stash] = crvRewards;
        }
    }

    function poolAdded(address /*_gauge*/, uint256 /*_stashVersion*/, uint256 _poolId) external override{
        //require called from pool manager
        require(msg.sender == poolManager, "!poolMng");

        // set stash map
        setStashMap(_poolId);

        // tell booster owner reward manager to initialize pool (add cvx reward and stash hook)
        address rewardmanager = IBoosterAdmin(boosterOwner).stashRewardManager();
        IBoosterRewardManager(rewardmanager).initializePool(_poolId);
    }

    function earmarkRewards(uint256 _pid) external onlyOperator returns(bool){
        uint256 crvb = IERC20(crv).balanceOf(address(this));
        isOperator = true;
        IBooster(booster).earmarkRewards(_pid);
        isOperator = false;
        IERC20(crv).transfer(msg.sender, IERC20(crv).balanceOf(address(this))-crvb);
        return true;
    }

    //hook from stash
    function onRewardClaim() external override{
        //msg.sender is a proper stash if in the stash map
        _onHarvest(stashMap[msg.sender]);
    }

    //hook from PoolRewardHook
    function getReward(address _stash) public{
        require(msg.sender == poolHook, "!hook");
        //can trust the stash address given by PoolRewardHook
        _onHarvest(stashMap[_stash]);
    }

    function _onHarvest(address _crvRewards) internal{

        //if not set or operator, return
        if(_crvRewards == address(0) || isOperator){
            return;
        }

        //check period finish on crvrewards
        if (block.timestamp >= IRewards(_crvRewards).periodFinish()+timebuffer) {
            return;
        }

        // //check if there is more crv rewards waiting to be claimed than the current reward epoch
        uint256 currentRewards = IRewards(_crvRewards).currentRewards();
        uint256 balanceOnBooster = IERC20(crv).balanceOf(booster);
        if(balanceOnBooster > currentRewards * 2){
            return;
        }

        //if fail, send 1 wei of crv to booster
        IERC20(crv).transfer(booster, 1);
    }

}