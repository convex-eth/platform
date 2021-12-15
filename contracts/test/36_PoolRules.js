// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
const { keccak256: k256 } = require('ethereum-cryptography/keccak');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');


const IERC20 = artifacts.require("IERC20");
const IExchange = artifacts.require("IExchange");
const IUniswapV2Router01 = artifacts.require("IUniswapV2Router01");

const Booster = artifacts.require("Booster");
const PoolManagerV2 = artifacts.require("PoolManagerV2");
const PoolManagerProxy = artifacts.require("PoolManagerProxy");
const ICurveGauge = artifacts.require("ICurveGauge");
const PoolManagerV3 = artifacts.require("PoolManagerV3");
const IVoteStarter = artifacts.require("IVoteStarter");
const IVoting = artifacts.require("IVoting");


contract("deploy pool manager layer", async accounts => {
  it("should check that pool addresses are properly enforced", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let treasury = "0x1389388d01708118b497f59521f6943Be2541bb7";
    let addressZero = "0x0000000000000000000000000000000000000000"

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

    let poolManager = await PoolManagerV2.at(contractList.system.poolManager);
    let booster = await Booster.at(contractList.system.booster);

    //deploy
    let poolProxy = await PoolManagerProxy.new();
    await poolManager.revertControl({ from:multisig, gasPrice:0 });
    await booster.setPoolManager(poolProxy.address,{ from:multisig, gasPrice:0 });

    //test roles
    await poolProxy.owner().then(a=>console.log("owner: " +a))
    await poolProxy.operator().then(a=>console.log("operator: " +a))
    await poolProxy.setOwner(deployer).catch(a=>console.log(" -> catch set owner attempt"));
    await poolProxy.setOperator(deployer).catch(a=>console.log(" -> catch set operator attempt"));
    await poolProxy.setOwner(deployer,{from:multisig, gasPrice:0});
    await poolProxy.setOperator(addressZero,{from:deployer});
    await poolProxy.owner().then(a=>console.log("owner: " +a));
    await poolProxy.operator().then(a=>console.log("operator: " +a))
    await poolProxy.setOwner(multisig,{from:deployer});
    await poolProxy.setOperator(deployer,{from:multisig, gasPrice:0});
    await poolProxy.owner().then(a=>console.log("owner: " +a));
    await poolProxy.operator().then(a=>console.log("operator: " +a))

    let lpToken = "0x3A283D9c08E8b55966afb64C515f5143cf907611"; //cvx lp
    let badlpToken = "0x1cEBdB0856dd985fAe9b8fEa2262469360B8a3a6"; //crv lp
    let gauge = await ICurveGauge.at("0x7E1444BA99dcdFfE8fBdb42C02F0005D14f13BE1"); //cvx lp gauge
    let sVersion = 3;

    //force cvx pool to gauge controller (may need to edit/remove after real vote goes through)
    await booster.vote(110,"0xE478de485ad2fe566d49342Cbd03E49ed7DB3356",true,{from:multisig,gasPrice:0});
    await advanceTime(7 * day);
    var ownership = await IVoteStarter.at(contractList.curve.voteOwnership);
    await ownership.executeVote(110);
    var weightVoting = await IVoting.at(contractList.curve.gaugeController);
    await weightVoting.vote_for_gauge_weights("0xD9277b0D007464eFF133622eC0d42081c93Cef02",0,{from:deployer,gasPrice:0});
    await weightVoting.vote_for_gauge_weights(gauge.address,10000,{from:deployer,gasPrice:0});
    console.log("weight added to pool");

    //test add pool
    console.log("add pool");
    let lpfromGauge = await gauge.lp_token();
    console.log("guage: " +gauge.address +", lptoken: " +lpfromGauge);
    await poolProxy.addPool(lpToken, gauge.address, sVersion).catch(a=>console.log(" -> revert, not operator: " +a))
    await poolProxy.addPool(badlpToken, gauge.address, sVersion, {from:deployer,gasPrice:0}).catch(a=>console.log(" -> revert, lp token is a gauge: " +a))
    await poolProxy.addPool(lpToken, badlpToken, sVersion, {from:deployer,gasPrice:0}).catch(a=>console.log(" -> revert, gauge token is a gauge: " +a))
    await poolProxy.addPool(lpToken, gauge.address, sVersion, {from:deployer,gasPrice:0});
    var poolcount = await booster.poolLength();
    console.log("pool count: " +poolcount);
    var info = await booster.poolInfo(poolcount-1);
    console.log(info);

    //test shutdown
    console.log("shutdown pool");
    await poolProxy.shutdownPool(poolcount-1).catch(a=>console.log(" -> revert, not owner: " +a))
    await poolProxy.shutdownPool(poolcount-1,{from:deployer,gasPrice:0})
    console.log("shutdown complete")
    info = await booster.poolInfo(poolcount-1);
    console.log(info);

    //test poolmanager v3
    let poolv3 = await PoolManagerV3.new(poolProxy.address);
    console.log("new manager v3 at " +poolv3.address)
    await poolProxy.operator().then(a=>console.log("proxy operator: " +a))
    await poolProxy.setOperator(deployer).catch(a=>console.log(" -> catch set operator attempt: " +a));
    await poolProxy.setOperator(poolv3.address,{from:multisig, gasPrice:0});
    await poolProxy.operator().then(a=>console.log("proxy operator: " +a))

    //add a new pool (anyone can)
    await poolv3.addPool(gauge.address);
    var poolcount = await booster.poolLength();
    console.log("pool added via pool manager v3, count: " +poolcount);
    var info = await booster.poolInfo(poolcount-1);
    console.log(info);

    //shutdown pool (only operator of manager)
    await poolv3.shutdownPool(poolcount-1,{from:deployer, gasPrice:0}).catch(a=>console.log(" -> catch shutdown attempt: " +a));
    await poolv3.shutdownPool(poolcount-1,{from:multisig, gasPrice:0})
    var info = await booster.poolInfo(poolcount-1);
    console.log(info);
  });
});


