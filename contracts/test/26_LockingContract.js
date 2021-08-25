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
const DepositToken = artifacts.require("DepositToken");
const IDelegation = artifacts.require("IDelegation");
const BasicCvxHolder = artifacts.require("BasicCvxHolder");


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
    var userNames = {};
    userNames[userA] = "A";
    userNames[userB] = "B";
    userNames[userC] = "C";
    userNames[userD] = "D";

    var isShutdown = false;

    let starttime = await time.latest();

    //swap for cvx
    await weth.sendTransaction({value:web3.utils.toWei("10.0", "ether"),from:deployer});
    var wethBalance = await weth.balanceOf(deployer);
    console.log("receive weth: " +wethBalance)
    await weth.approve(exchange.address,wethBalance,{from:deployer});
    await exchange.swapExactTokensForTokens(web3.utils.toWei("10.0", "ether"),0,[weth.address,cvx.address],userA,starttime+3000,{from:deployer});
    var cvxbalance = await cvx.balanceOf(userA);
    console.log("swapped for cvx(userA): " +cvxbalance);

    //deploy
    let locker = await CvxLocker.new({from:deployer});
    let stakeproxy = await CvxStakingProxy.new(locker.address,{from:deployer});
    console.log("deployed");
    console.log("locker: " +locker.address);
    console.log("stakeproxy: " +stakeproxy.address);
    contractList.system.locker = locker.address;
    contractList.system.lockerStakeProxy = stakeproxy.address;
    // jsonfile.writeFileSync("./contracts.json", contractList, { spaces: 4 });
    await stakeproxy.setApprovals();
    await locker.addReward(cvxcrv.address, stakeproxy.address, true, {from:deployer});
    await locker.setStakingContract(stakeproxy.address,{from:deployer});
    await locker.setApprovals();
    console.log("setup complete");

    let delegation = await IDelegation.at("0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446");
    let holder = await BasicCvxHolder.new(locker.address);
    await holder.setApprovals();
    console.log("holder deployed");

    console.log("user b: " +userB);
    console.log("keccak256: " +k256("cvx.eth").toString('hex') );
    var spaceHex = "0x"+Buffer.from('cvx.eth', 'utf8').toString('hex');
    console.log("space(hex): " +spaceHex);
    var tx = await delegation.setDelegate(spaceHex,userB);
    var calldata = delegation.contract.methods.setDelegate(spaceHex,userB).encodeABI();
    console.log("calldata: " +calldata);
    await delegation.delegation(userA,spaceHex).then(a=>console.log("wallet delegated to: " +a));

    var tx = await holder.setDelegate(delegation.address,userB);
    await delegation.delegation(holder.address,spaceHex).then(a=>console.log("contract delegated to: " +a));

    //snapshot website creates a tx with data that looks like this:
    //0xbd86e508 6376782e65746800000000000000000000000000000000000000000000000000000000000000000000000000
    //..which appears to NOT be keccak and is just a string
  });
});


