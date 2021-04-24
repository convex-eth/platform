const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const CrvDepositor = artifacts.require("CrvDepositor");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const ExtraRewardStashV2 = artifacts.require("ExtraRewardStashV2");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const VirtualBalanceRewardPool = artifacts.require("VirtualBalanceRewardPool");
//const cvxCrvRewardPool = artifacts.require("cvxCrvRewardPool");
const cvxRewardPool = artifacts.require("cvxRewardPool");
const ConvexToken = artifacts.require("ConvexToken");
const cvxCrvToken = artifacts.require("cvxCrvToken");
const StashFactory = artifacts.require("StashFactory");
const RewardFactory = artifacts.require("RewardFactory");


const IExchange = artifacts.require("IExchange");
const ICurveFi = artifacts.require("I3CurveFi");
const IERC20 = artifacts.require("IERC20");
const IVoting = artifacts.require("IVoting");
const IVoteStarter = artifacts.require("IVoteStarter");
const IWalletCheckerDebug = artifacts.require("IWalletCheckerDebug");
const IEscro = artifacts.require("IEscro");




contract("Whitelist Test", async accounts => {
  it("should add to whitelist and test locking", async () => {
    let account = accounts[0];
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let threeCrv = await IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let vecrv = await IERC20.at("0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2");
    let exchange = await IExchange.at("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
    let walletChecker = await IWalletCheckerDebug.at("0xca719728Ef172d0961768581fdF35CB116e0B7a4");
    let escrow = await IEscro.at("0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2");
    let checkerAdmin = "0x40907540d8a6C65c637785e8f8B742ae6b0b9968";


    let admin = accounts[0];
    let userA = accounts[1];
    let userB = accounts[2];
    let caller = accounts[3];

    //system
    let voteproxy = await CurveVoterProxy.deployed();
    let booster = await Booster.deployed();
    let rewardFactory = await RewardFactory.deployed();
    let stashFactory = await StashFactory.deployed();
    let cvx = await ConvexToken.deployed();
    let cvxCrv = await cvxCrvToken.deployed();
    let crvDeposit = await CrvDepositor.deployed();
    let cvxCrvRewards = await booster.lockRewards();
    let cvxRewards = await booster.stakerRewards();
    let cvxCrvRewardsContract = await BaseRewardPool.at(cvxCrvRewards);
    let cvxRewardsContract = await cvxRewardPool.at(cvxRewards);

    var poolId = contractList.pools.find(pool => pool.name == "3pool").id;
    let poolinfo = await booster.poolInfo(poolId);
    let rewardPoolAddress = poolinfo.crvRewards;
    let rewardPool = await BaseRewardPool.at(rewardPoolAddress);

    let starttime = await time.latest();
    console.log("current block time: " +starttime)
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //exchange for crv
    await weth.sendTransaction({value:web3.utils.toWei("1.0", "ether"),from:userA});
    let wethForCrv = await weth.balanceOf(userA);
    await weth.approve(exchange.address, 0,{from:userA});
    await weth.approve(exchange.address,wethForCrv,{from:userA});
    await exchange.swapExactTokensForTokens(wethForCrv,0,[weth.address,crv.address],userA,starttime+3000,{from:userA});
    let startingcrv = await crv.balanceOf(userA);
    console.log("crv to deposit: " +startingcrv);
    
    //deposit crv
    await crv.approve(crvDeposit.address,0,{from:userA});
    await crv.approve(crvDeposit.address,startingcrv,{from:userA});
    await crvDeposit.deposit(startingcrv,true,"0x0000000000000000000000000000000000000000",{from:userA});
    console.log("crv deposited");

    //check balances, crv should still be on depositor
    await crv.balanceOf(userA).then(a=>console.log("crv on wallet: " +a))
    await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))
    await crv.balanceOf(crvDeposit.address).then(a=>console.log("depositor crv(>0): " +a));
    await crv.balanceOf(voteproxy.address).then(a=>console.log("proxy crv(==0): " +a));
    await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv(==0): " +a));

    //try burning from cvxCrv to reclaim crv (only doable before lock made)
    console.log("try burn 100 cvxCrv");
    await crvDeposit.burn(100,{from:userA});
    await crv.balanceOf(userA).then(a=>console.log("crv on wallet: " +a))
    await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))

    //add to whitelist
    await walletChecker.approveWallet(voteproxy.address,{from:checkerAdmin,gasPrice:0});
    console.log("approve wallet");
    let isWhitelist = await walletChecker.check(voteproxy.address);
    console.log("is whitelist? " +isWhitelist);

    //get more crv
    await weth.sendTransaction({value:web3.utils.toWei("1.0", "ether"),from:userA});
    let wethForCrv2 = await weth.balanceOf(userA);
    await weth.approve(exchange.address, 0,{from:userA});
    await weth.approve(exchange.address,wethForCrv2,{from:userA});
    await exchange.swapExactTokensForTokens(wethForCrv2,0,[weth.address,crv.address],userA,starttime+3000,{from:userA});
    var crvBal = await crv.balanceOf(userA);
    console.log("crv to deposit(2): " +crvBal);


    //split into 3 deposits
    // 1: initial lock
    // 2: within 2 weeks (triggers only amount increase)
    // 3: after 2 weeks (triggers amount+time increase)

    //deposit crv (after whitelist)
    await crv.approve(crvDeposit.address,0,{from:userA});
    await crv.approve(crvDeposit.address,crvBal,{from:userA});
    await crvDeposit.deposit(1,true,"0x0000000000000000000000000000000000000000",{from:userA});
    console.log("crv deposited (initial lock)");

    //check balances, crv should have moved to proxy and vecrv should be >0
    await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))
    await crv.balanceOf(crvDeposit.address).then(a=>console.log("depositor crv(==0): " +a));
    await crv.balanceOf(voteproxy.address).then(a=>console.log("proxy crv(==0): " +a));
    await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv(>0): " +a));
    await escrow.locked__end(voteproxy.address).then(a=>console.log("proxy unlock date: " +a));

    //try burning again after lock, which will fail
    await crv.balanceOf(userA).then(a=>console.log("crv on wallet: " +a))
    await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))
    console.log("try burn 100 cvxCrv after whitelist(should catch error)");
    await crvDeposit.burn(100,{from:userA}).catch(a=>console.log("--> burn reverted"));

    await crv.balanceOf(userA).then(a=>console.log("crv on wallet: " +a))
    await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))

    //increase time a bit
    await time.increase(86400);
    await time.advanceBlock();
    console.log("advance time....");

    //deposit more crv, this should trigger a amount increase only
    // vecrv should go up, unlock date should stay the same
    await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv(>0): " +a));
    await crvDeposit.deposit(12345678900,true,"0x0000000000000000000000000000000000000000",{from:userA});
    console.log("crv deposited (amount increase only)");
    await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))
    await crv.balanceOf(crvDeposit.address).then(a=>console.log("depositor crv(==0): " +a));
    await crv.balanceOf(voteproxy.address).then(a=>console.log("proxy crv(==0): " +a));
    await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv(>0): " +a));
    await escrow.locked__end(voteproxy.address).then(a=>console.log("proxy unlock date: " +a));
    
    //increase by more than 2 weeks
    await time.increase(15*86400);
    await time.advanceBlock();
    console.log("advance time....");

    //deposit rest of crv
    //vecrv AND unlock date should increase
    crvBal = await crv.balanceOf(userA);
    await crvDeposit.deposit(crvBal,true,"0x0000000000000000000000000000000000000000",{from:userA});
    console.log("crv deposited (amount+time increase)");
    await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))
    await crv.balanceOf(crvDeposit.address).then(a=>console.log("depositor crv(==0): " +a));
    await crv.balanceOf(voteproxy.address).then(a=>console.log("proxy crv(==0): " +a));
    await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv(>0): " +a));
    await escrow.locked__end(voteproxy.address).then(a=>console.log("proxy unlock date: " +a));

    //advance time by 1.5 months
    await time.increase(45*86400);
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time....");

    await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv(>0): " +a));

    //get more crv
    await weth.sendTransaction({value:web3.utils.toWei("1.0", "ether"),from:userA});
    let wethForCrv3 = await weth.balanceOf(userA);
    await weth.approve(exchange.address, 0,{from:userA});
    await weth.approve(exchange.address,wethForCrv3,{from:userA});
    await exchange.swapExactTokensForTokens(wethForCrv3,0,[weth.address,crv.address],userA,starttime+3000,{from:userA});
    crvBal = await crv.balanceOf(userA);
    console.log("crv to deposit(3): " +crvBal);


    //deposit crv (after whitelist) without locking immediately
    await crv.approve(crvDeposit.address,0,{from:userA});
    await crv.approve(crvDeposit.address,crvBal,{from:userA});
    await crvDeposit.deposit(crvBal,false,"0x0000000000000000000000000000000000000000",{from:userA});
    console.log("crv deposited but not locked");
    await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))
    await crv.balanceOf(crvDeposit.address).then(a=>console.log("depositor crv(==0): " +a));
    await crv.balanceOf(voteproxy.address).then(a=>console.log("proxy crv(==0): " +a));
    await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv: " +a));


    //NOTE: when testing for release and re creation of lock
    //this function timeouts in infura when trying to process 4 years.
    //to test release/createlock, the contract needs to be modified to only lock a month or so

    //lock deposited crv, caller should get a bit of cvxCrv for compensation
    await crvDeposit.lockCurve({from:caller});
    console.log("crv locked")
    await cvxCrv.balanceOf(userA).then(a=>console.log("cvxCrv on wallet: " +a))
    await cvxCrv.balanceOf(caller).then(a=>console.log("cvxCrv on caller: " +a))
    await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))
    await crv.balanceOf(crvDeposit.address).then(a=>console.log("depositor crv(==0): " +a));
    await crv.balanceOf(voteproxy.address).then(a=>console.log("proxy crv(==0): " +a));
    await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv(>0): " +a));


  });
});


