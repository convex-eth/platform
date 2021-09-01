// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const CvxLocker = artifacts.require("CvxLocker");
const CvxStakingProxy = artifacts.require("CvxStakingProxy");
const cvxRewardPool = artifacts.require("cvxRewardPool");
const IERC20 = artifacts.require("IERC20");


contract("Deploy CVX Locker", async accounts => {
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

    //deploy
    let locker = await CvxLocker.new({from:deployer});
    let stakeproxy = await CvxStakingProxy.new(locker.address,{from:deployer});
    console.log("deployed");
    console.log("locker: " +locker.address);
    console.log("stakeproxy: " +stakeproxy.address);
    contractList.system.locker = locker.address;
    contractList.system.lockerStakeProxy = stakeproxy.address;
    jsonfile.writeFileSync("./contracts.json", contractList, { spaces: 4 });
    await stakeproxy.setApprovals();
    await locker.addReward(cvxcrv.address, stakeproxy.address, true, {from:deployer});
    await locker.setStakingContract(stakeproxy.address,{from:deployer});
    await locker.setApprovals();
    console.log("setup complete");

  });
});


