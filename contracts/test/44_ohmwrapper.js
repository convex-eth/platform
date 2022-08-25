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
const ConvexStakingWrapperOhmMint = artifacts.require("ConvexStakingWrapperOhmMint");


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

    const advanceTime = async (secondsElaspse) => {
      await time.increase(secondsElaspse);
      await time.advanceBlock();
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;

    //curve lp token
    let stakingToken = await IERC20.at("0x3660BD168494d61ffDac21E403d0F6356cF90fD7");
    
    //grab tokens
    let lpHolder = "0x8dF6FdAe05C9405853dd4cF2809D5dc2b5E77b0C";
    await unlockAccount(lpHolder);
    await stakingToken.transfer(userA,web3.utils.toWei("1000.0", "ether"),{from:lpHolder,gasPrice:0});
    await stakingToken.transfer(userB,web3.utils.toWei("1000.0", "ether"),{from:lpHolder,gasPrice:0});
    await stakingToken.transfer(userC,web3.utils.toWei("1000.0", "ether"),{from:lpHolder,gasPrice:0});
  
    //create
    let lib = await CvxMining.at(contractList.system.cvxMining);
    console.log("mining lib at: " +lib.address);
    await ConvexStakingWrapperOhmMint.link("CvxMining", lib.address);
    let farm = await ConvexStakingWrapperOhmMint.new();
    console.log("warpper at: " +farm.address);

    await farm.curveToken().then(a=>console.log("curveToken: " +a))
    await farm.curveSwap().then(a=>console.log("curveSwap: " +a))
    await farm.convexToken().then(a=>console.log("convexToken: " +a))
    await farm.convexPool().then(a=>console.log("convexPool: " +a))
    await farm.convexPoolId().then(a=>console.log("convexPoolId: " +a))
    await farm.asset().then(a=>console.log("asset: " +a))
    await farm.totalAssets().then(a=>console.log("totalAssets: " +a))
    await farm.totalSupply().then(a=>console.log("totalSupply: " +a))
    await farm.convertToShares(web3.utils.toWei("1.0", "ether")).then(a=>console.log("convertToShares(1e18): " +a))
    await farm.convertToAssets(web3.utils.toWei("1.0", "ether")).then(a=>console.log("convertToAssets(1e18): " +a))


    //approve users
    await stakingToken.approve(farm.address, web3.utils.toWei("100000.0","ether"),{from:userA});
    await stakingToken.approve(farm.address, web3.utils.toWei("100000.0","ether"),{from:userB});
    await stakingToken.approve(farm.address, web3.utils.toWei("100000.0","ether"),{from:userC});
    console.log("approvals complete")

    //deposit
    await farm.deposit(web3.utils.toWei("10.0", "ether"), userA, {from:userA});
    console.log("deposit complete");
    await farm.balanceOf(userA).then(a=>console.log("balanceOf(shares) userA: " +a))
    await farm.convertToShares(web3.utils.toWei("1.0", "ether")).then(a=>console.log("convertToShares(1e18): " +a))
    await farm.convertToAssets(web3.utils.toWei("1.0", "ether")).then(a=>console.log("convertToAssets(1e18): " +a))

    //mint
    await farm.mint(web3.utils.toWei("10.0", "ether"), userB, {from:userB});
    console.log("mint complete");
    await farm.balanceOf(userB).then(a=>console.log("balanceOf(shares) userB: " +a));
    await farm.convertToShares(web3.utils.toWei("1.0", "ether")).then(a=>console.log("convertToShares(1e18): " +a))
    await farm.convertToAssets(web3.utils.toWei("1.0", "ether")).then(a=>console.log("convertToAssets(1e18): " +a))



    //harvest convex pool
    var poolid = await farm.convexPoolId();
    await booster.earmarkRewards(poolid);
    console.log("harvested convex pool " +poolid);

    await advanceTime(day);

    await farm.earned(userA).then(a=>console.log("earned userA: " +a));
    await farm.earned(userB).then(a=>console.log("earned userB: " +a));


    //mint and sync
    await stakingToken.transfer(farm.address,web3.utils.toWei("20.0", "ether"),{from:lpHolder,gasPrice:0});
    console.log("lp tokens transfered to wrapper");
    await farm.sync();
    console.log("sync called");

    await farm.convertToShares(web3.utils.toWei("1.0", "ether")).then(a=>console.log("convertToShares(1e18): " +a))
    await farm.convertToAssets(web3.utils.toWei("1.0", "ether")).then(a=>console.log("convertToAssets(1e18): " +a))


    //deposit
    await farm.deposit(web3.utils.toWei("10.0", "ether"), userA, {from:userA});
    console.log("deposit complete user A, amount 10");
    await farm.balanceOf(userA).then(a=>console.log("balanceOf(shares) userA: " +a))

    //mint
    await farm.mint(web3.utils.toWei("10.0", "ether"), userB, {from:userB});
    console.log("mint complete user B, shares 10");
    await farm.balanceOf(userB).then(a=>console.log("balanceOf(shares) userB: " +a));


    //todo reward claims etc



    //withdraw
    await farm.convertToShares(web3.utils.toWei("1.0", "ether")).then(a=>console.log("convertToShares(1e18): " +a))
    await farm.convertToAssets(web3.utils.toWei("1.0", "ether")).then(a=>console.log("convertToAssets(1e18): " +a))

    var balanceA = await farm.balanceOf(userA);
    console.log("user A balance: " +balanceA);
    
    console.log("redeem via shares...user a")
    // await farm.redeem(balanceA, userA, userA, {from:userA});
    await farm.methods['redeem(uint256,address,address)'](balanceA, userA, userA, {from:userA})
    console.log("redeemed.")
    await stakingToken.balanceOf(userA).then(a=>console.log("balance on wallet: " +a))
    await farm.balanceOf(userA).then(a=>console.log("balance on wrapper: " +a))

    await farm.convertToShares(web3.utils.toWei("1.0", "ether")).then(a=>console.log("convertToShares(1e18): " +a))
    await farm.convertToAssets(web3.utils.toWei("1.0", "ether")).then(a=>console.log("convertToAssets(1e18): " +a))
    console.log("\n\n");

    var balanceB = await farm.balanceOf(userB);
    console.log("user B balance: " +balanceB);
    var amountB = await farm.convertToAssets(balanceB);
    console.log("shares to amount, user b: " +amountB);
    var sharesB = await farm.convertToShares(amountB);
    console.log("shares double check, user b: " +sharesB);
    await farm.totalAssets().then(a=>console.log("balance remaining on wrapper: " +a))
    console.log("withdraw via amount...")
    // await farm.withdraw(amountB, {from:userB});
    // await farm.withdraw(amountB, userB, userB, {from:userB});
    await farm.methods['withdraw(uint256,address,address)'](amountB, userB, userB, {from:userB})
    console.log("withdrawn");
    await stakingToken.balanceOf(userB).then(a=>console.log("balance on wallet: " +a))
    await farm.balanceOf(userB).then(a=>console.log("balance on wrapper: " +a))


    await farm.convertToShares(web3.utils.toWei("1.0", "ether")).then(a=>console.log("convertToShares(1e18): " +a))
    await farm.convertToAssets(web3.utils.toWei("1.0", "ether")).then(a=>console.log("convertToAssets(1e18): " +a))
  });
});


