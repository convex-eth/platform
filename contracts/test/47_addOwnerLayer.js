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
const IERC20 = artifacts.require("IERC20");
const CvxCrvStakingWrapper = artifacts.require("CvxCrvStakingWrapper");
const ExtraRewardStashV3 = artifacts.require("ExtraRewardStashV3");
const BoosterOwner = artifacts.require("BoosterOwner");
const StashTokenWrapper = artifacts.require("StashTokenWrapper");
const VirtualBalanceRewardPool = artifacts.require("VirtualBalanceRewardPool");
const PoolManagerV4 = artifacts.require("PoolManagerV4");
const DepositToken = artifacts.require("DepositToken");

const BoosterPlaceholder = artifacts.require("BoosterPlaceholder");
const BoosterOwnerSecondary = artifacts.require("BoosterOwnerSecondary");
const VoterProxyOwner = artifacts.require("VoterProxyOwner");
const PoolManagerSecondaryProxy = artifacts.require("PoolManagerSecondaryProxy");
const PoolManagerTertiaryProxy = artifacts.require("PoolManagerTertiaryProxy");

const IPlaceholder = artifacts.require("IPlaceholder");
const IBoosterOwner = artifacts.require("IBoosterOwner");
const IStashFactory = artifacts.require("IStashFactory");
const StashFactoryV2 = artifacts.require("StashFactoryV2");
const IRescueStash = artifacts.require("IRescueStash");
const IStashTokenWrapper = artifacts.require("IStashTokenWrapper");
const IStash = artifacts.require("IStash");
const ExtraRewardStashTokenRescue = artifacts.require("ExtraRewardStashTokenRescue");
const VoteDelegateExtension = artifacts.require("VoteDelegateExtension");


const addAccount = async (address) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_addAccount",
        params: [address, "passphrase"],
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};

const unlockAccount = async (address) => {
  await addAccount(address);
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "personal_unlockAccount",
        params: [address, "passphrase"],
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};

const unlockAccountHardhat = async (address) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "hardhat_impersonateAccount",
        params: [address],
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};

const setNoGas = async () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "hardhat_setNextBlockBaseFeePerGas",
        params: ["0x0"],
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};

const send = payload => {
  if (!payload.jsonrpc) payload.jsonrpc = '2.0';
  if (!payload.id) payload.id = new Date().getTime();

  return new Promise((resolve, reject) => {
    web3.currentProvider.send(payload, (error, result) => {
      if (error) return reject(error);

      return resolve(result);
    });
  });
};

/**
 *  Mines a single block in Ganache (evm_mine is non-standard)
 */
const mineBlock = () => send({ method: 'evm_mine' });

/**
 *  Gets the time of the last block.
 */
const currentTime = async () => {
  const { timestamp } = await web3.eth.getBlock('latest');
  return timestamp;
};

/**
 *  Increases the time in the EVM.
 *  @param seconds Number of seconds to increase the time by
 */
const fastForward = async seconds => {
  // It's handy to be able to be able to pass big numbers in as we can just
  // query them from the contract, then send them back. If not changed to
  // a number, this causes much larger fast forwards than expected without error.
  if (BN.isBN(seconds)) seconds = seconds.toNumber();

  // And same with strings.
  if (typeof seconds === 'string') seconds = parseFloat(seconds);

  await send({
    method: 'evm_increaseTime',
    params: [seconds],
  });

  await mineBlock();
};

contract("Test new stash and reward wrapper", async accounts => {
  it("should complete without errors", async () => {

    let deployer = contractList.system.deployer;
    let multisig = contractList.system.multisig;
    let addressZero = "0x0000000000000000000000000000000000000000"


    //system
    let booster = await Booster.at(contractList.system.booster);
    let voteproxy = await CurveVoterProxy.at(contractList.system.voteProxy);
    let crvDeposit = await CrvDepositor.at(contractList.system.crvDepositor);
    let vanillacvxCrv = await BaseRewardPool.at(contractList.system.cvxCrvRewards);
    let cvx = await ConvexToken.at(contractList.system.cvx);
    let crv = await IERC20.at(contractList.curve.crv);
    let threeCrv = await IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
    let cvxCrv = await IERC20.at(contractList.system.cvxCrv);
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
    userNames[userZ] = "Z";

    const advanceTime = async (secondsElaspse) => {
      // await time.increase(secondsElaspse);
      // await time.advanceBlock();
      await fastForward(secondsElaspse);
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");

      var periodend = await vanillacvxCrv.periodFinish();
      var now = Number( (new Date()).getTime() / 1000 ).toFixed(0);
      // console.log("period end: " +Number(periodend))
      // console.log("now: " +now)
      if(Number(periodend) < now){
        await booster.earmarkRewards(100);
        console.log("\n  >>>>  harvested");
      }
    }
    const day = 86400;

    // var poolmanagerold = await PoolManagerV4.at("0x9E398B61a7d1B320b8510f0873bA071AcF92BD1b");
    var poolmanagerold = await PoolManagerV4.at(contractList.system.poolManager);
    console.log("old pool manager: " +poolmanagerold.address);

    // await unlockAccount(multisig);
    await unlockAccountHardhat(multisig);
    await unlockAccountHardhat(deployer);
    console.log("unlocked accounts");


    // console.log("\n\n----- new deployment -----\n");

    // var secondPoolManager = await PoolManagerSecondaryProxy.at(contractList.system.poolManagerSecondaryProxy);

    // //deploy
    // var primaryowner = await BoosterOwner.at(contractList.system.boosterOwner);

    // // await setNoGas();
    // var secondaryOwner = await BoosterOwnerSecondary.new({from:deployer});
    // console.log("secondary owner: " +secondaryOwner.address);

    // // await setNoGas();
    // var thirdPoolManager = await PoolManagerTertiaryProxy.new(secondaryOwner.address,{from:deployer});
    // console.log("third pool manager proxy: " +thirdPoolManager.address);

    // var boosterplaceholder = await BoosterPlaceholder.new({from:deployer});
    // console.log("boosterplaceholder: " +boosterplaceholder.address);

    // var voteOwner = await VoterProxyOwner.new(boosterplaceholder.address,{from:deployer});
    // console.log("VoterProxyOwner: " +voteOwner.address);

    // var poolmanager = await PoolManagerV4.new(thirdPoolManager.address,{from:deployer});
    // console.log("PoolManagerV4: " +poolmanager.address);

    console.log("\n\n----- use live deployment -----\n");

    var secondPoolManager = await PoolManagerSecondaryProxy.at(contractList.system.poolManagerSecondaryProxy);

    //deploy
    var primaryowner = await BoosterOwner.at(contractList.system.boosterOwner);

    // await setNoGas();
    var secondaryOwner = await BoosterOwnerSecondary.at(contractList.system.boosterOwnerSecondary);
    console.log("secondary owner: " +secondaryOwner.address);

    // await setNoGas();
    var thirdPoolManager = await PoolManagerTertiaryProxy.at(contractList.system.poolManagerTertiaryProxy);
    console.log("third pool manager proxy: " +thirdPoolManager.address);

    var boosterplaceholder = await BoosterPlaceholder.at(contractList.system.boosterPlaceholder);
    console.log("boosterplaceholder: " +boosterplaceholder.address);

    var voteOwner = await VoterProxyOwner.at(contractList.system.voteProxyOwner);
    console.log("VoterProxyOwner: " +voteOwner.address);

    var poolmanager = await PoolManagerV4.at(contractList.system.poolManager);
    console.log("PoolManagerV4: " +poolmanager.address);

    console.log("\n\n----- connection -----\n");

    /*
    1) set pool manager on 2nd owner to the 3rd poolmanager
    2) set retire access to 2nd owner on voteowner
    3) set owner of vote proxy to the voteowner
    4) set transferownerhsip of primary owner from msig to 2nd owner
    5) accept ownerhsip of primary owner on 2nd owner
    6) set operator of 2nd poolmanager to 3rd
    7) set operator of 3rd poolmanager to latest external facing manager
    */

    //connect
    await setNoGas();
    await secondaryOwner.setPoolManager(thirdPoolManager.address,{from:multisig,gasPrice:0});
    console.log("set pool manager on 2nd owner");
    await setNoGas();
    await voteOwner.setRetireAccess(secondaryOwner.address,{from:multisig,gasPrice:0});
    console.log("set 2nd owner as retire access");
    await setNoGas();
    await voteproxy.setOwner(voteOwner.address,{from:multisig,gasPrice:0});
    console.log("vote proxy ownership transfered");
    await setNoGas();
    await primaryowner.transferOwnership(secondaryOwner.address,{from:multisig,gasPrice:0});
    console.log("primaryowner ownership set pending to secondary");
    await primaryowner.pendingowner().then(a=>console.log("primary pending owner: " +a))
    await setNoGas();
    await secondaryOwner.acceptOwnershipBoosterOwner({from:multisig,gasPrice:0});
    console.log("secondary accepted ownership");
   

    console.log("third pm: " +thirdPoolManager.address);
    await secondPoolManager.operator().then(a=>console.log("2nd pm operator: " +a))
    await setNoGas();
    // await thirdPoolManager.setSecondaryOperator({from:multisig,gasPrice:0});
    await secondPoolManager.setOperator(thirdPoolManager.address, {from:multisig,gasPrice:0});
    console.log("third mng set as operator to second")
    await secondPoolManager.operator().then(a=>console.log("2nd pm operator: " +a))
    await setNoGas();
    await thirdPoolManager.setOperator(poolmanager.address,{from:multisig,gasPrice:0});
    console.log("add new poolmngV4 as operator to third pool proxy");
    await thirdPoolManager.operator().then(a=>console.log("3rd pm operator: " +a))


    // ----- sealing check
    console.log("\n\n----- sealing -----\n");

    console.log(" >> seal secondary pool manager")
    await secondPoolManager.owner().then(a=>console.log("2nd pm owner: " +a))
    await setNoGas();
    await secondPoolManager.setOwner(thirdPoolManager.address,{from:multisig,gasPrice:0});
    await secondPoolManager.owner().then(a=>console.log("2nd pm owner: " +a))
    console.log("set third poolm as owner to second, cant be reverted");

    console.log(" >> seal vote owner");
    await voteproxy.owner().then(a=>console.log("proxy owner: " +a))
    await setNoGas();
    await voteOwner.setProxyOwner({from:multisig,gasPrice:0});
    console.log("reverted owner of proxy back to msig..");
    await voteproxy.owner().then(a=>console.log("proxy owner: " +a))
    await setNoGas();
    await voteproxy.setOwner(voteOwner.address,{from:multisig,gasPrice:0});
    console.log("vote proxy ownership transfered to owner layer");
    await voteproxy.owner().then(a=>console.log("proxy owner: " +a))

    await voteOwner.isSealed().then(a=>console.log("is sealed? " +a))
    await setNoGas();
    await voteOwner.sealOwnership({from:multisig,gasPrice:0});
    await voteOwner.isSealed().then(a=>console.log("is sealed? " +a))
    await setNoGas();
    await voteOwner.setProxyOwner({from:multisig,gasPrice:0}).catch(a=>console.log("revert on setting vote proxy owner back to msig: " +a));

    console.log("\n >> seal ownership ");
    await primaryowner.pendingowner().then(a=>console.log("primary pending: "+a))
    await primaryowner.owner().then(a=>console.log("primary owner: "+a))
    await secondaryOwner.setBoosterOwner({from:userA}).catch(a=>console.log("role check: " +a));
    await setNoGas();
    await secondaryOwner.setBoosterOwner({from:multisig,gasPrice:0});
    console.log("revert ownership")
    await setNoGas();
    await primaryowner.acceptOwnership({from:multisig,gasPrice:0});
    console.log("accepted");
    await primaryowner.pendingowner().then(a=>console.log("primary pending: "+a))
    await primaryowner.owner().then(a=>console.log("primary owner: "+a))
    console.log(" -> set back to secondary");
    await setNoGas();
    await primaryowner.transferOwnership(secondaryOwner.address,{from:multisig,gasPrice:0});
    console.log("primaryowner ownership set pending to secondary");
    await primaryowner.pendingowner().then(a=>console.log("primary pending: "+a))
    await primaryowner.owner().then(a=>console.log("primary owner: "+a))
    await setNoGas();
    await secondaryOwner.acceptOwnershipBoosterOwner({from:multisig,gasPrice:0});
    console.log("secondary accepted ownership");
    await primaryowner.pendingowner().then(a=>console.log("primary pending: "+a))
    await primaryowner.owner().then(a=>console.log("primary owner: "+a))
    await setNoGas();
    await secondaryOwner.sealOwnership({from:userA,gasPrice:0}).catch(a=>console.log("role check: " +a));
    await setNoGas();
    await secondaryOwner.sealOwnership({from:multisig,gasPrice:0});
    await secondaryOwner.isSealed().then(a=>console.log("sealed: " +a));
    await setNoGas();
    await secondaryOwner.setBoosterOwner({from:multisig,gasPrice:0}).catch(a=>console.log("revert: " +a))

    await secondaryOwner.poolManager().then(a=>console.log("current pool mng: " +a))
    console.log("try to change pool mng...");
    await setNoGas();
    await secondaryOwner.setPoolManager(addressZero,{from:multisig,gasPrice:0}).catch(a=>console.log("sealed: " +a))

    console.log(" >> seal factory and implementations ");

    //get factory and implementation
    var sFactory = await StashFactoryV2.at(contractList.system.sFactory);
    var currentStashImpl = await sFactory.v3Implementation();
    await sFactory.v3Implementation().then(a=>console.log("currentStashImpl: " +a));
    await setNoGas();
    await secondaryOwner.setStashFactoryImplementation(addressZero,addressZero,addressZero,{from:multisig,gasPrice:0});
    console.log("set stash impl");
    await sFactory.v3Implementation().then(a=>console.log("currentStashImpl: " +a));
    await setNoGas();
    await secondaryOwner.setStashFactoryImplementation(addressZero,addressZero,currentStashImpl,{from:multisig,gasPrice:0});
    console.log("set stash impl back");
    await sFactory.v3Implementation().then(a=>console.log("currentStashImpl: " +a));

    console.log("seal stash...");
    await secondaryOwner.sealStashImplementation().then(a=>console.log("stash is sealed? " +a))
    await setNoGas();
    await secondaryOwner.setSealStashImplementation({from:multisig,gasPrice:0});
    console.log("set sealed");
    await secondaryOwner.sealStashImplementation().then(a=>console.log("stash is sealed? " +a))

    console.log("try to change stash again...");
    await setNoGas();
    await secondaryOwner.setStashFactoryImplementation(addressZero,addressZero,addressZero,{from:multisig,gasPrice:0}).catch(a=>console.log("revert set stash impl: " +a));
    console.log("set stash should fail");


    // ---- role checks
    console.log("\n\n----- role checks -----\n"); 

    //setting
    await secondaryOwner.stashRewardManager().then(a=>console.log("stashRewardManager: "+a))
    await secondaryOwner.pendingstashRewardManager().then(a=>console.log("pendingstashRewardManager: "+a))
    await secondaryOwner.setStashRewardManager(deployer).catch(a=>console.log("not mng: " +a))
    await setNoGas();
    await secondaryOwner.setStashRewardManager(deployer,{from:multisig,gasPrice:0})
    console.log("set pending stash reward manager")
    await secondaryOwner.stashRewardManager().then(a=>console.log("stashRewardManager: "+a))
    await secondaryOwner.pendingstashRewardManager().then(a=>console.log("pendingstashRewardManager: "+a))
    await secondaryOwner.acceptStashRewardManager({from:userA}).catch(a=>console.log("not pending: " +a))
    await secondaryOwner.acceptStashRewardManager({from:deployer});
    console.log("stash reward manager accepted");
    await secondaryOwner.stashRewardManager().then(a=>console.log("stashRewardManager: "+a))
    await secondaryOwner.pendingstashRewardManager().then(a=>console.log("pendingstashRewardManager: "+a))

    await secondaryOwner.rescueManager().then(a=>console.log("rescueManager: "+a))
    await secondaryOwner.pendingrescueManager().then(a=>console.log("pendingrescueManager: "+a))
    await secondaryOwner.setRescueManager(deployer).catch(a=>console.log("not mng: " +a))
    await setNoGas();
    await secondaryOwner.setRescueManager(deployer,{from:multisig,gasPrice:0})
    console.log("set pending rescueManager")
    await secondaryOwner.rescueManager().then(a=>console.log("rescueManager: "+a))
    await secondaryOwner.pendingrescueManager().then(a=>console.log("pendingrescueManager: "+a))
    await secondaryOwner.acceptRescueManager({from:userA}).catch(a=>console.log("not pending: " +a))
    await secondaryOwner.acceptRescueManager({from:deployer});
    console.log("stash rescueManager accepted");
    await secondaryOwner.rescueManager().then(a=>console.log("rescueManager: "+a))
    await secondaryOwner.pendingrescueManager().then(a=>console.log("pendingrescueManager: "+a))

    console.log("\n\n----- basic command checks -----\n");

    //function calls
    var poolinfo = await booster.poolInfo(159);
    var poolstash = await ExtraRewardStashV3.at(poolinfo.stash);

    var weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    console.log("test add weth as reward -> " +weth)
    await poolstash.tokenCount().then(a=>console.log("stash token count: "+a))
    
    //setStashExtraReward
    await secondaryOwner.setStashExtraReward(159,weth,{from:userA}).catch(a=>console.log("!mng: " +a));
    await secondaryOwner.setStashExtraReward(159,weth,{from:deployer});
    var newcount = await poolstash.tokenCount()
    console.log("stash token new count: "+newcount);
    await poolstash.tokenList(newcount-1).then(a=>console.log("new reward: " +a))

    //setStashRewardHook
    await poolstash.rewardHook().then(a=>console.log("current stash hook: " +a));
    await secondaryOwner.setStashRewardHook(159,contractList.system.cvxDistroPoolHook,{from:userA}).catch(a=>console.log("!mng: " +a));
    await secondaryOwner.setStashRewardHook(159,contractList.system.cvxDistroPoolHook,{from:deployer});
    await poolstash.rewardHook().then(a=>console.log("updated stash hook: " +a));

    //setStashTokenIsValid
    var tokeninfo = await poolstash.tokenInfo(weth);
    console.log("tokeninfo: " +JSON.stringify(tokeninfo) );
    var tokenwrapper = await StashTokenWrapper.at(tokeninfo.wrapperAddress);
    await tokenwrapper.token().then(a=>console.log("token wrapper for " +a))
    await tokenwrapper.isInvalid().then(a=>console.log("is invalid? " +a))
    await secondaryOwner.setStashTokenIsValid(tokenwrapper.address, true, {from:userA}).catch(a=>console.log("!mng: " +a));
    await secondaryOwner.setStashTokenIsValid(tokenwrapper.address, true,{from:deployer});
    console.log("set as invalid");
    await tokenwrapper.isInvalid().then(a=>console.log("is invalid? " +a))


    //setRescueTokenDistribution
    var rescuestash = await ExtraRewardStashTokenRescue.at(contractList.system.rescueStash);
    await rescuestash.distributor().then(a=>console.log("current rescue stash distributor: " +a))
    await rescuestash.rewardDeposit().then(a=>console.log("current rescue stash rewardDeposit: " +a))
    await rescuestash.treasuryDeposit().then(a=>console.log("current rescue stash treasuryDeposit: " +a))
    await secondaryOwner.setRescueTokenDistribution(addressZero, addressZero, addressZero, {from:userA}).catch(a=>console.log("!mng: " +a));
    await secondaryOwner.setRescueTokenDistribution(addressZero, addressZero, addressZero, {from:deployer});
    console.log("updated rescue stash")
    await rescuestash.distributor().then(a=>console.log("updated rescue stash distributor: " +a))
    await rescuestash.rewardDeposit().then(a=>console.log("updated rescue stash rewardDeposit: " +a))
    await rescuestash.treasuryDeposit().then(a=>console.log("updated rescue stash treasuryDeposit: " +a))

    //setRescueTokenReward
    await rescuestash.activeTokens(crv.address).then(a=>console.log("current rescue setting for crv: " +a))
    await secondaryOwner.setRescueTokenReward(crv.address,0, {from:userA}).catch(a=>console.log("!mng: " +a));
    await secondaryOwner.setRescueTokenReward(crv.address,0, {from:deployer});
    await rescuestash.activeTokens(crv.address).then(a=>console.log("updated rescue setting for crv: " +a))


    //setVoteDelegate
    await booster.voteDelegate().then(a=>console.log("current vote delegate: " +a))
    var votedel = await VoteDelegateExtension.at(await booster.voteDelegate());
    await setNoGas();
    await votedel.revertControl({from:multisig,gasPrice:0});
    console.log("revert from vote del")
    await booster.voteDelegate().then(a=>console.log("current vote delegate: " +a))
    await secondaryOwner.setVoteDelegate(deployer,{from:deployer}).catch(a=>console.log("revert not owner: " +a))
    await setNoGas();
    await secondaryOwner.setVoteDelegate(secondaryOwner.address,{from:multisig,gasPrice:0})
    await booster.voteDelegate().then(a=>console.log("changed vote delegate to self: " +a))

    //make sure execute works for this too just in case
    calldata = booster.contract.methods.setVoteDelegate(deployer).encodeABI();
    await setNoGas();
    await secondaryOwner.executeDirect(booster.address,0,calldata,{from:multisig,gasPrice:0})
    await booster.voteDelegate().then(a=>console.log("changed vote delegate from self: " +a))

    //setFeeManager
    await booster.feeManager().then(a=>console.log("current feeManager: " +a))
    await setNoGas();
    await booster.setFeeManager(primaryowner.address,{from:multisig,gasPrice:0});
    console.log("switch fee manager from multi to primary bowner");
    await booster.feeManager().then(a=>console.log("current feeManager: " +a))
    await secondaryOwner.setFeeManager(deployer,{from:deployer}).catch(a=>console.log("revert not owner: " +a))
    await setNoGas();
    await secondaryOwner.setFeeManager(secondaryOwner.address,{from:multisig,gasPrice:0})
    await booster.feeManager().then(a=>console.log("changed feeManager to self: " +a))

    //make sure execute works for this too just in case
    calldata = booster.contract.methods.setFeeManager(deployer).encodeABI();
    await setNoGas();
    await secondaryOwner.executeDirect(booster.address,0,calldata,{from:multisig,gasPrice:0})
    await booster.voteDelegate().then(a=>console.log("changed feeManager from self: " +a))

    //setArbitrator
    await booster.rewardArbitrator().then(a=>console.log("current rewardArbitrator: " +a))
    await secondaryOwner.setArbitrator(deployer,{from:deployer}).catch(a=>console.log("revert not owner: " +a))
    await setNoGas();
    await secondaryOwner.setArbitrator(deployer,{from:multisig,gasPrice:0})
    await booster.rewardArbitrator().then(a=>console.log("changed rewardArbitrator: " +a))

    //setFactories
    await booster.stashFactory().then(a=>console.log("current stashFactory: " +a))
    await secondaryOwner.setFactories(deployer,deployer,deployer,{from:deployer}).catch(a=>console.log("revert not owner: " +a))
    await setNoGas();
    await secondaryOwner.setFactories(deployer,deployer,deployer,{from:multisig,gasPrice:0})
    console.log("set factories called...")
    await booster.stashFactory().then(a=>console.log("NON-changed stashFactory: " +a))


    // ----- execute check
    console.log("\n\n----- execute checks -----\n");
    console.log(" >> basic execute ");
    var calldata = crv.contract.methods.approve(deployer,web3.utils.toWei("50000.0", "ether")).encodeABI();
    await secondaryOwner.execute(crv.address,0,calldata,{from:userA}).catch(a=>console.log("auth exec: " +a));
    await setNoGas();
    await secondaryOwner.execute(crv.address,0,calldata,{from:multisig,gasPrice:0});
    console.log("use execute() to transfer");

    console.log(" >> protected execution ");
    
    //setFactories(address _rfactory, address _sfactory, address _tfactory) = primary booster owner
    var execinterface = await IBoosterOwner.at(primaryowner.address);
    calldata = execinterface.contract.methods.setFactories(addressZero,addressZero,addressZero).encodeABI();
    await setNoGas();
    await secondaryOwner.execute(primaryowner.address,0,calldata,{from:multisig,gasPrice:0}).catch(a=>console.log("invalid sig setFactories: " +a));

    //setImplementation(address _v1, address _v2, address _v3) -> stash factory
    var stashFactoryInterface = await IStashFactory.at(sFactory.address);
    calldata = stashFactoryInterface.contract.methods.setImplementation(addressZero,addressZero,addressZero).encodeABI();
    await setNoGas();
    await secondaryOwner.execute(primaryowner.address,0,calldata,{from:multisig,gasPrice:0}).catch(a=>console.log("invalid sig setImplementation: " +a));

    //shutdownPool(uint256 _pid) returns(bool) -> thirdPoolManager.address
    calldata = execinterface.contract.methods.shutdownPool(200).encodeABI();
    await setNoGas();
    await secondaryOwner.execute(thirdPoolManager.address,0,calldata,{from:multisig,gasPrice:0}).catch(a=>console.log("invalid sig shutdownPool: " +a));

    var rescuestashInterface = await IRescueStash.at(rescuestash.address);
    //setDistribution(address _distributor, address _rewardDeposit, address _treasury) -> rescue stash
    calldata = rescuestashInterface.contract.methods.setDistribution(addressZero,addressZero,addressZero).encodeABI();
    await setNoGas();
    await secondaryOwner.execute(rescuestash.address,0,calldata,{from:multisig,gasPrice:0}).catch(a=>console.log("invalid sig setDistribution: " +a));

    //setExtraReward(address _token, uint256 _option) -> rescue stash
    calldata = rescuestashInterface.contract.methods.setExtraReward(weth,2).encodeABI();
    await setNoGas();
    await secondaryOwner.execute(rescuestash.address,0,calldata,{from:multisig,gasPrice:0}).catch(a=>console.log("invalid sig setExtraReward(address,uint): " +a));


    //setInvalid(bool _isInvalid) -> stash token wrapper
    calldata = execinterface.contract.methods.setInvalid(true).encodeABI();
    await setNoGas();
    await secondaryOwner.execute(tokenwrapper.address,0,calldata,{from:multisig,gasPrice:0}).catch(a=>console.log("invalid sig setInvalid: " +a));

    //setExtraReward(address _token) -> any stash
    var stashInterface = await IStash.at(poolstash.address);
    calldata = stashInterface.contract.methods.setExtraReward(weth).encodeABI();
    await setNoGas();
    await secondaryOwner.execute(poolstash.address,0,calldata,{from:multisig,gasPrice:0}).catch(a=>console.log("invalid sig setExtraReward(address): " +a));
  
    //setRewardHook(address _hook) -> any stash
    calldata = stashInterface.contract.methods.setRewardHook(weth).encodeABI();
    await setNoGas();
    await secondaryOwner.execute(poolstash.address,0,calldata,{from:multisig,gasPrice:0}).catch(a=>console.log("invalid sig setRewardHook: " +a));


    //primary booster owner calls to force through roled functions
    //setRescueTokenDistribution(address _distributor, address _rewardDeposit, address _treasury)
    calldata = execinterface.contract.methods.setRescueTokenDistribution(addressZero,addressZero,addressZero).encodeABI();
    await setNoGas();
    await secondaryOwner.execute(primaryowner.address,0,calldata,{from:multisig,gasPrice:0}).catch(a=>console.log("invalid sig setRescueTokenDistribution: " +a));
    
    //setRescueTokenReward(address _token, uint256 _option)
    calldata = execinterface.contract.methods.setRescueTokenReward(weth,2).encodeABI();
    await setNoGas();
    await secondaryOwner.execute(primaryowner.address,0,calldata,{from:multisig,gasPrice:0}).catch(a=>console.log("invalid sig setRescueTokenReward: " +a));

    //setStashExtraReward(address _stash, address _token)
    calldata = execinterface.contract.methods.setStashExtraReward(poolstash.address,weth).encodeABI();
    await setNoGas();
    await secondaryOwner.execute(primaryowner.address,0,calldata,{from:multisig,gasPrice:0}).catch(a=>console.log("invalid sig setStashExtraReward: " +a));

    //setStashRewardHook(address _stash, address _hook)
    calldata = execinterface.contract.methods.setStashRewardHook(poolstash.address,weth).encodeABI();
    await setNoGas();
    await secondaryOwner.execute(primaryowner.address,0,calldata,{from:multisig,gasPrice:0}).catch(a=>console.log("invalid sig setStashRewardHook: " +a));

    //stash token::setInvalid(bool)
    calldata = execinterface.contract.methods.setInvalid(false).encodeABI();
    await setNoGas();
    await secondaryOwner.execute(primaryowner.address,0,calldata,{from:multisig,gasPrice:0}).catch(a=>console.log("invalid sig setInvalid: " +a));

    // ---- shutdown check
    console.log("\n\n----- shutdown checks -----\n");

    await secondPoolManager.isShutdown().then(a=>console.log("is pool manager shutdown? " +a))
    console.log("shutdown pool manager")
    await setNoGas();
    await thirdPoolManager.shutdownSystem({from:multisig,gasPrice:0});
    console.log("done");
    await secondPoolManager.isShutdown().then(a=>console.log("is pool manager shutdown? " +a))

    console.log("-- shutdown protected pool")

    console.log("shutdown normal pool (10)")
    await setNoGas();
    await poolmanager.shutdownPool(10,{from:multisig,gasPrice:0});
    console.log("done");

    console.log("shutdown protected pool (9)")
    await setNoGas();
    await poolmanager.shutdownPool(9,{from:multisig,gasPrice:0}).catch(a=>console.log("revert: " +a));
    console.log("couldnt shutdown protected pool");


    var poolCnt = await booster.poolLength();
    console.log("shutting down all pools ->  " +poolCnt);
    for(var i = 0; i < poolCnt; i++){
      console.log("shutdown pool " +i);
      // await unlockAccount(multisig);
      await setNoGas();
      await poolmanager.shutdownPool(i,{from:multisig,gasPrice:0}).catch(a=>console.log("revert shutdown pool: " +a));
    }
    console.log("all pools shutdown");

    console.log("get list of all pools that were unable to shutdown...")
    var ppools = [];
    for(var i = 0; i < poolCnt; i++){
      var pinfo = await booster.poolInfo(i);
      if(pinfo.shutdown == false){
        console.log("add pool " +i +" to list of protected pools")
        ppools.push(i);
      }
    }
    console.log("protected pools: " +ppools);

    console.log("try shutting down without passing in protected pool")
    await setNoGas();
    await secondaryOwner.shutdownSystem([],{from:multisig,gasPrice:0}).catch(a=>console.log("revert: " +a))

    var doForceShutdown = false;

    if(doForceShutdown){
      await setNoGas();
      await secondaryOwner.queueForceShutdown({from:multisig,gasPrice:0})
      console.log("force shutdown queued")
      await primaryowner.isForceTimerStarted().then(a=>console.log("isForceTimerStarted? " +a))
      await primaryowner.forceTimestamp().then(a=>console.log("forceTimestamp? " +a))
      await advanceTime(day * 20);
      await setNoGas();
      await secondaryOwner.forceShutdownSystem({from:multisig,gasPrice:0}).catch(a=>console.log("revert too soon: " +a))
      await advanceTime(day * 20);
      await setNoGas();
      await secondaryOwner.forceShutdownSystem({from:multisig,gasPrice:0})
      console.log("force shutdown executed")
    }else{
      console.log("normal shut down system with protected pool")
      await setNoGas();
      await secondaryOwner.shutdownSystem(ppools,{from:multisig,gasPrice:0}).catch(a=>console.log("revert: " +a))
    }

    console.log("full shutdown complete, check that booster changed to placeholder");
    await voteOwner.boosterPlaceholder().then(a=>console.log("vote owner placeholder: " +a))
    await voteproxy.operator().then(a=>console.log("vote proxy operator: " +a))

    console.log("create new booster and set as operator...")
    await setNoGas();
    var newbooster = await Booster.new(voteproxy.address,cvx.address,{from:deployer});
    console.log("new booster: "+newbooster.address);

    var ph = await voteOwner.boosterPlaceholder();
    var placeholder = await Booster.at(ph);
    await placeholder.isShutdown().then(a=>console.log("is placeholder shutdown? " +a))

    //shutdown placeholder
    await setNoGas();
    await voteOwner.setPlaceholderState(true,{from:multisig,gasPrice:0});
    console.log("set placeholder to shutdown")
    await placeholder.isShutdown().then(a=>console.log("is placeholder shutdown? " +a))


    await setNoGas();
    await voteOwner.setOperator(booster.address,{from:multisig,gasPrice:0}).catch(a=>console.log("revert set old booster: " +a))
    await setNoGas();
    await voteOwner.setOperator(newbooster.address,{from:multisig,gasPrice:0});
    await voteproxy.operator().then(a=>console.log("vote proxy new operator: " +a))

    await setNoGas();
    await voteOwner.setPlaceholderState(false,{from:multisig,gasPrice:0});
    console.log("reset placeholder to not shutdown")
    await placeholder.isShutdown().then(a=>console.log("is placeholder shutdown? " +a))
    

    console.log("update cvx operator..");
    await cvx.operator().then(a=>console.log("cvx operater: " +a))
    await cvx.updateOperator();
    console.log("operator updated")
    await cvx.operator().then(a=>console.log("cvx operater: " +a))



    console.log("#### done ####");
  });
});


