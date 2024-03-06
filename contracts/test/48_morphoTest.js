// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const ConvexStakingWrapperMorpho = artifacts.require("ConvexStakingWrapperMorpho");
const IERC20 = artifacts.require("IERC20");
const MorphoMock = artifacts.require("MorphoMock");
const IMorpho = artifacts.require("IMorpho");

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
contract("Test morpho collateral", async accounts => {
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

    
    await setNoGas();
    let morpho = await MorphoMock.new({from:deployer,gasPrice:0});
    console.log("morpho mock: " +morpho.address);

    var curvelp = await IERC20.at("0x4dece678ceceb27446b35c672dc7d61f30bad69e");
    var holder = "0x95f00391cB5EebCd190EB58728B4CE23DbFa6ac1";
    var convexpool = 182;
    var poolInfo = await booster.poolInfo(convexpool);
    var convexRewards = await BaseRewardPool.at(poolInfo.crvRewards);
    await unlockAccount(holder);
    await setNoGas();
    await curvelp.transfer(userA, web3.utils.toWei("1000000", "ether"),{from:holder,gasPrice:0});
    console.log("lp token transfered");

    await setNoGas();
    await booster.earmarkRewards(convexpool);
    console.log("convex pool earmarked");

    await setNoGas();
    let wrapper = await ConvexStakingWrapperMorpho.new(morpho.address, {from:deployer,gasPrice:0});
    console.log("wrapper: " +wrapper.address);

    var marketParams = [
      addressZero,
      wrapper.address,
      addressZero,
      addressZero,
      0
      ];

    var marketId = await morpho.id(marketParams);
    console.log("market id: " +marketId);

    await morpho.addMarket(marketParams);
    console.log("added market");

    await wrapper.initialize(convexpool);
    let morphoOwner = await morpho.owner();
    await unlockAccount(morphoOwner);
    await wrapper.setMorphoId(marketId,{from:userA,gasPrice:0})
    console.log("wrapper id set")
    await wrapper.setMorphoId(marketId,{from:morphoOwner,gasPrice:0}).catch(a=>console.log("revert cant set id twice: " +a));
    console.log("wrapper initialized");

    await curvelp.approve(wrapper.address, web3.utils.toWei("1000000000.0","ether"),{from:userA});
    console.log("approved lp to wrapper");

    await wrapper.depositFor(web3.utils.toWei("100000.0","ether"), userA,{from:deployer,gasPrice:0}).catch(a=>console.log("revert no tokens: " +a));
    await wrapper.depositFor(web3.utils.toWei("100000.0","ether"), userA,{from:userA});
    console.log("depositFor called user A")
    await wrapper.depositFor(web3.utils.toWei("100000.0","ether"), userB,{from:userA});
    console.log("depositFor called user B")

    await morpho.position(marketId,userA).then(a=>console.log("position collateral A: " +a.collateral))
    await morpho.position(marketId,userB).then(a=>console.log("position collateral B: " +a.collateral))


    //check normal claim
    await wrapper.earned.call(userA).then(a=>console.log("earned A: " +a ));
    await convexRewards.earned(wrapper.address).then(a=>console.log("wrapper claimable: " +a))
    await convexRewards.balanceOf(wrapper.address).then(a=>console.log("wrapper balance: " +a))
    await convexRewards.periodFinish().then(a=>console.log("periodFinish: " +a))
    await convexRewards.rewardRate().then(a=>console.log("rewardRate: " +a))

    await advanceTime(day);
    await wrapper.earned.call(userA).then(a=>console.log("earned A: " +a ));
    await convexRewards.earned(wrapper.address).then(a=>console.log("wrapper claimable: " +a))
    await crv.balanceOf(userA).then(a=>console.log("balance of crv: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("balance of cvx: " +a));

    await wrapper.getReward(userA);
    await wrapper.getReward(userB);
    console.log("rewards claimed");
    await crv.balanceOf(userA).then(a=>console.log("balance of crv: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("balance of cvx: " +a));

    //check claim after liquidate
    await advanceTime(day);
    //should be roughly the same
    await wrapper.earned.call(userA).then(a=>console.log("earned A: " +a ));
    await wrapper.earned.call(userB).then(a=>console.log("earned B: " +a ));

    //liquidate half of A
    console.log("liquidate>>");
    await morpho.position(marketId,userA).then(a=>console.log("position collateral A: " +a.collateral))
    await morpho.position(marketId,userB).then(a=>console.log("position collateral B: " +a.collateral))
    await curvelp.balanceOf(userB).then(a=>console.log("lp tokens on B: " +a));
    await morpho.liquidate(marketParams, userA, web3.utils.toWei("50000.0","ether"),{from:userB});
    console.log("A liquidated by B")
    await curvelp.balanceOf(userB).then(a=>console.log("lp tokens on B: " +a));
    await morpho.position(marketId,userA).then(a=>console.log("position collateral A: " +a.collateral))
    await morpho.position(marketId,userB).then(a=>console.log("position collateral B: " +a.collateral))

    //B should have more earned
    await wrapper.earned.call(userA).then(a=>console.log("earned A: " +a ));
    await wrapper.earned.call(userB).then(a=>console.log("earned B: " +a ));


    console.log("\n\nwithdraw >>>")
    //withdrawing
    //forget to checkpoint
    console.log("\n no checkpoint user A>>>")
    var collateral = (await morpho.position(marketId,userA)).collateral
    console.log("position collateral A: " +collateral)
    await wrapper.earned.call(userA).then(a=>console.log("earned A: " +a ));
    await curvelp.balanceOf(userA).then(a=>console.log("lp tokens on A: " +a));
    await morpho.withdrawCollateral(marketParams, collateral, userA, {from:userA, gasPrice:0} );
    console.log("A withdraw without checkpointing");
    await wrapper.earned.call(userA).then(a=>console.log("earned A: " +a ));
    await curvelp.balanceOf(userA).then(a=>console.log("lp tokens on A: " +a));
    await morpho.position(marketId,userA).then(a=>console.log("position collateral A: " +a.collateral))

    //proper checkpoint
    console.log("\n checkpoint user B>>>")
    var collateral = (await morpho.position(marketId,userB)).collateral
    console.log("position collateral B: " +collateral)
    await wrapper.earned.call(userB).then(a=>console.log("earned B: " +a ));
    await curvelp.balanceOf(userB).then(a=>console.log("lp tokens on B: " +a));
    await wrapper.transfer(userB,0,{from:userC}); //use transfer to checkpoint, callable by anyone
    console.log("checkpointed via transfer by calling wrapper.transfer(userB,0) from any address");
    await morpho.withdrawCollateral(marketParams, collateral, userB, {from:userB, gasPrice:0} );
    console.log("B withdraw without checkpointing");
    await wrapper.earned.call(userB).then(a=>console.log("earned B: " +a ));
    await curvelp.balanceOf(userB).then(a=>console.log("lp tokens on B: " +a));
    await morpho.position(marketId,userB).then(a=>console.log("position collateral B: " +a.collateral))

    console.log("#### done ####");
  });
});


