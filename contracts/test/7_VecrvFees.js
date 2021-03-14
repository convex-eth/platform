const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');


const Booster = artifacts.require("Booster");
const CrvDepositor = artifacts.require("CrvDepositor");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const ExtraRewardStashV2 = artifacts.require("ExtraRewardStashV2");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const VirtualBalanceRewardPool = artifacts.require("VirtualBalanceRewardPool");
//const cCrvRewardPool = artifacts.require("cCrvRewardPool");
const cvxRewardPool = artifacts.require("cvxRewardPool");
const ConvexToken = artifacts.require("ConvexToken");
const cCrvToken = artifacts.require("cCrvToken");
const StashFactory = artifacts.require("StashFactory");
const RewardFactory = artifacts.require("RewardFactory");


const IExchange = artifacts.require("IExchange");
const IERC20 = artifacts.require("IERC20");
const ICurveGauge = artifacts.require("ICurveGauge");
const ICurveGaugeDebug = artifacts.require("ICurveGaugeDebug");
const IWalletCheckerDebug = artifacts.require("IWalletCheckerDebug");
const IBurner = artifacts.require("IBurner");



contract("VeCrv Fees Test", async accounts => {
  it("should add to whitelist, lock crv, test vecrv fee distribution", async () => {

    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let wbtc = await IERC20.at("0x2260fac5e5542a773aa44fbcfedf7c193bc2c599");
    let dai = await IERC20.at("0x6B175474E89094C44Da98b954EedeAC495271d0F");
    let vecrv = await IERC20.at("0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2");
    let threecrv = await IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
    let exchange = await IExchange.at("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
    let walletChecker = await IWalletCheckerDebug.at("0xca719728Ef172d0961768581fdF35CB116e0B7a4");
    let checkerAdmin = "0x40907540d8a6C65c637785e8f8B742ae6b0b9968";
    let vecrvWhale = "0xb01151B93B5783c252333Ce0707D704d0BBDF5EC";

    //memo: these burner addresses may change
    let burner = await IBurner.at("0xeCb456EA5365865EbAb8a2661B0c503410e9B347");
    let underlyingburner = await IBurner.at("0x786B374B5eef874279f4B7b4de16940e57301A58");
    ///////

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
    let cCrv = await cCrvToken.deployed();
    let crvDeposit = await CrvDepositor.deployed();
    let cCrvRewards = await booster.lockRewards();
    let cvxRewards = await booster.stakerRewards();
    let vecrvRewards = await booster.lockFees();
    let cCrvRewardsContract = await BaseRewardPool.at(cCrvRewards);
    let cvxRewardsContract = await cvxRewardPool.at(cvxRewards);
    let vecrvRewardsContract = await VirtualBalanceRewardPool.at(vecrvRewards);

    let starttime = await time.latest();
    console.log("current block time: " +starttime)
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //add to whitelist
    await walletChecker.approveWallet(voteproxy.address,{from:checkerAdmin,gasPrice:0});
    console.log("approve wallet");
    let isWhitelist = await walletChecker.check(voteproxy.address);
    console.log("is whitelist? " +isWhitelist);

    //exchange for crv
    await weth.sendTransaction({value:web3.utils.toWei("1.0", "ether"),from:userA});
    let wethForCrv = await weth.balanceOf(userA);
    await weth.approve(exchange.address, 0,{from:userA});
    await weth.approve(exchange.address,wethForCrv,{from:userA});
    await exchange.swapExactTokensForTokens(wethForCrv,0,[weth.address,crv.address],userA,starttime+3000,{from:userA});
    let startingcrv = await crv.balanceOf(userA);
    console.log("crv to deposit: " +startingcrv);
    
    //deposit crv and stake
    await crv.approve(crvDeposit.address,0,{from:userA});
    await crv.approve(crvDeposit.address,startingcrv,{from:userA});
    await crvDeposit.deposit(startingcrv,true,{from:userA});
    console.log("crv deposited");
    await cCrv.balanceOf(userA).then(a=>console.log("cCrv on wallet: " +a))
    await cCrv.totalSupply().then(a=>console.log("cCrv supply: " +a))
    await crv.balanceOf(crvDeposit.address).then(a=>console.log("depositor crv(>0): " +a));
    await crv.balanceOf(voteproxy.address).then(a=>console.log("proxy crv(==0): " +a));
    await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv(==0): " +a));
    console.log("crv deposited");
    await cCrv.approve(cCrvRewardsContract.address,0,{from:userA});
    await cCrv.approve(cCrvRewardsContract.address,startingcrv,{from:userA});
    await cCrvRewardsContract.stakeAll({from:userA})
    console.log("staked")
    await cCrv.balanceOf(userA).then(a=>console.log("cCrv on wallet: " +a))
    await cCrvRewardsContract.balanceOf(userA).then(a=>console.log("cCrv staked: " +a))


    //voting
    console.log("fee claiming...")

    //claim fees
    await booster.earmarkFees({from:caller});
    console.log("fees earmarked")

    //reward contract balance (should be 0 still)
    await threecrv.balanceOf(vecrvRewardsContract.address).then(a=>console.log("vecrvRewardsContract balance: " +a));

    //move forward about 2 weeks
    await time.increase(86400*15);
    await time.advanceBlock();
    console.log("advance time...");

    /// ----- burn fees to vecrv claim contracts (curve dao side) ----
    let burnerBalance = await threecrv.balanceOf("0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc");
    console.log("3crv on burner: " +burnerBalance);

    await dai.balanceOf(burner.address).then(a=>console.log("burner dai: " +a));
    //withdraw 3crv fees
    await burner.withdraw_admin_fees("0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7")
    console.log("admin fees withdrawn from pool")
    await dai.balanceOf(burner.address).then(a=>console.log("burner dai: " +a));
    await dai.balanceOf(underlyingburner.address).then(a=>console.log("dai on underlyingburner: " +a));

    //burn dai/usdt/usdc
    await burner.burn(dai.address)
    await burner.burn("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
    await burner.burn("0xdAC17F958D2ee523a2206206994597C13D831ec7")
    console.log("burnt single coins")
    
    await dai.balanceOf(burner.address).then(a=>console.log("burner dai: " +a));
    await dai.balanceOf(underlyingburner.address).then(a=>console.log("dai on underlyingburner: " +a));

    //execute to wrap everything to 3crv then send to "receiver" at 0xa464
    await underlyingburner.execute();
    console.log("burner executed")

    //should be zero now that its transfered
    await dai.balanceOf(burner.address).then(a=>console.log("burner dai: " +a));
    await dai.balanceOf(underlyingburner.address).then(a=>console.log("dai on underlyingburner: " +a));
    //burn 3crv
    await burner.burn(threecrv.address)
    console.log("burn complete, checkpoit 3crv")

    let burnerBalance2 = await threecrv.balanceOf("0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc");
    console.log("3crv on burner: " +burnerBalance2);

    /// ----- burn to vecrv claim contract complete ----

    //claim fees for convex platform
    await booster.earmarkFees();
    console.log("fees earmarked")

    //balance check (should be all in vecrv reward contract)
    await threecrv.balanceOf(vecrvRewardsContract.address).then(a=>console.log("vecrvRewardsContract balance: " +a));
    await threecrv.balanceOf(voteproxy.address).then(a=>console.log("voteproxy balance(==0): " +a));
    await threecrv.balanceOf(booster.address).then(a=>console.log("booster balance(==0): " +a));

    //check earned
    await vecrvRewardsContract.earned(userA).then(a=>console.log("earned fees: " +a));

    //increase time
    await time.increase(86400);
    await time.advanceBlock();
    console.log("advance time...");
    //check earned
    await vecrvRewardsContract.earned(userA).then(a=>console.log("earned fees: " +a));
    //increase time
    await time.increase(86400);
    await time.advanceBlock();
    console.log("advance time...");

    //check earned
    await vecrvRewardsContract.earned(userA).then(a=>console.log("earned fees: " +a));

    //before balance
    await threecrv.balanceOf(userA).then(a=>console.log("3crv before claim: " +a));
    //get reward from main contract which will also claim from children contracts(crv is main, vecrv fees is child)
    await cCrvRewardsContract.getReward({from:userA});
    await threecrv.balanceOf(userA).then(a=>console.log("3crv after claim: " +a));

  });
});
