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


contract("setup lock contract", async accounts => {
  it("should setup lock contract", async () => {
    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let treasury = "0x1389388d01708118b497f59521f6943Be2541bb7";
    let addressZero = "0x0000000000000000000000000000000000000000"

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

    await time.latest().then(a=>console.log("current time: " +a))
    await time.latestBlock().then(a=>console.log("current block: " +a));
    await time.increase(86400 * 7);
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time to next epoch...");
    await time.latest().then(a=>console.log("current time: " +a))
    await time.latestBlock().then(a=>console.log("current block: " +a));

    let cvx = await IERC20.at(contractList.system.cvx);
    let stakeproxy = await CvxStakingProxy.at(contractList.system.lockerStakeProxy);
    let locker = await CvxLocker.at(contractList.system.locker);
    let cvxcrv = await IERC20.at(contractList.system.cvxCrv);
    let cvxrewards = await cvxRewardPool.at(contractList.system.cvxRewards);
    let cvxcrvrewards = await cvxRewardPool.at(contractList.system.cvxCrvRewards);

    await stakeproxy.distribute();
    console.log("staking rewards distributed");

    const lockerInfo = async () => {
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
        if(i==epochs-1){
          assert(tsupAtEpoch.toString()==tsup.toString(),"totalSupply() should be equal to value at most recent epoch (" +i +")");
        }
      }
      console.log("\t----- locker info end -----");
    }
    
    const userInfo = async (_user) => {
      console.log("\t==== user info: "+userNames[_user]+" ====");
      var bal = await locker.balanceOf(_user);
      console.log("\t   balanceOf: " +bal);
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
        console.log("\t   voteBalanceAtEpochOf("+i+") " +balAtE );
        if(!isShutdown && i==epochs-1){
          assert(balAtE.toString()==bal.toString(),"balanceOf should be equal to value at most recent epoch (" +i +")");
        }
      }
      console.log("\t---- user info: "+userNames[_user]+"("+_user +") end ----");
    }

    await lockerInfo();
    await userInfo(userA);
  });
});


