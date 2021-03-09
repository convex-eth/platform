const Booster = artifacts.require("Booster");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const RewardFactory = artifacts.require("RewardFactory");
const StashFactory = artifacts.require("StashFactory");
const ConvexToken = artifacts.require("ConvexToken");
const cCrvToken = artifacts.require("cCrvToken");
const CrvDepositor = artifacts.require("CrvDepositor");
const cCrvRewardPool = artifacts.require("cCrvRewardPool");
const cvxRewardPool = artifacts.require("cvxRewardPool");


//TODO: create reward pools and distribute premine
//TODO: pass various roles to multisig

module.exports = function (deployer, network, accounts) {
	let crv = "0xD533a949740bb3306d119CC777fa900bA034cd52";
	let vecrvFeeDistro = "0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc";
	let threeCrv = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";
	let threeCrvGauge = "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A";
    let threeCrvSwap = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";

    let admin = accounts[0];

	var booster, voter, rFactory, sFactory, cvx, ccrv, deposit;
	var ccrvRewards, cvxRewards;
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
		return deployer.deploy(cCrvRewardPool,ccrv.address,crv,0,booster.address,rFactory.address)
	}).then(function(instance) {
		ccrvRewards = instance;

		// reward manager is admin to add any new incentive programs
		return deployer.deploy(cvxRewardPool,cvx.address,crv,deposit.address,ccrv.address,0,booster.address,admin)
	}).then(function(instance) {
		cvxRewards = instance;
		return booster.setRewardContracts(ccrvRewards.address,cvxRewards.address)
	}).then(function() {
		return booster.setFactories(rFactory.address,sFactory.address)
	}).then(function() {
		return booster.setMinter(cvx.address)
	}).then(function() {
		return booster.setFeeInfo(vecrvFeeDistro,threeCrv)
	}).then(function() {
		return booster.addPool(threeCrvSwap,threeCrvGauge,0)
	}).then(function() {
		console.log("cCrv: " +ccrv.address)
		console.log("deposit: " +deposit.address)
		console.log("ccrvRewards: " +ccrvRewards.address)
		console.log("cvxRewards: " +cvxRewards.address)
		console.log("sFactory: " +sFactory.address)
		console.log("rFactory: " +rFactory.address)
		console.log("cvx: " +cvx.address)
		console.log("booster: " +booster.address)
		console.log("voter: " +voter.address)
	});
};
