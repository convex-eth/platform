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
const ICurveAavePool = artifacts.require("ICurveAavePool");
const IExchange = artifacts.require("IExchange");
const IUniswapV2Router01 = artifacts.require("IUniswapV2Router01");
const CvxMining = artifacts.require("CvxMining");
const CvxCrvRari = artifacts.require("CvxCrvRari");

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

contract("Test cvxcrv stake wrapper", async accounts => {
  it("should deposit cvxcrv and earn rewards while being transferable", async () => {

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

    const advanceTime = async (secondsElaspse) => {
      // await time.increase(secondsElaspse);
      // await time.advanceBlock();
      await fastForward(secondsElaspse);
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;


    var crvescrow = "0x5f3b5dfeb7b28cdbd7faba78963ee202a494e2a2";
    await unlockAccount(crvescrow);
    await crv.transfer(userA,web3.utils.toWei("100000.0", "ether"),{from:crvescrow,gasPrice:0});
    await crv.transfer(userB,web3.utils.toWei("100000.0", "ether"),{from:crvescrow,gasPrice:0});
    await crv.transfer(deployer,web3.utils.toWei("100000.0", "ether"),{from:crvescrow,gasPrice:0});

    var crvbalance = await crv.balanceOf(userA);
    console.log("crv: " +crvbalance);


    let staker = await CvxCrvStakingWrapper.new({from:deployer});
    console.log("staker token: " +staker.address);

    await staker.name().then(a=>console.log("name: " +a));
    await staker.symbol().then(a=>console.log("symbol: " +a));
    await staker.decimals().then(a=>console.log("decimals: " +a));

    let rewardCount = await staker.rewardLength();
    for(var i = 0; i < rewardCount; i++){
      var rInfo = await staker.rewards(i);
      console.log("rewards " +i +": " +JSON.stringify(rInfo));
    }

    //user A will deposit curve tokens and user B convex
    await crv.approve(staker.address,crvbalance,{from:userA});
    await crv.approve(crvDeposit.address,crvbalance,{from:userB});
    await cvxCrv.approve(staker.address,crvbalance,{from:userB});
    console.log("approved depositor and staker");

    await staker.setRewardWeight(10000,{from:userB});
    console.log("set user b weight")

    await crvDeposit.deposit(crvbalance,false,addressZero,{from:userB});
    // await crvDeposit.deposit(crvbalance,false,staker.address,{from:userB});
    console.log("deposited into convex for user b");


    var depositTx = await staker.deposit(crvbalance,userA,{from:userA});
    console.log("user A deposited, gas: " +depositTx.receipt.gasUsed);


    // await cvxCrv.balanceOf(userB).then(a=>console.log("user b cvxCrv: " +a));
    var stakeTx = await staker.stake(crvbalance,userB,{from:userB});
    console.log("user b staked, gas: " +stakeTx.receipt.gasUsed);


    await staker.balanceOf(userA).then(a=>console.log("user a: " +a));
    await staker.balanceOf(userB).then(a=>console.log("user b: " +a));
    await staker.userRewardWeight(userA).then(a=>console.log("user a weight: " +a))
    await staker.userRewardWeight(userB).then(a=>console.log("user b weight: " +a))
    await staker.totalSupply().then(a=>console.log("totalSupply: " +a))
    await staker.supplyWeight().then(a=>console.log("supplyWeight: " +a))
    await staker.userRewardBalance(userA,0).then(a=>console.log("userRewardBalance(a,0): " +a));
    await staker.userRewardBalance(userA,1).then(a=>console.log("userRewardBalance(a,1): " +a));
    await staker.userRewardBalance(userB,0).then(a=>console.log("userRewardBalance(b,0): " +a));
    await staker.userRewardBalance(userB,1).then(a=>console.log("userRewardBalance(b,0): " +a));
    await staker.rewardSupply(0).then(a=>console.log("rewardSupply(0): " +a))
    await staker.rewardSupply(1).then(a=>console.log("rewardSupply(1): " +a))

    

    await staker.earned.call(userA).then(a=>console.log("user a earned: " +a));
    await staker.earned.call(userB).then(a=>console.log("user b earned: " +a));

    await advanceTime(86400);

    console.log("======");
    await staker.earned.call(userA).then(a=>console.log("user a earned: " +a ));
    await crv.balanceOf(userA).then(a=>console.log("user a wallet crv: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("user a wallet cvx: " +a));
    await threeCrv.balanceOf(userA).then(a=>console.log("user a wallet threeCrv: " +a));
    console.log("-----");
    await staker.earned.call(userB).then(a=>console.log("user b earned: " +a ));
    await crv.balanceOf(userB).then(a=>console.log("user b wallet crv: " +a));
    await cvx.balanceOf(userB).then(a=>console.log("user b wallet cvx: " +a));
    await threeCrv.balanceOf(userB).then(a=>console.log("user b wallet threeCrv: " +a));

    await advanceTime(86400);

    console.log("======");
    await staker.earned.call(userA).then(a=>console.log("user a earned: " +a ));
    await crv.balanceOf(userA).then(a=>console.log("user a wallet crv: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("user a wallet cvx: " +a));
    await threeCrv.balanceOf(userA).then(a=>console.log("user a wallet threeCrv: " +a));
    console.log("-----");
    await staker.earned.call(userB).then(a=>console.log("user b earned: " +a ));
    await crv.balanceOf(userB).then(a=>console.log("user b wallet crv: " +a));
    await cvx.balanceOf(userB).then(a=>console.log("user b wallet cvx: " +a));
    await threeCrv.balanceOf(userB).then(a=>console.log("user b wallet threeCrv: " +a));

    console.log("checkpoint");
    await staker.user_checkpoint(userA);
    await staker.user_checkpoint(userB);
    await crv.balanceOf(staker.address).then(a=>console.log("staker crv: " +a));
    await cvx.balanceOf(staker.address).then(a=>console.log("staker cvx: " +a));
    await threeCrv.balanceOf(staker.address).then(a=>console.log("staker threeCrv: " +a));
    for(var i = 0; i < rewardCount; i++){
      var rInfo = await staker.rewards(i);
      console.log("rewards " +i +": " +JSON.stringify(rInfo));
    }


    console.log("======");
    await staker.earned.call(userA).then(a=>console.log("user a earned: " +a ));
    await crv.balanceOf(userA).then(a=>console.log("user a wallet crv: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("user a wallet cvx: " +a));
    await threeCrv.balanceOf(userA).then(a=>console.log("user a wallet threeCrv: " +a));
    console.log("-----");
    await staker.earned.call(userB).then(a=>console.log("user b earned: " +a ));
    await crv.balanceOf(userB).then(a=>console.log("user b wallet crv: " +a));
    await cvx.balanceOf(userB).then(a=>console.log("user b wallet cvx: " +a));
    await threeCrv.balanceOf(userB).then(a=>console.log("user b wallet threeCrv: " +a));

    //test transfering to account C
    await staker.transfer(userC,crvbalance,{from:userB});
    console.log("transfer to userC");
    await staker.earned.call(userB).then(a=>console.log("user b earned: " +a ));
    await crv.balanceOf(userB).then(a=>console.log("user b wallet crv: " +a));
    await cvx.balanceOf(userB).then(a=>console.log("user b wallet cvx: " +a));
    await threeCrv.balanceOf(userB).then(a=>console.log("user b wallet threeCrv: " +a));
    console.log("-----");
    await staker.earned.call(userC).then(a=>console.log("user c earned: " +a ));
    await crv.balanceOf(userC).then(a=>console.log("user c wallet crv: " +a));
    await cvx.balanceOf(userC).then(a=>console.log("user c wallet cvx: " +a));
    await threeCrv.balanceOf(userC).then(a=>console.log("user c wallet threeCrv: " +a));

    await advanceTime(86400);

    await staker.earned.call(userB).then(a=>console.log("user b earned: " +a ));
    await crv.balanceOf(userB).then(a=>console.log("user b wallet crv: " +a));
    await cvx.balanceOf(userB).then(a=>console.log("user b wallet cvx: " +a));
    await threeCrv.balanceOf(userB).then(a=>console.log("user b wallet threeCrv: " +a));
    console.log("-----");
    await staker.earned.call(userC).then(a=>console.log("user c earned: " +a ));
    await crv.balanceOf(userC).then(a=>console.log("user c wallet crv: " +a));
    await cvx.balanceOf(userC).then(a=>console.log("user c wallet cvx: " +a));
    await threeCrv.balanceOf(userC).then(a=>console.log("user c wallet threeCrv: " +a));


    //withdraw
    console.log("withdrawing...");
    await staker.withdraw(crvbalance,{from:userA});
    await staker.withdraw(0,{from:userB});
    await staker.withdraw(crvbalance,{from:userC});
    var getRewardTx = await staker.getReward(userA,userA,{from:userA});
    await staker.getReward(userB,userB,{from:userB});
    await staker.getReward(userC,userC,{from:userC});
    console.log("withdrew and claimed all, gas: " +getRewardTx.receipt.gasUsed);

    console.log("try claim again");
    await staker.getReward(userC,userC,{from:userC});

    await staker.earned.call(userA).then(a=>console.log("user a earned: " +a ));
    await crv.balanceOf(userA).then(a=>console.log("user a wallet crv: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("user a wallet cvx: " +a));
    await threeCrv.balanceOf(userA).then(a=>console.log("user a wallet threeCrv: " +a));
    console.log("-----");
    await staker.earned.call(userB).then(a=>console.log("user b earned: " +a ));
    await crv.balanceOf(userB).then(a=>console.log("user b wallet crv: " +a));
    await cvx.balanceOf(userB).then(a=>console.log("user b wallet cvx: " +a));
    await threeCrv.balanceOf(userB).then(a=>console.log("user b wallet threeCrv: " +a));
    console.log("-----");
    await staker.earned.call(userC).then(a=>console.log("user c earned: " +a ));
    await crv.balanceOf(userC).then(a=>console.log("user c wallet crv: " +a));
    await cvx.balanceOf(userC).then(a=>console.log("user c wallet cvx: " +a));
    await threeCrv.balanceOf(userC).then(a=>console.log("user c wallet threeCrv: " +a));

    //check whats left on the staker
    console.log(">>> remaining check <<<<");
    await staker.balanceOf(userA).then(a=>console.log("user a staked: " +a));
    await staker.balanceOf(userB).then(a=>console.log("user b staked: " +a));
    await staker.balanceOf(userC).then(a=>console.log("user c staked: " +a));
    await staker.totalSupply().then(a=>console.log("remaining supply: " +a));
    await crv.balanceOf(staker.address).then(a=>console.log("remaining crv: " +a));
    await cvx.balanceOf(staker.address).then(a=>console.log("remaining cvx: " +a));
    await threeCrv.balanceOf(staker.address).then(a=>console.log("remaining threeCrv: " +a));


    //reclaim
    console.log(">>> reclaim check <<<");
    await crv.approve(crvDeposit.address,crvbalance,{from:deployer});
    console.log("approved depositor");
    await crvDeposit.deposit(crvbalance,false,addressZero,{from:deployer});
    console.log("mint cvxcrv");

    await cvxCrv.approve(vanillacvxCrv.address,crvbalance,{from:deployer});
    await vanillacvxCrv.stakeFor(staker.address, crvbalance, {from:deployer});

    await staker.totalSupply().then(a=>console.log("totalSupply: " +a));
    await vanillacvxCrv.balanceOf(staker.address).then(a=>console.log("staked supply: " +a));

    await staker.reclaim({from:multisig,gasPrice:0}).catch(a=>console.log("revert reclaim before shutdown: " +a));

    await staker.shutdown({from:multisig,gasPrice:0});
    await staker.isShutdown().then(a=>console.log("isShutdown? " +a));

    await cvxCrv.balanceOf(contractList.system.treasury).then(a=>console.log("treasury cvxCrv: " +a));
    await staker.reclaim({from:multisig,gasPrice:0});
    console.log("reclaim called");
    await cvxCrv.balanceOf(contractList.system.treasury).then(a=>console.log("treasury cvxCrv: " +a));

    await staker.totalSupply().then(a=>console.log("totalSupply: " +a));
    await vanillacvxCrv.balanceOf(staker.address).then(a=>console.log("staked supply: " +a));

  });
});


