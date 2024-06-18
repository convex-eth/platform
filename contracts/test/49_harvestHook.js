// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const BoosterOwnerSecondary = artifacts.require("BoosterOwnerSecondary");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const PoolRewardHook = artifacts.require("PoolRewardHook");
const Harvester = artifacts.require("Harvester");
const IERC20 = artifacts.require("IERC20");

const BoosterRewardManager = artifacts.require("BoosterRewardManager");
const PoolHarvestHook = artifacts.require("PoolHarvestHook");
const PoolManagerV4 = artifacts.require("PoolManagerV4");
const ExtraRewardStashV3 = artifacts.require("ExtraRewardStashV3");
const PoolManagerTertiaryProxy = artifacts.require("PoolManagerTertiaryProxy");

const unlockAccount = async (address) => {
  let NETWORK = config.network;
  if(!NETWORK.includes("debug")){
    return null;
  }
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
  let NETWORK = config.network;
  if(!NETWORK.includes("debug")){
    return null;
  }
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
contract("Test harvest hook", async accounts => {
  it("should complete without errors", async () => {

    let deployer = contractList.system.deployer;
    let multisig = contractList.system.multisig;
    let addressZero = "0x0000000000000000000000000000000000000000"

    let booster = await Booster.at(contractList.system.booster);
    let cvx = await IERC20.at(contractList.system.cvx);
    let crv = await IERC20.at(contractList.curve.crv);

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
      await fastForward(secondsElaspse);
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;
    await unlockAccount(deployer);
    await unlockAccount(multisig);
    console.log("deploying from " +deployer);

    var pidlist = [];
    var poolRewardlist = [];
    var pcount = Number(await booster.poolLength())-1;
    for(var i=151; i < pcount; i++){
      var convexpool = i
      
      var poolInfo = await booster.poolInfo(convexpool);
      var stash = await ExtraRewardStashV3.at(poolInfo.stash);
      var currenthook = await stash.rewardHook();
      if(currenthook == addressZero){
        pidlist.push(convexpool);
      }else{
        poolRewardlist.push(convexpool);
      }
      console.log(convexpool +" stash: " +stash.address);
    }
    // for(var i=200; i < pcount; i++){
    //   var convexpool = i
    //   pidlist.push(convexpool);
    // }
    console.log("pool list: " +pidlist);
    console.log("pools that have pool reward hook already set: " +poolRewardlist);
    
    return;

    await setNoGas();
    let boosterOwner = await BoosterOwnerSecondary.at(contractList.system.boosterOwnerSecondary);
    let mainhook = await PoolRewardHook.at(contractList.system.cvxDistroPoolHook);
    let tertiary = await PoolManagerTertiaryProxy.at(contractList.system.poolManagerTertiaryProxy);

    let rewardManager = await BoosterRewardManager.new(multisig, {from:deployer});
    console.log("rewardManager: " +rewardManager.address);
    let poolmanager = await PoolManagerV4.new(tertiary.address, {from:deployer});
    console.log("poolmanager: " +poolmanager.address);
    let harvestHook = await PoolHarvestHook.new(multisig,poolmanager.address, mainhook.address, {from:deployer});
    console.log("harvestHook: " +harvestHook.address);
    let harvester = await Harvester.new("0x051C42Ee7A529410a10E5Ec11B9E9b8bA7cbb795", harvestHook.address, {from:deployer});
    console.log("harvester: " +harvester.address);

    // return;

    //hook up
    await setNoGas();
  
    //1 replace outer pool manager
    await tertiary.setOperator(poolmanager.address,{from:multisig,gasPrice:0});

    //2 set stash rewardManager on booster owner
    await boosterOwner.setStashRewardManager(rewardManager.address,{from:multisig,gasPrice:0})

    //3 accept stash reward manager role
    await rewardManager.acceptStashRewardManager();

    //4 set harvest hook as the default hook in stash reward manager
    await rewardManager.setPoolHooks(harvestHook.address,{from:multisig,gasPrice:0})

    //5 allow harvest hook to call initialize pools by being an operator
    await rewardManager.setOperators(harvestHook.address, true, {from:multisig,gasPrice:0})

    //6 set poolmanager add pool hook to the harvest hook
    await poolmanager.setPostAddHook(harvestHook.address,{from:multisig,gasPrice:0});

    //7 add harvester as operator of harvest hook
    await harvestHook.setOperators(harvester.address, true, {from:multisig,gasPrice:0})


    console.log("set pool manager and booster owner");

    await boosterOwner.stashRewardManager().then(a=>console.log("rmanager: " +a))

    await crv.transfer(harvestHook.address, 1, {from:deployer});
    await crv.balanceOf(harvestHook.address).then(a=>console.log("crv on harvest hook: " +a))

    


    // console.log("\n --- create list  ---")
    // var pidlist = [];
    // var poolRewardlist = [];
    // var pcount = Number(await booster.poolLength())-1;
    // for(var i=151; i < pcount; i++){
    //   var convexpool = i
      
    //   var poolInfo = await booster.poolInfo(convexpool);
    //   var stash = await ExtraRewardStashV3.at(poolInfo.stash);
    //   var currenthook = await stash.rewardHook();
    //   if(currenthook == addressZero){
    //     pidlist.push(convexpool);
    //   }else{
    //     poolRewardlist.push(convexpool);
    //   }
    //   console.log(convexpool +" stash: " +stash.address);
    // }
    // console.log("pool list: " +pidlist);
    // console.log("pools that have pool reward hook already set: " +poolRewardlist);
    // var sethookcode = await rewardManager.contract.methods.setMultiStashRewardHook(pidlist, harvestHook.address).encodeABI();
    // console.log("set stash hook byte code:")
    // console.log(sethookcode);

    console.log("\n --- new pool ---")
    var newpoolgauge = "0xa5793afa36bb22322f3670ac58e50360c2ce20e5";
    // await poolmanager.setPostAddHook(addressZero,{from:multisig,gasPrice:0});
    var convexpool = await booster.poolLength();
    await poolmanager.addPool(newpoolgauge);
    console.log("pool added")
    var poolInfo = await booster.poolInfo(convexpool);
    console.log(poolInfo.gauge);
    var crvRewards = await BaseRewardPool.at(poolInfo.crvRewards);
    var stash = await ExtraRewardStashV3.at(poolInfo.stash);
    console.log("crvRewards: " +crvRewards.address);
    console.log("stash: " +stash.address);
    await stash.rewardHook().then(a=>console.log("stash reward hook: " +a))
    await harvestHook.stashMap(stash.address).then(a=>console.log("stash to rewards: " +a))

    console.log("\n ---- test direct hook ---")
    //add hook to a pool
    var convexpool = 182;
    var poolInfo = await booster.poolInfo(convexpool);
    var crvRewards = await BaseRewardPool.at(poolInfo.crvRewards);
    var stash = await ExtraRewardStashV3.at(poolInfo.stash);
    console.log("crvRewards: " +crvRewards.address);
    console.log("stash: " +stash.address);

    var tx = await rewardManager.setStashRewardHook(convexpool, harvestHook.address, {from:multisig,gasPrice:0});
    console.log("booster setStashRewardHook, gas: " +tx.receipt.gasUsed);
    // var tx = await mainhook.addPoolReward(stash.address, harvestHook.address, {from:multisig,gasPrice:0});
    // console.log("mainhook addPoolReward, gas: " +tx.receipt.gasUsed);

    await rewardManager.initializePool(convexpool, {from:multisig,gasPrice:0});
    await stash.rewardHook().then(a=>console.log("stash reward hook: " +a))
    // await mainhook.poolRewardList(stash.address,0).then(a=>console.log("hooks: " +a))
    var tx = await harvestHook.setStashMap(convexpool);
    console.log("harvestHook.setStashMap, gas: " +tx.receipt.gasUsed);
    await harvestHook.stashMap(stash.address).then(a=>console.log("stash to rewards: " +a))

    await advanceTime(8 * day);

    await setNoGas();
    console.log("try normal harvest after period finish")
    // await booster.earmarkRewards(convexpool);
    await harvester.earmark(convexpool);
    console.log("earmarked");
    console.log("try again now that period finish is in future...");
    await booster.earmarkRewards(convexpool).then(a=>console.log("!!!SHOULD HAVE REVERTED!!!")).catch(a=>console.log("revert: " +a));
    console.log("try again by calling through harvesthook as a NON-operator..");
    await harvestHook.earmarkRewards(convexpool).then(a=>console.log("!!!SHOULD HAVE REVERTED!!!")).catch(a=>console.log("revert: " +a));
    console.log("try again by calling through harvesthook as an operator..");
    await crv.balanceOf(deployer).then(a=>console.log("crv before on operator: " +a))
    await harvestHook.earmarkRewards(convexpool,{from:deployer}).then(a=>console.log("earmarked with operator")).catch(a=>console.log("revert: " +a));
    await crv.balanceOf(deployer).then(a=>console.log("crv after on operator: " +a))
    await crv.balanceOf(harvestHook.address).then(a=>console.log("crv left on harvest hook: " +a))

    await advanceTime( (7 * day) + 600);

    console.log("try with period finish but not buffer...");
    await booster.earmarkRewards(convexpool).then(a=>console.log("!!!SHOULD HAVE REVERTED!!!")).catch(a=>console.log("revert: " +a));

    await advanceTime(3600);

    await setNoGas();
    console.log("try after time has passed...")
    await booster.earmarkRewards(convexpool);
    console.log("earmarked");



    console.log("\n\n---- test pool reward hook ---")
    await rewardManager.setStashRewardHook(convexpool, mainhook.address, {from:multisig,gasPrice:0});
    await mainhook.addPoolReward(stash.address, harvestHook.address, {from:multisig,gasPrice:0});
    console.log("set hooks")
    await mainhook.poolRewardList(stash.address,0).then(a=>console.log("stash hooks via poolrewardhook: " +a))
    await advanceTime(8 * day);

    await setNoGas();
    console.log("try normal harvest after period finish")
    await booster.earmarkRewards(convexpool);
    console.log("earmarked");
    console.log("try again now that period finish is in future...");
    await booster.earmarkRewards(convexpool).then(a=>console.log("!!!SHOULD HAVE REVERTED!!!")).catch(a=>console.log("revert: " +a));
    console.log("try again by calling through harvesthook as a NON-operator..");
    await harvestHook.earmarkRewards(convexpool).then(a=>console.log("!!!SHOULD HAVE REVERTED!!!")).catch(a=>console.log("revert: " +a));
    console.log("try again by calling through harvesthook as an operator..");
    await crv.balanceOf(deployer).then(a=>console.log("crv before on operator: " +a))
    await harvestHook.earmarkRewards(convexpool,{from:deployer}).then(a=>console.log("earmarked with operator")).catch(a=>console.log("revert: " +a));
    await crv.balanceOf(deployer).then(a=>console.log("crv after on operator: " +a))
    await crv.balanceOf(harvestHook.address).then(a=>console.log("crv left on harvest hook: " +a))

    await advanceTime(8 * day);

    await setNoGas();
    console.log("try after time has passed...")
    await booster.earmarkRewards(convexpool);
    console.log("earmarked");


    console.log("\n --- multi set---")
    var pidlist = [];
    for(var i=0; i < 5; i++){
      var convexpool = 182+i;
      pidlist.push(convexpool);
    }
    await rewardManager.setMultiStashRewardHook(pidlist, harvestHook.address, {from:deployer,gasPrice:0});
    await harvestHook.setMultiStashMap(pidlist, {from:deployer,gasPrice:0});
    console.log("set multi stashes")
    for(var i=0; i < 5; i++){
      var convexpool = 182+i;
      var poolInfo = await booster.poolInfo(convexpool);
      var crvRewards = await BaseRewardPool.at(poolInfo.crvRewards);
      var stash = await ExtraRewardStashV3.at(poolInfo.stash);
      await stash.rewardHook().then(a=>console.log(convexpool +" -> stash reward hook: " +a))
      await harvestHook.stashMap(stash.address).then(a=>console.log("stash to rewards: " +a))
    }


    console.log("\n --- disable ---")
    await crv.balanceOf(contractList.system.treasury).then(a=>console.log("crv treasury: " +a))
    await crv.balanceOf(harvestHook.address).then(a=>console.log("crv hook: " +a))
    await harvestHook.disable({from:multisig,gasPrice:0});
    await crv.balanceOf(contractList.system.treasury).then(a=>console.log("crv treasury: " +a))
    await crv.balanceOf(harvestHook.address).then(a=>console.log("crv hook: " +a))

    console.log("\n --- role reverse ---")
    await boosterOwner.stashRewardManager().then(a=>console.log("rmanager: " +a))
    await rewardManager.setStashRewardManager(multisig,{from:multisig,gasPrice:0});
    console.log("set pending to msig")
    await boosterOwner.acceptStashRewardManager({from:multisig,gasPrice:0});
    console.log("accepted")
    await boosterOwner.stashRewardManager().then(a=>console.log("rmanager: " +a))

    
    console.log("#### done ####");
  });
});


