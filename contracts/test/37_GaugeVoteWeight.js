// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
const { keccak256: k256 } = require('ethereum-cryptography/keccak');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const CvxLocker = artifacts.require("CvxLocker");
const CvxStakingProxy = artifacts.require("CvxStakingProxy");
const cvxRewardPool = artifacts.require("cvxRewardPool");
const IERC20 = artifacts.require("IERC20");
const IExchange = artifacts.require("IExchange");
const IUniswapV2Router01 = artifacts.require("IUniswapV2Router01");
const DepositToken = artifacts.require("DepositToken");
const IDelegation = artifacts.require("IDelegation");
const BasicCvxHolder = artifacts.require("BasicCvxHolder");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const VotingBalance = artifacts.require("VotingBalance");
const VotingBalanceMax = artifacts.require("VotingBalanceMax");


contract("check vote balance", async accounts => {
  it("should check vote balance", async () => {

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

    const advanceTime = async (secondsElaspse) => {
      await time.increase(secondsElaspse);
      await time.advanceBlock();
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;

    //swap for cvx
    // await weth.sendTransaction({value:web3.utils.toWei("10.0", "ether"),from:deployer});
    // var wethBalance = await weth.balanceOf(deployer);
    // console.log("receive weth: " +wethBalance)
    // await weth.approve(exchange.address,wethBalance,{from:deployer});
    // await exchange.swapExactTokensForTokens(web3.utils.toWei("10.0", "ether"),0,[weth.address,cvx.address],userA,starttime+3000,{from:deployer});
    // var cvxbalance = await cvx.balanceOf(userA);
    // console.log("swapped for cvx(userA): " +cvxbalance);

    //deploy
    let locker = await CvxLocker.at(contractList.system.locker);
    let votebalance = await VotingBalanceMax.new({from:deployer});

    await locker.lockedBalanceOf(userZ).then(a => console.log("locked coins: " +a))
    await locker.balanceOf(userZ).then(a => console.log("balance via locker: " +a))
    await votebalance.balanceOf(userZ).then(a => console.log("balance via votebalance: " +a))
    await votebalance.pendingBalanceOf(userZ).then(a => console.log("pending balance: " +a))
    await cvx.balanceOf(userZ).then(a => console.log("balance on wallet: " +a))

    await advanceTime(day);

    await locker.lockedBalanceOf(userZ).then(a => console.log("locked coins: " +a))
    await locker.balanceOf(userZ).then(a => console.log("balance via locker: " +a))
    await votebalance.balanceOf(userZ).then(a => console.log("balance via votebalance: " +a))
    await votebalance.pendingBalanceOf(userZ).then(a => console.log("pending balance: " +a))
    await cvx.balanceOf(userZ).then(a => console.log("balance on wallet: " +a))

    await locker.processExpiredLocks(true,{from:userZ});
    console.log("relocked")

    await locker.lockedBalanceOf(userZ).then(a => console.log("locked coins: " +a))
    await locker.balanceOf(userZ).then(a => console.log("balance via locker: " +a))
    await votebalance.balanceOf(userZ).then(a => console.log("balance via votebalance: " +a))
    await votebalance.pendingBalanceOf(userZ).then(a => console.log("pending balance: " +a))
    await cvx.balanceOf(userZ).then(a => console.log("balance on wallet: " +a))

    await advanceTime(day*7);

    await locker.lockedBalanceOf(userZ).then(a => console.log("locked coins: " +a))
    await locker.balanceOf(userZ).then(a => console.log("balance via locker: " +a))
    await votebalance.balanceOf(userZ).then(a => console.log("balance via votebalance: " +a))
    await votebalance.pendingBalanceOf(userZ).then(a => console.log("pending balance: " +a))
    await cvx.balanceOf(userZ).then(a => console.log("balance on wallet: " +a))
  });
});


