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
const ConvexStakingWrapper = artifacts.require("ConvexStakingWrapper");
const IERC20 = artifacts.require("IERC20");
const ICurveAavePool = artifacts.require("ICurveAavePool");
const IExchange = artifacts.require("IExchange");
const IUniswapV2Router01 = artifacts.require("IUniswapV2Router01");
const CvxMining = artifacts.require("CvxMining");

contract("Test stake wrapper", async accounts => {
  it("should deposit lp tokens and earn rewards while being transferable", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"

    //system
    let booster = await Booster.at(contractList.system.booster);
    let voteproxy = await CurveVoterProxy.at(contractList.system.voteProxy);
    let cvx = await ConvexToken.at(contractList.system.cvx);
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let stkaave = await IERC20.at("0x4da27a545c0c5B758a6BA100e3a049001de870f5");
    let cvxCrv = await cvxCrvToken.at(contractList.system.cvxCrv);
    let cvxCrvLP = await IERC20.at(contractList.system.cvxCrvCrvSLP);
    let exchange = await IExchange.at("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
    let exchangerouter = await IUniswapV2Router01.at("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let curveAave = await IERC20.at("0xFd2a8fA60Abd58Efe3EeE34dd494cD491dC14900");
    let convexAave = await IERC20.at("0x23F224C37C3A69A058d86a54D3f561295A93d542");
    let aavepool = 24;
    let aaveswap = await ICurveAavePool.at("0xDeBF20617708857ebe4F679508E7b7863a8A8EeE");
    let convexAaveRewards = await BaseRewardPool.at("0xE82c1eB4BC6F92f85BF7EB6421ab3b882C3F5a7B");
    let dai = await IERC20.at("0x6B175474E89094C44Da98b954EedeAC495271d0F");

    let userA = accounts[0];
    let userB = accounts[1];
    let userC = accounts[2];

    let starttime = await time.latest();
    await weth.sendTransaction({value:web3.utils.toWei("10.0", "ether"),from:deployer});
    var wethBalance = await weth.balanceOf(deployer);
    console.log("receive weth: " +wethBalance)
    await weth.approve(exchange.address,wethBalance,{from:deployer});
    await exchange.swapExactTokensForTokens(web3.utils.toWei("10.0", "ether"),0,[weth.address,dai.address],deployer,starttime+3000,{from:deployer});
    var daibalance = await dai.balanceOf(deployer);
    console.log("swapped for dai: " +daibalance);

    await dai.approve(aaveswap.address,daibalance,{from:deployer});
    console.log("approved");
    await aaveswap.add_liquidity([daibalance,0,0],0,true,{from:deployer});
    console.log("liq added");
    var lpbalance = await curveAave.balanceOf(deployer);
    console.log("lpbalance: " +lpbalance);

    var touserB = lpbalance.div(new BN("3"));
    await curveAave.transfer(userB,touserB,{from:deployer});
    lpbalance = await curveAave.balanceOf(deployer);
    await curveAave.transfer(userA,lpbalance,{from:deployer});
    var userABalance = await curveAave.balanceOf(userA);
    var userBBalance = await curveAave.balanceOf(userB);
    console.log("userA: " +userABalance +",  userB: " +userBBalance);

    let lib = await CvxMining.new();
    console.log("mining lib at: " +lib.address);
    await ConvexStakingWrapper.link("CvxMining", lib.address);
    let staker = await ConvexStakingWrapper.new(curveAave.address,convexAave.address,convexAaveRewards.address, aavepool, addressZero,{from:deployer});
    console.log("staker token: " +staker.address);
    await staker.name().then(a=>console.log("name: " +a));
    await staker.symbol().then(a=>console.log("symbol: " +a));
    await staker.setApprovals();
    await staker.addRewards({from:deployer});

    let rewardCount = await staker.rewardLength();
    for(var i = 0; i < rewardCount; i++){
      var rInfo = await staker.rewards(i);
      console.log("rewards " +i +": " +JSON.stringify(rInfo));
    }

    //user A will deposit curve tokens and user B convex
    await curveAave.approve(staker.address,userABalance,{from:userA});
    await curveAave.approve(booster.address,userBBalance,{from:userB});
    await convexAave.approve(staker.address,userBBalance,{from:userB});
    console.log("approved booster and staker");
    await booster.depositAll(aavepool, false, {from:userB});
    console.log("deposited into convex");


    await staker.deposit(userABalance,userA,{from:userA});
    console.log("user A deposited")
    await convexAave.balanceOf(userB).then(a=>console.log("user b convex aave: " +a));
    await staker.stake(userBBalance,userB,{from:userB});
    console.log("user b staked");
    await staker.totalSupply().then(a=>console.log("staker supply: " +a));

    await staker.balanceOf(userA).then(a=>console.log("user a: " +a));
    await staker.balanceOf(userB).then(a=>console.log("user b: " +a));

    await staker.earned(userA).then(a=>console.log("user a earned: " +a));
    await staker.earned(userB).then(a=>console.log("user b earned: " +a));

    await time.increase(86400);
    await time.advanceBlock();
    console.log("advance time...");

    console.log("======");
    await staker.earned(userA).then(a=>console.log("user a earned: " +a ));
    await crv.balanceOf(userA).then(a=>console.log("user a wallet crv: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("user a wallet cvx: " +a));
    await stkaave.balanceOf(userA).then(a=>console.log("user a wallet stkaave: " +a));
    console.log("-----");
    await staker.earned(userB).then(a=>console.log("user b earned: " +a ));
    await crv.balanceOf(userB).then(a=>console.log("user b wallet crv: " +a));
    await cvx.balanceOf(userB).then(a=>console.log("user b wallet cvx: " +a));
    await stkaave.balanceOf(userB).then(a=>console.log("user b wallet stkaave: " +a));

    console.log("checkpoint");
    await staker.user_checkpoint([userA,addressZero]);
    await staker.user_checkpoint([userB,addressZero]);
    await crv.balanceOf(staker.address).then(a=>console.log("staker crv: " +a));
    await cvx.balanceOf(staker.address).then(a=>console.log("staker cvx: " +a));
    await stkaave.balanceOf(staker.address).then(a=>console.log("staker stkaave: " +a));
    for(var i = 0; i < rewardCount; i++){
      var rInfo = await staker.rewards(i);
      console.log("rewards " +i +": " +JSON.stringify(rInfo));
    }


    console.log("======");
    await staker.earned(userA).then(a=>console.log("user a earned: " +a ));
    await crv.balanceOf(userA).then(a=>console.log("user a wallet crv: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("user a wallet cvx: " +a));
    await stkaave.balanceOf(userA).then(a=>console.log("user a wallet stkaave: " +a));
    console.log("-----");
    await staker.earned(userB).then(a=>console.log("user b earned: " +a ));
    await crv.balanceOf(userB).then(a=>console.log("user b wallet crv: " +a));
    await cvx.balanceOf(userB).then(a=>console.log("user b wallet cvx: " +a));
    await stkaave.balanceOf(userB).then(a=>console.log("user b wallet stkaave: " +a));

    //test transfering to account C


    //withdraw
    console.log("withdrawing...");
    await staker.withdrawAndUnwrap(userABalance,{from:userA});
    await staker.withdraw(userBBalance,{from:userB});
    await staker.getReward(userA,{from:userA});
    await staker.getReward(userB,{from:userB});
    console.log("withdrew all");

    await staker.earned(userA).then(a=>console.log("user a earned: " +a ));
    await crv.balanceOf(userA).then(a=>console.log("user a wallet crv: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("user a wallet cvx: " +a));
    await stkaave.balanceOf(userA).then(a=>console.log("user a wallet stkaave: " +a));
    console.log("-----");
    await staker.earned(userB).then(a=>console.log("user b earned: " +a ));
    await crv.balanceOf(userB).then(a=>console.log("user b wallet crv: " +a));
    await cvx.balanceOf(userB).then(a=>console.log("user b wallet cvx: " +a));
    await stkaave.balanceOf(userB).then(a=>console.log("user b wallet stkaave: " +a));

    //check whats left on the staker
    console.log(">>> remaining check <<<<");
    await staker.balanceOf(userA).then(a=>console.log("user a staked: " +a));
    await staker.balanceOf(userB).then(a=>console.log("user b staked: " +a));
    await staker.totalSupply().then(a=>console.log("remaining supply: " +a));
    await crv.balanceOf(staker.address).then(a=>console.log("remaining crv: " +a));
    await cvx.balanceOf(staker.address).then(a=>console.log("remaining cvx: " +a));
    await stkaave.balanceOf(staker.address).then(a=>console.log("remaining stkaave: " +a));

  });
});


