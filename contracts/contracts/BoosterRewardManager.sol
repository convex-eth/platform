// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./interfaces/IBooster.sol";
import "./interfaces/IBoosterAdmin.sol";
import "./interfaces/IBoosterRewardManager.sol";
import "./interfaces/IRewardStash.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/*
    Reward Manager
*/
contract BoosterRewardManager is IBoosterRewardManager{

    address public constant booster = address(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    address public constant boosterOwner = address(0x256e1bbA846611C37CF89844a02435E6C098b86D);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public immutable owner;

    mapping(address => bool) public operators;
    mapping(address => address) public stashMap;
    address public override defaultHook;

    event AddOperator(address indexed _op, bool _valid);
    event ChangeHooks(address mainhook);

    constructor(address _owner) public {
        owner = _owner;
        operators[msg.sender] = true;
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

    //set default hooks
    function setPoolHooks(address _poolhook) external onlyOwner{
        defaultHook = _poolhook;
        emit ChangeHooks(_poolhook);
    }

    function setStashRewardManager(address _mng) external override onlyOwner{
        IBoosterAdmin(boosterOwner).setStashRewardManager(_mng);
    }

    function acceptStashRewardManager() external{
        IBoosterAdmin(boosterOwner).acceptStashRewardManager();
    }

    function initializePool(uint256 _pid) external override onlyOperator{
        //add cvx (will be ignored if called twice)
        IBoosterAdmin(boosterOwner).setStashExtraReward(_pid, cvx);

        (, , , , address stash, ) = IBooster(booster).poolInfo(_pid);
        if(IRewardStash(stash).rewardHook() == address(0)){
            //set pool hook
            IBoosterAdmin(boosterOwner).setStashRewardHook(_pid, defaultHook);
        }
    }
    
    function setStashExtraReward(uint256 _pid, address _token) external override onlyOperator{
        IBoosterAdmin(boosterOwner).setStashExtraReward(_pid, _token);
    }

    function setStashRewardHook(uint256 _pid, address _hook) external override onlyOperator{
        IBoosterAdmin(boosterOwner).setStashRewardHook(_pid, _hook);
    }

    function setMultiStashRewardHook(uint256[] calldata _pids, address _hook) external override onlyOperator{
        uint256 plength = _pids.length;
        for(uint256 i = 0; i < plength; ++i ){ 
            IBoosterAdmin(boosterOwner).setStashRewardHook(_pids[i], _hook);
        }
    }

    function setStashTokenIsValid(address stashToken, bool isValid) external override onlyOperator{
        IBoosterAdmin(boosterOwner).setStashTokenIsValid(stashToken, isValid);
    }

}