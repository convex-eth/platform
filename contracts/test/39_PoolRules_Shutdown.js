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
const PoolManagerShutdownProxy = artifacts.require("PoolManagerShutdownProxy");
const ICurveGauge = artifacts.require("ICurveGauge");
const PoolManagerV3 = artifacts.require("PoolManagerV3");
const IVoteStarter = artifacts.require("IVoteStarter");
const IVoting = artifacts.require("IVoting");
const FakeGauge = artifacts.require("FakeGauge");


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



contract("deploy pool manager layer", async accounts => {
  it("should check that pool rules are properly enforced", async () => {

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

    //let poolManager = await PoolManagerV3.at(contractList.system.poolManager);
    let booster = await Booster.at(contractList.system.booster);
    let poolProxy = await PoolManagerProxy.at(contractList.system.poolManagerProxy);

    //deploy
    let poolShutdown = await PoolManagerShutdownProxy.new();
    console.log("poolManagerShutdownProxy: " +poolShutdown.address);
    let poolManager = await PoolManagerV3.new(poolShutdown.address);
    console.log("poolManager: " +poolManager.address);

    //connect proxy to shutdown, and shutdown to new manager
    console.log("set operators")
    await poolProxy.setOperator(poolShutdown.address,{from:multisig,gasPrice:0});
    await poolShutdown.setOperator(poolManager.address,{from:multisig,gasPrice:0});

    //revoke ownership
    console.log("revoke ownership");
    await poolProxy.setOwner(addressZero,{from:multisig,gasPrice:0});
    await poolProxy.owner().then(a=>console.log("proxy owner: " +a))

    //test roles
    console.log("test roles for shutdown layer")
    await poolShutdown.owner().then(a=>console.log("owner: " +a))
    await poolShutdown.operator().then(a=>console.log("operator: " +a))
    await poolShutdown.setOwner(deployer).catch(a=>console.log(" -> catch set owner attempt"));
    await poolShutdown.setOperator(deployer).catch(a=>console.log(" -> catch set operator attempt"));
    await poolShutdown.setOwner(deployer,{from:multisig, gasPrice:0});
    await poolShutdown.setOperator(addressZero,{from:deployer});
    await poolShutdown.owner().then(a=>console.log("owner: " +a));
    await poolShutdown.operator().then(a=>console.log("operator: " +a))
    await poolShutdown.setOwner(multisig,{from:deployer});
    await poolShutdown.setOperator(poolManager.address,{from:multisig, gasPrice:0});
    await poolShutdown.owner().then(a=>console.log("owner: " +a));
    await poolShutdown.operator().then(a=>console.log("operator: " +a))

    let lpToken = await IERC20.at("0x3A283D9c08E8b55966afb64C515f5143cf907611"); //cvx lp
    let depositToken = await IERC20.at("0x0bC857f97c0554d1d0D602b56F2EEcE682016fBA"); //cvx lp
    let badlpToken = await IERC20.at("0x1cEBdB0856dd985fAe9b8fEa2262469360B8a3a6"); //crv lp
    let gauge = await ICurveGauge.at("0x7E1444BA99dcdFfE8fBdb42C02F0005D14f13BE1"); //cvx lp gauge
    let sVersion = 3;

    //shutdown individual pools
    await lpToken.balanceOf(booster.address).then(a=>console.log("lp on booster: " +a))
    await depositToken.totalSupply().then(a=>console.log("deposit token supply: " +a))
    await poolManager.shutdownPool(64,{from:multisig,gasPrice:0})
    console.log("shutdown cvx pool");
    await lpToken.balanceOf(booster.address).then(a=>console.log("lp on booster: " +a))
    await depositToken.totalSupply().then(a=>console.log("deposit token supply: " +a))

    console.log("shutdown 3pool...");
    var threepoolLP = await IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
    var threepoolDeposit = await IERC20.at("0x30D9410ED1D5DA1F6C8391af5338C93ab8d4035C");
    await threepoolLP.balanceOf(booster.address).then(a=>console.log("lp on booster: " +a))
    await threepoolDeposit.totalSupply().then(a=>console.log("deposit token supply: " +a))
    await poolManager.shutdownPool(9,{from:multisig,gasPrice:0})
    console.log("shutdown 3pool pool");
    await threepoolLP.balanceOf(booster.address).then(a=>console.log("lp on booster: " +a))
    await threepoolDeposit.totalSupply().then(a=>console.log("deposit token supply: " +a))

    console.log("do 3pool again..")
    await threepoolLP.balanceOf(booster.address).then(a=>console.log("lp on booster: " +a))
    await threepoolDeposit.totalSupply().then(a=>console.log("deposit token supply: " +a))
    await poolManager.shutdownPool(9,{from:multisig,gasPrice:0}).catch(a=>console.log("already shutdown, revert: " +a))
    console.log("shutdown 3pool pool(again)");
    await threepoolLP.balanceOf(booster.address).then(a=>console.log("lp on booster: " +a))
    await threepoolDeposit.totalSupply().then(a=>console.log("deposit token supply: " +a))

    //re-add pool with fake gauge
    var fgauge = await FakeGauge.new(lpToken.address);
    await poolShutdown.setOperator(deployer,{from:multisig,gasPrice:0})
    await poolShutdown.addPool(lpToken.address, fgauge.address, 3,{from:deployer});
    console.log("added pool");
    var poolcount = await booster.poolLength();
    var info = await booster.poolInfo(poolcount-1);
    console.log(info);

    //get lp tokens
    var lpholder = "0x7e1444ba99dcdffe8fbdb42c02f0005d14f13be1";
    await unlockAccount(lpholder);
    await lpToken.transfer(deployer, web3.utils.toWei("1.0", "ether"),{from:lpholder,gasPrice:0});
    await lpToken.balanceOf(deployer).then(a=>console.log("tokens on deployer: " +a));
    //deposit in new pool
    await lpToken.approve(booster.address,web3.utils.toWei("1.0", "ether"),{from:deployer})
    await booster.depositAll(poolcount-1,false,{from:deployer})
    console.log("deposited");

    //try shutdown but the balance will not match and revert
    await poolShutdown.shutdownPool(poolcount-1,{from:deployer}).catch(a=>console.log("can not shutdown pool, balance mismatch: " +a));

    //try shutdown on all pools(except for the one we just made)
    console.log("pool count: " +(poolcount-1));
    for(var i=0; i < poolcount-1; i++){
      console.log("shutting down pool " +i +"...");
      var info = await booster.poolInfo(i);
      if(info.shutdown){
        console.log("   -> already shutdown");
      }else{
        await poolShutdown.shutdownPool(i,{from:deployer,gasPrice:0})
        console.log("   -> done");
      }
    }

  });
});


