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
const CvxCrvStakingWrapper = artifacts.require("CvxCrvStakingWrapper");
const IERC20 = artifacts.require("IERC20");
const CvxCrvUtilities = artifacts.require("CvxCrvUtilities");
const ChefRewardHook = artifacts.require("ChefRewardHook");
const ChefToken = artifacts.require("ChefToken");
const ConvexMasterChef = artifacts.require("ConvexMasterChef");
const CvxDistribution = artifacts.require("CvxDistribution");
const PoolRewardHook = artifacts.require("PoolRewardHook");


// -- for old ganache
// const unlockAccount = async (address) => {
//   return new Promise((resolve, reject) => {
//     web3.currentProvider.send(
//       {
//         jsonrpc: "2.0",
//         method: "evm_unlockUnknownAccount",
//         params: [address],
//         id: new Date().getTime(),
//       },
//       (err, result) => {
//         if (err) {
//           return reject(err);
//         }
//         return resolve(result);
//       }
//     );
//   });
// };

// -- for new ganache
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

contract("deply cvxcrv stake wrapper for ui testing", async accounts => {
  it("should deploy cvxcrv wrapper and util", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    await unlockAccount(deployer);
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    await unlockAccount(multisig);
    let addressZero = "0x0000000000000000000000000000000000000000"

    //system
    let booster = await Booster.at(contractList.system.booster);
    let voteproxy = await CurveVoterProxy.at(contractList.system.voteProxy);
    let crvDeposit = await CrvDepositor.at(contractList.system.crvDepositor);
    let vanillacvxCrv = await BaseRewardPool.at(contractList.system.cvxCrvRewards);
    let cvx = await ConvexToken.at(contractList.system.cvx);
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let threeCrv = await IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
    let cvxCrv = await IERC20.at("0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7");
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

    let wrapper = await CvxCrvStakingWrapper.new({from:deployer});
    let util = await CvxCrvUtilities.new(wrapper.address,{from:deployer});
    console.log("cvxcrv wrapper: " +wrapper.address);
    console.log("cvxcrv util: " +util.address);


    //grab crv
    var crvescrow = "0x5f3b5dfeb7b28cdbd7faba78963ee202a494e2a2";
    await unlockAccount(crvescrow);
    await crv.transfer(userA,web3.utils.toWei("300000.0", "ether"),{from:crvescrow,gasPrice:0});
    //approve for convert and to stake for wrapper
    await crv.approve(crvDeposit.address,web3.utils.toWei("200000.0", "ether"),{from:userA});
    await cvxCrv.approve(vanillacvxCrv.address,web3.utils.toWei("100000.0", "ether"),{from:userA});
    //get some cvxcrv
    await crvDeposit.deposit(web3.utils.toWei("200000.0", "ether"),false,addressZero,{from:userA});
    //stake on behalf of wrapper
    await vanillacvxCrv.stakeFor(wrapper.address,web3.utils.toWei("100000.0", "ether"),{from:userA});

    //final balances
    await crv.balanceOf(userA).then(a=>console.log("crv balance: " +a))
    await cvxCrv.balanceOf(userA).then(a=>console.log("crvcrv balance: " +a))
    await vanillacvxCrv.balanceOf(wrapper.address).then(a=>console.log("wrapper staked balance: " +a))

    
    //hook up cvx emissions
    

    //create deposit token
    var cheftoken = await ChefToken.new("CvxDistribution",{from:deployer});
    console.log("chef token: " +cheftoken.address);
    await cheftoken.create({from:deployer});
    await cheftoken.name().then(a=>console.log("chef token name: " +a))

    //add to chef
    var chef = await ConvexMasterChef.at(contractList.system.chef);
    var pid = await chef.poolLength();
    await chef.add(1000,cheftoken.address,addressZero,true,{from:multisig,gasPrice:0});
    console.log("added to chef at pid: " +pid);

    //create distro
    var cvxdistro = await CvxDistribution.new({from:deployer});
    console.log("cvxdistro: " +cvxdistro.address);
    await cvxdistro.setWeight(wrapper.address,10000,{from:multisig,gasPrice:0});
    console.log("set cvxdistro weight for wrapper");

    //create hook
    var hook = await ChefRewardHook.new(cvxdistro.address, pid, cheftoken.address, {from:deployer});
    console.log("chef hook: " +hook.address);
    await cvxdistro.setChefHook(hook.address,{from:multisig,gasPrice:0});
    console.log("cvxdistro hook set to chef hook");
    await cheftoken.approve(hook.address,web3.utils.toWei("1000.0", "ether"),{from:deployer});
    await hook.deposit({from:deployer});
    console.log("chef deposited");

    //create poolrewardhook
    var poolhook = await PoolRewardHook.new({from:deployer});
    console.log("pool hook: "+poolhook.address);
    await poolhook.addPoolReward(wrapper.address, cvxdistro.address, {from:deployer});
    console.log("pool hook added to wrapper")

    //get cvx from somewhere
    var cvxholder = "0xcf50b810e57ac33b91dcf525c6ddd9881b139332";
    await unlockAccount(cvxholder);
    await cvx.transfer(deployer,web3.utils.toWei("10000.0", "ether"),{from:cvxholder,gasPrice:0});
    console.log("pulled cvx");
    await cvx.approve(cvxdistro.address,web3.utils.toWei("10000.0", "ether"),{from:deployer});
    await cvxdistro.donate(web3.utils.toWei("500.0", "ether"),{from:deployer});
    console.log("donated cvx");
    await cvxdistro.queueNewRewards({from:deployer});
    console.log("cvx rewards queued");

    //add hook
    await wrapper.setHook(poolhook.address,{from:multisig,gasPrice:0});
    console.log("hook set on cvxcrv wrapper");

    console.log("deployment complete");
    return;


    
    ////// local rate/apr testing ///////////

    await crv.transfer(userB,web3.utils.toWei("300000.0", "ether"),{from:crvescrow,gasPrice:0});
    await crv.transfer(userC,web3.utils.toWei("300000.0", "ether"),{from:crvescrow,gasPrice:0});
    await crv.approve(wrapper.address,web3.utils.toWei("100000000.0", "ether"),{from:userA});
    await crv.approve(crvDeposit.address,web3.utils.toWei("100000000.0", "ether"),{from:userA});
    await cvxCrv.approve(wrapper.address,web3.utils.toWei("100000000.0", "ether"),{from:userA});
    await crv.approve(wrapper.address,web3.utils.toWei("100000000.0", "ether"),{from:userB});
    await crv.approve(crvDeposit.address,web3.utils.toWei("100000000.0", "ether"),{from:userB});
    await cvxCrv.approve(wrapper.address,web3.utils.toWei("100000000.0", "ether"),{from:userB});
    await crv.approve(wrapper.address,web3.utils.toWei("100000000.0", "ether"),{from:userC});
    await crv.approve(crvDeposit.address,web3.utils.toWei("100000000.0", "ether"),{from:userC});
    await cvxCrv.approve(wrapper.address,web3.utils.toWei("100000000.0", "ether"),{from:userC});

    await wrapper.totalSupply().then(a=>console.log("wrapper supply: " +a));
    await vanillacvxCrv.balanceOf(wrapper.address).then(a=>console.log("wrapped staked balance: " +a));

    //todo: actually get price
    const price = async (token) => {
      if(token == crv.address){
        return "809000000000000000"
      }
      if(token == cvxCrv.address){
        return "720000000000000000"
      }
      if(token == cvx.address){
        return "4010000000000000000"
      }
      if(token == threeCrv.address){
        return "1020000000000000000"
      }
      return 0;
    }
    const displayApr = async (r) => {

      var cvxcrvPrice = await price(cvxCrv.address);
      for(var i = 0; i < r.rates.length; i++){
        // console.log("rate " +i +": " +r.rates[i].toString());
        console.log("rate " +i +": " +web3.utils.fromWei(r.rates[i].toString(), "ether"));
        var p = await price(r.tokens[i]);
        await util.apr(r.rates[i],p, cvxcrvPrice).then(a=>console.log("apr " +i +": " +web3.utils.fromWei(a.toString(), "ether")));
      }
    }

    const displayAllRates = async (r) => {
      var rates = await util.mainRewardRates();
      console.log("--- global rates ---");
      await displayApr(rates);
      console.log("--- extra rates ---");
      var extraRates = await util.extraRewardRates();
      await displayApr(extraRates);
      console.log("--- user main rates ---");
      var userRates = await util.accountRewardRates(userA);
      await displayApr(userRates);
      console.log("--- user extra rates ---");
      var userExtraRates = await util.accountExtraRewardRates(userA);
      await displayApr(userExtraRates);
      console.log("\n\n");
    }
    await displayAllRates();

    await wrapper.setRewardWeight(5000,{from:userA});

    await wrapper.deposit(web3.utils.toWei("100000.0", "ether"),userA,{from:userA});
    console.log("deposit complete");

    await wrapper.totalSupply().then(a=>console.log("wrapper supply: " +a));
    await vanillacvxCrv.balanceOf(wrapper.address).then(a=>console.log("wrapped staked balance: " +a));

    await displayAllRates();

    await wrapper.stake(web3.utils.toWei("100000.0", "ether"),userA,{from:userA});
    console.log("stake complete");
    await wrapper.totalSupply().then(a=>console.log("wrapper supply: " +a));
    await vanillacvxCrv.balanceOf(wrapper.address).then(a=>console.log("wrapped staked balance: " +a));

    await displayAllRates();

    await wrapper.setRewardWeight(10000,{from:userB});
    await wrapper.setRewardWeight(5000,{from:userC});
    console.log("set weights on b and c")

    await wrapper.deposit(web3.utils.toWei("200000.0", "ether"),userB,{from:userB});
    await wrapper.deposit(web3.utils.toWei("200000.0", "ether"),userC,{from:userC});
    console.log("deposited b and c")

    var rates = await util.mainRewardRates();
    console.log("--- global rates ---");
    await displayApr(rates);
    console.log("--- extra rates ---");
    var extraRates = await util.extraRewardRates();
    await displayApr(extraRates);
    console.log("--- user main rates ---");
    var userRates = await util.accountRewardRates(userA);
    await displayApr(userRates);
    console.log("---");
    var userRates = await util.accountRewardRates(userB);
    await displayApr(userRates);
    console.log("---");
    var userRates = await util.accountRewardRates(userC);
    await displayApr(userRates);
    console.log("--- user extra rates ---");
    var userExtraRates = await util.accountExtraRewardRates(userA);
    await displayApr(userExtraRates);
    console.log("---");
    var userExtraRates = await util.accountExtraRewardRates(userB);
    await displayApr(userExtraRates);
    console.log("---");
    var userExtraRates = await util.accountExtraRewardRates(userC);
    await displayApr(userExtraRates);
    console.log("\n\n");
  });
});


