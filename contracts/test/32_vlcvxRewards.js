// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
const { keccak256: k256 } = require('ethereum-cryptography/keccak');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const ConvexToken = artifacts.require("ConvexToken");
const cvxCrvToken = artifacts.require("cvxCrvToken");
const IERC20 = artifacts.require("IERC20");
const IExchange = artifacts.require("IExchange");
const IUniswapV2Router01 = artifacts.require("IUniswapV2Router01");
const DepositToken = artifacts.require("DepositToken");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const ProxyFactory = artifacts.require("ProxyFactory");
const StashFactoryV2 = artifacts.require("StashFactoryV2");
const IVoteStarter = artifacts.require("IVoteStarter");
const PoolManager = artifacts.require("PoolManager");
const I2CurveFi = artifacts.require("I2CurveFi");
const ExtraRewardStashV3 = artifacts.require("ExtraRewardStashV3");
const RewardHook = artifacts.require("RewardHook");
const ExtraRewardStashTokenRescue = artifacts.require("ExtraRewardStashTokenRescue");
const RescueToken = artifacts.require("RescueToken");
const RewardDeposit = artifacts.require("RewardDeposit");
const CvxLocker = artifacts.require("CvxLocker");
const vlCvxExtraRewardDistribution = artifacts.require("vlCvxExtraRewardDistribution");
// const ChefToken = artifacts.require("ChefToken");
// const ChefRewardHook = artifacts.require("ChefRewardHook");
// const TreasuryFunds = artifacts.require("TreasuryFunds");


contract("Extra rewards for vlcvx", async accounts => {
  it("should add and claim extra rewards", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"

    //system
    let booster = await Booster.at(contractList.system.booster);
    let locker = await CvxLocker.at(contractList.system.locker);
    let voteproxy = await CurveVoterProxy.at(contractList.system.voteProxy);
    let cvx = await ConvexToken.at(contractList.system.cvx);
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let cvxCrv = await cvxCrvToken.at(contractList.system.cvxCrv);
    let cvxCrvLP = await IERC20.at(contractList.system.cvxCrvCrvSLP);
    let exchange = await IExchange.at("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
    let exchangerouter = await IUniswapV2Router01.at("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    // let curvetoken = await IERC20.at("0x49849C98ae39Fff122806C06791Fa73784FB3675");
    // let curveswap = await I2CurveFi.at("0x93054188d876f558f4a66B2EF1d97d16eDf0895B");
    let spell = await IERC20.at("0x090185f2135308bad17527004364ebcc2d37e5f6");

    // let cheftoken = await ChefToken.at("0x51854310A2411e682F5C1A23924DD9de79D0342a");
    // let chefhook = await ChefRewardHook.at("0x5e2706946c2bE55b038f4a0475cb7b19f5a67897");
    // await cheftoken.approve(chefhook.address,web3.utils.toWei("1.0", "ether"),{from:deployer});
    // await chefhook.init(contractList.system.treasury,5,cheftoken.address,{from:deployer});
    // return;
    // let treasury = await TreasuryFunds.at(contractList.system.treasury);
    // var calldata = chefhook.contract.methods.onRewardClaim().encodeABI();
    // console.log("calldata: " +calldata);

    // await treasury.execute(chefhook.address,0,calldata,{from:multisig,gasPrice:0})
    // await cvx.balanceOf(contractList.system.treasury).then(a=>console.log("treasury: " +a));
    
    // await time.increase(86400*1);
    // await time.advanceBlock();
    // await time.advanceBlock();
    // await time.advanceBlock();
    // await time.advanceBlock();
    // await time.advanceBlock();
    // await time.advanceBlock();
    // await time.advanceBlock();
    // await time.advanceBlock();
    // await time.advanceBlock();
    // await time.advanceBlock();
    // await time.advanceBlock();
    // await time.advanceBlock();
    // await time.advanceBlock();
    // await time.advanceBlock();

    // await treasury.execute(chefhook.address,0,calldata,{from:multisig,gasPrice:0})

    // await cvx.balanceOf(contractList.system.treasury).then(a=>console.log("treasury: " +a));

    // return;

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

    var epoch0 = 1630540800;
    var epoch1 = 1631145600;

    var isShutdown = false;

    let starttime = await time.latest();

    const advanceTime = async (secondsElaspse) => {
      await time.increase(secondsElaspse);
      await time.advanceBlock();
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;

    await weth.sendTransaction({value:web3.utils.toWei("10.0", "ether"),from:deployer});
    var wethBalance = await weth.balanceOf(deployer);
    console.log("receive weth: " +wethBalance)
    await weth.approve(exchange.address,wethBalance,{from:deployer});
    await exchange.swapExactTokensForTokens(web3.utils.toWei("10.0", "ether"),0,[weth.address,spell.address],deployer,starttime+3000,{from:deployer});
    var spellbalance = await spell.balanceOf(deployer);
    console.log("swapped for spell: " +spellbalance);

    //deploy
    let rewardDistro = await vlCvxExtraRewardDistribution.new();
    console.log("distro at: " +rewardDistro.address);

    //set starting rewards
    await spell.approve(rewardDistro.address,spellbalance,{from:deployer});
    await rewardDistro.addReward(spell.address, web3.utils.toWei("1000000.0", "ether"), 0,{from:deployer});
    await spell.balanceOf(rewardDistro.address).then(a=>console.log("spell on distro: " +a));

    await rewardDistro.rewardEpochs(spell.address,0).then(a=>console.log("reward epochs: " +a));
    await rewardDistro.rewardData(spell.address,0).then(a=>console.log("reward data: " +a));
    await rewardDistro.userClaims(spell.address,userZ).then(a=>console.log("next user claim index: " +a));
    
    await locker.balanceAtEpochOf(0,userZ).then(a=>console.log("balance at epoch: " +a));
    await locker.totalSupplyAtEpoch(0).then(a=>console.log("supply at epoch: " +a));
    await rewardDistro.claimableRewards(userZ,spell.address).then(a=>console.log("claimable: " +a));
    var tx = await rewardDistro.getReward(userZ,spell.address);
    console.log("claimed, gas: " +tx.receipt.gasUsed);
    
    await spell.balanceOf(userZ).then(a=>console.log("spell on userZ: " +a));
    await rewardDistro.claimableRewards(userZ,spell.address).then(a=>console.log("claimable: " +a));
    await rewardDistro.userClaims(spell.address,userZ).then(a=>console.log("next user claim index: " +a));

    await rewardDistro.addReward(spell.address, web3.utils.toWei("1000000.0", "ether"), 1,{from:deployer});
    console.log("add more rewards for epoch 1");
    await rewardDistro.rewardEpochs(spell.address,1).then(a=>console.log("reward epochs: " +a));
    await rewardDistro.rewardData(spell.address,1).then(a=>console.log("reward data: " +a));
    await rewardDistro.claimableRewards(userZ,spell.address).then(a=>console.log("claimable: " +a));
    // var tx = await rewardDistro.getReward(userZ,spell.address);
    // console.log("claimed, gas: " +tx.receipt.gasUsed);
    await rewardDistro.userClaims(spell.address,userZ).then(a=>console.log("next user claim index: " +a));
    await spell.balanceOf(userZ).then(a=>console.log("spell on userZ: " +a));
  
    await rewardDistro.addReward(spell.address, web3.utils.toWei("1000000.0", "ether"), 2,{from:deployer});
    console.log("added rewards to epoch 2");
    var tx = await rewardDistro.getReward(userZ,spell.address);
    console.log("claimed, gas: " +tx.receipt.gasUsed);
    await rewardDistro.userClaims(spell.address,userZ).then(a=>console.log("next user claim index: " +a));
    await spell.balanceOf(userZ).then(a=>console.log("spell on userZ: " +a));

    await rewardDistro.methods['addReward(address,uint256)'](spell.address, web3.utils.toWei("1000000.0", "ether"),{from:deployer});
    console.log("add more rewards for current epoch");
    await rewardDistro.rewardEpochs(spell.address,2).then(a=>console.log("reward epochs(2): " +a));
    await rewardDistro.rewardData(spell.address,2).then(a=>console.log("reward data(2): " +a));
    await rewardDistro.rewardData(spell.address,3).then(a=>console.log("reward data(3): " +a));
    // await rewardDistro.forfeitRewards(spell.address,1,{from:userZ,gasPrice:0});
    // await rewardDistro.claimableRewards(userZ,spell.address).then(a=>console.log("claimable: " +a));
  
  });
});


