// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
const { keccak256: k256 } = require('ethereum-cryptography/keccak');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const rewardFile = jsonfile.readFileSync('./vlcvx_token_rewards.json');

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
    let locker = await CvxLocker.at(contractList.system.locker);
    let cvx = await IERC20.at(contractList.system.cvx);
    let cvxcrv = await IERC20.at(contractList.system.cvxCrv);
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let exchange = await IExchange.at("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
    let exchangerouter = await IUniswapV2Router01.at("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let dai = await IERC20.at("0x6B175474E89094C44Da98b954EedeAC495271d0F");
    let pools = await PoolManager.at(contractList.system.poolManager);

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

    let poolm = await PoolManager.at(contractList.system.poolManager);
    let sfactory = await StashFactoryV2.at(contractList.system.sFactory);

    //1. deploy rescue stash implementation
    let v3impl = await ExtraRewardStashTokenRescue.new();
    console.log("impl at " +v3impl.address);
    //2. deploy rescue token
    let rescueToken = await RescueToken.new({from:deployer});
    console.log("rescue token: " +rescueToken.address)

    //multisig 1. set stash implementation
    await sfactory.setImplementation(addressZero,addressZero,v3impl.address,{from:multisig,gasPrice:0});
    console.log("impl set");
    //multisig 2. revert pool controls
    await poolm.revertControl({from:multisig,gasPrice:0});
    console.log("poolm reverted")
    //multisig 3. add custom pool
    await booster.addPool(rescueToken.address,rescueToken.address,3,{from:multisig,gasPrice:0});
    console.log("pool added");


    //3. set stash receiver to deployer
    var poolLength = await booster.poolLength();
    var poolInfo = await booster.poolInfo(poolLength-1);
    console.log(poolInfo);

    let rstash = await ExtraRewardStashTokenRescue.at(poolInfo.stash);
    console.log("stash: " +rstash.address);
    await rstash.setDistribution(deployer,addressZero,deployer,{from:multisig,gasPrice:0});
    console.log("distribution set to deployer");

    //4. Deploy rewards
    let rewardDistro = await vlCvxExtraRewardDistribution.new();
    console.log("reward deposit: " +rewardDistro.address);

    //multisig 4. set distro (treasury to deployer for now)
    await rstash.setDistribution(deployer,rewardDistro.address,deployer,{from:multisig,gasPrice:0});
    console.log("distro set");

    //multisig 5. add tokens
    let alcx = await IERC20.at("0xdbdb4d16eda451d0503b854cf79d55697f90c8df");
    let spell = await IERC20.at("0x090185f2135308bad17527004364ebcc2d37e5f6");
    let nsbt = await IERC20.at("0x9D79d5B61De59D882ce90125b18F74af650acB93");
    let stkaave = await IERC20.at("0x4da27a545c0c5b758a6ba100e3a049001de870f5");
    //set all to option 1(send to rewards)
    await rstash.setExtraReward(alcx.address,1,{from:multisig,gasPrice:0});
    await rstash.setExtraReward(spell.address,1,{from:multisig,gasPrice:0});
    await rstash.setExtraReward(nsbt.address,1,{from:multisig,gasPrice:0});
    await rstash.setExtraReward(stkaave.address,1,{from:multisig,gasPrice:0});
    console.log("extra rewards set");

    //multisig 6. remove rewards so that tokens get set to treasury as fallback (for now)
    await rstash.setDistribution(deployer,addressZero,deployer,{from:multisig,gasPrice:0});
    console.log("distro set to deployer");

    //5. claim to deployer
    await rstash.claimRewardToken(alcx.address,{from:deployer});
    await rstash.claimRewardToken(spell.address,{from:deployer});
    await rstash.claimRewardToken(nsbt.address,{from:deployer});
    await rstash.claimRewardToken(stkaave.address,{from:deployer});
    console.log("rewards claimed");
    await spell.balanceOf(deployer).then(a=>console.log("deployer spell: "+a));
    await nsbt.balanceOf(deployer).then(a=>console.log("deployer nsbt: "+a));
    await alcx.balanceOf(deployer).then(a=>console.log("deployer alcx: "+a));
    await stkaave.balanceOf(deployer).then(a=>console.log("deployer stkaave: "+a));

    //6. approve
    await alcx.approve(rewardDistro.address,web3.utils.toWei("1000000000.0", "ether"),{from:deployer});
    await spell.approve(rewardDistro.address,web3.utils.toWei("1000000000.0", "ether"),{from:deployer});
    await nsbt.approve(rewardDistro.address,web3.utils.toWei("1000000000.0", "ether"),{from:deployer});

    //7. get rewards for each epoch
    var epochCount = await locker.epochCount();
    epochCount = Number(epochCount)-2;
    console.log("prev epoch: " +epochCount);
    for(var i in rewardFile.spell){
      var rdata = rewardFile.spell[i];
      if(rdata.rewardedEpoch == epochCount){
        await rewardDistro.addReward(spell.address,rdata.value,{from:deployer});
        console.log("addReward for spell " +i);
      }else{
        await rewardDistro.addRewardToEpoch(spell.address,rdata.value,rdata.rewardedEpoch,{from:deployer});
        console.log("addRewardToEpoch for spell " +i);
      }
      await rewardDistro.rewardEpochs(spell.address,rdata.rewardedEpoch).then(a=>console.log("reward epochs " +rdata.rewardedEpoch +": " +a));
      await rewardDistro.rewardData(spell.address,rdata.rewardedEpoch).then(a=>console.log("reward epochs " +rdata.rewardedEpoch +": " +a));
    }

    for(var i in rewardFile.neutrino){
      var rdata = rewardFile.neutrino[i];
      if(rdata.rewardedEpoch == epochCount){
        await rewardDistro.addReward(nsbt.address,rdata.value,{from:deployer});
        console.log("addReward for nsbt " +i);
      }else{
        await rewardDistro.addRewardToEpoch(nsbt.address,rdata.value,rdata.rewardedEpoch,{from:deployer});
        console.log("addRewardToEpoch for nsbt " +i);
      }
      await rewardDistro.rewardEpochs(nsbt.address,rdata.rewardedEpoch).then(a=>console.log("reward epochs " +rdata.rewardedEpoch +": " +a));
      await rewardDistro.rewardData(nsbt.address,rdata.rewardedEpoch).then(a=>console.log("reward epochs " +rdata.rewardedEpoch +": " +a));
    }
    for(var i in rewardFile.alcx){
      var rdata = rewardFile.alcx[i];
      if(rdata.rewardedEpoch == epochCount){
        await rewardDistro.addReward(alcx.address,rdata.value,{from:deployer});
        console.log("addReward for alcx " +i);
      }else{
        await rewardDistro.addRewardToEpoch(alcx.address,rdata.value,rdata.rewardedEpoch,{from:deployer});
        console.log("addRewardToEpoch for alcx " +i);
      }
      await rewardDistro.rewardEpochs(alcx.address,rdata.rewardedEpoch).then(a=>console.log("reward epochs " +rdata.rewardedEpoch +": " +a));
      await rewardDistro.rewardData(alcx.address,rdata.rewardedEpoch).then(a=>console.log("reward epochs " +rdata.rewardedEpoch +": " +a));
    }
    await alcx.balanceOf(rewardDistro.address).then(a=>console.log("rewardDistro.address alcx: "+a));
    await spell.balanceOf(rewardDistro.address).then(a=>console.log("rewardDistro.address spell: "+a));
    await nsbt.balanceOf(rewardDistro.address).then(a=>console.log("rewardDistro.address nsbt: "+a));

    //8 send stkaave to arb
    var stkBal = await stkaave.balanceOf(deployer);
    await stkaave.balanceOf(contractList.system.arbitratorVault).then(a=>console.log("stk on arbi before: "+a));
    await stkaave.transfer(contractList.system.arbitratorVault,stkBal,{from:deployer});
    await stkaave.balanceOf(contractList.system.arbitratorVault).then(a=>console.log("stk on arbi after: "+a));

    await spell.balanceOf(deployer).then(a=>console.log("deployer spell: "+a));
    await nsbt.balanceOf(deployer).then(a=>console.log("deployer nsbt: "+a));
    await alcx.balanceOf(deployer).then(a=>console.log("deployer alcx: "+a));
    await stkaave.balanceOf(deployer).then(a=>console.log("deployer stkaave: "+a));

    //multisig 6. set distro to final settings
    await rstash.setDistribution(deployer,rewardDistro.address,contractList.system.treasury,{from:multisig,gasPrice:0});
    console.log("distro set to rewardDistro");

    //multisig 7. return pool manager
    await booster.setPoolManager(poolm.address, {from:multisig,gasPrice:0});
    var pm = await booster.poolManager();
    console.log("pool manager returned: " +pm);

    //multisig 8. return stash implementation
    await sfactory.setImplementation(addressZero,addressZero,contractList.system.stashv3Impl,{from:multisig,gasPrice:0});
    var simp = await sfactory.v3Implementation();
    console.log("impl set: " +simp.address);

    //multisig 9. turn off stkaave from rescue
    await rstash.setExtraReward(stkaave.address,0,{from:multisig,gasPrice:0});

    return;

  });
});


