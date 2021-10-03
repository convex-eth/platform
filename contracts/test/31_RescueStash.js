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


contract("Rescue tokens from voteProxy", async accounts => {
  it("should rescue tokens", async () => {

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

    //deploy
    // let pfactory = await ProxyFactory.new({from:deployer});
    // console.log("proxy factory: " +pfactory.address);
    let poolm = await PoolManager.at(contractList.system.poolManager);
    let sfactory = await StashFactoryV2.at(contractList.system.sFactory);
    // console.log("stash factory: " +sfactory.address);
    let v3impl = await ExtraRewardStashTokenRescue.new();
    console.log("impl at " +v3impl.address);
    await sfactory.setImplementation(addressZero,addressZero,v3impl.address,{from:multisig,gasPrice:0});
    console.log("impl set");

    //set new stash factory
    // await booster.setFactories(contractList.system.rFactory,sfactory.address,contractList.system.tFactory,{from:multisig,gasPrice:0})
    // console.log("set factories");

    // var fac = await booster.stashFactory();
    // console.log("check if set -> set factory: " +fac);

    let rescueToken = await RescueToken.new({from:deployer});
    //await rescueToken.create({from:deployer});
    console.log("fake token: " +rescueToken.address)

    await poolm.revertControl({from:multisig,gasPrice:0});
    console.log("poolm reverted")

    await booster.addPool(rescueToken.address,rescueToken.address,3,{from:multisig,gasPrice:0});
    console.log("pool added");

    var poolLength = await booster.poolLength();
    var poolInfo = await booster.poolInfo(poolLength-1);
    console.log(poolInfo);

    let rstash = await ExtraRewardStashTokenRescue.at(poolInfo.stash);
    console.log("stash: " +rstash.address);


    //let rdeposit = await RewardDeposit.new(deployer);
    let rdeposit = await vlCvxExtraRewardDistribution.new();
    console.log("reward deposit: " +rdeposit.address);

    await rstash.setDistribution(deployer,rdeposit.address,deployer,{from:multisig,gasPrice:0});
    console.log("distro set");

    let alcx = await IERC20.at("0xdbdb4d16eda451d0503b854cf79d55697f90c8df");
    let spell = await IERC20.at("0x090185f2135308bad17527004364ebcc2d37e5f6");

    await rstash.setExtraReward(alcx.address,2,{from:multisig,gasPrice:0}); //alcx
    await rstash.setExtraReward(spell.address,1,{from:multisig,gasPrice:0}); //spell
    console.log("stash rewards added");

    await alcx.balanceOf(contractList.system.voteProxy).then(a=>console.log("trapped alcx: "+a));
    await spell.balanceOf(contractList.system.voteProxy).then(a=>console.log("trapped spell: "+a));

    await rstash.claimRewardToken(alcx.address,{from:deployer});
    await rstash.setExtraReward(spell.address,0,{from:multisig,gasPrice:0}); //spell
    console.log("set spell off")
    await rstash.claimRewardToken(spell.address,{from:deployer}).catch(a=>console.log("-> revert: catch fail claim"));
    await rstash.setExtraReward(spell.address,1,{from:multisig,gasPrice:0}); //spell
    console.log("set spell on")
    await rstash.claimRewardToken(spell.address,{from:deployer});
    console.log("\nrescue tokens...\n");

    await alcx.balanceOf(contractList.system.voteProxy).then(a=>console.log("trapped alcx: "+a));
    await spell.balanceOf(contractList.system.voteProxy).then(a=>console.log("trapped spell: "+a));
    await alcx.balanceOf(rdeposit.address).then(a=>console.log("reward alcx: "+a));
    await spell.balanceOf(rdeposit.address).then(a=>console.log("reward spell: "+a));
    await alcx.balanceOf(deployer).then(a=>console.log("treasury alcx: "+a));
    await spell.balanceOf(deployer).then(a=>console.log("treasury spell: "+a));

    await rdeposit.claimableRewards(userZ,spell.address).then(a=>console.log("claimable spell: " +a));
    await rdeposit.claimableRewards(userZ,alcx.address).then(a=>console.log("claimable alcx: " +a));
    await advanceTime(day*7);
    await rdeposit.claimableRewards(userZ,spell.address).then(a=>console.log("claimable spell: " +a));
    await rdeposit.claimableRewards(userZ,alcx.address).then(a=>console.log("claimable alcx: " +a));
    await locker.checkpointEpoch();
    console.log("checkpoint epoch");
    await rdeposit.claimableRewards(userZ,spell.address).then(a=>console.log("claimable spell: " +a));
    await rdeposit.claimableRewards(userZ,alcx.address).then(a=>console.log("claimable alcx: " +a));

  });
});


