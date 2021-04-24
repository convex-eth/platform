const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const CrvDepositor = artifacts.require("CrvDepositor");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const ExtraRewardStashV2 = artifacts.require("ExtraRewardStashV2");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const VirtualBalanceRewardPool = artifacts.require("VirtualBalanceRewardPool");
//const cvxCrvRewardPool = artifacts.require("cvxCrvRewardPool");
const cvxRewardPool = artifacts.require("cvxRewardPool");
const ConvexToken = artifacts.require("ConvexToken");
const cvxCrvToken = artifacts.require("cvxCrvToken");
const StashFactory = artifacts.require("StashFactory");
const RewardFactory = artifacts.require("RewardFactory");


const IExchange = artifacts.require("IExchange");
const ICurveFi = artifacts.require("I3CurveFi");
const IERC20 = artifacts.require("IERC20");



contract("cvxCrv Rewards", async accounts => {
  it("should deposit and gain rewrds with cvxCrv", async () => {
    
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let dai = await IERC20.at("0x6b175474e89094c44da98b954eedeac495271d0f");
    let exchange = await IExchange.at("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
    let threecrvswap = await ICurveFi.at("0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7");
    let threeCrv = await IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
    let threeCrvGauge = "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A";
    let threeCrvSwap = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";

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
    let cvxCrv = await cvxCrvToken.deployed();
    let crvDeposit = await CrvDepositor.deployed();
    let cvxCrvRewards = await booster.lockRewards();
    let cvxRewards = await booster.stakerRewards();
    let cvxCrvRewardsContract = await BaseRewardPool.at(cvxCrvRewards);
    let cvxRewardsContract = await cvxRewardPool.at(cvxRewards);

    var poolId = contractList.pools.find(pool => pool.name == "3pool").id;
    let poolinfo = await booster.poolInfo(poolId);
    let rewardPoolAddress = poolinfo.crvRewards;
    let rewardPool = await BaseRewardPool.at(rewardPoolAddress);

    //advance to start cvx farming
    await time.increase(10*86400);
    await time.advanceBlock();
    await time.advanceBlock();

    let starttime = await time.latest();
    console.log("current block time: " +starttime)
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //exchange and deposit for 3crv
    await weth.sendTransaction({value:web3.utils.toWei("2.0", "ether"),from:userA});
    let startingWeth = await weth.balanceOf(userA);
    await weth.approve(exchange.address,startingWeth,{from:userA});
    await exchange.swapExactTokensForTokens(startingWeth,0,[weth.address,dai.address],userA,starttime+3000,{from:userA});
    let startingDai = await dai.balanceOf(userA);
    await dai.approve(threecrvswap.address,startingDai,{from:userA});
    await threecrvswap.add_liquidity([startingDai,0,0],0,{from:userA});
    let startingThreeCrv = await threeCrv.balanceOf(userA);
    console.log("3crv: " +startingThreeCrv);
 
    //approve and deposit 3crv
    await threeCrv.approve(booster.address,0,{from:userA});
    await threeCrv.approve(booster.address,startingThreeCrv,{from:userA});

    await booster.depositAll(0,true,{from:userA});
    await rewardPool.balanceOf(userA).then(a=>console.log("deposited lp: " +a));
    await rewardPool.balanceOf(userA).then(a=>console.log("reward balance: " +a));
    await rewardPool.earned(userA).then(a=>console.log("rewards earned(unclaimed): " +a));
    console.log("deposited lp tokens");

    //exchange for crv
    await weth.sendTransaction({value:web3.utils.toWei("1.0", "ether"),from:userA});
    let wethForCrv = await weth.balanceOf(userA);
    await weth.approve(exchange.address, 0,{from:userA});
    await weth.approve(exchange.address,wethForCrv,{from:userA});
    await exchange.swapExactTokensForTokens(wethForCrv,0,[weth.address,crv.address],userA,starttime+3000,{from:userA});
    let startingcrv = await crv.balanceOf(userA);
    console.log("crv: " +startingcrv);
    
    //deposit crv
    await crv.approve(crvDeposit.address,0,{from:userA});
    await crv.approve(crvDeposit.address,startingcrv,{from:userA});
    await crvDeposit.deposit(startingcrv,true,"0x0000000000000000000000000000000000000000",{from:userA});
    console.log("crv deposited");
    await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    //stake cvxCrv
    console.log("stake at " +cvxCrvRewardsContract.address);
    await cvxCrv.approve(cvxCrvRewardsContract.address,0,{from:userA});
    await cvxCrv.approve(cvxCrvRewardsContract.address,startingcrv,{from:userA});
    console.log("stake approve");
    await cvxCrvRewardsContract.stakeAll({from:userA})
    console.log("staked")

    //check balances, depositor should still have crv since no whitelist
    await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    await cvxCrvRewardsContract.balanceOf(userA).then(a=>console.log("cvxCrv staked: " +a))
    await crv.balanceOf(crvDeposit.address).then(a=>console.log("crv on depositor: " +a))
    await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))

    //advance time
    await time.increase(86400);
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time....");
    await time.latest().then(a=>console.log("current block time: " +a));
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //distribute rewards
    await booster.earmarkRewards(0,{from:caller});
    console.log("earmark")
    await crv.balanceOf(voteproxy.address).then(a=>console.log("proxy crv(==0): " +a));
    await crv.balanceOf(crvDeposit.address).then(a=>console.log("depositor crv(>0): " +a));
    await crv.balanceOf(userA).then(a=>console.log("userA crv(==0): " +a));
    await crv.balanceOf(caller).then(a=>console.log("caller crv(>0): " +a));
    await crv.balanceOf(cvxCrvRewards).then(a=>console.log("crv at cvxCrvRewards " +a));
    await crv.balanceOf(cvxRewards).then(a=>console.log("crv at cvxRewards " +a));
    
    //check earned(should be 0)
    await cvxCrvRewardsContract.earned(userA).then(a=>console.log("current earned: " +a));

    await time.increase(3*86400);
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time....");

    //check earned
    await cvxCrvRewardsContract.earned(userA).then(a=>console.log("current earned: " +a));
    //claim
    await cvxCrvRewardsContract.getReward({from:userA});
    console.log("getReward()");

    await crv.balanceOf(cvxCrvRewards).then(a=>console.log("crv at cvxCrvRewards " +a));
    await cvxCrvRewardsContract.earned(userA).then(a=>console.log("current earned: " +a));
    await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    await crv.balanceOf(userA).then(a=>console.log("crv on wallet: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("cvx on wallet: " +a))
    

    //advance time
    await time.increase(10*86400);
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time....");

    //claim rewards again
    await cvxCrvRewardsContract.earned(userA).then(a=>console.log("current earned: " +a));
    await cvxCrvRewardsContract.getReward({from:userA});
    console.log("getReward()");

    await crv.balanceOf(cvxCrvRewards).then(a=>console.log("crv at cvxCrvRewards " +a));
    await cvxCrvRewardsContract.earned(userA).then(a=>console.log("current earned: " +a));
    await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    await crv.balanceOf(userA).then(a=>console.log("crv on wallet: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("cvx on wallet: " +a))

    //distribute again
    await booster.earmarkRewards(0);
    console.log("earmark 2")
    await crv.balanceOf(cvxCrvRewards).then(a=>console.log("crv at cvxCrvRewards " +a));
    await crv.balanceOf(cvxRewards).then(a=>console.log("crv at cvxRewards " +a));

    await time.increase(3*86400);
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time....");

    //rewards should be earning again
    await cvxCrvRewardsContract.earned(userA).then(a=>console.log("current earned: " +a));
    await cvxCrvRewardsContract.getReward({from:userA});
    console.log("getReward()");

    await crv.balanceOf(cvxCrvRewards).then(a=>console.log("crv at cvxCrvRewards " +a));
    await cvxCrvRewardsContract.earned(userA).then(a=>console.log("current earned: " +a));
    await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    await crv.balanceOf(userA).then(a=>console.log("crv on wallet: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("cvx on wallet: " +a))
  });
});


