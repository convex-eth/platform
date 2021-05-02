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

const IERC20 = artifacts.require("IERC20");


//3. extra rewards, but with v1 gauges

contract("Test masterchef rewards", async accounts => {
  it("should deposit lp tokens and earn cvx", async () => {

    //let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");

    let admin = accounts[0];
    let userA = accounts[1];
    let userB = accounts[2];
    let caller = accounts[3];

    //system
    let voteproxy = await CurveVoterProxy.at(contractList.system.voteProxy);
    let booster = await Booster.deployed();
    let rewardFactory = await RewardFactory.deployed();
    let stashFactory = await StashFactory.deployed();
    let poolManager = await PoolManager.deployed();
    let chef = await ConvexMasterChef.deployed();
    let cvx = await ConvexToken.deployed();
    let cvxCrv = await cvxCrvToken.deployed();
    let crvDeposit = await CrvDepositor.deployed();
    let cvxCrvRewards = await booster.lockRewards();
    let cvxRewards = await booster.stakerRewards();
    let cvxCrvRewardsContract = await BaseRewardPool.at(cvxCrvRewards);
    let cvxRewardsContract = await cvxRewardPool.at(cvxRewards);

    let cvxLP = await IERC20.at(contractList.system.cvxEthSLP);
    let cvxCrvLP = await IERC20.at(contractList.system.cvxCrvCrvSLP);

    //give to different accounts
    var cvxlpBal = await cvxLP.balanceOf(admin);
    await cvxLP.transfer(userA,cvxlpBal);
    var cvxCrvlpBal = await cvxCrvLP.balanceOf(admin);
    await cvxCrvLP.transfer(userB,cvxCrvlpBal);

    await cvxLP.approve(chef.address,cvxlpBal,{from:userA});
    await cvxCrvLP.approve(chef.address,cvxCrvlpBal,{from:userB});

    await chef.deposit(1,cvxlpBal,{from:userA});
    await chef.deposit(0,cvxCrvlpBal,{from:userB});

    await chef.userInfo(1,userA).then(a=>console.log("user a cvxeth: " +JSON.stringify(a)));
    await chef.userInfo(0,userB).then(a=>console.log("user b cvxcrvcrvv: " +JSON.stringify(a)));
    await time.increase(60);
    await time.advanceBlock();
    await chef.pendingCvx(1,userA).then(a=>console.log("user a pending: " +a));
    await chef.pendingCvx(0,userB).then(a=>console.log("user b pending: " +a));

    //advance time
    await time.increase(86400);
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time...");

    await chef.pendingCvx(1,userA).then(a=>console.log("user a pending: " +a));
    await chef.pendingCvx(0,userB).then(a=>console.log("user b pending: " +a));

    //advance time
    await time.increase(86400);
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time...")

    await chef.pendingCvx(1,userA).then(a=>console.log("user a pending: " +a));
    await chef.pendingCvx(0,userB).then(a=>console.log("user b pending: " +a));

    //advance time
    await time.increase(86400);
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time...")

    await chef.pendingCvx(1,userA).then(a=>console.log("user a pending: " +a));
    await chef.pendingCvx(0,userB).then(a=>console.log("user b pending: " +a));

    await chef.claim(1,userA);
    await chef.withdraw(0,cvxCrvlpBal,{from:userB});
    await chef.pendingCvx(1,userA).then(a=>console.log("user a pending: " +a));
    await chef.pendingCvx(0,userB).then(a=>console.log("user b pending: " +a));
    await chef.userInfo(1,userA).then(a=>console.log("user a cvxeth: " +JSON.stringify(a)));
    await chef.userInfo(0,userB).then(a=>console.log("user b cvxcrvcrvv: " +JSON.stringify(a)));

    await cvxLP.balanceOf(userA).then(a=>console.log("user a lp on wallet: " +a));
    await cvxCrvLP.balanceOf(userB).then(a=>console.log("user b lp on wallet: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("user a cvx on wallet: " +a));
    await cvx.balanceOf(userB).then(a=>console.log("user b cvx on wallet: " +a));
  });
});


