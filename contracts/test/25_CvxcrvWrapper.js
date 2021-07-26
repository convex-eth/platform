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


contract("Test cvxcrv stake wrapper", async accounts => {
  it("should deposit cvxcrv and earn rewards while being transferable", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"

    //system
    let booster = await Booster.at(contractList.system.booster);
    let voteproxy = await CurveVoterProxy.at(contractList.system.voteProxy);
    let crvDeposit = await CrvDepositor.at(contractList.system.crvDepositor);
    let cvx = await ConvexToken.at(contractList.system.cvx);
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let threeCrv = await IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
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
    await exchange.swapExactTokensForTokens(web3.utils.toWei("10.0", "ether"),0,[weth.address,crv.address],deployer,starttime+3000,{from:deployer});
    var crvbalance = await crv.balanceOf(deployer);
    console.log("swapped for crv: " +crvbalance);

    // await crv.approve(crvDeposit.address,crvbalance,{from:deployer});
    // console.log("approved");
    // await crvDeposit.deposit(crvbalance,false,addressZero,{from:deployer});
    // console.log("crv deposited");
    var crvbalance = await crv.balanceOf(deployer);
    console.log("crvbalance: " +crvbalance);

    var touserB = crvbalance.div(new BN("3"));
    await crv.transfer(userB,touserB,{from:deployer});
    crvbalance = await crv.balanceOf(deployer);
    await crv.transfer(userA,crvbalance,{from:deployer});
    var userABalance = await crv.balanceOf(userA);
    var userBBalance = await crv.balanceOf(userB);
    console.log("userA: " +userABalance +",  userB: " +userBBalance);

    let lib = await CvxMining.new();
    console.log("mining lib at: " +lib.address);
    await CvxCrvStakingWrapper.link("CvxMining", lib.address);
    let staker = await CvxCrvStakingWrapper.new(addressZero,"","",{from:deployer});
    // await CvxCrvRari.link("CvxMining", lib.address);
    // let staker = await CvxCrvRari.new(addressZero,{from:deployer});
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
    await crv.approve(staker.address,userABalance,{from:userA});
    await crv.approve(crvDeposit.address,userBBalance,{from:userB});
    await cvxCrv.approve(staker.address,userBBalance,{from:userB});
    console.log("approved booster and staker");
    await crvDeposit.deposit(userBBalance,false,addressZero,{from:userB});
    console.log("deposited into convex for user b");


    await staker.deposit(userABalance,userA,{from:userA});
    console.log("user A deposited")
    await cvxCrv.balanceOf(userB).then(a=>console.log("user b cvxCrv: " +a));
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
    await threeCrv.balanceOf(userA).then(a=>console.log("user a wallet threeCrv: " +a));
    console.log("-----");
    await staker.earned(userB).then(a=>console.log("user b earned: " +a ));
    await crv.balanceOf(userB).then(a=>console.log("user b wallet crv: " +a));
    await cvx.balanceOf(userB).then(a=>console.log("user b wallet cvx: " +a));
    await threeCrv.balanceOf(userB).then(a=>console.log("user b wallet threeCrv: " +a));

    console.log("checkpoint");
    await staker.user_checkpoint([userA,addressZero]);
    await staker.user_checkpoint([userB,addressZero]);
    await crv.balanceOf(staker.address).then(a=>console.log("staker crv: " +a));
    await cvx.balanceOf(staker.address).then(a=>console.log("staker cvx: " +a));
    await threeCrv.balanceOf(staker.address).then(a=>console.log("staker threeCrv: " +a));
    for(var i = 0; i < rewardCount; i++){
      var rInfo = await staker.rewards(i);
      console.log("rewards " +i +": " +JSON.stringify(rInfo));
    }


    console.log("======");
    await staker.earned(userA).then(a=>console.log("user a earned: " +a ));
    await crv.balanceOf(userA).then(a=>console.log("user a wallet crv: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("user a wallet cvx: " +a));
    await threeCrv.balanceOf(userA).then(a=>console.log("user a wallet threeCrv: " +a));
    console.log("-----");
    await staker.earned(userB).then(a=>console.log("user b earned: " +a ));
    await crv.balanceOf(userB).then(a=>console.log("user b wallet crv: " +a));
    await cvx.balanceOf(userB).then(a=>console.log("user b wallet cvx: " +a));
    await threeCrv.balanceOf(userB).then(a=>console.log("user b wallet threeCrv: " +a));

    //test transfering to account C
    await staker.transfer(userC,userBBalance,{from:userB});
    console.log("transfer to userC");
    await staker.earned(userB).then(a=>console.log("user b earned: " +a ));
    await crv.balanceOf(userB).then(a=>console.log("user b wallet crv: " +a));
    await cvx.balanceOf(userB).then(a=>console.log("user b wallet cvx: " +a));
    await threeCrv.balanceOf(userB).then(a=>console.log("user b wallet threeCrv: " +a));
    console.log("-----");
    await staker.earned(userC).then(a=>console.log("user c earned: " +a ));
    await crv.balanceOf(userC).then(a=>console.log("user c wallet crv: " +a));
    await cvx.balanceOf(userC).then(a=>console.log("user c wallet cvx: " +a));
    await threeCrv.balanceOf(userC).then(a=>console.log("user c wallet threeCrv: " +a));

    await time.increase(86400);
    await time.advanceBlock();
    console.log("\nadvance time...\n");

    await staker.earned(userB).then(a=>console.log("user b earned: " +a ));
    await crv.balanceOf(userB).then(a=>console.log("user b wallet crv: " +a));
    await cvx.balanceOf(userB).then(a=>console.log("user b wallet cvx: " +a));
    await threeCrv.balanceOf(userB).then(a=>console.log("user b wallet threeCrv: " +a));
    console.log("-----");
    await staker.earned(userC).then(a=>console.log("user c earned: " +a ));
    await crv.balanceOf(userC).then(a=>console.log("user c wallet crv: " +a));
    await cvx.balanceOf(userC).then(a=>console.log("user c wallet cvx: " +a));
    await threeCrv.balanceOf(userC).then(a=>console.log("user c wallet threeCrv: " +a));


    //withdraw
    console.log("withdrawing...");
    await staker.withdraw(userABalance,{from:userA});
    await staker.withdraw(0,{from:userB});
    await staker.withdraw(userBBalance,{from:userC});
    await staker.getReward(userA,{from:userA});
    await staker.getReward(userB,{from:userB});
    await staker.getReward(userC,{from:userC});
    console.log("withdrew and claimed all");

    console.log("try claim again");
    await staker.getReward(userC,{from:userC});

    await staker.earned(userA).then(a=>console.log("user a earned: " +a ));
    await crv.balanceOf(userA).then(a=>console.log("user a wallet crv: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("user a wallet cvx: " +a));
    await threeCrv.balanceOf(userA).then(a=>console.log("user a wallet threeCrv: " +a));
    console.log("-----");
    await staker.earned(userB).then(a=>console.log("user b earned: " +a ));
    await crv.balanceOf(userB).then(a=>console.log("user b wallet crv: " +a));
    await cvx.balanceOf(userB).then(a=>console.log("user b wallet cvx: " +a));
    await threeCrv.balanceOf(userB).then(a=>console.log("user b wallet threeCrv: " +a));
    console.log("-----");
    await staker.earned(userC).then(a=>console.log("user c earned: " +a ));
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

  });
});


