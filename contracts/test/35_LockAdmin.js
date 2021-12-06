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

const LockerAdmin = artifacts.require("LockerAdmin");


contract("setup lock contract", async accounts => {
  it("should setup lock contract", async () => {

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

    
    //deploy
    let locker = await CvxLocker.at(contractList.system.locker);
    let admin = await LockerAdmin.new();
    console.log("admin: " +admin.address);

    // console.log("test change stake proxy");
    // await locker.setStakeLimits(0,0,{from:multisig,gasPrice:0});
    // await locker.setStakingContract(addressZero, {from:multisig,gasPrice:0});
    // await locker.setStakingContract(contractList.system.lockerStakeProxy, {from:multisig,gasPrice:0});
    // await locker.setStakeLimits(1000,1000,{from:multisig,gasPrice:0});
    // console.log("change success");

    console.log("change admin");
    await locker.transferOwnership(admin.address, {from:multisig,gasPrice:0});
    await locker.owner().then(a=>console.log("new owner: " +a))

    // console.log("setStakingContract (should fail)");
    // await admin.setStakeLimits(0, 0, {from:multisig,gasPrice:0});
    // await admin.setStakingContract(addressZero, {from:multisig,gasPrice:0}).catch(" -> revert catch, cant change staking contract");

    console.log("add reward");
    await admin.addReward(dai.address, deployer, false, {from:multisig,gasPrice:0});
    await locker.rewardTokens(1).then(a=>console.log("new reward token: " +a))

    console.log("approveRewardDistributor");
    await locker.rewardDistributors(dai.address, deployer).then(a=>console.log("is distributor? " +a));
    await admin.approveRewardDistributor(dai.address, deployer, false, {from:multisig,gasPrice:0});
    await locker.rewardDistributors(dai.address, deployer).then(a=>console.log("is distributor? " +a));

    console.log("setStakeLimits");
    await locker.minimumStake().then(a=>console.log("min stake: " +a));
    await locker.maximumStake().then(a=>console.log("min stake: " +a));
    await admin.setStakeLimits(600, 200, {from:multisig,gasPrice:0}).catch(a=>console.log(" -> catch revert with min < max: " +a));
    await admin.setStakeLimits(500, 600, {from:multisig,gasPrice:0});
    await locker.minimumStake().then(a=>console.log("min stake: " +a));
    await locker.maximumStake().then(a=>console.log("min stake: " +a));
    await admin.setStakeLimits(1000, 1000, {from:multisig,gasPrice:0});
    await locker.minimumStake().then(a=>console.log("min stake: " +a));
    await locker.maximumStake().then(a=>console.log("min stake: " +a));

    console.log("setBoost");
    await locker.nextMaximumBoostPayment().then(a=>console.log("nextMaximumBoostPayment: " +a));
    await locker.nextBoostRate().then(a=>console.log("nextBoostRate: " +a));
    await locker.boostPayment().then(a=>console.log("boostPayment: " +a));
    await admin.setBoost(1600, 20000, multisig, {from:multisig,gasPrice:0}).catch(a=>console.log(" -> catch revert improper _max: " +a));
    await admin.setBoost(500, 40000, multisig, {from:multisig,gasPrice:0}).catch(a=>console.log(" -> catch revert improper _rate: " +a));
    await admin.setBoost(500, 20000, multisig, {from:multisig,gasPrice:0});
    await locker.nextMaximumBoostPayment().then(a=>console.log("nextMaximumBoostPayment: " +a));
    await locker.nextBoostRate().then(a=>console.log("nextBoostRate: " +a));
    await locker.boostPayment().then(a=>console.log("boostPayment: " +a));


    //swap for cvx
    console.log("rescue")
    await weth.sendTransaction({value:web3.utils.toWei("10.0", "ether"),from:deployer});
    var wethBalance = await weth.balanceOf(deployer);
    await weth.transfer(locker.address, wethBalance,{from:deployer});
    await admin.recoverERC20(weth.address, wethBalance, {from:multisig,gasPrice:0});
    await weth.balanceOf(locker.address).then(a=>console.log("weth on locker: " +a))
    await weth.balanceOf(multisig).then(a=>console.log("weth on owner: " +a))

    console.log("shutdown");
    await locker.isShutdown().then(a=>console.log("isShutdown: " +a));
    await admin.shutdown({from:multisig,gasPrice:0});
    await locker.isShutdown().then(a=>console.log("isShutdown: " +a));



  });
});


