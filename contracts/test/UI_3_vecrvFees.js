const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');

var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const CrvDepositor = artifacts.require("CrvDepositor");
const Booster = artifacts.require("Booster");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const IERC20 = artifacts.require("IERC20");
const IWalletCheckerDebug = artifacts.require("IWalletCheckerDebug");
const IBurner = artifacts.require("IBurner");
const VirtualBalanceRewardPool = artifacts.require("VirtualBalanceRewardPool");

contract("Claim vecrv fees", async accounts => {
  it("should pull admin fees and claim to convex", async () => {

  	let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
  	
  	let dai = await IERC20.at("0x6B175474E89094C44Da98b954EedeAC495271d0F");
  	let vecrv = await IERC20.at("0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2");
    let threecrv = await IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
    let walletChecker = await IWalletCheckerDebug.at("0xca719728Ef172d0961768581fdF35CB116e0B7a4");
    let checkerAdmin = "0x40907540d8a6C65c637785e8f8B742ae6b0b9968";
    let vecrvWhale = "0xb01151B93B5783c252333Ce0707D704d0BBDF5EC";

    //memo: these burner addresses may change
    let burner = await IBurner.at("0xeCb456EA5365865EbAb8a2661B0c503410e9B347");
    let underlyingburner = await IBurner.at("0x786B374B5eef874279f4B7b4de16940e57301A58");
    ///////

    let voteproxy = await CurveVoterProxy.at(contractList.system.voteProxy);
    let booster = await Booster.at(contractList.system.booster);
    let crvDeposit = await CrvDepositor.at(contractList.system.crvDepositor);
    let cvxCrv = await IERC20.at(contractList.system.cvxCrv);
    let vecrvRewardAddress = await booster.lockFees();
    let vecrvRewardsContract = await VirtualBalanceRewardPool.at(vecrvRewardAddress);

    let self = accounts[0];

    //add to whitelist
    await walletChecker.approveWallet(voteproxy.address,{from:checkerAdmin,gasPrice:0});
    console.log("added to whitelist");

    let isWhitelist = await walletChecker.check(voteproxy.address);
    console.log("is whitelist? " +isWhitelist);

    // ---------- deposit crv ---------- //////
    
    //deposit crv
    // let crvBal = await crv.balanceOf(self);
    // await crv.approve(crvDeposit.address,0);
    // await crv.approve(crvDeposit.address,crvBal);
    // await crvDeposit.deposit(crvBal,false,"0x0000000000000000000000000000000000000000");

    await crvDeposit.lockCurve();
    await cvxCrv.totalSupply().then(a=>console.log("cvxCrv supply: " +a))
    await vecrv.balanceOf(voteproxy.address).then(a=>console.log("proxy veCrv: " +a));

    // -----------------------------///

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

    await threecrv.balanceOf(vecrvRewardsContract.address).then(a=>console.log("vecrvRewardsContract balance: " +a));
  });
});


