// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const CrvDepositor = artifacts.require("CrvDepositor");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const ExtraRewardStashV1 = artifacts.require("ExtraRewardStashV1");
const ExtraRewardStashV2 = artifacts.require("ExtraRewardStashV2");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const VirtualBalanceRewardPool = artifacts.require("VirtualBalanceRewardPool");
const cvxRewardPool = artifacts.require("cvxRewardPool");
const ConvexToken = artifacts.require("ConvexToken");
const cvxCrvToken = artifacts.require("cvxCrvToken");
const StashFactory = artifacts.require("StashFactory");
const RewardFactory = artifacts.require("RewardFactory");
const ArbitratorVault = artifacts.require("ArbitratorVault");
const PoolManager = artifacts.require("PoolManager");
const ConvexMasterChef = artifacts.require("ConvexMasterChef");
const ChefToken = artifacts.require("ChefToken");
const ChefExtraRewards = artifacts.require("ChefExtraRewards");
const SushiChefV2 = artifacts.require("SushiChefV2");
const SushiChefV1 = artifacts.require("SushiChefV1");
const ConvexRewarder = artifacts.require("ConvexRewarder");
const IExchange = artifacts.require("IExchange");
const IUniswapV2Router01 = artifacts.require("IUniswapV2Router01");
const ICurveGaugeDebug = artifacts.require("ICurveGaugeDebug");

const IERC20 = artifacts.require("IERC20");
const CvxExtraRewardPool = artifacts.require("CvxExtraRewardPool");
const SimplePurchaser = artifacts.require("SimplePurchaser");


//3. extra rewards, but with v1 gauges

contract("Test buyback", async accounts => {
  it("shouldbuyback", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let cvx = await IERC20.at("0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B");
    let cvxCrv = await IERC20.at("0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7");

    //system
    let booster = await Booster.at(contractList.system.booster);
    let voteproxy = await CurveVoterProxy.at(contractList.system.voteProxy);
    let cvxRewards = await cvxRewardPool.at(contractList.system.cvxRewards);


    let extraPool = await CvxExtraRewardPool.new(cvxRewards.address,cvxCrv.address,{from:deployer});
    console.log("cvx extra rewards: " +extraPool.address);
    let purchaser = await SimplePurchaser.new(extraPool.address,{from:deployer});
    console.log("purchaser: " +purchaser.address);

    await extraPool.setOperator(purchaser.address,{from:deployer});
    await purchaser.setApprovals({from:deployer});
    await extraPool.setOwner(multisig,{from:deployer});
    await cvxRewards.addExtraReward(extraPool.address,{from:deployer});
    
    await booster.setTreasury(purchaser.address,{from:multisig,gasPrice:0});
    await booster.setFees(1000,300,100,200,{from:multisig,gasPrice:0});

    console.log("setup complete");

    await booster.earmarkRewards(28);
    // await booster.earmarkRewards(21);
    // await booster.earmarkRewards(22);
    // await booster.earmarkRewards(23);
    // await booster.earmarkRewards(24);
    // await booster.earmarkRewards(25);
    // await booster.earmarkRewards(26);
    console.log("earmark complete");

    await crv.balanceOf(purchaser.address).then(a=>console.log("crv on purchaser: "+a))

    await purchaser.distribute();
    console.log("purchaser complete");

    await crv.balanceOf(purchaser.address).then(a=>console.log("crv on purchaser: "+a))
    await cvxCrv.balanceOf(extraPool.address).then(a=>console.log("cvxcrv on purchaser: "+a))

    await time.increase(86400);
    await time.advanceBlock();
    console.log("advance time");

    let cp = "0xAAc0aa431c237C2C0B5f041c8e59B3f1a43aC78F";
    await cvxCrv.balanceOf(cp).then(a=>console.log("cvxcrv on wallet: "+a))
    await cvxRewards.earned(cp).then(a=>console.log("cvxcrv on main: "+a))
    await extraPool.earned(cp).then(a=>console.log("cvxcrv on extra: "+a))

    await cvxRewards.getReward(cp,true,false);
    console.log("get reward called");

    await cvxCrv.balanceOf(cp).then(a=>console.log("cvxcrv on wallet: "+a))
    await cvxRewards.earned(cp).then(a=>console.log("cvxcrv earned main: "+a))
    await extraPool.earned(cp).then(a=>console.log("cvxcrv earned extra: "+a))

   
  });
});


