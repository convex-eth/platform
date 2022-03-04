// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const CvxLocker = artifacts.require("CvxLocker");
const CvxStakingProxy = artifacts.require("CvxStakingProxy");
const IERC20 = artifacts.require("IERC20");
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

contract("Test Deploy locker for UI testing", async accounts => {
  it("should deploy contracts", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let treasury = "0x1389388d01708118b497f59521f6943Be2541bb7";
    let addressZero = "0x0000000000000000000000000000000000000000"

    //system
    let cvx = await IERC20.at(contractList.system.cvx);
    let cvxcrv = await IERC20.at(contractList.system.cvxCrv);

    let userA = accounts[0];
    let userB = accounts[1];
    let userC = accounts[2];
    let userD = accounts[3];
    var userNames = {};
    userNames[userA] = "A";
    userNames[userB] = "B";
    userNames[userC] = "C";
    userNames[userD] = "D";

    var isShutdown = false;

    let starttime = await time.latest();
    await unlockAccount(multisig);
    await unlockAccount(deployer);
    await unlockAccount(treasury);

    const advanceTime = async (secondsElaspse) => {
      await time.increase(secondsElaspse);
      await time.advanceBlock();
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;

    //get old locker
    var oldLocker = await CvxLocker.at(contractList.system.locker);

    //send cvx to usera
    await cvx.transfer(userA, web3.utils.toWei("123.0", "ether"),{from:treasury, gasPrice:0});
    await cvx.approve(oldLocker.address,web3.utils.toWei("123.0", "ether"),{from:userA});
    await oldLocker.lock(userA,web3.utils.toWei("123.0", "ether"),0,{from:userA});
    await advanceTime(7*day*7);
    await oldLocker.checkpointEpoch();
    console.log("userA locked and fast forwarded");
    await oldLocker.lockedBalanceOf(userA).then(a=>console.log("locked balance: " +a));

    //shutdown old locker
    var lockeradmin = await LockerAdmin.at(contractList.system.lockerAdmin);
    await lockeradmin.shutdown({from:multisig,gasPrice:0});
    console.log("shutdown v1");

    //deploy
    let locker = await CvxLockerV2.new({from:deployer});
    let stakeproxy = await CvxStakingProxyV2.new(locker.address,{from:deployer});
    console.log("deployed v2: " +locker.address);
    await stakeproxy.setApprovals();
    await locker.addReward(cvxcrv.address, stakeproxy.address, true, {from:deployer});
    await locker.setStakingContract(stakeproxy.address,{from:deployer});
    await locker.setApprovals();
    await locker.checkpointEpoch();
    console.log("done");
    
  });
});


