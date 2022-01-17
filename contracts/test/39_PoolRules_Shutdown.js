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
const PoolManagerSecondaryProxy = artifacts.require("PoolManagerSecondaryProxy");
const ICurveGauge = artifacts.require("ICurveGauge");
const PoolManagerV3 = artifacts.require("PoolManagerV3");
const IVoteStarter = artifacts.require("IVoteStarter");
const IVoting = artifacts.require("IVoting");
const FakeGauge = artifacts.require("FakeGauge");
const IGaugeController = artifacts.require("IGaugeController");
const BoosterOwner = artifacts.require("BoosterOwner");


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

    var usedList = [];

    // var pooltotal = await booster.poolLength();
    // for( var i = 0; i < pooltotal; i++){
    //   // console.log("getting pool info... " +i);
    //   var poolInfo = await booster.poolInfo(i);
    //   usedList.push(poolInfo.lptoken);
    //   usedList.push(poolInfo.gauge);
    //   console.log(poolInfo.lptoken);
    //   console.log(poolInfo.gauge);
    // }

    //define to increase test speed
    usedList = [
      "0x845838DF265Dcd2c412A1Dc9e959c7d08537f8a2",
      "0x7ca5b0a2910B33e9759DC7dDB0413949071D7575",
      "0x9fC689CCaDa600B6DF723D9E47D84d76664a1F23",
      "0xBC89cd85491d81C6AD2954E6d0362Ee29fCa8F53",
      "0xdF5e0e81Dff6FAF3A7e52BA697820c5e32D806A8",
      "0xFA712EE4788C042e2B7BB55E6cb8ec569C4530c1",
      "0x3B3Ac5386837Dc563660FB6a0937DFAa5924333B",
      "0x69Fb7c45726cfE2baDeE8317005d3F94bE838840",
      "0xC25a3A3b969415c80451098fa907EC722572917F",
      "0xA90996896660DEcC6E997655E065b23788857849",
      "0xD905e2eaeBe188fc92179b6350807D8bd91Db0D8",
      "0x64E3C23bfc40722d3B649844055F1D51c1ac041d",
      "0x49849C98ae39Fff122806C06791Fa73784FB3675",
      "0xB1F2cdeC61db658F091671F5f199635aEF202CAC",
      "0x075b1bb99792c9E1041bA13afEf80C91a1e70fB3",
      "0x705350c4BcD35c9441419DdD5d2f097d7a55410F",
      "0xb19059ebb43466C323583928285a49f558E572Fd",
      "0x4c18E409Dc8619bFb6a1cB56D114C3f592E0aE79",
      "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490",
      "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A",
      "0xD2967f45c4f384DEEa880F807Be904762a3DeA07",
      "0xC5cfaDA84E902aD92DD40194f0883ad49639b023",
      "0x5B5CFE992AdAC0C9D48E05854B2d91C73a003858",
      "0x2db0E83599a91b508Ac268a6197b8B14F5e72840",
      "0x97E2768e8E73511cA874545DC5Ff8067eB19B787",
      "0xC2b1DF84112619D190193E48148000e3990Bf627",
      "0x4f3E8F405CF5aFC05D68142F3783bDfE13811522",
      "0xF98450B5602fa59CC66e1379DFfB6FDDc724CfC4",
      "0x1AEf73d49Dedc4b1778d0706583995958Dc862e6",
      "0x5f626c30EC1215f4EdCc9982265E8b1F411D1352",
      "0xC2Ee6b0334C261ED60C72f6054450b61B8f18E35",
      "0x4dC4A289a8E33600D8bD4cf5F6313E43a37adec7",
      "0x64eda51d3Ad40D56b9dFc5554E06F94e1Dd786Fd",
      "0x6828bcF74279eE32f2723eC536c22c51Eed383C6",
      "0x3a664Ab939FD8482048609f652f9a0B0677337B9",
      "0xAEA6c312f4b3E04D752946d329693F7293bC2e6D",
      "0xDE5331AC4B3630f94853Ff322B66407e0D6331E8",
      "0xd7d147c6Bb90A718c3De8C0568F9B560C79fa416",
      "0x410e3E86ef427e30B9235497143881f717d93c2A",
      "0xdFc7AdFa664b08767b735dE28f9E84cd30492aeE",
      "0x2fE94ea3d5d4a175184081439753DE15AeF9d614",
      "0x11137B10C210b579405c21A07489e28F3c040AB1",
      "0x94e131324b6054c0D789b190b2dAC504e4361b53",
      "0x3B7020743Bc2A4ca9EaF9D0722d42E20d6935855",
      "0x194eBd173F6cDacE046C53eACcE9B953F28411d1",
      "0x90Bb609649E0451E5aD952683D64BD2d1f245840",
      "0xA3D87FffcE63B53E0d54fAa1cc983B7eB0b74A9c",
      "0x3C0FFFF15EA30C35d7A85B85c0782D6c94e1d238",
      "0xFd2a8fA60Abd58Efe3EeE34dd494cD491dC14900",
      "0xd662908ADA2Ea1916B3318327A97eB18aD588b5d",
      "0x06325440D014e39736583c165C2963BA99fAf14E",
      "0x182B723a58739a9c974cFDB385ceaDb237453c28",
      "0x02d341CcB60fAaf662bC0554d13778015d1b285C",
      "0x462253b8F74B72304c145DB0e4Eebd326B22ca39",
      "0xaA17A236F2bAdc98DDc0Cf999AbB47D47Fc0A6Cf",
      "0x6d10ed2cF043E6fcf51A0e7b4C2Af3Fa06695707",
      "0x7Eb40E450b9655f4B3cC4259BCC731c63ff55ae6",
      "0x055be5DDB7A925BfEF3417FC157f53CA77cA7222",
      "0x5282a4eF67D9C33135340fB3289cc1711c13638C",
      "0xF5194c3325202F456c95c1Cf0cA36f8475C1949F",
      "0xcee60cFa923170e4f8204AE08B4fA6A3F5656F3a",
      "0xFD4D8a17df4C27c1dD245d153ccf4499e806C87D",
      "0xEcd5e75AFb02eFa118AF914515D6521aaBd189F1",
      "0x359FD5d6417aE3D8D6497d9B2e7A890798262BA4",
      "0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B",
      "0x72E158d38dbd50A483501c24f792bDAAA3e7D55C",
      "0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA",
      "0x9B8519A9a00100720CCdC8a120fBeD319cA47a14",
      "0x4807862AA8b2bF68830e4C8dc86D0e9A998e085a",
      "0xd4B22fEdcA85E684919955061fDf353b9d38389b",
      "0x53a901d48795C58f485cBB38df08FA96a24669D5",
      "0x824F13f1a2F29cFEEa81154b46C0fc820677A637",
      "0x43b4FdFD4Ff969587185cDB6f0BD875c5Fc83f8c",
      "0x9582C4ADACB3BCE56Fea3e590F05c3ca2fb9C477",
      "0xcA3d75aC011BF5aD07a98d02f18225F9bD9A6BDF",
      "0x6955a55416a06839309018A8B0cB72c4DDC11f15",
      "0xc4AD29ba4B3c580e6D59105FFf484999997675Ff",
      "0xDeFd8FdD20e0f34115C7018CCfb655796F6B2168",
      "0xFD5dB7463a3aB53fD211b4af195c5BCCC1A03890",
      "0xe8060Ad8971450E624d5289A10017dD30F5dA85F",
      "0x5a6A4D54456819380173272A5E8E9B9904BdF41B",
      "0xd8b712d29381748dB89c36BCa0138d7c75866ddF",
      "0x9D0464996170c6B9e75eED71c68B99dDEDf279e8",
      "0x903dA6213a5A12B61c821598154EfAd98C3B20E4",
      "0x8818a9bb44Fbf33502bE7c15c500d0C783B73067",
      "0xeFF437A56A22D7dD86C1202A308536ED8C7da7c1",
      "0xD6Ac1CB9019137a896343Da59dDE6d097F710538",
      "0x63d9f3aB7d0c528797A12a0684E50C397E9e79dC",
      "0x3F1B0278A9ee595635B61817630cC19DE792f506",
      "0x05ca5c01629a8E5845f12ea3A03fF7331932233A",
      "0x19b080FE1ffA0553469D20Ca36219F17Fcf03859",
      "0x99fb76F75501039089AAC8f20f487bf84E51d76F",
      "0x9c2C8910F113181783c249d8F6Aa41b51Cde0f0c",
      "0x2fA53e8fa5fAdb81f4332C8EcE39Fe62eA2f919E",
      "0x8461A004b50d321CB22B7d034969cE6803911899",
      "0x1750a3a3d80A3F5333BBe9c4695B0fAd41061ab1",
      "0xB15fFb543211b558D40160811e5DcBcd7d5aaac9",
      "0xB15fFb543211b558D40160811e5DcBcd7d5aaac9",
      "0xC4C319E2D4d66CcA4464C0c2B32c9Bd23ebe784e",
      "0x12dCD9E8D1577b5E4F066d8e7D404404Ef045342",
      "0x3Fb78e61784C9c637D560eDE23Ad57CA1294c14a",
      "0xD9277b0D007464eFF133622eC0d42081c93Cef02",
      "0x5B3b5DF2BF2B6543f78e053bD91C4Bdd820929f1",
      "0x9AF13a7B1f1Bbf1A2B05c6fBF23ac23A9E573b4E",
      "0x55A8a39bc9694714E2874c1ce77aa1E599461E18",
      "0xB518f5e3242393d4eC792BD3f44946A3b98d0E48",
      "0xFbdCA68601f835b27790D98bbb8eC7f05FDEaA9B",
      "0x346C7BB1A7a6A30c8e81c14e90FC2f0FBddc54d8",
      "0x3D229E1B4faab62F621eF2F6A610961f7BD7b23B",
      "0x65CA7Dc5CB661fC58De57B1E1aF404649a27AD35",
      "0x3b6831c0077a1e44ED0a21841C3bC4dC11bCE833",
      "0x4Fd86Ce7Ecea88F7E0aA78DC12625996Fb3a04bC",
      "0x87650D7bbfC3A9F10587d7778206671719d9910D",
      "0x25f0cE4E2F8dbA112D9b115710AC297F816087CD",
      "0xc270b3B858c335B6BA5D5b10e2Da8a09976005ad",
      "0xC95bdf13A08A547E4dD9f29B00aB7fF08C5d093d",
      "0xBaaa1F5DbA42C3389bDbc2c9D2dE134F5cD0Dc89",
      "0x16C2beE6f55dAB7F494dBa643fF52ef2D47FBA36",
      "0xCEAF7747579696A2F0bb206a14210e3c9e6fB269",
      "0xb0f5d00e5916c8b8981e99191A1458704B587b2b",
      "0xb9446c4Ef5EBE66268dA6700D26f96273DE3d571",
      "0x1E212e054d74ed136256fc5a5DDdB4867c6E003F",
      "0xEd4064f376cB8d68F770FB1Ff088a3d0F3FF5c4d",
      "0x1cEBdB0856dd985fAe9b8fEa2262469360B8a3a6",
      "0xAA5A67c256e27A5d80712c51971408db3370927D",
      "0x8Fa728F393588E8D8dD1ca397E9a710E53fA553a",
      "0x6BA5b4e438FA0aAf7C1bD179285aF65d13bD3D90",
      "0x66ec719045bBD62db5eBB11184c18237D3Cc2E62",
      "0x3A283D9c08E8b55966afb64C515f5143cf907611",
      "0x7E1444BA99dcdFfE8fBdb42C02F0005D14f13BE1",
      "0x8484673cA7BfF40F82B041916881aeA15ee84834",
      "0x1B3E14157ED33F60668f2103bCd5Db39a1573E5B",
      "0x8282BD15dcA2EA2bDf24163E8f2781B30C43A2ef",
      "0x08380a4999Be1a958E2abbA07968d703C7A3027C",
      "0xCb08717451aaE9EF950a2524E33B6DCaBA60147B",
      "0x6070fBD4E608ee5391189E7205d70cc4A274c017"
    ]

    console.log(usedList);
    
    //deploy
    let poolSecondary = await PoolManagerSecondaryProxy.new(usedList);
    console.log("poolManagerSecondaryProxy: " +poolSecondary.address);
    let poolManager = await PoolManagerV3.new(poolSecondary.address);
    console.log("poolManager: " +poolManager.address);

    //connect proxy to shutdown, and shutdown to new manager
    console.log("set operators")
    await poolProxy.setOperator(poolSecondary.address,{from:multisig,gasPrice:0});
    await poolSecondary.setOperator(poolManager.address,{from:multisig,gasPrice:0});

    //revoke ownership
    console.log("revoke ownership");
    await poolProxy.setOwner(addressZero,{from:multisig,gasPrice:0});
    await poolProxy.owner().then(a=>console.log("proxy owner: " +a))

    //test roles
    console.log("test roles for shutdown layer")
    await poolSecondary.owner().then(a=>console.log("owner: " +a))
    await poolSecondary.operator().then(a=>console.log("operator: " +a))
    await poolSecondary.setOwner(deployer).catch(a=>console.log(" -> catch set owner attempt"));
    await poolSecondary.setOperator(deployer).catch(a=>console.log(" -> catch set operator attempt"));
    await poolSecondary.setOwner(deployer,{from:multisig, gasPrice:0});
    await poolSecondary.setOperator(addressZero,{from:deployer});
    await poolSecondary.owner().then(a=>console.log("owner: " +a));
    await poolSecondary.operator().then(a=>console.log("operator: " +a))
    await poolSecondary.setOwner(multisig,{from:deployer});
    await poolSecondary.setOperator(poolManager.address,{from:multisig, gasPrice:0});
    await poolSecondary.owner().then(a=>console.log("owner: " +a));
    await poolSecondary.operator().then(a=>console.log("operator: " +a))

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
    await poolSecondary.setOperator(deployer,{from:multisig,gasPrice:0})
    await poolSecondary.addPool(lpToken.address, fgauge.address, 3,{from:deployer}).catch(a=>console.log(" revert -> add pool fail, no weight.  " +a));
    await poolSecondary.forceAddPool(lpToken.address, fgauge.address, 3,{from:deployer}).catch(a=>console.log(" revert -> force add pool fail, old pool.  " +a));
    
    let gaugeAdmin = "0x40907540d8a6C65c637785e8f8B742ae6b0b9968";
    await unlockAccount(gaugeAdmin);
    var controller = await IGaugeController.at(contractList.curve.gaugeController);
    await controller.add_gauge(fgauge.address, 0, 1000, {from:gaugeAdmin,gasPrice:0})
    console.log("added to gauge controller");

    await poolSecondary.addPool(lpToken.address, fgauge.address, 3,{from:deployer});
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

    //try shutdown on all pools(except for the one we just made)
    console.log("pool count: " +(poolcount-1));
    for(var i=0; i < poolcount-1; i++){
      console.log("shutting down pool " +i +"...");
      var info = await booster.poolInfo(i);
      if(info.shutdown){
        console.log("   -> already shutdown");
      }else{
        await poolSecondary.shutdownPool(i,{from:deployer,gasPrice:0})
        console.log("   -> done");
      }
    }

    console.log("try shutdown bad pool..")
    //try shutdown but the balance will not match and revert
    await poolSecondary.shutdownPool(poolcount-1,{from:deployer}).catch(a=>console.log("can not shutdown pool, balance mismatch: " +a));

    let boosterowner = await BoosterOwner.new(poolSecondary.address);
    await booster.setOwner(boosterowner.address, {from:multisig, gasPrice:0});
    console.log("insert booster owner")

    console.log("try full shutdown")
    await boosterowner.shutdownSystem({from:multisig, gasPrice:0}).catch(a=>console.log("revert shutdown -> pool mgr not shut down: " +a));
    await boosterowner.queueForceShutdown({from:multisig, gasPrice:0}).catch(a=>console.log("revert queue -> pool mgr not shut down: " +a));
    await poolSecondary.shutdownSystem({from:multisig, gasPrice:0});
    await poolSecondary.isShutdown().then(a=>console.log("is pool mgr shutdown? " +a));
    await boosterowner.shutdownSystem({from:multisig, gasPrice:0}).catch(a=>console.log("revert -> not all poools shutdown: " +a));
    await boosterowner.forceShutdownSystem({from:multisig, gasPrice:0}).catch(a=>console.log("revert force -> timer not started: " +a));

    await boosterowner.queueForceShutdown({from:multisig, gasPrice:0});
    await boosterowner.isForceTimerStarted().then(a=>console.log("is forced started? " +a))
    await boosterowner.forceTimestamp().then(a=>console.log("forceTimestamp: " +a))
    await advanceTime(day * 10);
    await boosterowner.forceShutdownSystem({from:multisig, gasPrice:0}).catch(a=>console.log("revert force -> timer not complete: " +a));
    await advanceTime(day * 30);
    await boosterowner.forceShutdownSystem({from:multisig, gasPrice:0});
    console.log("shutdown complete")
  });
});


