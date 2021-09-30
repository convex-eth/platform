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
const ExtraRewardStashTokenRescue = artifacts.require("ExtraRewardStashTokenRescue");
const RescueToken = artifacts.require("RescueToken");
const RewardDeposit = artifacts.require("RewardDeposit");
const vlCvxExtraRewardDistribution = artifacts.require("vlCvxExtraRewardDistribution");
const CvxLocker = artifacts.require("CvxLocker");
const ClaimZap = artifacts.require("ClaimZap");
const ISwapExchange = artifacts.require("ISwapExchange");


contract("Test claim zap", async accounts => {
  it("perform tests", async () => {

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
    let locker = await CvxLocker.at(contractList.system.locker);
    let threeCrv = await IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");

    let userA = accounts[0];
    let userB = accounts[1];
    let userC = accounts[2];
    let userD = accounts[3];
    let userZ = "0xAAc0aa431c237C2C0B5f041c8e59B3f1a43aC78F";
    var userNames = {};
    userNames[userA] = "A";
    userNames[userB] = "B";
    userNames[userC] = "C";
    userNames[userD] = "D";

    let starttime = await time.latest();

    const advanceTime = async (secondsElaspse) => {
      await time.increase(secondsElaspse);
      await time.advanceBlock();
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;

    //swap for crv
    await weth.sendTransaction({value:web3.utils.toWei("1.0", "ether"),from:deployer});
    var wethBalance = await weth.balanceOf(deployer);
    console.log("receive weth: " +wethBalance)
    await weth.approve(exchange.address,wethBalance,{from:deployer});
    await exchange.swapExactTokensForTokens(web3.utils.toWei("1.0", "ether"),0,[weth.address,crv.address],userZ,starttime+3000,{from:deployer});
    
    var crvbalance = await crv.balanceOf(userZ);
    console.log("crv balance: " +crvbalance);

    // let curvepool = await ISwapExchange.at("0x9D0464996170c6B9e75eED71c68B99dDEDf279e8");
    // await crv.approve(curvepool.address, 0,{from:userA});
    // await crv.approve(curvepool.address, crvbalance,{from:userA});
    // console.log("approved");
    // var calldata = curvepool.contract.methods.exchange(0,1,1000,0).encodeABI();
    // console.log("calldata: " +calldata);
    // await curvepool.exchange(0,1,crvbalance,0,{from:userA});
    // await crv.balanceOf(userA).then(a=>console.log("wallet crv: " +a));
    // await cvxcrv.balanceOf(userA).then(a=>console.log("wallet cvxcrv: " +a));

    // return;
    //deploy
    let zap = await ClaimZap.new();
    await zap.setApprovals();
    console.log("zap deployed")
    // await crv.approve(zap.address,crvbalance);
    // console.log("approved");
    // await zap.claimRewards([],[],[],[],crvbalance,1000,0,0);

    let cvxcrvpool = await BaseRewardPool.at("0x3Fe65692bfCD0e6CF84cB1E7d24108E434A7587e");
    // await crv.balanceOf(userA).then(a=>console.log("wallet crv: " +a));
    // await crv.balanceOf(zap.address).then(a=>console.log("zap crv: " +a));
    // await cvxcrvpool.balanceOf(userA).then(a=>console.log("pool cvxcrv: " +a));


    //tests
    let spell = await IERC20.at("0x090185f2135308bad17527004364ebcc2d37e5f6");
    await weth.sendTransaction({value:web3.utils.toWei("10.0", "ether"),from:deployer});
    var wethBalance = await weth.balanceOf(deployer);
    console.log("receive weth: " +wethBalance)
    await weth.approve(exchange.address,wethBalance,{from:deployer});
    await exchange.swapExactTokensForTokens(web3.utils.toWei("10.0", "ether"),0,[weth.address,spell.address],deployer,starttime+3000,{from:deployer});
    var spellbalance = await spell.balanceOf(deployer);
    console.log("swapped for spell: " +spellbalance);

    let rewardDistro = await vlCvxExtraRewardDistribution.new();
    console.log("distro at: " +rewardDistro.address);
    await spell.approve(rewardDistro.address,spellbalance,{from:deployer});
    await rewardDistro.addRewardToEpoch(spell.address, web3.utils.toWei("1000000.0", "ether"), 0,{from:deployer});
    console.log("added spell rewards")

    let cvxpool = await BaseRewardPool.at("0xCF50b810E57Ac33B91dCF525C6ddd9881B139332");
    await crv.approve(zap.address,web3.utils.toWei("100000000000.0", "ether"),{from:userZ,gasPrice:0});
    await cvx.approve(zap.address,web3.utils.toWei("100000000000.0", "ether"),{from:userZ,gasPrice:0});
    console.log("approved");

    await cvxcrv.totalSupply().then(a=>console.log("cvxcrv totaly supply: " +a));
    await crv.balanceOf(userZ).then(a=>console.log("userZ crv: " +a));
    await cvxcrv.balanceOf(userZ).then(a=>console.log("userZ cvxcrv: " +a));
    await cvx.balanceOf(userZ).then(a=>console.log("userZ cvx: " +a));
    await threeCrv.balanceOf(userZ).then(a=>console.log("userZ threeCrv: " +a));
    await spell.balanceOf(userZ).then(a=>console.log("userZ spell: " +a));
    await cvxcrvpool.balanceOf(userZ).then(a=>console.log("pool cvxcrv: " +a));
    await cvxpool.balanceOf(userZ).then(a=>console.log("pool cvx: " +a));
    await cvxcrvpool.earned(userZ).then(a=>console.log("pool cvxcrv earned: " +a));
    await cvxpool.earned(userZ).then(a=>console.log("pool cvx earned: " +a));
    await locker.lockedBalanceOf(userZ).then(a=>console.log("locked balance: " +a));
    await locker.claimableRewards(userZ).then(a=>console.log("locked claimableRewards: " +a));
    await rewardDistro.claimableRewards(userZ,spell.address).then(a=>console.log("claimable spell from distro: " +a));
    // var mask = 2 + 4; //claimcvxstake, claim cvxcrv
    var mask = 4; //claimcvxstake, claim cvxcrv
    // await zap.claimRewards([],[],[rewardDistro.address],[spell.address],web3.utils.toWei("100000000000.0", "ether"),1,web3.utils.toWei("100000000000.0", "ether"),0,mask,{from:userZ,gasPrice:0});
    await zap.claimRewards([],[],[rewardDistro.address],[spell.address],0,1,0,0,mask,{from:userZ,gasPrice:0});
    console.log("zap'd");
    await cvxcrv.totalSupply().then(a=>console.log("cvxcrv totaly supply: " +a));
    await crv.balanceOf(userZ).then(a=>console.log("userZ crv: " +a));
    await cvxcrv.balanceOf(userZ).then(a=>console.log("userZ cvxcrv: " +a));
    await cvx.balanceOf(userZ).then(a=>console.log("userZ cvx: " +a));
    await threeCrv.balanceOf(userZ).then(a=>console.log("userZ threeCrv: " +a));
    await spell.balanceOf(userZ).then(a=>console.log("userZ spell: " +a));
    await cvxcrvpool.balanceOf(userZ).then(a=>console.log("pool cvxcrv: " +a));
    await cvxpool.balanceOf(userZ).then(a=>console.log("pool cvx: " +a));
    await cvxcrvpool.earned(userZ).then(a=>console.log("pool cvxcrv earned: " +a));
    await cvxpool.earned(userZ).then(a=>console.log("pool cvx earned: " +a));
    await locker.lockedBalanceOf(userZ).then(a=>console.log("locked balance: " +a));
    await locker.claimableRewards(userZ).then(a=>console.log("locked claimableRewards: " +a));
    await rewardDistro.claimableRewards(userZ,spell.address).then(a=>console.log("claimable spell from distro: " +a));
  });
});


