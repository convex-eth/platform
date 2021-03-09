// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
//const { expect } = require('chai');

const Booster = artifacts.require("Booster");
const CrvDepositor = artifacts.require("CrvDepositor");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const ExtraRewardStashV1 = artifacts.require("ExtraRewardStashV1");
const ExtraRewardStashV2 = artifacts.require("ExtraRewardStashV2");
const ManagedRewardPool = artifacts.require("ManagedRewardPool");
const VirtualBalanceRewardPool = artifacts.require("VirtualBalanceRewardPool");
const cCrvRewardPool = artifacts.require("cCrvRewardPool");
const cvxRewardPool = artifacts.require("cvxRewardPool");
const ConvexToken = artifacts.require("ConvexToken");
const cCrvToken = artifacts.require("cCrvToken");
const StashFactory = artifacts.require("StashFactory");
const RewardFactory = artifacts.require("RewardFactory");


const IExchange = artifacts.require("IExchange");
const ISPool = artifacts.require("ISPool");
const IERC20 = artifacts.require("IERC20");
const ICurveGauge = artifacts.require("ICurveGauge");


//3. extra rewards, but with v1 gauges

contract("ExtraRewardsTest v1", async accounts => {
  it("should deposit and claim crv/cvx as well as extra incentives", async () => {

    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let threeCrv = await IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let dai = await IERC20.at("0x6b175474e89094c44da98b954eedeac495271d0f");
    let snx = await IERC20.at("0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f");
    let exchange = await IExchange.at("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
    let susdswap = await ISPool.at("0xA5407eAE9Ba41422680e2e00537571bcC53efBfD");
    let susdlp = await IERC20.at("0xC25a3A3b969415c80451098fa907EC722572917F");
    let susdGauge = await ICurveGauge.at("0xA90996896660DEcC6E997655E065b23788857849");
    let susdGaugeDebug = await ISPool.at("0xA90996896660DEcC6E997655E065b23788857849");

    let admin = accounts[0];
    let userA = accounts[1];
    let userB = accounts[2];
    let caller = accounts[3];

    //system
    let voteproxy = await CurveVoterProxy.deployed();
    let booster = await Booster.deployed();
    let rewardFactory = await RewardFactory.deployed();
    let stashFactory = await StashFactory.deployed();
    let cvx = await ConvexToken.deployed();
    let cCrv = await cCrvToken.deployed();
    let crvDeposit = await CrvDepositor.deployed();
    let cCrvRewards = await booster.lockRewards();
    let cvxRewards = await booster.stakerRewards();
    let cCrvRewardsContract = await cCrvRewardPool.at(cCrvRewards);
    let cvxRewardsContract = await cvxRewardPool.at(cvxRewards);

    //add pool that uses a v1 gauge with rewards (susd)
    await booster.addPool(susdswap.address,susdGauge.address,1);
    console.log("pool added");
    let poolinfo = await booster.poolInfo(1);
    let rewardPoolAddress = poolinfo.crvRewards;
    let rewardPool = await ManagedRewardPool.at(rewardPoolAddress);
    console.log("reward contract at " +rewardPool.address);
    let stash = poolinfo.stash;
    let rewardStash = await ExtraRewardStashV1.at(stash);
    console.log("stash contract at " +rewardStash.address);
    let canclaim = await rewardStash.canClaimRewards();
   // console.log("stash can claim? " +JSON.stringify(canclaim));
    
    //make sure statsh is v1
    let stashName = await rewardStash.getName();
    console.log("stash name: " +stashName);

    //advance time to start cvx rewards
    await time.increase(10*86400);
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time...");

    let starttime = await time.latest();
    console.log("current block time: " +starttime)
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //exchange and deposit for susd lp
    await weth.sendTransaction({value:web3.utils.toWei("5.0", "ether"),from:userA});
    let startingWeth = await weth.balanceOf(userA);
    await weth.approve(exchange.address,startingWeth,{from:userA});
    await exchange.swapExactTokensForTokens(startingWeth,0,[weth.address,dai.address],userA,starttime+3000,{from:userA});
    let startingdai = await dai.balanceOf(userA);
    await dai.approve(susdswap.address,0,{from:userA});
    await dai.approve(susdswap.address,startingdai,{from:userA});
    await susdswap.add_liquidity([startingdai,0,0,0],0,{from:userA});
    let startinglp = await susdlp.balanceOf(userA);
    console.log("s pool lp: " +startinglp);
 
     //approve and partial deposit
    await susdlp.approve(booster.address,0,{from:userA});
    await susdlp.approve(booster.address,startinglp,{from:userA});
    await booster.deposit(1,web3.utils.toWei("0.1", "ether"),{from:userA});
    console.log("partial deposit complete");

    //confirm deposit
    await susdlp.balanceOf(userA).then(a=>console.log("userA susdlp: " +a));
    await booster.userPoolInfo(1,userA).then(a=>console.log("deposited lp: " +a));
    await susdGauge.balanceOf(voteproxy.address).then(a=>console.log("gaugeBalance: " +a));
    await snx.balanceOf(rewardStash.address).then(a=>console.log("snx on stash (==0): " +a));
    await snx.balanceOf(voteproxy.address).then(a=>console.log("snx on voter (==0): " +a));
    await snx.balanceOf(booster.address).then(a=>console.log("snx on deposit (==0): " +a));

    //advance time
    await time.increase(86400);
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time...");
    await time.latest().then(a=>console.log("current block time: " +a));
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //collect and distribute rewards off gauge
    await booster.earmarkRewards(1,{from:caller});
    console.log("earmark 1")

    //get new snx reward contract
    await rewardPool.extraRewardsLength().then(a=>console.log("reward pool extra rewards: " +a));
    let tokenInfo = await rewardStash.tokenInfo();
    console.log("snx token rewards (from stash): " +tokenInfo.rewardAddress);
    let snxRewardsAddress = await rewardPool.extraRewards(0);
    let snxRewards = await VirtualBalanceRewardPool.at(snxRewardsAddress);
    console.log("snx token rewards (from main rewards): " +snxRewards.address);

    //make sure crv and snx is where they should be
    await crv.balanceOf(voteproxy.address).then(a=>console.log("crv at voteproxy " +a));
    await crv.balanceOf(booster.address).then(a=>console.log("crv at booster " +a));
    await crv.balanceOf(caller).then(a=>console.log("crv at caller " +a));
    await crv.balanceOf(rewardPool.address).then(a=>console.log("crv at reward pool " +a));
    await crv.balanceOf(cCrvRewards).then(a=>console.log("crv at cCrvRewards " +a));
    await crv.balanceOf(cvxRewards).then(a=>console.log("crv at cvxRewards " +a));
    await crv.balanceOf(userA).then(a=>console.log("userA crv: " +a))
    await rewardPool.earned(userA).then(a=>console.log("rewards earned(unclaimed): " +a));

    await snx.balanceOf(rewardStash.address).then(a=>console.log("snx on stash (==0): " +a));
    await snx.balanceOf(voteproxy.address).then(a=>console.log("snx on voter (==0): " +a));
    await snx.balanceOf(booster.address).then(a=>console.log("snx on deposit (==0): " +a));
    await snx.balanceOf(snxRewards.address).then(a=>console.log("snx on rewards (>0): " +a));
    
    //increase time
    await time.increase(2*86400);
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time...");
    await time.latest().then(a=>console.log("current block time: " +a));
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //check gauge claimables
    await susdGaugeDebug.claimable_tokens(voteproxy.address).then(a=>console.log("claimableTokens: " +a));
    await susdGaugeDebug.claimable_reward(voteproxy.address).then(a=>console.log("claimableRewards: " +a));
    await rewardPool.earned(userA).then(a=>console.log("rewards earned(unclaimed): " +a));

    //deposit remaining
    await booster.depositAll(1,{from:userA});
    console.log("Deposit All")

    //stash should NOT catch rewards after a deposit in v1 stashes
    await snx.balanceOf(rewardStash.address).then(a=>console.log("snx on stash (==0): " +a));
    await snx.balanceOf(voteproxy.address).then(a=>console.log("snx on voter2 (==0): " +a));
    await snx.balanceOf(booster.address).then(a=>console.log("snx on deposit0 (==0): " +a));
    await snx.balanceOf(snxRewards.address).then(a=>console.log("snx on rewards (>0,same num as before): " +a));

    //increase time
    await time.increase(2*86400);
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time...");
    await time.latest().then(a=>console.log("current block time: " +a));
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //check gauge claimables
    await susdGaugeDebug.claimable_tokens(voteproxy.address).then(a=>console.log("claimableTokens: " +a));
    await susdGaugeDebug.claimable_reward(voteproxy.address).then(a=>console.log("claimableRewards: " +a));
    
    //claim rewards off gauge and distribute
    await booster.earmarkRewards(1,{from:caller});
    console.log("earmark 2")

    //check balances, snx/crv should be moved to their reward contracts
    await crv.balanceOf(voteproxy.address).then(a=>console.log("crv at voteproxy " +a));
    await crv.balanceOf(booster.address).then(a=>console.log("crv at booster " +a));
    await crv.balanceOf(caller).then(a=>console.log("crv at caller " +a));
    await crv.balanceOf(rewardPool.address).then(a=>console.log("crv at reward pool " +a));
    await crv.balanceOf(cCrvRewards).then(a=>console.log("crv at cCrvRewards " +a));
    await crv.balanceOf(cvxRewards).then(a=>console.log("crv at cvxRewards " +a));
    await crv.balanceOf(userA).then(a=>console.log("userA crv: " +a))

    await snx.balanceOf(rewardStash.address).then(a=>console.log("snx on stash (==0): " +a));
    await snx.balanceOf(voteproxy.address).then(a=>console.log("snx on voter (==0): " +a));
    await snx.balanceOf(booster.address).then(a=>console.log("snx on deposit (==0): " +a));
    await snx.balanceOf(snxRewards.address).then(a=>console.log("snx on rewards (>0): " +a));
    await snx.balanceOf(userA).then(a=>console.log("userA snx: " +a))


    await time.increase(86400);
    await time.advanceBlock();
    await time.advanceBlock();

    //claim crv reward pool, should also trigger cvx and snx
    await rewardPool.earned(userA).then(a=>console.log("crv rewards earned(unclaimed): " +a));
    await snxRewards.earned(userA).then(a=>console.log("snx rewards earned(unclaimed): " +a));
    await rewardPool.getReward({from:userA});
    console.log("getReward()");
    await rewardPool.earned(userA).then(a=>console.log("crv rewards earned(unclaimed): " +a));
    await snxRewards.earned(userA).then(a=>console.log("snx rewards earned(unclaimed): " +a));
    await crv.balanceOf(userA).then(a=>console.log("userA crv: " +a))
    await snx.balanceOf(userA).then(a=>console.log("userA snx: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("userA cvx: " +a))
  });
});


