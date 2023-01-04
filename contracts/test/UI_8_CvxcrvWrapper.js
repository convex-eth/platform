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
const CvxCrvUtilities = artifacts.require("CvxCrvUtilities");


// -- for old ganache
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

// -- for new ganache
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

contract("deply cvxcrv stake wrapper for ui testing", async accounts => {
  it("should deploy cvxcrv wrapper and util", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    await unlockAccount(deployer);
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    await unlockAccount(multisig);
    let addressZero = "0x0000000000000000000000000000000000000000"

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

    let wrapper = await CvxCrvStakingWrapper.new({from:deployer});
    let util = await CvxCrvUtilities.new(wrapper.address,{from:deployer});
    console.log("cvxcrv wrapper: " +wrapper.address);
    console.log("cvxcrv util: " +util.address);


    //grab crv
    var crvescrow = "0x5f3b5dfeb7b28cdbd7faba78963ee202a494e2a2";
    await unlockAccount(crvescrow);
    await crv.transfer(userA,web3.utils.toWei("300000.0", "ether"),{from:crvescrow,gasPrice:0});
    //approve for convert and to stake for wrapper
    await crv.approve(crvDeposit.address,web3.utils.toWei("200000.0", "ether"),{from:userA});
    await cvxCrv.approve(vanillacvxCrv.address,web3.utils.toWei("100000.0", "ether"),{from:userA});
    //get some cvxcrv
    await crvDeposit.deposit(web3.utils.toWei("200000.0", "ether"),false,addressZero,{from:userA});
    //stake on behalf of wrapper
    await vanillacvxCrv.stakeFor(wrapper.address,web3.utils.toWei("100000.0", "ether"),{from:userA});

    //final balances
    await crv.balanceOf(userA).then(a=>console.log("crv balance: " +a))
    await cvxCrv.balanceOf(userA).then(a=>console.log("crvcrv balance: " +a))
    await vanillacvxCrv.balanceOf(wrapper.address).then(a=>console.log("wrapper staked balance: " +a))

    

  });
});


