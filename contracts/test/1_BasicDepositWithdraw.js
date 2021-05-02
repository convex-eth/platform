const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');

var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const CrvDepositor = artifacts.require("CrvDepositor");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const ExtraRewardStashV2 = artifacts.require("ExtraRewardStashV2");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const VirtualBalanceRewardPool = artifacts.require("VirtualBalanceRewardPool");
const cvxRewardPool = artifacts.require("cvxRewardPool");
const ConvexToken = artifacts.require("ConvexToken");
const cvxCrvToken = artifacts.require("cvxCrvToken");
const StashFactory = artifacts.require("StashFactory");
const RewardFactory = artifacts.require("RewardFactory");

const IExchange = artifacts.require("IExchange");
const ICurveFi = artifacts.require("I3CurveFi");
const IERC20 = artifacts.require("IERC20");


contract("BasicDepositWithdraw", async accounts => {
  it("should test basic deposits and withdrawals", async () => {
    
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let dai = await IERC20.at("0x6b175474e89094c44da98b954eedeac495271d0f");
    let exchange = await IExchange.at("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
    let threecrvswap = await ICurveFi.at("0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7");
    let threeCrv = await IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
    let threeCrvGauge = "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A";
    let threeCrvSwap = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
    let vecrvFeeDistro = "0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc";

    let admin = accounts[0];
    let userA = accounts[1];
    let userB = accounts[2];
    let caller = accounts[3];

    //system setup
    let voteproxy = await CurveVoterProxy.at(contractList.system.voteProxy);
    let booster = await Booster.deployed();
    let voterewardFactoryproxy = await RewardFactory.deployed();
    let stashFactory = await StashFactory.deployed();
    let cvx = await ConvexToken.deployed();
    let cvxCrv = await cvxCrvToken.deployed();
    let crvDeposit = await CrvDepositor.deployed();
    let cvxCrvRewards = await booster.lockRewards();
    let cvxRewards = await booster.stakerRewards();

    var poolId = contractList.pools.find(pool => pool.name == "3pool").id;
    console.log("pool id: " +poolId);
    let poolinfo = await booster.poolInfo(poolId);
    let rewardPoolAddress = poolinfo.crvRewards;
    let rewardPool = await BaseRewardPool.at(rewardPoolAddress);
    let depositToken = await IERC20.at(poolinfo.token);
    console.log("pool lp token " +poolinfo.lptoken);
    console.log("pool gauge " +poolinfo.gauge);
    console.log("pool reward contract at " +rewardPool.address);
    let starttime = await time.latest();
    console.log("current block time: " +starttime)

    //exchange weth for dai
    await weth.sendTransaction({value:web3.utils.toWei("2.0", "ether"),from:userA});
    let startingWeth = await weth.balanceOf(userA);
    await weth.approve(exchange.address,startingWeth,{from:userA});
    await exchange.swapExactTokensForTokens(startingWeth,0,[weth.address,dai.address],userA,starttime+3000,{from:userA});
    let startingDai = await dai.balanceOf(userA);

    //deposit dai for 3crv
    await dai.approve(threecrvswap.address,startingDai,{from:userA});
    await threecrvswap.add_liquidity([startingDai,0,0],0,{from:userA});
    let startingThreeCrv = await threeCrv.balanceOf(userA);
    console.log("3crv: " +startingThreeCrv);
 
    //approve
    await threeCrv.approve(booster.address,0,{from:userA});
    await threeCrv.approve(booster.address,startingThreeCrv,{from:userA});

    //first try depositing too much
    console.log("try depositing too much");
    await expectRevert(
        booster.deposit(poolId,startingThreeCrv+1,false,{from:userA}),
        "SafeERC20");
    console.log(" ->reverted");

    //deposit a small portion
    await booster.deposit(poolId,web3.utils.toWei("500.0", "ether"),false,{from:userA});
    console.log("deposited portion");

    //check wallet balance and deposit credit
    await threeCrv.balanceOf(userA).then(a=>console.log("wallet balance: " +a));
    await depositToken.balanceOf(userA).then(a=>console.log("lp balance: " +a));
    //should not be staked
    await rewardPool.balanceOf(userA).then(a=>console.log("staked balance: " +a));
    //should be staked on curve even if not staked in rewards
    await voteproxy.balanceOfPool(threeCrvGauge).then(a=>console.log("gauge balance: " +a));

    //deposit reset of funds
    await booster.depositAll(poolId,false,{from:userA});
    console.log("deposited all");

    //check wallet balance and deposit credit
    await threeCrv.balanceOf(userA).then(a=>console.log("wallet balance: " +a));
    await depositToken.balanceOf(userA).then(a=>console.log("lp balance: " +a));

    //should not be staked
    await rewardPool.balanceOf(userA).then(a=>console.log("staked balance: " +a));
    //check if staked on curve
    await voteproxy.balanceOfPool(threeCrvGauge).then(a=>console.log("gauge balance: " +a));

    //withdraw a portion
    await booster.withdraw(poolId,web3.utils.toWei("500.0", "ether"),{from:userA});
    console.log("withdrawn portion");

    //check wallet increased and that deposit credit decreased
    await threeCrv.balanceOf(userA).then(a=>console.log("wallet balance: " +a));
    await depositToken.balanceOf(userA).then(a=>console.log("lp balance: " +a));

    //withdraw too much error check
    // this will error on the gauge not having enough balance
    console.log("try withdraw too much");
    await expectRevert(
        booster.withdraw(poolId,startingThreeCrv+1,{from:userA}),
        "revert");
    console.log(" ->reverted (fail on unstake)");


    ///add funds for user B
    await weth.sendTransaction({value:web3.utils.toWei("2.0", "ether"),from:userB});
    await weth.approve(exchange.address,web3.utils.toWei("2.0", "ether"),{from:userB});
    await exchange.swapExactTokensForTokens(web3.utils.toWei("2.0", "ether"),0,[weth.address,dai.address],userB,starttime+3000,{from:userB});
    let userBDai = await dai.balanceOf(userB);
    await dai.approve(threecrvswap.address,userBDai,{from:userB});
    await threecrvswap.add_liquidity([userBDai,0,0],0,{from:userB});
    let userBThreeCrv = await threeCrv.balanceOf(userB);
    await threeCrv.approve(booster.address,0,{from:userB});
    await threeCrv.approve(booster.address,userBThreeCrv,{from:userB});
    await booster.depositAll(poolId,false,{from:userB});
    await depositToken.balanceOf(userB).then(a=>console.log("lp balance: " +a));

    //withdraw too much error check again
    // this will error on the deposit balance not being high enough (gauge balance check passes though because of userB)
    //update: ordering of unstake and burn changed so burn is always first.
    console.log("try withdraw too much(2)");
    await expectRevert(
        booster.withdraw(poolId,startingThreeCrv+1,{from:userA}),
        "revert");
    console.log(" ->reverted (fail on user funds)");

    await voteproxy.balanceOfPool(threeCrvGauge).then(a=>console.log("gauge balance: " +a));
    
    //withdraw all properly
    await booster.withdrawAll(poolId,{from:userA});
    console.log("withdrawAll A");

    //all balance should be back on wallet and equal to starting value
    await threeCrv.balanceOf(userA).then(a=>console.log("userA wallet balance: " +a));
    await depositToken.balanceOf(userA).then(a=>console.log("userA lp balance: " +a));
    await rewardPool.balanceOf(userA).then(a=>console.log("userA staked balance: " +a));
    await voteproxy.balanceOfPool(threeCrvGauge).then(a=>console.log("gauge balance: " +a));
  
    //withdraw all properly
    await booster.withdrawAll(poolId,{from:userB});
    console.log("withdrawAll B");
    await threeCrv.balanceOf(userB).then(a=>console.log("userB wallet balance: " +a));
    await depositToken.balanceOf(userB).then(a=>console.log("userB lp balance: " +a));
    await rewardPool.balanceOf(userB).then(a=>console.log("userB staked balance: " +a));
    await voteproxy.balanceOfPool(threeCrvGauge).then(a=>console.log("gauge balance: " +a));
  });
});


