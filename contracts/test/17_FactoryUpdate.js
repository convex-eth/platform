const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');

const MerkleTree = require('./helpers/merkleTree');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const IERC20 = artifacts.require("IERC20");
const Booster = artifacts.require("Booster");
const StashFactory = artifacts.require("StashFactory");
const ExtraRewardStashV3 = artifacts.require("ExtraRewardStashV3");
const PoolManager = artifacts.require("PoolManager");
const IExchange = artifacts.require("IExchange");
const I2CurveFi = artifacts.require("I2CurveFi");
const ICurveFi = artifacts.require("I3CurveFi");
const ICurveGaugeDebug = artifacts.require("ICurveGaugeDebug");
const IBaseRewards = artifacts.require("IBaseRewards");
const TreasuryFunds = artifacts.require("TreasuryFunds");
const ConvexToken = artifacts.require("ConvexToken");

contract("Factory Update", async accounts => {
  it("should update stash factory", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB"

    let booster = await Booster.at(contractList.system.booster);
    let pools = await PoolManager.at(contractList.system.poolManager);
    let cvx = await ConvexToken.at(contractList.system.cvx);

    let newStashFactory = await StashFactory.new(booster.address, contractList.system.rFactory);
    console.log("new factory: " +newStashFactory.address);

    //shutdown reth
    await pools.shutdownPool(35,{from:multisig,gasPrice:0});
    console.log("shutdown pool 35");

    //set new stash factory
    await booster.setFactories(contractList.system.rFactory,newStashFactory.address,contractList.system.tFactory,{from:multisig,gasPrice:0})
    console.log("set factories");

    var fac = await booster.stashFactory();
    console.log("check if set -> set factory: " +fac);

    let rEthSwap = await I2CurveFi.at("0xF9440930043eb3997fc70e1339dBb11F341de7A8");
    let exchange = await IExchange.at("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
    let dai = await IERC20.at("0x6b175474e89094c44da98b954eedeac495271d0f");
    let reth = await IERC20.at("0x9559aaa82d9649c7a7b220e7c461d2e74c9a3593");
    let rethLP = await IERC20.at("0x53a901d48795C58f485cBB38df08FA96a24669D5");
    let stafi = await IERC20.at("0xef3A930e1FfFFAcd2fc13434aC81bD278B0ecC8d");
    let rethGauge = await ICurveGaugeDebug.at("0x824F13f1a2F29cFEEa81154b46C0fc820677A637");
    let userA = accounts[1];

    await pools.revertControl({from:multisig,gasPrice:0});
    console.log("reverted pool control");
    await booster.addPool(rethLP.address,rethGauge.address,3,{from:multisig,gasPrice:0})
    console.log("reth pool added");
    var poolCount = await booster.poolLength()
    var info = await booster.poolInfo(poolCount-1);
    console.log(info);
    await booster.earmarkRewards(poolCount-1);
    console.log("earmarked")
    
    let starttime = await time.latest();
    console.log("current block time: " +starttime)

    await weth.sendTransaction({value:web3.utils.toWei("5.0", "ether"),from:userA});
    var wethBalance = await weth.balanceOf(userA);
    await weth.approve(exchange.address,wethBalance,{from:userA});
    await exchange.swapExactTokensForTokens(web3.utils.toWei("1.0", "ether"),0,[weth.address,reth.address],userA,starttime+3000,{from:userA});
    var rethBalance = await reth.balanceOf(userA);
    console.log("reth: " +rethBalance)
    await reth.approve(rEthSwap.address,rethBalance,{from:userA});
    await rEthSwap.add_liquidity([0,rethBalance],0,{from:userA});
    let startingreth = await rethLP.balanceOf(userA);
    console.log("reth lp: " +startingreth);

    

    await rethLP.approve(booster.address,startingreth,{from:userA});
    await booster.depositAll(poolCount-1,true,{from:userA});

    await stafi.balanceOf(info.stash).then(a=>console.log("stafi on stash " +a));

    await time.increase(10*86400);
    await time.advanceBlock();
    console.log("advance time...");

    await stafi.balanceOf(info.stash).then(a=>console.log("stafi on stash " +a));
    await stafi.balanceOf(contractList.system.voteProxy).then(a=>console.log("stafi on proxy " +a));
    await rethGauge.claim_rewards(contractList.system.voteProxy);
    console.log("claimed")
    await stafi.balanceOf(info.stash).then(a=>console.log("stafi on stash " +a));
    await stafi.balanceOf(contractList.system.voteProxy).then(a=>console.log("stafi on proxy " +a));
    await booster.earmarkRewards(poolCount-1);
    console.log("earmarked")
    await stafi.balanceOf(info.stash).then(a=>console.log("stafi on stash " +a));
    await stafi.balanceOf(contractList.system.voteProxy).then(a=>console.log("stafi on proxy " +a));

    await time.increase(10*86400);
    await time.advanceBlock();
    console.log("advance time...");

    let pool = await IBaseRewards.at(info.crvRewards);
    await pool.getReward(userA,true);
    await stafi.balanceOf(userA).then(a=>console.log("stafi on user A " +a));

    //add weth rewards
    let stash = await ExtraRewardStashV3.at(info.stash);
    var stashName = await stash.getName();
    console.log("stash: " +stashName);
    console.log("stash address: " +stash.address);
    await booster.owner().then(a=>console.log("booster owner: " +a));
    await stash.setExtraReward(weth.address,{from:multisig,gasPrice:0});
    console.log("added weth reward")

    var wethbal = await weth.balanceOf(userA);
    await weth.balanceOf(userA).then(a=>console.log("weth on user A " +a));
    await weth.transfer(stash.address,wethbal,{from:userA});
    console.log("transfer to stash");

    await weth.balanceOf(userA).then(a=>console.log("weth on user A " +a));
    await weth.balanceOf(stash.address).then(a=>console.log("weth on stash: " +a));
    //earmark
    await booster.earmarkRewards(poolCount-1);
    console.log("earmarked")
    await cvx.balanceOf(stash.address).then(a=>console.log("weth on stash after earmark: " +a));

    await time.increase(10*86400);
    await time.advanceBlock();
    console.log("advance time...");
    await pool.getReward(userA,true);
    console.log("get reward");
    await stafi.balanceOf(userA).then(a=>console.log("stafi on user A " +a));
    await weth.balanceOf(userA).then(a=>console.log("weth on user A " +a));

  });
});


