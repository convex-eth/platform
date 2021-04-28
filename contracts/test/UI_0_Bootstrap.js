const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const IERC20 = artifacts.require("IERC20");
const IExchange = artifacts.require("IExchange");
const ISPool = artifacts.require("ISPool");
const I2CurveFi = artifacts.require("I2CurveFi");
const I3CurveFi = artifacts.require("I3CurveFi");
const IWalletCheckerDebug = artifacts.require("IWalletCheckerDebug");

contract("Bootstrap", async accounts => {
  it("should exchange for various LP tokens", async () => {

    let currentTime = await time.latest();
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let dai = await IERC20.at("0x6b175474e89094c44da98b954eedeac495271d0f");
    let eurs = await IERC20.at("0xdb25f211ab05b1c97d595516f45794528a807ad8");
    let exchange = await IExchange.at("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
    let susdSwap = await ISPool.at("0xA5407eAE9Ba41422680e2e00537571bcC53efBfD");
    let susdLp = await IERC20.at("0xC25a3A3b969415c80451098fa907EC722572917F");
    let eursSwap = await I2CurveFi.at("0x0Ce6a5fF5217e38315f87032CF90686C96627CAA");
    let eursLp = await IERC20.at("0x194eBd173F6cDacE046C53eACcE9B953F28411d1");
    let threeCrvSwap = await I3CurveFi.at("0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7");
    let threeCrvLp = await IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let walletChecker = await IWalletCheckerDebug.at("0xca719728Ef172d0961768581fdF35CB116e0B7a4");
    let checkerAdmin = "0x40907540d8a6C65c637785e8f8B742ae6b0b9968";

    let self = accounts[0];

    //convert to weth
    await weth.sendTransaction({value:web3.utils.toWei("20.0", "ether")});
    let wethbalance = await weth.balanceOf(self);

    //approve
    await weth.approve(exchange.address,wethbalance);

    //exchange
    await exchange.swapExactTokensForTokens(web3.utils.toWei("5.0", "ether"),0,[weth.address,dai.address],self,currentTime+3000);
    await exchange.swapExactTokensForTokens(web3.utils.toWei("5.0", "ether"),0,[weth.address,eurs.address],self,currentTime+3000);
  

    var daibalance = await dai.balanceOf(self);
    var eursbalance = await eurs.balanceOf(self);

    await dai.approve(susdSwap.address,daibalance);
    await eurs.approve(eursSwap.address,eursbalance);

    await susdSwap.add_liquidity([daibalance,0,0,0],0);
    await eursSwap.add_liquidity([eursbalance,0],0);

    await susdLp.balanceOf(self).then(a => console.log("susdLp: " +a))
    await eursLp.balanceOf(self).then(a => console.log("eursLp: " +a))

    //more dai
    await exchange.swapExactTokensForTokens(web3.utils.toWei("5.0", "ether"),0,[weth.address,dai.address],self,currentTime+3000);
    daibalance = await dai.balanceOf(self);
    await dai.approve(threeCrvSwap.address,daibalance);
    await threeCrvSwap.add_liquidity([daibalance,0,0],0);

    await threeCrvLp.balanceOf(self).then(a => console.log("threeCrvLp: " +a))

    //get crv
    await exchange.swapExactTokensForTokens(web3.utils.toWei("5.0", "ether"),0,[weth.address,crv.address],self,currentTime+3000);
    await crv.balanceOf(self).then(a => console.log("crv: " +a))

    //whitelist
    console.log("whitelisting proxy...");
    await walletChecker.approveWallet(contractList.system.voteProxy,{from:checkerAdmin,gasPrice:0}).catch(a=>console.log("--> could not whitelist"));
    let isWhitelist = await walletChecker.check(contractList.system.voteProxy);
    console.log("is whitelist? " +isWhitelist);
  });
});


