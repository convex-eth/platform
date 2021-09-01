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
const ConvexStakingWrapper = artifacts.require("ConvexStakingWrapper");
const IERC20 = artifacts.require("IERC20");
const ICurveAavePool = artifacts.require("ICurveAavePool");
const IExchange = artifacts.require("IExchange");
const IUniswapV2Router01 = artifacts.require("IUniswapV2Router01");
const CvxMining = artifacts.require("CvxMining");
const ConvexStakingWrapperAbra = artifacts.require("ConvexStakingWrapperAbra");

contract("Deploy stake wrapper", async accounts => {
  it("should deploy contracts", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"

    //system
    let booster = await Booster.at(contractList.system.booster);
    let voteproxy = await CurveVoterProxy.at(contractList.system.voteProxy);
    let cvx = await ConvexToken.at(contractList.system.cvx);
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let stkaave = await IERC20.at("0x4da27a545c0c5B758a6BA100e3a049001de870f5");
    let cvxCrv = await cvxCrvToken.at(contractList.system.cvxCrv);
    let cvxCrvLP = await IERC20.at(contractList.system.cvxCrvCrvSLP);
    let exchange = await IExchange.at("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
    let exchangerouter = await IUniswapV2Router01.at("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let curveAave = await IERC20.at("0xFd2a8fA60Abd58Efe3EeE34dd494cD491dC14900");
    let convexAave = await IERC20.at("0x23F224C37C3A69A058d86a54D3f561295A93d542");
    let aavepool = 24;
    let aaveswap = await ICurveAavePool.at("0xDeBF20617708857ebe4F679508E7b7863a8A8EeE");
    let convexAaveRewards = await BaseRewardPool.at("0xE82c1eB4BC6F92f85BF7EB6421ab3b882C3F5a7B");
    let dai = await IERC20.at("0x6B175474E89094C44Da98b954EedeAC495271d0F");

    //3pool
    // let curveLP = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";
    // let convexLP = "0x30D9410ED1D5DA1F6C8391af5338C93ab8d4035C";
    // let convexPool = "0x689440f2Ff927E1f24c72F1087E1FAF471eCe1c8";
    // let poolId = 9;

    //tri2
    // let curveLP = "0xc4AD29ba4B3c580e6D59105FFf484999997675Ff";
    // let convexLP = "0x903C9974aAA431A765e60bC07aF45f0A1B3b61fb";
    // let convexPool = "0x9D5C5E364D81DaB193b72db9E9BE9D8ee669B652";
    // let poolId = 38;

    // //ren
    // let curveLP = "0x49849C98ae39Fff122806C06791Fa73784FB3675";
    // let convexLP = "0x74b79021Ea6De3f0D1731fb8BdfF6eE7DF10b8Ae";
    // let convexPool = "0x8E299C62EeD737a5d5a53539dF37b5356a27b07D";
    // let poolId = 6;

    // //alusd
    let curveLP = "0x43b4FdFD4Ff969587185cDB6f0BD875c5Fc83f8c";
    let convexLP = "0xCA3D9F45FfA69ED454E66539298709cb2dB8cA61";
    let convexPool = "0x02E2151D4F351881017ABdF2DD2b51150841d5B3";
    let poolId = 36;


    var cvxlib = await CvxMining.at(contractList.system.cvxMining);
    console.log("mining cvxlib at: " +cvxlib.address);
    await ConvexStakingWrapperAbra.link("CvxMining", cvxlib.address);
    var abraLP = await ConvexStakingWrapperAbra.new(curveLP,convexLP,convexPool,poolId,{from:deployer});
    console.log("abraLP token: " +abraLP.address);
    await abraLP.name().then(a=>console.log("name: " +a));
    await abraLP.symbol().then(a=>console.log("symbol: " +a));
    await abraLP.setApprovals();
    await abraLP.addRewards({from:deployer});
    console.log("finish");

    return;
  });
});


