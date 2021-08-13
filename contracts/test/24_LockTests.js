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

/*
- lock for self
- lock for other
- lock with boost
- staking underneath
- change staking ratio
- epoch growth
- balance for voting period (check valid ranges)
- total supplies at epochs (check valid ranges)
- withdrawing
- relocking
- force withdrawing/kick (too fast and proper)
- get reward
- get reward and stake cvxcrv
- distribute new rewards
- add new rewards
- cvx rewards are non-boosted
- remove distributor
- find epochs by timestamp
- shutdown
- epoch gap filling
- owner change locker
- owner change stake proxy
- stake proxy incentive
- stake proxy incentive change
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
    var userNames = {};
    userNames[userA] = "A";
    userNames[userB] = "B";
    userNames[userC] = "C";

    let starttime = await time.latest();

    //swap for cvx
    await weth.sendTransaction({value:web3.utils.toWei("20.0", "ether"),from:deployer});
    var wethBalance = await weth.balanceOf(deployer);
    console.log("receive weth: " +wethBalance)
    await weth.approve(exchange.address,wethBalance,{from:deployer});
    await exchange.swapExactTokensForTokens(web3.utils.toWei("5.0", "ether"),0,[weth.address,cvx.address],userA,starttime+3000,{from:deployer});
    await exchange.swapExactTokensForTokens(web3.utils.toWei("5.0", "ether"),0,[weth.address,cvx.address],userB,starttime+3000,{from:deployer});
    var cvxbalance = await cvx.balanceOf(userA);
    var cvxbalanceB = await cvx.balanceOf(userB);
    console.log("swapped for cvx(userA): " +cvxbalance);
    console.log("swapped for cvx(userB): " +cvxbalanceB);


    //deploy
    let locker = await CvxLocker.new({from:deployer});
    let stakeproxy = await CvxStakingProxy.new(locker.address,{from:deployer});
    console.log("deployed");
    await stakeproxy.setApprovals();
    await locker.addReward(cvxcrv.address, stakeproxy.address,{from:deployer});
    await locker.setStakingContract(stakeproxy.address,{from:deployer});
    await locker.setApprovals();

    const currentEpoch = async() =>{
      var currentTime = await time.latest();
      currentTime = (currentTime / (86400*7)).toFixed(0) * (86400*7)
      console.log("current epoch: " + currentTime);
    }
    await currentEpoch();

    await locker.epochCount().then(a=>console.log("epoch count before: " +a))
    await locker.checkpointEpoch();
    await locker.epochCount().then(a=>console.log("epoch count after: " +a))
    await locker.checkpointEpoch();
    await locker.epochCount().then(a=>console.log("epoch count after2: " +a))

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
        if(i==epochs-1){
          assert(balAtE.toString()==bal.toString(),"balanceOf should be equal to value at most recent epoch (" +i +")");
        }
      }
      console.log("\t---- user info: "+userNames[_user]+" end ----");
    }

    await lockerInfo();
    await userInfo(userA);


    //deposit

    await cvx.approve(locker.address,cvxbalance,{from:userA});
    await cvx.approve(locker.address,cvxbalanceB,{from:userB});
    console.log("approved users");
    var tx = await locker.lock(userA,"1000000000000000000",0,{from:userA});
    console.log("locked for user a, gas: " +tx.receipt.gasUsed);

    //gas should be a lot lower for second lock
    // var tx = await locker.lock(userA,"1000000000000000000",0,{from:userA});
    // console.log("locked for user a again");
    // console.log("gas used: " +tx.receipt.gasUsed);


    await lockerInfo();
    await userInfo(userA);


    // check staking rewards
    const advanceTime = async (secondsElaspse) => {
      await time.increase(secondsElaspse);
      await time.advanceBlock();
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;
    await advanceTime(day);

    await stakeproxy.distribute();
    console.log("distribute()");

    await lockerInfo();
    await userInfo(userA);

    await advanceTime(day);

    await lockerInfo();
    await userInfo(userA);

    await advanceTime(day);

    await lockerInfo();
    await userInfo(userA);

    var tx = await locker.getReward(userA,false,{from:userA});
    console.log("get reward for user A");
    console.log("gas used: " +tx.receipt.gasUsed);

    await userInfo(userA);
    await advanceTime(day*2); //may need to be shifted for testing epoch change
    await userInfo(userA);
    var tx = await locker.getReward(userA,true,{from:userA});
    console.log("get reward for user A and stake");
    console.log("gas used: " +tx.receipt.gasUsed);
    await userInfo(userA);

    await locker.epochCount().then(a=>console.log("epoch count: " +a))
    var tx = await locker.lock(userA,"1000000000000000000",0,{from:userA});
    console.log("locked for user a");
    console.log("gas used: " +tx.receipt.gasUsed);
    await locker.epochCount().then(a=>console.log("epoch count: " +a))
    await lockerInfo();
    await userInfo(userA);
    var tx = await locker.lock(userA,"1000000000000000000",0,{from:userB});
    console.log("locked for user a from b, gas used: " +tx.receipt.gasUsed);
    await lockerInfo();
    await userInfo(userA);
    await userInfo(userB);


    console.log("try boost deposits")
    //try boost deposit
    await locker.lock(userB,"1000000000000000000",500,{from:userB}).catch(a=>console.log(" -> reverted. too much boost"));
    await locker.setBoost(500,10000,treasury,{from:deployer});
    console.log("setBoost called");
    await advanceTime(day*7);
    await lockerInfo();
    await locker.checkpointEpoch();
    console.log("checkpointEpoch to set new boost parameters")
    var tx = await locker.lock(userB,"1000000000000000000",500,{from:userB})
    console.log("locked with boost, gas: " +tx.receipt.gasUsed);
    await lockerInfo();
    await userInfo(userB);

    var tx = await locker.lock(userA,"1000000000000000000",0,{from:userA});
    console.log("locked more for user a, gas: " +tx.receipt.gasUsed);
    await userInfo(userA);


    console.log("try stake ratio change");
    console.log("set to 0/50");
    await locker.setStakeLimits(0,5000,{from:deployer});
    await lockerInfo();
    console.log("set to 0/0")
    await locker.setStakeLimits(0,0,{from:deployer});
    console.log("try deposit user b")
    var tx = await locker.lock(userB,"1000000000000000000",0,{from:userB})
    await userInfo(userB);
    await lockerInfo();
    console.log("set to 90/100")
    await locker.setStakeLimits(9000,10000,{from:deployer});
    await lockerInfo();
    console.log("set to 100/100")
    await locker.setStakeLimits(10000,10000,{from:deployer});
    await lockerInfo();

    await advanceTime(day*7);
    var tx = await locker.lock(userA,"1000000000000000000",0,{from:userA});
    console.log("locked more for user a, gas: " +tx.receipt.gasUsed);
    await userInfo(userA);

    await lockerInfo();
    await advanceTime(day*7*3);
    await lockerInfo();
    await locker.checkpointEpoch();
    console.log("checkpoint epochs, should fill skipped epochs");
    await lockerInfo();

    console.log("jump to lock expiry")
    await advanceTime(day*7*12);
    await locker.checkpointEpoch();
    await currentEpoch();
    await lockerInfo();
    await userInfo(userA);

    console.log("process locks for user A, check cvx supply, user lock data update, user wallet info")
    var tx = await locker.processExpiredLocks(false,{from:userA});
    console.log("gas cost: " +tx.receipt.gasUsed);
    await lockerInfo();
    await userInfo(userA);


    await advanceTime(day*7*4);
    await locker.checkpointEpoch();
    await lockerInfo();
    await userInfo(userA);

    console.log("process locks for user A, check cvx supply, user lock data update, user wallet info")
    var tx = await locker.methods['processExpiredLocks(bool,uint256,address)'](true,500,userA,{from:userA});
    console.log("gas cost: " +tx.receipt.gasUsed);
    await lockerInfo();
    await userInfo(userA);

    await advanceTime(day*7);
    await locker.checkpointEpoch();
    await lockerInfo();
    await userInfo(userA);
  });
});


