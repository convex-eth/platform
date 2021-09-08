// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const CrvDepositor = artifacts.require("CrvDepositor");
const ConvexToken = artifacts.require("ConvexToken");
const cvxCrvToken = artifacts.require("cvxCrvToken");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const IERC20 = artifacts.require("IERC20");
const ERC20 = artifacts.require("ERC20");
const IExchange = artifacts.require("IExchange");
const IUniswapV2Router01 = artifacts.require("IUniswapV2Router01");
const Multicaller = artifacts.require("Multicaller");
const ICrvBribe = artifacts.require("ICrvBribe");
const IVoting = artifacts.require("IVoting");

contract("check for rewards and claim", async accounts => {
  it("should check for rewards and claim", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"

    //system
    let booster = await Booster.at(contractList.system.booster);
    let voteproxy = await CurveVoterProxy.at(contractList.system.voteProxy);
    let cvx = await ConvexToken.at(contractList.system.cvx);
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let cvxCrv = await cvxCrvToken.at(contractList.system.cvxCrv);
    let cvxCrvLP = await IERC20.at(contractList.system.cvxCrvCrvSLP);
    let exchange = await IExchange.at("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
    let exchangerouter = await IUniswapV2Router01.at("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let alcx = await IERC20.at("0xdbdb4d16eda451d0503b854cf79d55697f90c8df");
    let multicaller = await Multicaller.at("0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441");
    let bribe = await ICrvBribe.at("0x7893bbb46613d7a4FbcC31Dab4C9b823FfeE1026");

    let userA = accounts[0];
    let userB = accounts[1];
    let userC = accounts[2];

    var claimingAddress = contractList.system.voteProxy;

    var gaugeRewards = {};
    var poolList = contractList.pools;
    console.log("getting gauge rewards...");
    for(var poolId in poolList){
      var pool = poolList[poolId];
      var rewards = await bribe.rewards_per_gauge(pool.gauge);
      gaugeRewards[pool.gauge] = rewards;
    }


    //check for claimables
    var claimables = [];
    for(var gauge in gaugeRewards){
      console.log("gauge: " +gauge);
      for(var reward in gaugeRewards[gauge]){
        var rewardToken = gaugeRewards[gauge][reward];
        if(rewardToken == "0") continue;
        console.log(" -> reward: " +rewardToken);
        var claimable = await bribe.claimable(claimingAddress, gauge, rewardToken);
        if(claimable != "0"){
          var calldata = bribe.contract.methods.claim_reward(claimingAddress, gauge, rewardToken).encodeABI();
          
          claimables.push({gauge:gauge, rewardToken:rewardToken, calldata:calldata });
          console.log("add claimable: " +JSON.stringify( claimables[claimables.length-1]));
        }
      }
    }

    console.log("\n\nprecall balances..");
    var calldatalist = []
    for(var c in claimables){
      calldatalist.push([bribe.address,claimables[c].calldata]);
      var rtoken = await ERC20.at(claimables[c].rewardToken);
      var rname = await rtoken.name();
      var rbalance = await rtoken.balanceOf(claimingAddress);
      console.log("token " +rname +",  balance: " +rbalance);
    }
    //console.log(calldatalist);

    var tx = await multicaller.aggregate(calldatalist,{from:deployer,gasLimit:100000});
    //console.log(tx);

    console.log("\n\npost call balances..");
    var calldatalist = []
    for(var c in claimables){
      var rtoken = await ERC20.at(claimables[c].rewardToken);
      var rname = await rtoken.name();
      var rbalance = await rtoken.balanceOf(claimingAddress);
      console.log("token " +rname +",  balance: " +rbalance);
    }
  });
});


