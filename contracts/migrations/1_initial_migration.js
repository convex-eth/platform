const { time } = require('openzeppelin-test-helpers');
var fs = require('fs');
var jsonfile = require('jsonfile');
var BN = require('big-number');
var distroList = jsonfile.readFileSync('./distro.json');

const Booster = artifacts.require("Booster");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const RewardFactory = artifacts.require("RewardFactory");
const StashFactory = artifacts.require("StashFactory");
const TokenFactory = artifacts.require("TokenFactory");
const ConvexToken = artifacts.require("ConvexToken");
const cvxCrvToken = artifacts.require("cvxCrvToken");
const CrvDepositor = artifacts.require("CrvDepositor");
const PoolManager = artifacts.require("PoolManager");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const cvxRewardPool = artifacts.require("cvxRewardPool");
const ArbitratorVault = artifacts.require("ArbitratorVault");
const ClaimZap = artifacts.require("ClaimZap");
const ConvexMasterChef = artifacts.require("ConvexMasterChef");
const VestedEscrow = artifacts.require("VestedEscrow");
const MerkleAirdrop = artifacts.require("MerkleAirdrop");
const MerkleAirdropFactory = artifacts.require("MerkleAirdropFactory");


const IUniswapV2Router01 = artifacts.require("IUniswapV2Router01");
const IUniswapV2Factory = artifacts.require("IUniswapV2Factory");
const IERC20 = artifacts.require("IERC20");



module.exports = function (deployer, network, accounts) {
// 	if(network != "ganachecli" && network != "mainnet"){
// 		return true;
// 	}
	
// 	let convexDeployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
// 	let convexMultisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
// 	let convexVoterProxy = "0x989AEb4d175e16225E39E87d0D97A3360524AD80";
// 	let convexTreasury = "0x1389388d01708118b497f59521f6943Be2541bb7";

// 	let merkleRoot = "0x632a2ad201c5b95d3f75c1332afdcf489d4e6b4b7480cf878d8eba2aa87d5f73";

// 	let crv = "0xD533a949740bb3306d119CC777fa900bA034cd52";

   //  let sushiswapRouter = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
   //  let sushiswapFactory = "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac";
   //  let weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
   //  let addressZero = "0x0000000000000000000000000000000000000000";

   //  let admin = accounts[0];
   //  console.log("deploying from: " +admin);

   //  var premine = new BN(0);
   //  premine.add(distroList.lpincentives);
   //  premine.add(distroList.vecrv);
   //  premine.add(distroList.teamcvxLpSeed)
   //  var vestedAddresses = distroList.vested.team.addresses.concat(distroList.vested.investor.addresses,distroList.vested.treasury.addresses)
   // // console.log("vested addresses: " +vestedAddresses.toString())
   //  var vestedAmounts = distroList.vested.team.amounts.concat(distroList.vested.investor.amounts,distroList.vested.treasury.amounts)
   //  //console.log("vested amounts: " +vestedAmounts.toString())
   //  var totalVested = new BN(0);
   //  for(var i in vestedAmounts){
   //  	totalVested.add(vestedAmounts[i]);
   //  }
   //  console.log("total vested: " +totalVested.toString());
   //  premine.add(totalVested);
   //  console.log("total cvx premine: " +premine.toString());
   //  var totaldistro = new BN(premine).add(distroList.miningRewards);
   //  console.log("total cvx: " +totaldistro.toString());

// 	var booster, voter, rFactory, sFactory, tFactory, cvx, cvxCrv, deposit, arb, pools;
// 	var crvToken;
// 	var cvxCrvRewards, cvxRewards, airdrop, vesting, chef;
// 	var sushiRouter, sushiFactory, pairToken;
// 	var crvdepositAmt, crvbal, cvxCrvBal

// 	var rewardsStart = Math.floor(Date.now() / 1000)+3600;
   //  var rewardsEnd = rewardsStart + (1 * 364 * 86400);

   //  var contractList = {};
   //  var systemContracts = {};
   //  var poolsContracts = [];
   //  var poolNames = [];
   //  contractList["system"] = systemContracts;
   //  contractList["pools"] = poolsContracts;

   //  var addContract = function(group, name, value){
// 		contractList[group][name] = value;
// 		var contractListOutput = JSON.stringify(contractList,null,4);
// 		fs.writeFileSync("contracts.json",contractListOutput, function(err) {
// 			if (err) {
// 				return console.log("Error writing file: " + err);
// 			}
// 		});
// 	}

// 	addContract("system","voteProxy",convexVoterProxy);
// 	addContract("system","treasury",convexTreasury);

// 	deployer.deploy(ConvexToken, convexVoterProxy).then(function(instance) {
// 		cvx = instance;
// 		addContract("system","cvx",cvx.address)
// 		return CurveVoterProxy.at(convexVoterProxy);
// 	})
// 	.then(function(voterinstance) {
// 		voter = voterinstance;
// 		return deployer.deploy(Booster, voter.address, cvx.address)
// 	})
// 	.then(function(instance) {
// 		booster = instance;
// 		addContract("system","booster",booster.address);
// 		return voter.owner();
// 	})
// 	.then(function(currentOwner){
// 		//if develop, change current owner to current deployer
// 		if(currentOwner != admin){
// 			return voter.setOwner(admin,{from:currentOwner});
// 		}
// 	})
// 	.then(function() {
// 		return voter.setOperator(booster.address)
// 	})
// 	.then(function(){
// 		return cvx.mint(accounts[0],premine.toString())
// 	})
// 	.then(function() {
// 		return deployer.deploy(RewardFactory,booster.address)
// 	}).then(function(instance) {
// 		rFactory = instance;
// 		addContract("system","rFactory",rFactory.address);
// 	}).then(function() {
// 		return deployer.deploy(TokenFactory,booster.address)
// 	}).then(function(instance) {
// 		tFactory = instance;
// 		addContract("system","tFactory",tFactory.address);
// 		return deployer.deploy(StashFactory,booster.address,rFactory.address)
// 	}).then(function(instance) {
// 		sFactory = instance;
// 		addContract("system","sFactory",sFactory.address);
// 		return deployer.deploy(cvxCrvToken)
// 	}).then(function(instance) {
// 		cvxCrv = instance;
// 		addContract("system","cvxCrv",cvxCrv.address);
// 		return deployer.deploy(CrvDepositor,voter.address,cvxCrv.address)
// 	}).then(function(instance) {
// 		deposit = instance;
// 		addContract("system","crvDepositor",deposit.address);
// 		return cvxCrv.setOperator(deposit.address)
// 	}).then(function() {
// 		return voter.setDepositor(deposit.address)
// 	})
// 	.then(function(){
// 		return deposit.initialLock();
// 	})
// 	.then(function() {
// 		return booster.setTreasury(deposit.address)
// 	}).then(function() {
// 		return deployer.deploy(BaseRewardPool,0,cvxCrv.address,crv,booster.address,rFactory.address)
// 	}).then(function(instance) {
// 		cvxCrvRewards = instance;
// 		addContract("system","cvxCrvRewards",cvxCrvRewards.address);
// 		// reward manager is admin to add any new incentive programs
// 		return deployer.deploy(cvxRewardPool,cvx.address,crv,deposit.address,cvxCrvRewards.address,cvxCrv.address,booster.address,admin)
// 	}).then(function(instance) {
// 		cvxRewards = instance;
// 		addContract("system","cvxRewards",cvxRewards.address);
// 		return booster.setRewardContracts(cvxCrvRewards.address,cvxRewards.address)
// 	}).then(function() {
// 		return deployer.deploy(PoolManager,booster.address)
// 	}).then(function(instance) {
// 		pools = instance;
// 		addContract("system","poolManager",pools.address);
// 		return booster.setPoolManager(pools.address)
// 	}).then(function() {
// 		return booster.setFactories(rFactory.address,sFactory.address,tFactory.address)
// 	}).then(function() {
// 		return booster.setFeeInfo()
// 	})
// 	.then(function() {
// 		return deployer.deploy(ArbitratorVault,booster.address)
// 	}).then(function(instance) {
// 		arb = instance
// 		addContract("system","arbitratorVault",arb.address);
// 		return booster.setArbitrator(arb.address)
// 	})
// 	.then(function(){
// 		return time.latestBlock();
// 	})
// 	.then(function(block) {
// 		var chefCvx = new BN(distroList.lpincentives);
// 		var numberOfBlocks = new BN(6000*365*4);
// 		var rewardPerBlock = new BN(chefCvx).div(numberOfBlocks)
// 		console.log("chef rewards per block: " +rewardPerBlock.toString());
// 		var startblock = Number(block) + 500;//start with small delay
// 		var endbonusblock = Number(startblock) + (2*7*6400);//about 2 weeks
// 		console.log("current block: " +block);
// 		console.log("chef rewards start on: " +startblock);
// 		console.log("chef reward bonus end on: " +endbonusblock);
// 		return deployer.deploy(ConvexMasterChef,cvx.address,rewardPerBlock, startblock, endbonusblock )
// 	}).then(function(instance) {
// 		chef = instance;
// 		addContract("system","chef",chef.address);
// 		return cvx.transfer(chef.address, distroList.lpincentives);
// 	})
// 	.then(function(){
// 		return cvx.balanceOf(chef.address);
// 	})
// 	.then(function(_cvx){
// 		console.log("cvx on chef: " +_cvx);
// 	})
// 	.then(function() {
// 		return deployer.deploy(ClaimZap,cvxRewards.address, cvxCrvRewards.address, chef.address, cvx.address, cvxCrv.address, deposit.address)
// 	}).then(function(instance) {
// 		addContract("system","claimZap",instance.address);
// 		return instance.setApprovals();
// 	})


// 	//Fund vested escrow
// 	.then(function() {
// 		//vest team, invest, treasury
// 		return deployer.deploy(VestedEscrow,cvx.address, rewardsStart, rewardsEnd, cvxRewards.address, admin)
// 	})
// 	.then(function(instance) {
// 		vesting = instance;
// 		addContract("system","vestedEscrow",vesting.address);
// 		return cvx.approve(vesting.address, distroList.vested.total);
// 	})
// 	.then(function() {
// 		return vesting.addTokens(distroList.vested.total);
// 	})
// 	.then(function() {
// 		return vesting.fund(vestedAddresses,vestedAmounts);
// 	})
// 	// .then(function() {
// 	// 	return vesting.fund(distroList.vested.investor.addresses,distroList.vested.investor.amounts);
// 	// })
// 	.then(function() {
// 		return vesting.unallocatedSupply();
// 	})
// 	.then(function(unallocatedSupply) {
// 		console.log("vesting unallocatedSupply: " +unallocatedSupply)
// 		return vesting.initialLockedSupply();
// 	})
// 	.then(function(initialLockedSupply) {
// 		console.log("vesting initialLockedSupply: " +initialLockedSupply)
// 	})
// 	.then(function() {
// 		return deployer.deploy(MerkleAirdropFactory)
// 	})
// 	.then(function(dropFactory) {
// 		addContract("system","dropFactory",dropFactory.address);
// 		return dropFactory.CreateMerkleAirdrop()
// 	})
// 	.then(function(tx) {
   //    	console.log("factory return: " +tx.logs[0].args.drop)
  // 		return MerkleAirdrop.at(tx.logs[0].args.drop);
  // 	})
  // 	.then(function(instance) {
  // 		airdrop = instance;
  // 		addContract("system","airdrop",airdrop.address);
  // 		return airdrop.setRewardToken(cvx.address)
  // 	})
  // 	.then(function() {
  // 		return cvx.transfer(airdrop.address, distroList.vecrv);
  // 	})
  // 	.then(function() {
// 		return cvx.balanceOf(airdrop.address);
// 	})
// 	.then(function(dropBalance) {
// 		console.log("airdrop balance: " +dropBalance);
// 		return airdrop.setRoot(merkleRoot);
// 	})

// 	//Create CVX sushi pool
// 	.then(function() {
// 		return IUniswapV2Router01.at(sushiswapRouter)
// 	}).then(function(instance) {
// 		sushiRouter = instance;
// 		return IUniswapV2Factory.at(sushiswapFactory)
// 	}).then(function(instance) {
// 		sushiFactory = instance;
// 		console.log("sushiRouter: " +sushiRouter.address)
// 		console.log("sushiFactory: " +sushiFactory.address)

// 		return cvx.approve(sushiRouter.address,distroList.teamcvxLpSeed)
// 	}).then(function() {
// 		return sushiRouter.addLiquidityETH(cvx.address,distroList.teamcvxLpSeed,distroList.teamcvxLpSeed,web3.utils.toWei("1.0", "ether"),admin,Math.floor(Date.now() / 1000)+3000,{value:web3.utils.toWei("1.0", "ether")})
// 	}).then(function() {
// 		return sushiFactory.getPair(cvx.address,weth)
// 	}).then(function(pair) {
// 		console.log("cvxEthSLP Address: " +pair)
// 		addContract("system","cvxEthSLP",pair);
// 		return IERC20.at(pair)
// 	}).then(function(token) {
// 		pairToken = token;
// 		return pairToken.balanceOf(admin)
// 	}).then(function(balance) {
// 		console.log("cvxEth pair balance: " +balance)
// 	})


// 	//Create cvxCRV sushi pool
// 	.then(function(){
// 		return IERC20.at(crv);
// 	})
// 	.then(function(_crv){
// 		crvToken = _crv;
// 		console.log("crvToken at " +crvToken.address)
// 	})
// 	.then(function(){
// 		console.log("swap eth for crv");
// 		return sushiRouter.swapExactETHForTokens(0,[weth,crv],admin,Math.floor(Date.now() / 1000)+3000,{value:web3.utils.toWei("1.0", "ether")});
// 	}).then(function(amounts){
// 		return crvToken.balanceOf(admin);
// 	})
// 	.then(function(_crvbal){
// 		console.log("swaped for crv: " +_crvbal.toString())
// 		crvdepositAmt = new BN(_crvbal.toString()).div(2);
// 		console.log("depositing for cvxcrv: " +crvdepositAmt.toString())
// 		return crvToken.approve(deposit.address,crvdepositAmt.toString());
// 	})
// 	.then(function(){
// 		return deposit.deposit(crvdepositAmt.toString(), false, "0x0000000000000000000000000000000000000000");
// 	})
// 	.then(function(){
// 		return crvToken.balanceOf(admin);
// 	})
// 	.then(function(_crvbal){
// 		crvbal = _crvbal;
// 		console.log("crv bal: " +crvbal);
// 		return cvxCrv.balanceOf(admin);
// 	})
// 	.then(function(_cvxcrvBal){
// 		cvxCrvBal = _cvxcrvBal;
// 		console.log("cvxCrv bal: " +cvxCrvBal);
// 	})
// 	.then(function(){
// 		return crvToken.approve(sushiRouter.address,crvbal)
// 	})
// 	.then(function(){
// 		return cvxCrv.approve(sushiRouter.address,cvxCrvBal)
// 	})
// 	.then(function() {
// 		return sushiRouter.addLiquidity(crv, cvxCrv.address,crvbal,cvxCrvBal,0,0,admin,Math.floor(Date.now() / 1000)+3000)
// 	}).then(function() {
// 		return sushiFactory.getPair(cvxCrv.address,crv)
// 	}).then(function(pair) {
// 		console.log("cvxCrvCRV SLP Address: " +pair)
// 		addContract("system","cvxCrvCrvSLP",pair);
// 		return IERC20.at(pair)
// 	}).then(function(token) {
// 		pairToken = token;
// 		return pairToken.balanceOf(admin)
// 	}).then(function(balance) {
// 		console.log("cvxCrv pair balance: " +balance)
// 	})
// 	.then(function(){
// 		return crvToken.balanceOf(systemContracts["cvxCrvCrvSLP"]);
// 	})
// 	.then(function(_crv){
// 		console.log("crv on sushi: " +_crv)
// 		return cvxCrv.balanceOf(systemContracts["cvxCrvCrvSLP"]);
// 	})
// 	.then(function(_cvxcrv){
// 		console.log("cvxCrv on sushi: " +_cvxcrv)
// 	})

// 	//Add sushi pools to chef
// 	.then(function(){
// 		return chef.add(12000,systemContracts["cvxCrvCrvSLP"],addressZero,false);
// 	})
// 	.then(function(){
// 		return chef.add(8000,systemContracts["cvxEthSLP"],addressZero,false);
// 	})


// 	//Create convex pools
// 	.then(function() {
// 		poolNames.push("compound");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0xA2B47E3D5c44877cca798226B7B8118F9BFb7A56","0x7ca5b0a2910B33e9759DC7dDB0413949071D7575",0)
// 	})
// 	.then(function() {
// 		poolNames.push("usdt");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x52EA46506B9CC5Ef470C5bf89f17Dc28bB35D85C","0xBC89cd85491d81C6AD2954E6d0362Ee29fCa8F53",0)
// 	})
// 	.then(function() {
// 		poolNames.push("ypool");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x45F783CCE6B7FF23B2ab2D70e416cdb7D6055f51","0xFA712EE4788C042e2B7BB55E6cb8ec569C4530c1",0)
// 	})
// 	.then(function() {
// 		poolNames.push("busd");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x79a8C46DeA5aDa233ABaFFD40F3A0A2B1e5A4F27","0x69Fb7c45726cfE2baDeE8317005d3F94bE838840",0)
// 	})
// 	.then(function() {
// 		poolNames.push("susd");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0xA5407eAE9Ba41422680e2e00537571bcC53efBfD","0xA90996896660DEcC6E997655E065b23788857849",1)
// 	})
// 	.then(function() {
// 		poolNames.push("pax");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x06364f10B501e868329afBc005b3492902d6C763","0x64E3C23bfc40722d3B649844055F1D51c1ac041d",0)
// 	})
// 	.then(function() {
// 		poolNames.push("ren");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x93054188d876f558f4a66B2EF1d97d16eDf0895B","0xB1F2cdeC61db658F091671F5f199635aEF202CAC",0)
// 	})
// 	.then(function() {
// 		poolNames.push("sbtc");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x7fC77b5c7614E1533320Ea6DDc2Eb61fa00A9714","0x705350c4BcD35c9441419DdD5d2f097d7a55410F",1)
// 	})
// 	.then(function() {
// 		poolNames.push("hbtc");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x4CA9b3063Ec5866A4B82E437059D2C43d1be596F","0x4c18E409Dc8619bFb6a1cB56D114C3f592E0aE79",0)
// 	})
// 	.then(function() {
// 		poolNames.push("3pool");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7","0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A",0)
// 	})
// 	.then(function() {
// 		poolNames.push("gusd");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x4f062658EaAF2C1ccf8C8e36D6824CDf41167956","0xC5cfaDA84E902aD92DD40194f0883ad49639b023",0)
// 	})
// 	.then(function() {
// 		poolNames.push("husd");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x3eF6A01A0f81D6046290f3e2A8c5b843e738E604","0x2db0E83599a91b508Ac268a6197b8B14F5e72840",0)
// 	})
// 	.then(function() {
// 		poolNames.push("usdk");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x3E01dD8a5E1fb3481F0F589056b428Fc308AF0Fb","0xC2b1DF84112619D190193E48148000e3990Bf627",0)
// 	})
// 	.then(function() {
// 		poolNames.push("usdn");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x0f9cb53Ebe405d49A0bbdBD291A65Ff571bC83e1","0xF98450B5602fa59CC66e1379DFfB6FDDc724CfC4",0)
// 	})
// 	.then(function() {
// 		poolNames.push("musd");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x8474DdbE98F5aA3179B3B3F5942D724aFcdec9f6","0x5f626c30EC1215f4EdCc9982265E8b1F411D1352",1)
// 	})
// 	.then(function() {
// 		poolNames.push("rsv");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0xC18cC39da8b11dA8c3541C598eE022258F9744da","0x4dC4A289a8E33600D8bD4cf5F6313E43a37adec7",1)
// 	})
// 	.then(function() {
// 		poolNames.push("tbtc");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0xC25099792E9349C7DD09759744ea681C7de2cb66","0x6828bcF74279eE32f2723eC536c22c51Eed383C6",1)
// 	})
// 	.then(function() {
// 		poolNames.push("dusd");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x8038C01A0390a8c547446a0b2c18fc9aEFEcc10c","0xAEA6c312f4b3E04D752946d329693F7293bC2e6D",1)
// 	})
// 	.then(function() {
// 		poolNames.push("pbtc");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x7F55DDe206dbAD629C080068923b36fe9D6bDBeF","0xd7d147c6Bb90A718c3De8C0568F9B560C79fa416",2)
// 	})
// 	.then(function() {
// 		poolNames.push("bbtc");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x071c661B4DeefB59E2a3DdB20Db036821eeE8F4b","0xdFc7AdFa664b08767b735dE28f9E84cd30492aeE",2)
// 	})
// 	.then(function() {
// 		poolNames.push("obtc");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0xd81dA8D904b52208541Bade1bD6595D8a251F8dd","0x11137B10C210b579405c21A07489e28F3c040AB1",2)
// 	})
// 	.then(function() {
// 		poolNames.push("ust");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x890f4e345B1dAED0367A877a1612f86A1f86985f","0x3B7020743Bc2A4ca9EaF9D0722d42E20d6935855",2)
// 	})
// 	.then(function() {
// 		poolNames.push("eurs");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x0Ce6a5fF5217e38315f87032CF90686C96627CAA","0x90Bb609649E0451E5aD952683D64BD2d1f245840",2)
// 	})
// 	.then(function() {
// 		poolNames.push("seth");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0xc5424B857f758E906013F3555Dad202e4bdB4567","0x3C0FFFF15EA30C35d7A85B85c0782D6c94e1d238",2)
// 	})
// 	.then(function() {
// 		poolNames.push("aave");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0xDeBF20617708857ebe4F679508E7b7863a8A8EeE","0xd662908ADA2Ea1916B3318327A97eB18aD588b5d",2)
// 	})
// 	.then(function() {
// 		poolNames.push("steth");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0xDC24316b9AE028F1497c275EB9192a3Ea0f67022","0x182B723a58739a9c974cFDB385ceaDb237453c28",2)
// 	})
// 	.then(function() {
// 		poolNames.push("saave");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0xEB16Ae0052ed37f479f7fe63849198Df1765a733","0x462253b8F74B72304c145DB0e4Eebd326B22ca39",2)
// 	})
// 	.then(function() {
// 		poolNames.push("ankreth");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0xA96A65c051bF88B4095Ee1f2451C2A9d43F53Ae2","0x6d10ed2cF043E6fcf51A0e7b4C2Af3Fa06695707",2)
// 	})
// 	.then(function() {
// 		poolNames.push("usdp");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x42d7025938bEc20B69cBae5A77421082407f053A","0x055be5DDB7A925BfEF3417FC157f53CA77cA7222",2)
// 	})
// 	.then(function() {
// 		poolNames.push("ironbank");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x2dded6Da1BF5DBdF597C45fcFaa3194e53EcfeAF","0xF5194c3325202F456c95c1Cf0cA36f8475C1949F",2)
// 	})
// 	.then(function() {
// 		poolNames.push("link");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0xF178C0b5Bb7e7aBF4e12A4838C7b7c5bA2C623c0","0xFD4D8a17df4C27c1dD245d153ccf4499e806C87D",2)
// 	})
// 	.then(function() {
// 		poolNames.push("tusd");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0xEcd5e75AFb02eFa118AF914515D6521aaBd189F1","0x359FD5d6417aE3D8D6497d9B2e7A890798262BA4",2)
// 	})
// 	.then(function() {
// 		poolNames.push("frax");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B","0x72E158d38dbd50A483501c24f792bDAAA3e7D55C",2)
// 	})
// 	.then(function() {
// 		poolNames.push("lusd");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA","0x9B8519A9a00100720CCdC8a120fBeD319cA47a14",2)
// 	})
// 	.then(function() {
// 		poolNames.push("busdv2");
// 		console.log("adding pool " +poolNames[poolNames.length-1]);
// 		return pools.addPool("0x4807862AA8b2bF68830e4C8dc86D0e9A998e085a","0xd4B22fEdcA85E684919955061fDf353b9d38389b",2)
// 	})


// 	.then(function() {
// 		return booster.poolLength()
// 	})
// 	.then(function(poolCount) {
// 		var pList = [];
// 		for(var i = 0; i < poolCount; i++){
// 			pList.push(booster.poolInfo(i));
// 		}
// 		//var pinfo = await booster.poolInfo(0)
// 		return Promise.all(pList);
// 	})
// 	.then(function(poolInfoList) {
// 		//console.log("poolInfo: " +JSON.stringify(poolInfoList));
// 		for(var i = 0; i < poolInfoList.length; i++){
// 			delete poolInfoList[i]["0"];
// 			delete poolInfoList[i]["1"];
// 			delete poolInfoList[i]["2"];
// 			delete poolInfoList[i]["3"];
// 			delete poolInfoList[i]["4"];
// 			delete poolInfoList[i]["5"];
// 			delete poolInfoList[i]["shutdown"];
// 			var crvrewards = poolInfoList[i]["crvRewards"];
// 			var rewardList = [];
// 			rewardList.push({rToken:crv,rAddress:crvrewards})
// 			poolInfoList[i].rewards = rewardList;
// 			poolInfoList[i].name = poolNames[i];
// 			poolInfoList[i].id = i;
// 			poolsContracts.push(poolInfoList[i]);
// 		}
// 	})

// 	.then(function() {
// 		var contractListOutput = JSON.stringify(contractList,null,4);
// 		console.log(contractListOutput);
// 		fs.writeFileSync("contracts.json",contractListOutput, function(err) {
// 			if (err) {
// 				return console.log("Error writing file: " + err);
// 			}
// 		});
// 	});
};
