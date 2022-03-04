// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const CvxLocker = artifacts.require("CvxLocker");
const CvxStakingProxy = artifacts.require("CvxStakingProxy");
const cvxRewardPool = artifacts.require("cvxRewardPool");
const IERC20 = artifacts.require("IERC20");
const IExchange = artifacts.require("IExchange");
const IUniswapV2Router01 = artifacts.require("IUniswapV2Router01");
const DepositToken = artifacts.require("DepositToken");
const LockerAdmin = artifacts.require("LockerAdmin");
const CvxLockerV2 = artifacts.require("CvxLockerV2");
const CvxStakingProxyV2 = artifacts.require("CvxStakingProxyV2");


const unlockAccount = async (address) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_unlockUnknownAccount",
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

/*
- test new lock/relock rules
*/

contract("Test lock contract", async accounts => {
  it("should deposit cvx and test all functions", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let treasury = "0x1389388d01708118b497f59521f6943Be2541bb7";
    let addressZero = "0x0000000000000000000000000000000000000000"

    //system
    let cvx = await IERC20.at(contractList.system.cvx);
    let cvxcrv = await IERC20.at(contractList.system.cvxCrv);
    let cvxrewards = await cvxRewardPool.at(contractList.system.cvxRewards);
    let cvxcrvrewards = await cvxRewardPool.at(contractList.system.cvxCrvRewards);
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let exchange = await IExchange.at("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
    let exchangerouter = await IUniswapV2Router01.at("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let dai = await IERC20.at("0x6B175474E89094C44Da98b954EedeAC495271d0F");

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

    var isShutdown = false;

    let starttime = await time.latest();
    await unlockAccount(deployer);
    await unlockAccount(multisig);
    await unlockAccount(treasury);
    await unlockAccount(userZ);

    const advanceTime = async (secondsElaspse) => {
      await time.increase(secondsElaspse);
      await time.advanceBlock();
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;


    var oldLocker = await CvxLocker.at(contractList.system.locker);

    // await advanceTime(7*day*18);
    // await oldLocker.claimableRewards(userZ).then(a=>console.log("userZ claimableRewards: " +a));
    // await oldLocker.methods['processExpiredLocks(bool,uint256,address)'](true,0,userA,{from:userZ});
    // await oldLocker.claimableRewards(userA).then(a=>console.log("userA claimableRewards: " +a));
    // await oldLocker.getReward(userA,false);
    // await cvxcrv.balanceOf(userA).then(a=>console.log("cvxcrv userA: " +a));

    //shutdown old locker
    var lockeradmin = await LockerAdmin.at(contractList.system.lockerAdmin);
    await lockeradmin.shutdown({from:multisig,gasPrice:0});
    console.log("shutdown v1");

    //withdraw
    await oldLocker.processExpiredLocks(false,{from:userZ});
    await cvx.balanceOf(userZ).then(a=>console.log("withdrew cvx: " +a));

    //deploy
    let locker = await CvxLockerV2.new({from:deployer});
    let stakeproxy = await CvxStakingProxyV2.new(locker.address,{from:deployer});
    console.log("deployed v2");
    await stakeproxy.setApprovals();
    await stakeproxy.setPendingOwner(multisig,{from:deployer});
    await stakeproxy.applyPendingOwner({from:deployer});
    await stakeproxy.owner().then(a=>console.log("stake proxy owner: " +a));
    await locker.addReward(cvxcrv.address, stakeproxy.address, true, {from:deployer});
    await locker.setStakingContract(stakeproxy.address,{from:deployer});
    await locker.setApprovals();
    console.log("rewards and approvals set");

    var firstTime = await time.latest();
    //epoch length 604800
    let firstepoch = (Math.floor(firstTime / (86400*7))).toFixed(0) * (86400*7);
    console.log("first epoch: " +firstepoch);
    const currentEpoch = async() =>{
      var currentTime = await time.latest();
      currentTime = (Math.floor(currentTime / (86400*7))).toFixed(0) * (86400*7)
      var epochIdx = ((currentTime - firstepoch) / (86400*7)).toFixed(0);
      console.log("current epoch: " + currentTime +", " +epochIdx);
      return currentTime;
    }
    //let firstepoch = await currentEpoch();

    await locker.epochCount().then(a=>console.log("epoch count before: " +a))
    await locker.checkpointEpoch();
    await locker.epochCount().then(a=>console.log("epoch count after: " +a))
    await locker.checkpointEpoch();
    await locker.epochCount().then(a=>console.log("epoch count after2: " +a))

    const lockerInfo = async () => {
      await currentEpoch();
      console.log("\t==== locker info =====");
      await cvx.balanceOf(locker.address).then(a=>console.log("\t   cvx: " +a));
      await cvx.balanceOf(treasury).then(a=>console.log("\t   treasury cvx: " +a));
      await stakeproxy.getBalance().then(a=>console.log("\t   staked cvx: " +a));
      var tsup = await locker.totalSupply();
      console.log("\t   totalSupply: " +tsup);
      await locker.lockedSupply().then(a=>console.log("\t   lockedSupply: " +a));
      await locker.boostedSupply().then(a=>console.log("\t   boostedSupply: " +a));
      await cvxcrv.balanceOf(locker.address).then(a=>console.log("\t   cvxcrv: " +a));
      var epochs = await locker.epochCount();
      console.log("\t   epochs: " +epochs);
      for(var i = 0; i < epochs; i++){
        var epochdata = await locker.epochs(i);
        var epochTime = epochdata.date;
        var epochSupply = epochdata.supply;
        var tsupAtEpoch = await locker.totalSupplyAtEpoch(i);
        console.log("\t   voteSupplyAtEpoch("+i+") " +tsupAtEpoch +", date: " +epochTime +"  sup: " +epochSupply);
        if(i==epochs-2){
          assert(tsupAtEpoch.toString()==tsup.toString(),"totalSupply() should be equal in value to the current epoch (" +i +")");
        }
      }
      console.log("\t----- locker info end -----");
    }
    
    const userInfo = async (_user) => {
      console.log("\t==== user info: "+userNames[_user]+" ====");
      var bal = await locker.balanceOf(_user);
      console.log("\t   balanceOf: " +bal);
      await locker.pendingLockOf(_user).then(a=>console.log("\t   pending balance: " +a));
      await locker.rewardWeightOf(_user).then(a=>console.log("\t   reward weightOf: " +a));
      await locker.lockedBalanceOf(_user).then(a=>console.log("\t   lockedBalanceOf: " +a));
      await locker.lockedBalances(_user).then(a=>console.log("\t   lockedBalances: " +a.total +", " +a.unlockable +", " +a.locked +"\n\t     lock data: " +JSON.stringify(a.lockData) ));
      await locker.balances(_user).then(a=>console.log("\t   nextunlockIndex: " +a.nextUnlockIndex ));
      await locker.claimableRewards(_user).then(a=>console.log("\t   claimableRewards: " +a));
      await cvx.balanceOf(_user).then(a=>console.log("\t   cvx wallet: " +a));
      await cvxcrv.balanceOf(_user).then(a=>console.log("\t   cvxcrv wallet: " +a));
      await cvxcrvrewards.balanceOf(_user).then(a=>console.log("\t   staked cvxcrv: " +a));
      var epochs = await locker.epochCount();
      for(var i = 0; i < epochs; i++){
        var balAtE = await locker.balanceAtEpochOf(i, _user);
        var pendingAtE = await locker.pendingLockAtEpochOf(i, _user);
        console.log("\t   voteBalanceAtEpochOf("+i+") " +balAtE +", pnd: " +pendingAtE);

        //this check is a bit annoying if you dont checkpointEpoch..
        if(!isShutdown && i==epochs-2){
          assert(balAtE.toString()==bal.toString(),"balanceOf should be equal in value to the current epoch (" +i +")");
        }
      }
      console.log("\t---- user info: "+userNames[_user]+"("+_user +") end ----");
    }

    await lockerInfo();
    await userInfo(userZ);

    console.log("start lock")
    var cvxbalance = await cvx.balanceOf(userZ);
    await cvx.approve(locker.address,cvxbalance,{from:userZ});
    var tx = await locker.lock(userZ,web3.utils.toWei("1.0", "ether"),0,{from:userZ});
    console.log("locked for user z, gas: " +tx.receipt.gasUsed);
    await lockerInfo();
    await userInfo(userZ);


    //check that balanceOf increases after next epoch starts
    console.log("\n\n\n\n##### check weight start at next epoch..\n");
    for(var i = 0; i < 7; i++){
      await advanceTime(day);
      await locker.checkpointEpoch();
      await currentEpoch();
      await userInfo(userZ);
    }

    //check that lock expires after 16 epochs
    console.log("\n\n\n\n##### check lock length and expiry..\n");
    for(var i = 0; i < 16; i++){
      await advanceTime(day*7);
      await locker.checkpointEpoch();
      await currentEpoch();
      await userInfo(userZ);
    }
    await lockerInfo();

    console.log("\n\n\n\n##### relock and normal lock and check epoch data\n");

    //move ahead an epoch just to see things more clearly
    await advanceTime(day*7);
    await locker.checkpointEpoch();
    await currentEpoch();


    //try relock and lock with order: relock -> lock
    //check relock goes to current epoch
    //check new lock goes to next epoch
    //check supply goes to correct epoch
    console.log("\n ->> relock then lock, relock to current and lock to next.");
    await locker.processExpiredLocks(true,{from:userZ});
    var tx = await locker.lock(userZ,web3.utils.toWei("1.0", "ether"),0,{from:userZ});
    console.log("locked for user z, gas: " +tx.receipt.gasUsed);
    await userInfo(userZ);
    await lockerInfo();

    //try relock&lock with different order: lock -> relock
    //check relock goes to current epoch
    //check new lock goes to next epoch
    //check supply goes to correct epoch
    await advanceTime(day*7*19);
    await locker.checkpointEpoch();
    await currentEpoch();
    console.log("\n ->> lock then relock, relock to current and lock to next.");
    var tx = await locker.lock(userZ,web3.utils.toWei("1.0", "ether"),0,{from:userZ});
    console.log("locked for user z, gas: " +tx.receipt.gasUsed);
    await locker.processExpiredLocks(true,{from:userZ});
    await userInfo(userZ);
    await lockerInfo();


    //try lock->advance 1 week-> relock (add weight to existing lock(current)) ->  lock (create new lock for next epoch)
    
    await advanceTime(day*7*20);
    await locker.checkpointEpoch();
    await currentEpoch();
    console.log("\n\n ->> lock, advance, relock, lock.");
    var tx = await locker.lock(userZ,web3.utils.toWei("1.0", "ether"),0,{from:userZ});
    console.log("locked for user z, gas: " +tx.receipt.gasUsed);
    await advanceTime(day*7);
    await currentEpoch();
    await locker.processExpiredLocks(true,{from:userZ});
    console.log("relocked")
    var tx = await locker.lock(userZ,web3.utils.toWei("2.0", "ether"),0,{from:userZ});
    console.log("locked for user z, gas: " +tx.receipt.gasUsed);
    await currentEpoch();
    await userInfo(userZ);
    await lockerInfo();


    //rewards and distribute
    //move cvxcrv from deployer for readability
    var b = await cvxcrv.balanceOf(deployer);
    await cvxcrv.transfer(userD, b, {from:deployer});

    await cvxrewards.getReward(stakeproxy.address, true, true);
    await cvxcrvrewards.balanceOf(stakeproxy.address).then(a=>console.log("staked cvxcrv on proxy: " +a));
    await cvxcrv.balanceOf(stakeproxy.address).then(a=>console.log("cvxcrv on proxy: " +a));
    await cvxcrv.balanceOf(locker.address).then(a=>console.log("cvxcrv on locker: " +a));
    await cvxcrv.balanceOf(deployer).then(a=>console.log("cvxcrv on deployer: " +a));

    await stakeproxy.distribute({from:userA}).catch(a=>console.log("fail distribute. non-harvester user A. " +a));
    await stakeproxy.distribute({from:deployer});
    console.log("distribute() from deployer");
    await stakeproxy.setDistributor(userA, true, {from:multisig,gasPrice:0});
    console.log("set distributor user a");
    await stakeproxy.distribute({from:userA});
    console.log("distribute() from user a");
    await cvxcrvrewards.balanceOf(stakeproxy.address).then(a=>console.log("staked cvxcrv on proxy: " +a));
    await cvxcrv.balanceOf(stakeproxy.address).then(a=>console.log("cvxcrv on proxy: " +a));
    await cvxcrv.balanceOf(locker.address).then(a=>console.log("cvxcrv on locker: " +a));
    await cvxcrv.balanceOf(deployer).then(a=>console.log("cvxcrv on deployer(fees): " +a));

    await lockerInfo();
    await userInfo(userZ);

    await advanceTime(day);

    await lockerInfo();
    await userInfo(userZ);

    await advanceTime(day);

    var tx = await locker.methods['getReward(address)'](userZ,{from:userZ});
    console.log("get reward for user A");
    console.log("gas used: " +tx.receipt.gasUsed);

    await userInfo(userZ);

  });
});


