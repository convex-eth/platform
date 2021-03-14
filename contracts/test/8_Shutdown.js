const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');


const Booster = artifacts.require("Booster");
const CrvDepositor = artifacts.require("CrvDepositor");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const ExtraRewardStashV2 = artifacts.require("ExtraRewardStashV2");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const VirtualBalanceRewardPool = artifacts.require("VirtualBalanceRewardPool");
//const cCrvRewardPool = artifacts.require("cCrvRewardPool");
const cvxRewardPool = artifacts.require("cvxRewardPool");
const ConvexToken = artifacts.require("ConvexToken");
const cCrvToken = artifacts.require("cCrvToken");
const StashFactory = artifacts.require("StashFactory");
const RewardFactory = artifacts.require("RewardFactory");

const IExchange = artifacts.require("IExchange");
const ICurveFi = artifacts.require("I3CurveFi");
const IERC20 = artifacts.require("IERC20");



contract("Shutdown Test", async accounts => {
  it("should deposit, shutdown, withdraw, upgrade, redeposit", async () => {

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
    let voterewardFactoryproxy = await RewardFactory.deployed();
    let stashFactory = await StashFactory.deployed();
    let cvx = await ConvexToken.deployed();
    let cCrv = await cCrvToken.deployed();
    let crvDeposit = await CrvDepositor.deployed();
    let cCrvRewards = await booster.lockRewards();
    let cvxRewards = await booster.stakerRewards();
    let cCrvRewardsContract = await BaseRewardPool.at(cCrvRewards);
    let cvxRewardsContract = await cvxRewardPool.at(cvxRewards);

    

    let starttime = await time.latest();
    console.log("current block time: " +starttime)
    await time.latestBlock().then(a=>console.log("current block: " +a));
    
    //get 3crv
    await weth.sendTransaction({value:web3.utils.toWei("2.0", "ether"),from:userA});
    let startingWeth = await weth.balanceOf(userA);
    await weth.approve(exchange.address,startingWeth,{from:userA});
    await exchange.swapExactTokensForTokens(startingWeth,0,[weth.address,dai.address],userA,starttime+3000,{from:userA});
    let startingDai = await dai.balanceOf(userA);
    await dai.approve(threecrvswap.address,startingDai,{from:userA});
    await threecrvswap.add_liquidity([startingDai,0,0],0,{from:userA});
    let startingThreeCrv = await threeCrv.balanceOf(userA);
    console.log("3crv: " +startingThreeCrv);
 

    //deposit, funds move to gauge
    await threeCrv.approve(booster.address,0,{from:userA});
    await threeCrv.approve(booster.address,startingThreeCrv,{from:userA});
    await booster.deposit(0,10000,true,{from:userA});
    await threeCrv.balanceOf(userA).then(a=>console.log("3crv on wallet: " +a));
    await rewardPool.balanceOf(userA).then(a=>console.log("deposited lp: " +a));
    await threeCrv.balanceOf(booster.address).then(a=>console.log("3crv at booster " +a));
    await voteproxy.balanceOfPool(threeCrvGauge).then(a=>console.log("3crv on gauge " +a));

    //shutdown, funds move back to booster(depositor)
    await booster.shutdownSystem(true,{from:admin});
    console.log("system shutdown");
    await threeCrv.balanceOf(userA).then(a=>console.log("3crv on wallet: " +a));
    await booster.userPoolInfo(0,userA).then(a=>console.log("deposited lp: " +a));
    await threeCrv.balanceOf(booster.address).then(a=>console.log("3crv at booster " +a));
    await voteproxy.balanceOfPool(threeCrvGauge).then(a=>console.log("3crv on gauge " +a));

    //try to deposit while in shutdown state, will revert
    console.log("try deposit again");
    await booster.deposit(0,10000,true,{from:userA}).catch(a=>console.log("--> deposit reverted"));

    //withdraw lp tokens from old booster
    console.log("withdraw")
    await booster.withdrawAll(0,{from:userA});
    await threeCrv.balanceOf(userA).then(a=>console.log("3crv on wallet: " +a));
    await booster.userPoolInfo(0,userA).then(a=>console.log("deposited lp: " +a));
    await threeCrv.balanceOf(booster.address).then(a=>console.log("3crv at booster " +a));
    await voteproxy.balanceOfPool(threeCrvGauge).then(a=>console.log("3crv on gauge " +a));


    //relaunch the system and connect to voteproxy and cvx contracts
    
    //first booster and set as operator on vote proxy
    console.log("create new booster and factories")
    let booster2 = await Booster.new(voteproxy.address);
    await voteproxy.setOperator(booster2.address);
    console.log("set new booster as voteproxy operator");

    //create factories
    let rewardFactory2 = await RewardFactory.new(booster2.address);
    let stashFactory2 = await StashFactory.new(booster2.address, rewardFactory2.address );
    await booster2.setFactories(rewardFactory2.address, stashFactory2.address);
    console.log("factories set");

    //set minter(cvx)
    await booster2.setMinter(cvx.address);
    console.log("minter set");
    //tell cvx to update its operator(mint role)
    await cvx.updateOperator();
    console.log("cvx operater updated");

    //create new reward pools for staking ccrv and cvx
    let cCrvRewardsContract2 = await cCrvRewardPool.new(cCrv.address,crv.address,0,booster2.address,rewardFactory2.address);
    console.log("create new ccrv reward pool");
    let cvxRewardsContract2 = await cvxRewardPool.new(cvx.address,crv.address,crvDeposit.address,cCrv.address,0,booster2.address,admin);
    console.log("create new cvx reward pool");
    await booster2.setRewardContracts(cCrvRewardsContract2.address,cvxRewardsContract2.address);
    console.log("set stake reward contracts");

    //set vecrv info
    let vecrvFeeDistro = "0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc";
    await booster2.setFeeInfo(vecrvFeeDistro,threeCrv.address);
    console.log("vecrv fee info set");

    //add 3crv pool
    await booster2.addPool(threeCrvSwap,threeCrvGauge,0);
    console.log("3crv pool added");

    let poolinfo = await booster2.poolInfo(0);
    let rewardPoolAddress = poolinfo.crvRewards;
    let rewardPool = await BaseRewardPool.at(rewardPoolAddress);
    console.log("pool lp token " +poolinfo.lptoken);
    console.log("pool gauge " +poolinfo.gauge);
    console.log("pool reward contract at " +rewardPool.address);

    //deposit to new booster, tokens move to gauge
    let threeCrvbalance = await threeCrv.balanceOf(userA);
    await threeCrv.approve(booster2.address,0,{from:userA});
    await threeCrv.approve(booster2.address,threeCrvbalance,{from:userA});
    await booster2.depositAll(0,true,{from:userA});
    await threeCrv.balanceOf(userA).then(a=>console.log("3crv on wallet: " +a));
    await rewardPool.balanceOf(userA).then(a=>console.log("deposited lp: " +a));
    await threeCrv.balanceOf(booster2.address).then(a=>console.log("3crv at booster2 " +a));
    await voteproxy.balanceOfPool(threeCrvGauge).then(a=>console.log("3crv on gauge " +a));

    //increase time
    await time.increase(15*86400);
    await time.advanceBlock();
    console.log("advance time...");

    await time.latest().then(a=>console.log("current block time: " +a));
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //distribute rewards
    await booster2.earmarkRewards(0,{from:caller});
    console.log("rewards earmarked");

    //3crv reward pool for crv
    await rewardPool.balanceOf(userA).then(a=>console.log("reward balance: " +a));
    await rewardPool.earned(userA).then(a=>console.log("rewards earned(unclaimed): " +a));
    
    //increase time
    await time.increase(4*86400);
    await time.advanceBlock();

    //check earned balances again
    await rewardPool.balanceOf(userA).then(a=>console.log("reward balance: " +a));
    await rewardPool.earned(userA).then(a=>console.log("rewards earned(unclaimed): " +a));
    await crv.balanceOf(userA).then(a=>console.log("userA crv: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("userA cvx: " +a))
    
    //claim rewards
    await rewardPool.getReward({from:userA});
    console.log("getReward()");
    await crv.balanceOf(userA).then(a=>console.log("userA crv: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("userA cvx: " +a))
    await crv.balanceOf(rewardPool.address).then(a=>console.log("rewards left: " +a));

  });
});


