const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');


const Booster = artifacts.require("Booster");
const CrvDepositor = artifacts.require("CrvDepositor");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
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
const ICurveFi = artifacts.require("I3CurveFi");
const IERC20 = artifacts.require("IERC20");



contract("RewardsTest", async accounts => {
  it("should deposit and receive crv and cvx rewards", async () => {

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
    //system setup
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

    let poolinfo = await booster.poolInfo(0);
    let rewardPoolAddress = poolinfo.crvRewards;
    let rewardPool = await ManagedRewardPool.at(rewardPoolAddress);
    console.log("pool lp token " +poolinfo.lptoken);
    console.log("pool gauge " +poolinfo.gauge);
    console.log("pool reward contract at " +rewardPool.address);

    //increase time so that cvx rewards start
    await time.increase(10*86400);
    await time.advanceBlock();
    console.log("advance time...");

    let starttime = await time.latest();
    console.log("current block time: " +starttime)
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //send cvx to user b to stake
    await cvx.transfer(userB,1000);
    await cvx.approve(cvxRewardsContract.address,0,{from:userB});
    await cvx.approve(cvxRewardsContract.address,1000,{from:userB});
    await cvxRewardsContract.stakeAll({from:userB});
    await cvxRewardsContract.balanceOf(userB).then(a=>console.log("user b staked cvx: " +a));

    //exchange for dai and deposit for 3crv
    await weth.sendTransaction({value:web3.utils.toWei("2.0", "ether"),from:userA});
    let startingWeth = await weth.balanceOf(userA);
    await weth.approve(exchange.address,startingWeth,{from:userA});
    await exchange.swapExactTokensForTokens(startingWeth,0,[weth.address,dai.address],userA,starttime+3000,{from:userA});
    let startingDai = await dai.balanceOf(userA);
    await dai.approve(threecrvswap.address,startingDai,{from:userA});
    await threecrvswap.add_liquidity([startingDai,0,0],0,{from:userA});
    let startingThreeCrv = await threeCrv.balanceOf(userA);
    console.log("3crv: " +startingThreeCrv);
 
    //approve
    await threeCrv.approve(booster.address,0,{from:userA});
    await threeCrv.approve(booster.address,startingThreeCrv,{from:userA});

    //deposit all for user a
    await booster.depositAll(0,{from:userA});

    //check deposited balance, reward balance, and earned amount(earned should be 0 still)
    await booster.userPoolInfo(0,userA).then(a=>console.log("deposited lp: " +a));
    await rewardPool.balanceOf(userA).then(a=>console.log("reward balance: " +a));
    await rewardPool.earned(userA).then(a=>console.log("rewards earned(unclaimed): " +a));

    //increase time
    await time.increase(86400);
    await time.advanceBlock();
    console.log("advance time...");
    await time.latest().then(a=>console.log("current block time: " +a));
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //check pre reward balances
    await crv.balanceOf(userA).then(a=>console.log("userA crv: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("userA cvx: " +a))

    //claim crv rewards from gauge and send to reward contract
    await booster.earmarkRewards(0,{from:caller});
    console.log("earmarked");

    //check crv at various addresses, should all be at reward contracts(3) and caller address(gas incentive)
    await crv.balanceOf(voteproxy.address).then(a=>console.log("crv at voteproxy " +a));
    await crv.balanceOf(booster.address).then(a=>console.log("crv at booster " +a));
    await crv.balanceOf(caller).then(a=>console.log("crv at caller " +a));
    await crv.balanceOf(rewardPool.address).then(a=>console.log("crv at reward pool " +a));
    await crv.balanceOf(cCrvRewards).then(a=>console.log("crv at cCrvRewards " +a));
    await crv.balanceOf(cvxRewards).then(a=>console.log("crv at cvxRewards " +a));
    await crv.balanceOf(userA).then(a=>console.log("userA crv: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("userA cvx: " +a))

    //earned should still be 0
    await rewardPool.earned(userA).then(a=>console.log("rewards earned(unclaimed): " +a));

    await time.increase(86400);
    await time.advanceBlock();
    console.log("advance time...");
    await time.latest().then(a=>console.log("current block time: " +a));
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //should now have earned amount
    await rewardPool.earned(userA).then(a=>console.log("rewards earned(unclaimed): " +a));

    //claim reward, should receive crv and cvx (cvx should be about half)
    await rewardPool.getReward({from:userA});
    console.log("getReward()");
    await crv.balanceOf(userA).then(a=>console.log("userA crv: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("userA cvx: " +a))
    await crv.balanceOf(rewardPool.address).then(a=>console.log("rewards left: " +a));

    //advance time 
    await time.increase(10*86400);
    await time.advanceBlock();
    console.log("advance time...");
    await time.latest().then(a=>console.log("current block time: " +a));
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //check earned again
    await rewardPool.earned(userA).then(a=>console.log("rewards earned(unclaimed): " +a));

    //claim rewards again
    await rewardPool.getReward({from:userA});
    console.log("getReward()");
    await crv.balanceOf(userA).then(a=>console.log("userA crv: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("userA cvx: " +a))
    await rewardPool.earned(userA).then(a=>console.log("rewards earned(unclaimed): " +a));

    //check rewards left
    await crv.balanceOf(rewardPool.address).then(a=>console.log("rewards left: " +a));

    //earmark again
    await booster.earmarkRewards(0,{from:caller});
    console.log("earmarked (2)");
    //crv on reward contract should have increased again
    await crv.balanceOf(rewardPool.address).then(a=>console.log("rewards left: " +a));
    await rewardPool.earned(userA).then(a=>console.log("rewards earned(unclaimed): " +a));

    //advance time some more
    await time.increase(86400);
    await time.advanceBlock();
    console.log("advance time...");
    await time.latest().then(a=>console.log("current block time: " +a));
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //claim rewards again
    await crv.balanceOf(rewardPool.address).then(a=>console.log("rewards left: " +a))
    await rewardPool.earned(userA).then(a=>console.log("rewards earned(unclaimed): " +a));
    await rewardPool.getReward({from:userA});
    console.log("getReward()");
    await crv.balanceOf(userA).then(a=>console.log("userA crv: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("userA cvx: " +a))
    await crv.balanceOf(rewardPool.address).then(a=>console.log("rewards left: " +a));

    //advance time
    await time.increase(10*86400);
    await time.advanceBlock();
    console.log("advance time...");
    await time.latest().then(a=>console.log("current block time: " +a));
    await time.latestBlock().then(a=>console.log("current block: " +a));


    //withdraw should also claim rewards
    await crv.balanceOf(userA).then(a=>console.log("userA crv: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("userA cvx: " +a))
    await rewardPool.earned(userA).then(a=>console.log("rewards earned(unclaimed): " +a));
    await booster.withdrawAll(0,{from:userA});
    console.log("withdrawAll()");

    await threeCrv.balanceOf(userA).then(a=>console.log("userA 3crv final: " +a));
    await booster.userPoolInfo(0,userA).then(a=>console.log("final deposited lp: " +a));
    await crv.balanceOf(cCrvRewards).then(a=>console.log("crv at cCrvRewards " +a));
    await crv.balanceOf(cvxRewards).then(a=>console.log("crv at cvxRewards " +a));
    await rewardPool.balanceOf(userA).then(a=>console.log("reward pool balance of user(==0): " +a));
    await crv.balanceOf(userA).then(a=>console.log("userA crv: " +a))
    await cvx.balanceOf(userA).then(a=>console.log("userA cvx: " +a))

    //meanwhile user B should be receiving ccrv rewards via cvx staking
    await crv.balanceOf(userB).then(a=>console.log("userB crv(before claim): " +a))
    await cCrv.balanceOf(userB).then(a=>console.log("userB cCrv(before claim): " +a))
    await cvxRewardsContract.earned(userB).then(a=>console.log("userB earned: " +a));
    await cvxRewardsContract.getReward({from:userB});
    await crv.balanceOf(userB).then(a=>console.log("userB crv(after claim): " +a))
    await cCrv.balanceOf(userB).then(a=>console.log("userB cCrv(after claim): " +a))
  });
});


