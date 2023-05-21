// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "./interfaces/IRewardHook.sol";
import "./interfaces/IProxyFactory.sol";
import "./interfaces/IStashTokenWrapper.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


//Stash v3: support for curve gauge reward redirect
//v3.1: support for arbitrary token rewards outside of gauge rewards
//      add reward hook to pull rewards during claims
//v3.2: move constuctor to init function for proxy creation
//v3.3: add extra checks and restrictions, wrap reward tokens

contract ExtraRewardStashV3 {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    uint256 private constant maxRewards = 8;
    uint256 private constant maxTotalRewards = 12;
    address public constant proxyFactory = address(0x66807B5598A848602734B82E432dD88DBE13fC8f);

    address public immutable tokenWrapperImplementation;

    uint256 public pid;
    address public operator;
    address public staker;
    address public gauge;
    address public rewardFactory;
   
    mapping(address => uint256) public historicalRewards;
    bool public hasRedirected;
    bool public hasCurveRewards;

    struct TokenInfo {
        address token;
        address rewardAddress;
        address wrapperAddress;
    }

    //use mapping+array so that we dont have to loop check each time setToken is called
    mapping(address => TokenInfo) public tokenInfo;
    address[] public tokenList;

    //address to call for reward pulls
    address public rewardHook;

    constructor(address _wrapperImplementation) public {
        tokenWrapperImplementation = _wrapperImplementation;
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
        return "ExtraRewardStashV3.4";
    }

    function tokenCount() external view returns (uint256){
        return tokenList.length;
    }

    //try claiming if there are reward tokens registered
    function claimRewards() external returns (bool) {
        require(msg.sender == operator, "!operator");
        uint256 boosterCrv = IERC20(crv).balanceOf(operator);

        //this is updateable from v2 gauges now so must check each time.
        checkForNewRewardTokens();

        //make sure we're redirected
        if(!hasRedirected){
            IDeposit(operator).setGaugeRedirect(pid);
            hasRedirected = true;

            //always make sure cvx is added as well
            setToken(cvx);
        }

        if(hasCurveRewards){
            //claim rewards on gauge for staker
            //using reward_receiver so all rewards will be moved to this stash
            IDeposit(operator).claimRewards(pid,gauge);
        }

        //hook for reward pulls
        if(rewardHook != address(0)){
            try IRewardHook(rewardHook).onRewardClaim(){
            }catch{}
        }

        require(boosterCrv == IERC20(crv).balanceOf(operator),"crvChange");
        return true;
    }
   

    //check if gauge rewards have changed
    function checkForNewRewardTokens() internal {
        for(uint256 i = 0; i < maxRewards; i++){
            address token = ICurveGauge(gauge).reward_tokens(i);
            if (token == address(0)) {
                break;
            }
            if(!hasCurveRewards){
                hasCurveRewards = true;
            }
            setToken(token);
        }
    }

    //register an extra reward token to be handled
    // (any new incentive that is not directly on curve gauges)
    function setExtraReward(address _token) external{
        //owner of booster can set extra rewards
        require(IDeposit(operator).owner() == msg.sender, "!owner");
        require(tokenList.length < maxTotalRewards,"rwd cnt");

        setToken(_token);
    }

    function setRewardHook(address _hook) external{
        //owner of booster can set reward hook
        require(IDeposit(operator).owner() == msg.sender, "!owner");

        rewardHook = _hook;
    }


    //replace a token on token list
    function setToken(address _token) internal {
        TokenInfo storage t = tokenInfo[_token];

        if(t.token == address(0)){
            //set token address
            t.token = _token;

            //check if crv
            if(_token != crv){
                //create new wrapper
                address tokenwrapper = IProxyFactory(proxyFactory).clone(tokenWrapperImplementation);
                
                //create new reward contract (for NON-crv tokens only)
                (,,,address mainRewardContract,,) = IDeposit(operator).poolInfo(pid);
                address rewardContract = IRewardFactory(rewardFactory).CreateTokenRewards(
                    tokenwrapper,//add the wrapper as reward token
                    mainRewardContract,
                    address(this));
                
                t.rewardAddress = rewardContract;
                t.wrapperAddress = tokenwrapper;

                //init wrapper
                IStashTokenWrapper(tokenwrapper).init(_token, rewardContract);
            }
            //add token to list of known rewards
            tokenList.push(_token);
        }
    }

    //pull assigned tokens from staker to stash
    function stashRewards() external pure returns(bool){

        //after depositing/withdrawing, extra incentive tokens are claimed
        //but from v3 this is default to off, and this stash is the reward receiver too.

        return true;
    }

    //send all extra rewards to their reward contracts
    function processStash() external returns(bool){
        require(msg.sender == operator, "!operator");

        uint256 tCount = tokenList.length;
        for(uint i=0; i < tCount; i++){
            TokenInfo storage t = tokenInfo[tokenList[i]];
            address token = t.token;
            if(token == address(0)) continue;

            if(token == crv){
                //if crv, send back to booster to distribute
                IERC20(token).safeTransfer(operator, IERC20(token).balanceOf(address(this)));
                continue;
            }
            
            address wrapper = t.wrapperAddress;
            if(IStashTokenWrapper(wrapper).isInvalid()) continue;

            uint256 amount = IERC20(token).balanceOf(address(this));

            if (amount > 0 && amount < 1e30) {
                historicalRewards[token] = historicalRewards[token].add(amount);
            	//add to wrapper, which is allocated to reward contract
            	address rewards = t.rewardAddress;
            	if(rewards == address(0)) continue;
            	IERC20(token).safeTransfer(wrapper, amount);
            	IRewards(rewards).queueNewRewards(amount);
            }
        }
        return true;
    }

}