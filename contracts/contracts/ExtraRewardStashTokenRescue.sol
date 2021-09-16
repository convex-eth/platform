// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
// import "./interfaces/IRewardHook.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


//Stash v3: support for curve gauge reward redirect
//v3.1: support for arbitrary token rewards outside of gauge rewards
//      add reward hook to pull rewards during claims
//v3.2: move constuctor to init function for proxy creation

interface IRewardDeposit {
    function depositNotify(address _token, uint256 _amount) external;
}

contract ExtraRewardStashTokenRescue {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    // address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    // uint256 private constant maxRewards = 8;

    uint256 public pid;
    address public operator;
    address public staker;
    address public gauge;
    address public rewardFactory;

    address public distributor;
    address public rewardDeposit;
   
    // mapping(address => uint256) public historicalRewards;
    // bool public hasRedirected;
    // bool public hasCurveRewards;

    struct TokenInfo {
        address token;
        //address rewardAddress;
    }

    //use mapping+array so that we dont have to loop check each time setToken is called
    mapping(address => TokenInfo) public tokenInfo;
    address[] public tokenList;

    //address to call for reward pulls
    // address public rewardHook;

    constructor() public {
    }

    function initialize(uint256 _pid, address _operator, address _staker, address _gauge, address _rFactory) external {
        require(gauge == address(0),"!init");
        pid = _pid;
        operator = _operator;
        staker = _staker;
        gauge = _gauge;
        rewardFactory = _rFactory;
    }

    function getName() external pure returns (string memory) {
        return "ExtraRewardStashTokenRescue";
    }

    function tokenCount() external view returns (uint256){
        return tokenList.length;
    }

    //try claiming if there are reward tokens registered
    function claimRewards() external returns (bool) {
        return true;
    }

    function claimRewardToken(uint256 _tid) public returns (bool) {
        require(msg.sender == distributor || distributor == address(0), "!distributor");
        require(rewardDeposit != address(0), "!deposit set");

        // TokenInfo storage t = tokenInfo[tokenList[_tid]];
        address token = tokenInfo[tokenList[_tid]].token;
        if(token == address(0)) return false;
        
        uint256 onstaker = IERC20(token).balanceOf(staker);
        if(onstaker > 0){
            IStaker(staker).withdraw(token);
        }

        uint256 amount = IERC20(token).balanceOf(address(this));
        if (amount > 0) {
            IERC20(token).safeTransfer(rewardDeposit,amount);
            IRewardDeposit(rewardDeposit).depositNotify(token,amount);
        }
        return true;
    }
   

    function setDistribution(address _distributor, address _deposit) external{
        require(IDeposit(operator).owner() == msg.sender, "!owner");
        distributor = _distributor;
        rewardDeposit = _deposit;
    }

    //register an extra reward token to be handled
    // (any new incentive that is not directly on curve gauges)
    function setExtraReward(address _token) external{
        //owner of booster can set extra rewards
        require(IDeposit(operator).owner() == msg.sender, "!owner");
        setToken(_token);
    }

    // function setRewardHook(address _hook) external{
    //     //owner of booster can set reward hook
    //     require(IDeposit(operator).owner() == msg.sender, "!owner");
    //     rewardHook = _hook;
    // }


    //replace a token on token list
    function setToken(address _token) internal {
        TokenInfo storage t = tokenInfo[_token];

        if(t.token == address(0)){
            //set token address
            t.token = _token;

            //add token to list of known rewards
            tokenList.push(_token);
        }
    }

    //pull assigned tokens from staker to stash
    function stashRewards() external pure returns(bool){
        return true;
    }

    //send all extra rewards to their reward contracts
    function processStash() external returns(bool){
        return true;
    }

}