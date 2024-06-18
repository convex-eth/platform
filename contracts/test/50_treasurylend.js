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
const ICurveRegistry = artifacts.require("ICurveRegistry");
const DebugRegistry = artifacts.require("DebugRegistry");
const TreasuryLend = artifacts.require("TreasuryLend");

const unlockAccount = async (address) => {
  let NETWORK = config.network;
  if(!NETWORK.includes("debug")){
    return null;
  }
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "hardhat_impersonateAccount",
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

const setNoGas = async () => {
  let NETWORK = config.network;
  if(!NETWORK.includes("debug")){
    return null;
  }
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "hardhat_setNextBlockBaseFeePerGas",
        params: ["0x0"],
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

const send = payload => {
  if (!payload.jsonrpc) payload.jsonrpc = '2.0';
  if (!payload.id) payload.id = new Date().getTime();

  return new Promise((resolve, reject) => {
    web3.currentProvider.send(payload, (error, result) => {
      if (error) return reject(error);

      return resolve(result);
    });
  });
};

/**
 *  Mines a single block in Ganache (evm_mine is non-standard)
 */
const mineBlock = () => send({ method: 'evm_mine' });

/**
 *  Gets the time of the last block.
 */
const currentTime = async () => {
  const { timestamp } = await web3.eth.getBlock('latest');
  return timestamp;
};

/**
 *  Increases the time in the EVM.
 *  @param seconds Number of seconds to increase the time by
 */
const fastForward = async seconds => {
  // It's handy to be able to be able to pass big numbers in as we can just
  // query them from the contract, then send them back. If not changed to
  // a number, this causes much larger fast forwards than expected without error.
  if (BN.isBN(seconds)) seconds = seconds.toNumber();

  // And same with strings.
  if (typeof seconds === 'string') seconds = parseFloat(seconds);

  await send({
    method: 'evm_increaseTime',
    params: [seconds],
  });

  await mineBlock();
};
contract("Test supplying crvusd to llamalend", async accounts => {
  it("should test supplying crvusd on behalf of treasury", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    await unlockAccount(deployer);
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    await unlockAccount(multisig);
    let addressZero = "0x0000000000000000000000000000000000000000"

    let treasury = contractList.system.treasury;
    await unlockAccount(treasury);

    //system
    let booster = await Booster.at(contractList.system.booster);
    let voteproxy = await CurveVoterProxy.at(contractList.system.voteProxy);
    let cvx = await ConvexToken.at(contractList.system.cvx);
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let cvxCrv = await IERC20.at("0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7");
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
      // await time.increase(secondsElaspse);
      // await time.advanceBlock();
      await fastForward(secondsElaspse);
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");

      // var periodend = await vanillacvxCrv.periodFinish();
      // var now = Number( (new Date()).getTime() / 1000 ).toFixed(0);
      // console.log("period end: " +Number(periodend))
      // console.log("now: " +now)
      // if(Number(periodend) < now){
      //   await booster.earmarkRewards(100);
      //   console.log("\n  >>>>  harvested");
      // }
    }
    const day = 86400;

    let treasurylend = await TreasuryLend.new({from:deployer});
    console.log("treasurylend: " +treasurylend.address);
    return;

    var crvescrow = "0x5f3b5dfeb7b28cdbd7faba78963ee202a494e2a2";
    await unlockAccount(crvescrow);
    await crv.transfer(voteproxy.address,web3.utils.toWei("5000000.0", "ether"),{from:crvescrow,gasPrice:0});

    var crvusd = await IERC20.at("0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E");

    var holder = "0xA920De414eA4Ab66b97dA1bFE9e6EcA7d4219635";
    await unlockAccount(holder);
    await crvusd.transfer(treasury,web3.utils.toWei("1000000.0", "ether"),{from:holder,gasPrice:0});

    await crvusd.balanceOf(treasury).then(a=>console.log("treasury balance: " +a));

    var approve = crvusd.contract.methods.approve(treasurylend.address,"115792089237316195423570985008687907853269984665640564039457584007913129639935").encodeABI();
    console.log("appprove calldata: " +approve);
    await crvusd.approve(treasurylend.address,web3.utils.toWei("100000000000.0", "ether"),{from:treasury,gasPrice:0});
    console.log("treasury approved tokens");


    var susdevault = "0x4a7999c55d3a93dAf72EA112985e57c2E3b9e95D";
    var susdepid = 361;
    await treasurylend.setPidToVault(susdepid,susdevault,{from:multisig,gasPrice:0})
    console.log("added pid to vault");
    await booster.earmarkRewards(susdepid).catch(a=>console.log("earmark not needed"));

    console.log("\n\n >>> Add vault >>>>");
    
    await crvusd.balanceOf(treasury).then(a=>console.log("treasury: " +a));
    await crvusd.balanceOf(treasurylend.address).then(a=>console.log("treasurylend: " +a));

    await treasurylend.addToPool(susdepid, web3.utils.toWei("100000.0", "ether"),{from:deployer});

    var lprewards = await IERC20.at("0x68e400d058D4c0066344D1B3F392878e993B38Ab");

    await crvusd.balanceOf(treasury).then(a=>console.log("treasury: " +a));
    await crvusd.balanceOf(treasurylend.address).then(a=>console.log("treasurylend: " +a));
    await lprewards.balanceOf(treasurylend.address).then(a=>console.log("staked: " +a));

    console.log("\n\n >>> Add LP END>>>>");

    

    console.log("\n\n >>> claim rewards >>>>");
    await advanceTime(day*7);
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));

    await crv.balanceOf(treasurylend.address).then(a=>console.log("treasurylend crv: " +a));
    await cvxCrv.balanceOf(treasurylend.address).then(a=>console.log("treasurylend cvxCrv: " +a));

    await treasurylend.claimRewards(susdepid, {from:deployer});

    await crv.balanceOf(treasurylend.address).then(a=>console.log("treasurylend crv: " +a));
    await cvxCrv.balanceOf(treasurylend.address).then(a=>console.log("treasurylend cvxCrv: " +a));

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));

    console.log("\n\n >>> claim rewards END>>>>");

    console.log("\n\n >>> Remove LP >>>>");

    await crvusd.balanceOf(treasury).then(a=>console.log("treasury: " +a));
    await lprewards.balanceOf(treasurylend.address).then(a=>console.log("staked: " +a));

    var lpbal = await lprewards.balanceOf(treasurylend.address);
    console.log("remove LP: " +lpbal);
    
    await treasurylend.removeFromPool(susdepid,lpbal,{from:deployer});
    console.log("removed");

    await crvusd.balanceOf(treasury).then(a=>console.log("treasury: " +a));
    await lprewards.balanceOf(treasurylend.address).then(a=>console.log("staked: " +a));

    console.log("\n\n >>> Remove LP END>>>>");

    
    

  });
});


