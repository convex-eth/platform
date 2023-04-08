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
const TreasurySwap = artifacts.require("TreasurySwap");

// const unlockAccount = async (address) => {
//   return new Promise((resolve, reject) => {
//     web3.currentProvider.send(
//       {
//         jsonrpc: "2.0",
//         method: "evm_unlockUnknownAccount",
//         params: [address],
//         id: new Date().getTime(),
//       },
//       (err, result) => {
//         if (err) {
//           return reject(err);
//         }
//         return resolve(result);
//       }
//     );
//   });
// };

const addAccount = async (address) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_addAccount",
        params: [address, "passphrase"],
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

const unlockAccount = async (address) => {
  await addAccount(address);
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "personal_unlockAccount",
        params: [address, "passphrase"],
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

contract("Test swapping/stakign and other actions for treasury", async accounts => {
  it("should test swapping and staking on behalf of treasury", async () => {

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
    let crvDeposit = await CrvDepositor.at(contractList.system.crvDepositor);
    let vanillacvxCrv = await BaseRewardPool.at(contractList.system.cvxCrvRewards);
    let cvx = await ConvexToken.at(contractList.system.cvx);
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let threeCrv = await IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
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

      var periodend = await vanillacvxCrv.periodFinish();
      var now = Number( (new Date()).getTime() / 1000 ).toFixed(0);
      // console.log("period end: " +Number(periodend))
      // console.log("now: " +now)
      if(Number(periodend) < now){
        await booster.earmarkRewards(100);
        console.log("\n  >>>>  harvested");
      }
    }
    const day = 86400;


    var crvescrow = "0x5f3b5dfeb7b28cdbd7faba78963ee202a494e2a2";
    await unlockAccount(crvescrow);
    await crv.transfer(treasury,web3.utils.toWei("5000000.0", "ether"),{from:crvescrow,gasPrice:0});
    // await crv.transfer(userB,web3.utils.toWei("100000.0", "ether"),{from:crvescrow,gasPrice:0});
    // await crv.transfer(deployer,web3.utils.toWei("100000.0", "ether"),{from:crvescrow,gasPrice:0});

    await crv.balanceOf(treasury).then(a=>console.log("treasury balance: " +a));


    let staker = await CvxCrvStakingWrapper.new({from:deployer});
    console.log("staker token: " +staker.address);


    let swapper = await TreasurySwap.new({from:deployer});

    await swapper.setStakeAddress(staker.address,{from:multisig,gasPrice:0});
    await swapper.stakedCvxcrv().then(a=>console.log("swapper staked cvxcrv: " +a));


    await crv.transfer(swapper.address,web3.utils.toWei("100000.0", "ether"),{from:crvescrow,gasPrice:0});

    await crv.balanceOf(swapper.address).then(a=>console.log("swap bal: " +a));
    await swapper.withdrawTo(crv.address,web3.utils.toWei("50000.0", "ether"),treasury,{from:userA}).catch(a=>console.log("auth: " +a))
    await swapper.withdrawTo(crv.address,web3.utils.toWei("50000.0", "ether"),treasury,{from:multisig,gasPrice:0});

    await crv.balanceOf(treasury).then(a=>console.log("treasury balance: " +a));
    await crv.balanceOf(swapper.address).then(a=>console.log("swap bal: " +a));

    var calldata = crv.contract.methods.transfer(treasury,web3.utils.toWei("50000.0", "ether")).encodeABI();
    await swapper.execute(crv.address,0,calldata,{from:userA}).catch(a=>console.log("auth exec: " +a));
    await swapper.execute(crv.address,0,calldata,{from:multisig,gasPrice:0});
    console.log("use execute() to transfer");

    await crv.balanceOf(treasury).then(a=>console.log("treasury balance: " +a));
    await crv.balanceOf(swapper.address).then(a=>console.log("swap bal: " +a));


    var crvApprove = crv.contract.methods.approve(swapper.address,"115792089237316195423570985008687907853269984665640564039457584007913129639935").encodeABI();
    var cvxCrvApprove = cvxCrv.contract.methods.approve(swapper.address,"115792089237316195423570985008687907853269984665640564039457584007913129639935").encodeABI();
    console.log("crv calldata: " +crvApprove);
    console.log("cvxcrv calldata: " +cvxCrvApprove);
    await crv.approve(swapper.address,web3.utils.toWei("100000000000.0", "ether"),{from:treasury,gasPrice:0});
    await cvxCrv.approve(swapper.address,web3.utils.toWei("100000000000.0", "ether"),{from:treasury,gasPrice:0});
    await staker.approve(swapper.address,web3.utils.toWei("100000000000.0", "ether"),{from:treasury,gasPrice:0});
    console.log("treasury approved tokens");



    console.log("\n\n >>> Swap >>>>\n");
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));

    var amount = web3.utils.toWei("100000.0", "ether");
    console.log("swapping: " +amount);
    await swapper.slippage().then(a=>console.log("slippage allowance: " +a))
    var minOut = await swapper.calc_minOut_swap(amount);
    console.log("calc out: " +minOut);
    await swapper.swap(amount,minOut,{from:deployer});

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));

    console.log("\n\n >>> Swap END>>>>");

    console.log("\n\n >>> stake >>>>\n");
    
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));

    var amount = web3.utils.toWei("100000.0", "ether");
    console.log("staking: " +amount);
    var minOut = await swapper.stake(amount,{from:deployer});
    

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));
    await staker.balanceOf(treasury).then(a=>console.log("treasury staked: " +a));

    console.log("\n\n >>> stake END>>>>");

    console.log("\n\n >>> swapAndStake >>>>\n");

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));

    var amount = web3.utils.toWei("100000.0", "ether");
    console.log("swap and stake amount: " +amount);
    var minOut = await swapper.calc_minOut_swap(amount);
    console.log("calc out: " +minOut);
    await swapper.swapAndStake(amount,minOut,{from:deployer});

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));
    await staker.balanceOf(treasury).then(a=>console.log("treasury staked: " +a));
    
    console.log("\n\n >>> swapAndStake END>>>>");

    console.log("\n\n >>> swapAndBurn >>>>\n");

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));
    await staker.totalSupply().then(a=>console.log("wrapper totalSupply: " +a));
    await vanillacvxCrv.balanceOf(staker.address).then(a=>console.log("wrapper staked: " +a));

    var amount = web3.utils.toWei("100000.0", "ether");
    console.log("swap and burn amount: " +amount);
    var minOut = await swapper.calc_minOut_swap(amount);
    console.log("calc out: " +minOut);
    await swapper.swapAndBurn(amount,minOut,{from:deployer});

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));
    await staker.balanceOf(treasury).then(a=>console.log("treasury staked: " +a));
    await staker.totalSupply().then(a=>console.log("wrapper totalSupply: " +a));
    await vanillacvxCrv.balanceOf(staker.address).then(a=>console.log("wrapper staked: " +a));
    
    console.log("\n\n >>> swapAndBurn END>>>>");

    console.log("\n\n >>> simple burn >>>>\n");

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));
    await staker.totalSupply().then(a=>console.log("wrapper totalSupply: " +a));
    await vanillacvxCrv.balanceOf(staker.address).then(a=>console.log("wrapper staked: " +a));

    var amount = await cvxCrv.balanceOf(treasury);
    console.log("simple burn amount: " +amount);
    await swapper.burn(amount,{from:deployer});

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));
    await staker.balanceOf(treasury).then(a=>console.log("treasury staked: " +a));
    await staker.totalSupply().then(a=>console.log("wrapper totalSupply: " +a));
    await vanillacvxCrv.balanceOf(staker.address).then(a=>console.log("wrapper staked: " +a));
    
    console.log("\n\n >>> simple burn END>>>>");

    console.log("\n\n >>> unstake >>>>\n");
    
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));
    await staker.balanceOf(treasury).then(a=>console.log("treasury staked: " +a));

    var amount = web3.utils.toWei("100000.0", "ether");
    console.log("unstake amount: " +amount);
    var minOut = await swapper.unstake(amount,{from:deployer});

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));
    await staker.balanceOf(treasury).then(a=>console.log("treasury staked: " +a));
    await staker.totalSupply().then(a=>console.log("wrapper totalSupply: " +a));
    await vanillacvxCrv.balanceOf(staker.address).then(a=>console.log("wrapper staked: " +a));

    console.log("\n\n >>> unstake END>>>>");

    console.log("\n\n >>> unstakeAndBurn >>>>\n");
    
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));
    await staker.balanceOf(treasury).then(a=>console.log("treasury staked: " +a));

    var amount = web3.utils.toWei("100000.0", "ether");
    console.log("unstake and burn amount: " +amount);
    var minOut = await swapper.unstakeAndBurn(amount,{from:deployer});

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));
    await staker.balanceOf(treasury).then(a=>console.log("treasury staked: " +a));
    await staker.totalSupply().then(a=>console.log("wrapper totalSupply: " +a));
    await vanillacvxCrv.balanceOf(staker.address).then(a=>console.log("wrapper staked: " +a));

    console.log("\n\n >>> unstakeAndBurn END>>>>");

    console.log("\n\n >>> Add LP >>>>");
    
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));

    var amountCrv = web3.utils.toWei("100000.0", "ether");
    var amountCrvCvx = web3.utils.toWei("100000.0", "ether");
    console.log("add to LP crv: " +amountCrv);
    console.log("add to LP cvxcrv: " +amountCrvCvx);

    var minOut = await swapper.calc_minOut_deposit(amountCrv,amountCrvCvx);
    console.log("minOut: " +minOut);

    await swapper.addToPool(amountCrv, amountCrvCvx, minOut,{from:deployer});

    var lprewards = await IERC20.at("0x39D78f11b246ea4A1f68573c3A5B64E83Cff2cAe");

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));
    await lprewards.balanceOf(swapper.address).then(a=>console.log("staked lp: " +a));

    console.log("\n\n >>> Add LP END>>>>");

    console.log("\n\n >>> Remove LP >>>>");

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));

    await crv.balanceOf(swapper.address).then(a=>console.log("swapper crv: " +a));
    await cvxCrv.balanceOf(swapper.address).then(a=>console.log("swapper cvxCrv: " +a));

    var lpbal = await lprewards.balanceOf(swapper.address);
    console.log("remove LP: " +lpbal);
    var minOut = await swapper.calc_withdraw_one_coin(lpbal);
    console.log("minOut: " +minOut);

    await swapper.removeFromPool(lpbal, minOut,{from:deployer});

    await crv.balanceOf(swapper.address).then(a=>console.log("swapper crv: " +a));
    await cvxCrv.balanceOf(swapper.address).then(a=>console.log("swapper cvxCrv: " +a));

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));

    console.log("\n\n >>> Remove LP END>>>>");

    console.log("\n\n >>> Add LP 2>>>>");
    
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));

    var amountCrv = web3.utils.toWei("100000.0", "ether");
    var amountCrvCvx = web3.utils.toWei("100000.0", "ether");
    console.log("add to LP crv: " +amountCrv);
    console.log("add to LP cvxcrv: " +amountCrvCvx);

    var minOut = await swapper.calc_minOut_deposit(amountCrv,amountCrvCvx);
    console.log("minOut: " +minOut);

    await swapper.addToPool(amountCrv, amountCrvCvx, minOut,{from:deployer});

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvxCrv.balanceOf(treasury).then(a=>console.log("treasury cvxCrv: " +a));
    await lprewards.balanceOf(swapper.address).then(a=>console.log("staked lp: " +a));

    console.log("\n\n >>> Add LP 2 END>>>>");

    await advanceTime(day*3);


    console.log("\n\n >>> claim rewards >>>>");

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));

    await crv.balanceOf(swapper.address).then(a=>console.log("swapper crv: " +a));
    await cvxCrv.balanceOf(swapper.address).then(a=>console.log("swapper cvxCrv: " +a));

    await swapper.claimLPRewards({from:deployer});

    await crv.balanceOf(swapper.address).then(a=>console.log("swapper crv: " +a));
    await cvxCrv.balanceOf(swapper.address).then(a=>console.log("swapper cvxCrv: " +a));

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));

    console.log("\n\n >>> claim rewards END>>>>");

    console.log("\n\n >>> Remove LP as lp token >>>>");
    var lptoken = await IERC20.at("0x971add32Ea87f10bD192671630be3BE8A11b8623");

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await lptoken.balanceOf(treasury).then(a=>console.log("treasury lptoken: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));

    var lpbal = await lprewards.balanceOf(swapper.address);
    console.log("remove LP: " +lpbal);

    await swapper.removeAsLP(lpbal, {from:deployer});

    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await lptoken.balanceOf(treasury).then(a=>console.log("treasury lptoken: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));

    console.log("\n\n >>> Remove LP as lp token END>>>>");

  });
});


