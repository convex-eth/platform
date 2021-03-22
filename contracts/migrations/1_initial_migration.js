
const Booster = artifacts.require("Booster");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const RewardFactory = artifacts.require("RewardFactory");
const StashFactory = artifacts.require("StashFactory");
const TokenFactory = artifacts.require("TokenFactory");
const ConvexToken = artifacts.require("ConvexToken");
const cCrvToken = artifacts.require("cCrvToken");
const CrvDepositor = artifacts.require("CrvDepositor");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const cvxRewardPool = artifacts.require("cvxRewardPool");
const ArbitratorVault = artifacts.require("ArbitratorVault");
// const MerkleAirdrop = artifacts.require("MerkleAirdrop");
// const MerkleAirdropFactory = artifacts.require("MerkleAirdropFactory");
// const VestedEscrow = artifacts.require("VestedEscrow");


//const UniswapV2Library = artifacts.require("UniswapV2Library");
const IUniswapV2Router01 = artifacts.require("IUniswapV2Router01");
const IUniswapV2Factory = artifacts.require("IUniswapV2Factory");
const IERC20 = artifacts.require("IERC20");

//TODO: create reward pools and distribute premine
//TODO: pass various roles to multisig

module.exports = function (deployer, network, accounts) {
	//return true;
	let crv = "0xD533a949740bb3306d119CC777fa900bA034cd52";
	let vecrvFeeDistro = "0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc";
	let threeCrv = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";
	let threeCrvGauge = "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A";
    let threeCrvSwap = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";

    let uniswapRouter = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";
    let uniswapFactory = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
    let weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

    let admin = accounts[0];

	var booster, voter, rFactory, sFactory, tFactory, cvx, ccrv, deposit, arb;
	var ccrvRewards, cvxRewards, airdrop, vecrvVesting;
	var uniRouter, uniFactory, pairToken;

	var rewardsStart = Math.floor(Date.now() / 1000)+86400;
    var rewardsEnd = rewardsStart + (1 * 364 * 86400);

    //todo: pass rewards start to booster constructor

  	deployer.deploy(CurveVoterProxy).then(function(instance) {
  		voter = instance;
  	}).then(function() {
		return deployer.deploy(Booster, voter.address)
	}).then(function(instance) {
		booster = instance;
	}).then(function() {
		return voter.setOperator(booster.address)
	}).then(function() {
		return deployer.deploy(ConvexToken, voter.address)
	}).then(function(instance) {
		cvx = instance;
		return cvx.mint(accounts[0],"5000000000000000000000000")
	}).then(function() {
		return deployer.deploy(RewardFactory,booster.address)
	}).then(function(instance) {
		rFactory = instance;
	}).then(function() {
		return deployer.deploy(TokenFactory,booster.address)
	}).then(function(instance) {
		tFactory = instance;
		return deployer.deploy(StashFactory,booster.address,rFactory.address)
	}).then(function(instance) {
		sFactory = instance;
		return deployer.deploy(cCrvToken)
	}).then(function(instance) {
		ccrv = instance;
		return deployer.deploy(CrvDepositor,voter.address,ccrv.address)
	}).then(function(instance) {
		deposit = instance;
		return ccrv.setOperator(deposit.address)
	}).then(function() {
		return voter.setDepositor(deposit.address)
	}).then(function() {
		return booster.setTreasury(deposit.address)
	}).then(function() {
		return deployer.deploy(BaseRewardPool,0,ccrv.address,crv,0,booster.address,rFactory.address)
	}).then(function(instance) {
		ccrvRewards = instance;

		// reward manager is admin to add any new incentive programs
		return deployer.deploy(cvxRewardPool,cvx.address,crv,deposit.address,ccrv.address,0,booster.address,admin)
	}).then(function(instance) {
		cvxRewards = instance;
		return booster.setRewardContracts(ccrvRewards.address,cvxRewards.address)
	}).then(function() {
		return booster.setFactories(rFactory.address,sFactory.address,tFactory.address)
	}).then(function() {
		return booster.setMinter(cvx.address)
	}).then(function() {
		return booster.setFeeInfo(vecrvFeeDistro,threeCrv)
	}).then(function() {
		return booster.addPool(threeCrvSwap,threeCrvGauge,0)
	}).then(function() {
		return deployer.deploy(ArbitratorVault,booster.address)
	}).then(function(instance) {
		arb = instance
		return booster.setArbitrator(arb.address)
	})
	// .then(function() {
	// 	return deployer.deploy(MerkleAirdrop)
	// }).then(function(instance) {
	// 	airdrop = instance;
	// 	return true;
	// })
	// .then(function() {
	// 	return IUniswapV2Router01.at(uniswapRouter)
	// }).then(function(instance) {
	// 	uniRouter = instance;
	// 	return IUniswapV2Factory.at(uniswapFactory)
	// }).then(function(instance) {
	// 	uniFactory = instance;
	// 	console.log("uniRouter: " +uniRouter.address)
	// 	console.log("uniFactory: " +uniFactory.address)
	// 	return cvx.approve(uniRouter.address,web3.utils.toWei("12000", "ether"))
	// }).then(function() {
	// 	console.log("approved")
	// 	return uniRouter.addLiquidityETH(cvx.address,web3.utils.toWei("12000", "ether"),web3.utils.toWei("12000", "ether"),web3.utils.toWei("1.0", "ether"),admin,Date.now()+3000,{value:web3.utils.toWei("1.0", "ether")})
	// }).then(function() {
	// 	return uniFactory.getPair(cvx.address,weth)
	// }).then(function(pair) {
	// 	console.log("pairAddress: " +pair)
	// 	return IERC20.at(pair)
	// }).then(function(token) {
	// 	pairToken = token;
	// 	return pairToken.balanceOf(admin)
	// }).then(function(balance) {
	// 	console.log("pair balance: " +balance)
	// 	return true;
	// })
	.then(function() {
		console.log("cCrv: " +ccrv.address)
		console.log("deposit: " +deposit.address)
		console.log("ccrvRewards: " +ccrvRewards.address)
		console.log("cvxRewards: " +cvxRewards.address)
		console.log("sFactory: " +sFactory.address)
		console.log("rFactory: " +rFactory.address)
		console.log("tFactory: " +tFactory.address)
		console.log("cvx: " +cvx.address)
		console.log("booster: " +booster.address)
		console.log("voter: " +voter.address)
	});
};
