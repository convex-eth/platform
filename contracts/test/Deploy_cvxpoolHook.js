// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const CrvDepositor = artifacts.require("CrvDepositor");
const ConvexToken = artifacts.require("ConvexToken");
const cvxCrvToken = artifacts.require("cvxCrvToken");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const ConvexStakingWrapper = artifacts.require("ConvexStakingWrapper");
const IERC20 = artifacts.require("IERC20");
const ChefRewardHook = artifacts.require("ChefRewardHook");
const ChefToken = artifacts.require("ChefToken");
const ConvexMasterChef = artifacts.require("ConvexMasterChef");
const Multicaller = artifacts.require("Multicaller");
const ExtraRewardStashV3 = artifacts.require("ExtraRewardStashV3");
const ProxyFactory = artifacts.require("ProxyFactory");

contract("Deploy cvx pool hook", async accounts => {
  it("should deploy contracts", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"

    //system
    let booster = await Booster.at(contractList.system.booster);
    let voteproxy = await CurveVoterProxy.at(contractList.system.voteProxy);
    let cvx = await ConvexToken.at(contractList.system.cvx);
    let crv = await IERC20.at(contractList.curve.crv);
    let cvxCrv = await cvxCrvToken.at(contractList.system.cvxCrv);
    let cvxCrvLP = await IERC20.at(contractList.system.cvxCrvCrvSLP);
    let chef = await ConvexMasterChef.at(contractList.system.chef);
    let multicaller = await Multicaller.at("0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441");
    let stash = await ExtraRewardStashV3.at("0x679df29F380F1BEc31657cd6a5638aec4AEA3300");

    var newcvxpid = 6;
    var oldcvxPid = 2;
    var cvxcrvPid = 4;
    var treasuryPid = 5;

    //create a reward hook
    let pfactory = await ProxyFactory.at(contractList.system.proxyFactory);
    let clone = await pfactory.clone.call(contractList.system.chefRewardHookTreasury);
    console.log("clone: " +clone);
    let clonetx = await pfactory.clone(contractList.system.chefRewardHookTreasury);
    var hook = await ChefRewardHook.at(clone);
    console.log("reward hook: " +hook.address);

    //create deposit token
    var cheftoken = await ChefToken.new({from:deployer});
    console.log("chef token: " +cheftoken.address);
    await cheftoken.create({from:deployer});
    await cheftoken.approve(hook.address,web3.utils.toWei("1000.0", "ether"),{from:deployer});
    
    return;

    await chef.add(1000,cheftoken.address,addressZero,false,{from:multisig,gasPrice:0});
    await chef.set(oldcvxPid,0,addressZero,true, false,{from:multisig,gasPrice:0});
    await chef.set(cvxcrvPid,1000,addressZero,true, false,{from:multisig,gasPrice:0});
    await chef.set(treasuryPid,8000,addressZero,true, false,{from:multisig,gasPrice:0});
    await stash.setRewardHook(hook.address,{from:multisig,gasPrice:0});
    
    await hook.init(stash.address, newcvxpid, cheftoken.address,{from:deployer});

    let rewards = await BaseRewardPool.at("0x834B9147Fd23bF131644aBC6e557Daf99C5cDa15");
    await cvx.balanceOf(hook.address).then(a=>console.log("cvx on hook: " +a));
    await cvx.balanceOf(rewards.address).then(a=>console.log("cvx on rewards: " +a));

    await time.increase(86400);
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time...");

    await cvx.balanceOf(hook.address).then(a=>console.log("cvx on hook: " +a));
    await cvx.balanceOf(rewards.address).then(a=>console.log("cvx on rewards: " +a));
    await rewards.rewardRate().then(a=>console.log("reward rate: " +a));
    await booster.earmarkRewards(64);
    await time.increase(86400);
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time...");
    await booster.earmarkRewards(64);
    await cvx.balanceOf(hook.address).then(a=>console.log("cvx on hook: " +a));
    await cvx.balanceOf(rewards.address).then(a=>console.log("cvx on rewards: " +a));
    await rewards.rewardRate().then(a=>console.log("reward rate: " +a));
    console.log("finish");
    return;
  });
});


