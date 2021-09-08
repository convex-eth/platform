// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
const { keccak256: k256 } = require('ethereum-cryptography/keccak');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const IERC20 = artifacts.require("IERC20");
const IExchange = artifacts.require("IExchange");
const IUniswapV2Router01 = artifacts.require("IUniswapV2Router01");
const DepositToken = artifacts.require("DepositToken");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const ProxyFactory = artifacts.require("ProxyFactory");
const StashFactoryV2 = artifacts.require("StashFactoryV2");
const IVoteStarter = artifacts.require("IVoteStarter");
const PoolManager = artifacts.require("PoolManager");
const I2CurveFi = artifacts.require("I2CurveFi");
const ExtraRewardStashV3 = artifacts.require("ExtraRewardStashV3");
const RewardHook = artifacts.require("RewardHook");


contract("setup stash proxies", async accounts => {
  it("should setup stash proxies", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let treasury = "0x1389388d01708118b497f59521f6943Be2541bb7";
    let addressZero = "0x0000000000000000000000000000000000000000"

    //system
    let booster = await Booster.at(contractList.system.booster);
    let cvx = await IERC20.at(contractList.system.cvx);
    let cvxcrv = await IERC20.at(contractList.system.cvxCrv);
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let exchange = await IExchange.at("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
    let exchangerouter = await IUniswapV2Router01.at("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let dai = await IERC20.at("0x6B175474E89094C44Da98b954EedeAC495271d0F");
    let pools = await PoolManager.at(contractList.system.poolManager);

    let userA = accounts[0];
    let userB = accounts[1];
    let userC = accounts[2];
    let userD = accounts[3];
    var userNames = {};
    userNames[userA] = "A";
    userNames[userB] = "B";
    userNames[userC] = "C";
    userNames[userD] = "D";

    var isShutdown = false;

    let starttime = await time.latest();

    const advanceTime = async (secondsElaspse) => {
      await time.increase(secondsElaspse);
      await time.advanceBlock();
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;

    //deploy
    let pfactory = await ProxyFactory.new({from:deployer});
    console.log("proxy factory: " +pfactory.address);
    let sfactory = await StashFactoryV2.new(contractList.system.booster,contractList.system.rFactory,pfactory.address,{from:deployer});
    console.log("stash factory: " +sfactory.address);
    let v3impl = await ExtraRewardStashV3.new();
    console.log("impl at " +v3impl.address);
    await sfactory.setImplementation(addressZero,addressZero,v3impl.address,{from:multisig,gasPrice:0});
    console.log("impl set");

    //set new stash factory
    await booster.setFactories(contractList.system.rFactory,sfactory.address,contractList.system.tFactory,{from:multisig,gasPrice:0})
    console.log("set factories");

    var fac = await booster.stashFactory();
    console.log("check if set -> set factory: " +fac);

    await advanceTime(day*7);

    //execute vote for new pool
    var voter = await IVoteStarter.at("0xE478de485ad2fe566d49342Cbd03E49ed7DB3356");
    await voter.executeVote(73);
    console.log("vote executed");

    var cvxcrvLP = await IERC20.at("0x9D0464996170c6B9e75eED71c68B99dDEDf279e8");
    var cvxcrvGauge = "0x903dA6213a5A12B61c821598154EfAd98C3B20E4";
    var trigauge = "0xDeFd8FdD20e0f34115C7018CCfb655796F6B2168";

    //add weight
    await booster.voteGaugeWeight([trigauge,cvxcrvGauge],[0,1500],{from:multisig,gasPrice:0});
    console.log("weight added");

    await advanceTime(day*7);

    await pools.revertControl({from:multisig,gasPrice:0});
    console.log("reverted pool control");
    var tx = await booster.addPool(cvxcrvLP.address,cvxcrvGauge,3,{from:multisig,gasPrice:0})
    console.log("cvxcrv pool added, gas: " +tx.receipt.gasUsed);

    var poolLength = await booster.poolLength();
    var poolInfo = await booster.poolInfo(poolLength-1);
    console.log(poolInfo);

    //swap for crv
    await weth.sendTransaction({value:web3.utils.toWei("10.0", "ether"),from:deployer});
    var wethBalance = await weth.balanceOf(deployer);
    console.log("receive weth: " +wethBalance)
    await weth.approve(exchange.address,wethBalance,{from:deployer});
    await exchange.swapExactTokensForTokens(web3.utils.toWei("5.0", "ether"),0,[weth.address,crv.address],userA,starttime+3000,{from:deployer});
    var crvbalance = await crv.balanceOf(userA);
    console.log("swapped for crv(userA): " +crvbalance);

    //deposit into pool
    var pool = await I2CurveFi.at(cvxcrvLP.address);
    await crv.approve(pool.address,crvbalance);
    await pool.add_liquidity([crvbalance,0],0);
    console.log("added liquidity");

    var lptokens = await cvxcrvLP.balanceOf(userA);
    console.log("lp tokens: " +lptokens);

    //deposit
    await cvxcrvLP.approve(booster.address,lptokens);
    await booster.depositAll(poolLength-1, true);
    console.log("deposited");

    var rewardContract = await BaseRewardPool.at(poolInfo.crvRewards);
    console.log("reward contract: " +rewardContract.address);
    var stakedAmount = await rewardContract.balanceOf(userA);
    console.log("staked amount: " +stakedAmount);

    await advanceTime(day);
    await booster.earmarkRewards(poolLength-1);

    await advanceTime(day);
    await rewardContract.earned(userA).then(a=>console.log("earned: " +a));


    //add weth rewards
    let stash = await ExtraRewardStashV3.at(poolInfo.stash);
    var stashName = await stash.getName();
    console.log("stash: " +stashName);
    console.log("stash address: " +stash.address);
    await booster.owner().then(a=>console.log("booster owner: " +a));
    await stash.setExtraReward(weth.address,{from:multisig,gasPrice:0});
    console.log("added weth reward")

    let hook = await RewardHook.new(stash.address, weth.address);
    console.log("created hook: " +hook.address);
    await stash.setRewardHook(hook.address,{from:multisig,gasPrice:0});
    console.log("set hook");

    var wethbal = await weth.balanceOf(deployer);
    await weth.balanceOf(deployer).then(a=>console.log("weth on deployer " +a));
    await weth.transfer(hook.address,wethbal,{from:deployer});
    console.log("transfer to hook");

    await weth.balanceOf(userA).then(a=>console.log("weth on user A " +a));
    await weth.balanceOf(stash.address).then(a=>console.log("weth on stash: " +a));
    await weth.balanceOf(hook.address).then(a=>console.log("weth on hook: " +a));
    //earmark
    await booster.earmarkRewards(poolLength-1);
    console.log("earmarked")
    await cvx.balanceOf(stash.address).then(a=>console.log("weth on stash after earmark: " +a));
    await weth.balanceOf(hook.address).then(a=>console.log("weth on hook after earmark: " +a));

    await advanceTime(day);
    await rewardContract.earned(userA).then(a=>console.log("earned: " +a));
    await rewardContract.getReward(userA,true);

    await weth.balanceOf(userA).then(a=>console.log("weth: " +a))
    await crv.balanceOf(userA).then(a=>console.log("crv: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("cvx: " +a))
  });
});


