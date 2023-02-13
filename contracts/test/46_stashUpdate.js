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

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    await unlockAccount(deployer);
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    await unlockAccount(multisig);
    let addressZero = "0x0000000000000000000000000000000000000000"

    let treasury = contractList.system.treasury;
    await unlockAccount(treasury);

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


    // var crvescrow = "0x5f3b5dfeb7b28cdbd7faba78963ee202a494e2a2";
    // await unlockAccount(crvescrow);
    // await crv.transfer(treasury,web3.utils.toWei("5000000.0", "ether"),{from:crvescrow,gasPrice:0});
    // // await crv.transfer(userB,web3.utils.toWei("100000.0", "ether"),{from:crvescrow,gasPrice:0});
    // // await crv.transfer(deployer,web3.utils.toWei("100000.0", "ether"),{from:crvescrow,gasPrice:0});

    // await crv.balanceOf(treasury).then(a=>console.log("treasury balance: " +a));


    var bowner = await BoosterOwner.at(contractList.system.boosterOwner);

    var rewardWrapper = await StashTokenWrapper.new();
    console.log("reward rewardWrapper: " +rewardWrapper.address);
    var stashImpl = await ExtraRewardStashV3.new(rewardWrapper.address)
    console.log("stash implementation: " +stashImpl.address);


    await bowner.setStashFactoryImplementation(addressZero,addressZero,stashImpl.address,{from:multisig,gasPrice:0});
    console.log("set stash implementation");

    var poolManager = await PoolManagerV4.at(contractList.system.poolManager);
    var lptoken = await IERC20.at("0xc4AD29ba4B3c580e6D59105FFf484999997675Ff");
    var gauge = "0xDeFd8FdD20e0f34115C7018CCfb655796F6B2168";
    var oldpool = 38;
    await unlockAccount(gauge);
    await lptoken.transfer(userA,web3.utils.toWei("10000.0", "ether"),{from:gauge,gasPrice:0});
    console.log("transfered lp tokens");

    await poolManager.shutdownPool(oldpool,{from:multisig,gasPrice:0});
    console.log("shutdown old pool");

    var poolCnt = await booster.poolLength();
    console.log("pool cnt: " +poolCnt);

    await poolManager.addPool(gauge);
    console.log("added pool: " +poolCnt);

    var poolinfo = await booster.poolInfo(poolCnt);
    console.log("pool info: " +JSON.stringify(poolinfo));

    var rewardAddress = await BaseRewardPool.at(poolinfo.crvRewards);
    var poolstash = await ExtraRewardStashV3.at(poolinfo.stash);

    //deposit
    await lptoken.approve(booster.address,web3.utils.toWei("10000.0", "ether"));
    await booster.depositAll(poolCnt,true);
    console.log("deposited");
    await rewardAddress.balanceOf(userA).then(a=>console.log("balance: "+a))

    //harvest
    await advanceTime(5 * day);
    await booster.earmarkRewards(poolCnt);
    console.log("harvested");
    await advanceTime(5 * day);

    //claim
    await crv.balanceOf(userA).then(a=>console.log("crv balance: " +a))
    await rewardAddress.earned(userA).then(a=>console.log("earned: " +a))
    await rewardAddress.getReward();
    console.log("claimed");
    await crv.balanceOf(userA).then(a=>console.log("crv balance: " +a))



    //create reward token
    var dummyReward = await DepositToken.new(deployer,lptoken.address,{from:deployer});
    console.log("dummy token: " +dummyReward.address);

    //add reward token
    await poolstash.tokenCount().then(a=>console.log("reward tokens: " +a));
    await bowner.setStashExtraReward(poolstash.address, dummyReward.address,{from:multisig,gasPrice:0});
    console.log("added token to stash rewards");
    await poolstash.tokenCount().then(a=>console.log("reward tokens: " +a));
    var tkncnt = await poolstash.tokenCount();
    var virtualReward;
    var tokenWrapper;
    for(var i=0; i < tkncnt; i++){
      var tokenaddress = await poolstash.tokenList(i);
      var tokeninfo = await poolstash.tokenInfo(tokenaddress);
      console.log("token info " +JSON.stringify(tokeninfo));
      virtualReward = await VirtualBalanceRewardPool.at(tokeninfo.rewardAddress);
      tokenWrapper = await StashTokenWrapper.at(tokeninfo.wrapperAddress);
      console.log("virtualReward: " +virtualReward.address);
      console.log("tokenWrapper: " +tokenWrapper.address);
    }

    await dummyReward.mint(poolstash.address,web3.utils.toWei("1.0", "ether"),{from:deployer});
    console.log("minted");
    await dummyReward.balanceOf(poolstash.address).then(a=>console.log("rewards on stash: " +a))

    await booster.earmarkRewards(poolCnt);
    console.log("harvested");
    await dummyReward.balanceOf(poolstash.address).then(a=>console.log("rewards on stash: " +a))
    
    //check distribution
    await tokenWrapper.totalSupply().then(a=>console.log("wrapper totalSupply: " +a))
    await tokenWrapper.token().then(a=>console.log("wrapper token: " +a))
    await tokenWrapper.rewardPool().then(a=>console.log("wrapper rewardPool: " +a))
    await dummyReward.balanceOf(tokenWrapper.address).then(a=>console.log("dummy on wrapper: " +a))
    await dummyReward.balanceOf(poolstash.address).then(a=>console.log("dummy on virtual: " +a))
    await tokenWrapper.balanceOf(virtualReward.address).then(a=>console.log("wrapper on virtual: " +a))
    await dummyReward.balanceOf(userA).then(a=>console.log("dummy on user: " +a))

    //claim rewards
    await virtualReward.earned(userA).then(a=>console.log("extra tokens earned: " +a))
    await advanceTime(5 * day);
    await virtualReward.earned(userA).then(a=>console.log("extra tokens earned: " +a))
    await rewardAddress.getReward();
    console.log("claimed");
    await tokenWrapper.balanceOf(virtualReward.address).then(a=>console.log("wrapper on virtual: " +a))
    await dummyReward.balanceOf(userA).then(a=>console.log("dummy on user: " +a))

    //test invalidate

    //try minting too many
    await dummyReward.mint(poolstash.address,web3.utils.toWei("1000000000000000.0", "ether"),{from:deployer});
    console.log("minted too many");
    await dummyReward.balanceOf(poolstash.address).then(a=>console.log("rewards on stash: " +a))
    await tokenWrapper.balanceOf(virtualReward.address).then(a=>console.log("wrapper on virtual: " +a))
    await booster.earmarkRewards(poolCnt);
    console.log("harvested");
    console.log("check that rewards didnt move to reward contract")
    await dummyReward.balanceOf(poolstash.address).then(a=>console.log("rewards on stash: " +a))
    await tokenWrapper.balanceOf(virtualReward.address).then(a=>console.log("wrapper on virtual: " +a))

    //try donate

    //withdraw
  });
});


