var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('../contracts.json');

const MerkleAirdrop = artifacts.require("MerkleAirdrop");
const IERC20 = artifacts.require("IERC20");
const IExchange = artifacts.require("IExchange");
const ISPool = artifacts.require("ISPool");
const I2CurveFi = artifacts.require("I2CurveFi");
const I3CurveFi = artifacts.require("I3CurveFi");

module.exports = function (deployer, network, accounts) {
  if(network != "uitest"){
    return true;
  }
	
  var currentTime = Math.floor(Date.now() / 1000);
  var self = accounts[0];
  var weth, dai, eurs, crv, exchange;
  var susdSwap, eursSwap, threeCrvSwap;
  var daibalance, eursbalance;

  deployer.deploy(MerkleAirdrop,self).then(function(instance) {
    return IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
  })
  .then(function(instance) {
    weth = instance;
  })
  .then(function() {
    return IERC20.at("0x6b175474e89094c44da98b954eedeac495271d0f");
  })
  .then(function(instance) {
    dai = instance;
  })
  .then(function() {
    return IERC20.at("0xdb25f211ab05b1c97d595516f45794528a807ad8");
  })
  .then(function(instance) {
    eurs = instance;
  })
  .then(function() {
    return weth.sendTransaction({value:web3.utils.toWei("20.0", "ether")})
  })
  .then(function() {
    return IExchange.at("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
  })
  .then(function(instance) {
    exchange = instance
    return weth.balanceOf(self);
  })
  .then(function(balance) {
    console.log("weth balance: " +balance)
    return weth.approve(exchange.address,balance);
  })
  .then(function() {
    //get dai
    return exchange.swapExactTokensForTokens(web3.utils.toWei("5.0", "ether"),0,[weth.address,dai.address],self,currentTime+3000);
  })
  .then(function() {
    //get eurs
    return exchange.swapExactTokensForTokens(web3.utils.toWei("5.0", "ether"),0,[weth.address,eurs.address],self,currentTime+3000);
  })
  .then(function(){
    return ISPool.at("0xA5407eAE9Ba41422680e2e00537571bcC53efBfD");
  })
  .then(function(swap){
    susdSwap = swap;
  })
  .then(function(){
    return I2CurveFi.at("0x0Ce6a5fF5217e38315f87032CF90686C96627CAA");
  })
  .then(function(swap){
    eursSwap = swap;
  })
  .then(function(instance) {
    return dai.balanceOf(self);
  })
  .then(function(dbal){
    daibalance = dbal;
    console.log("dai: " +daibalance);
    return dai.approve(susdSwap.address,daibalance);
  })
  .then(function(instance) {
    return eurs.balanceOf(self);
  })
  .then(function(ebal){
    eursbalance = ebal;
    console.log("eurs: " +eursbalance);
    return eurs.approve(eursSwap.address,daibalance);
  })
  .then(function(){
    return susdSwap.add_liquidity([daibalance,0,0,0],0);
  })
  .then(function(){
    return eursSwap.add_liquidity([eursbalance,0],0);
  })
  .then(function(){
    //susd lp
    return IERC20.at("0xC25a3A3b969415c80451098fa907EC722572917F");
  })
  .then(function(susdLp){
    return susdLp.balanceOf(self);
  })
  .then(function(bal){
    console.log("susd lp balance: " +bal);
  })
  .then(function(){
    //eurs lp
    return IERC20.at("0x194eBd173F6cDacE046C53eACcE9B953F28411d1");
  })
  .then(function(eursLp){
    return eursLp.balanceOf(self);
  })
  .then(function(bal){
    console.log("eurs lp balance: " +bal);
  })
  .then(function() {
    //get more dai
    return exchange.swapExactTokensForTokens(web3.utils.toWei("5.0", "ether"),0,[weth.address,dai.address],self,currentTime+3000);
  })
  .then(function(){
    //3crv swap
    return I3CurveFi.at("0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7");
  })
  .then(function(swap){
    threeCrvSwap = swap;
  })
  .then(function() {
    return dai.balanceOf(self);
  })
  .then(function(dbal){
    daibalance = dbal;
    console.log("dai: " +daibalance);
    return dai.approve(threeCrvSwap.address,daibalance);
  })
  .then(function(){
    return threeCrvSwap.add_liquidity([daibalance,0,0],0);
  })
  .then(function(){
    //3crv lp
    return IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
  })
  .then(function(threecrvLp){
    return threecrvLp.balanceOf(self);
  })
  .then(function(bal){
    console.log("3crv lp balance: " +bal);
  })
  .then(function(){
    //crv
    return IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
  })
  .then(function(_crv){
    crv = _crv;
    return  exchange.swapExactTokensForTokens(web3.utils.toWei("5.0", "ether"),0,[weth.address,crv.address],self,currentTime+3000);
  })
   .then(function() {
    return crv.balanceOf(self);
  })
  .then(function(cbal){
    console.log("crv: " +cbal);
  })
}
