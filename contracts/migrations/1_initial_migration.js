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
const cCrvToken = artifacts.require("cCrvToken");
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


// const IUniswapV2Router01 = artifacts.require("IUniswapV2Router01");
// const IUniswapV2Factory = artifacts.require("IUniswapV2Factory");
const IERC20 = artifacts.require("IERC20");

//TODO: create reward pools and distribute premine
//TODO: pass various roles to multisig

module.exports = function (deployer, network, accounts) {
	if(network == "deployed"){
		return true;
	}
	//return true;
	let crv = "0xD533a949740bb3306d119CC777fa900bA034cd52";
	let vecrvFeeDistro = "0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc";
	let threeCrv = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";
	let threeCrvGauge = "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A";
    let threeCrvSwap = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";

    let sushiswapRouter = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
    let sushiswapFactory = "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac";
    let weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

    let admin = accounts[0];

	var booster, voter, rFactory, sFactory, tFactory, cvx, ccrv, deposit, arb, pools;
	var ccrvRewards, cvxRewards, airdrop, vecrvVesting, chef;
	var sushiRouter, sushiFactory, pairToken;

	var rewardsStart = Math.floor(Date.now() / 1000)+86400;
    var rewardsEnd = rewardsStart + (1 * 364 * 86400);

    var contractList = {};
    var systemContracts = {};
    var poolsContracts = [];
    var poolNames = [];
    contractList["system"] = systemContracts;
    contractList["pools"] = poolsContracts;
    //todo: pass rewards start to booster constructor

  	deployer.deploy(CurveVoterProxy).then(function(instance) {
  		voter = instance;
  		systemContracts["voteProxy"] = voter.address;
  	}).then(function() {
		return deployer.deploy(ConvexToken, voter.address)
	}).then(function(instance) {
		cvx = instance;
		systemContracts["cvx"] = cvx.address;
		return cvx.mint(accounts[0],distroList.premine)//"5000000000000000000000000")
	})
	.then(function() {
		return deployer.deploy(Booster, voter.address, cvx.address, rewardsStart)
	})
	.then(function(instance) {
		booster = instance;
		systemContracts["booster"] = booster.address;
	})
	.then(function() {
		return voter.setOperator(booster.address)
	})
	.then(function() {
		return deployer.deploy(RewardFactory,booster.address)
	}).then(function(instance) {
		rFactory = instance;
		systemContracts["rFactory"] = rFactory.address;
	}).then(function() {
		return deployer.deploy(TokenFactory,booster.address)
	}).then(function(instance) {
		tFactory = instance;
		systemContracts["tFactory"] = tFactory.address;
		return deployer.deploy(StashFactory,booster.address,rFactory.address)
	}).then(function(instance) {
		sFactory = instance;
		systemContracts["sFactory"] = sFactory.address;
		return deployer.deploy(cCrvToken)
	}).then(function(instance) {
		ccrv = instance;
		systemContracts["cvxCrv"] = ccrv.address;
		return deployer.deploy(CrvDepositor,voter.address,ccrv.address)
	}).then(function(instance) {
		deposit = instance;
		systemContracts["crvDepositor"] = deposit.address;
		return ccrv.setOperator(deposit.address)
	}).then(function() {
		return voter.setDepositor(deposit.address)
	}).then(function() {
		return booster.setTreasury(deposit.address)
	}).then(function() {
		return deployer.deploy(BaseRewardPool,0,ccrv.address,crv,booster.address,rFactory.address)
	}).then(function(instance) {
		ccrvRewards = instance;
		systemContracts["cvxCrvRewards"] = ccrvRewards.address;
		// reward manager is admin to add any new incentive programs
		return deployer.deploy(cvxRewardPool,cvx.address,crv,deposit.address,ccrvRewards.address,ccrv.address,booster.address,admin)
	}).then(function(instance) {
		cvxRewards = instance;
		systemContracts["cvxRewards"] = cvxRewards.address;
		return booster.setRewardContracts(ccrvRewards.address,cvxRewards.address)
	}).then(function() {
		return deployer.deploy(PoolManager,booster.address)
	}).then(function(instance) {
		pools = instance;
		systemContracts["poolManager"] = pools.address;
		return booster.setPoolManager(pools.address)
	}).then(function() {
		return booster.setFactories(rFactory.address,sFactory.address,tFactory.address)
	}).then(function() {
		return booster.setFeeInfo(vecrvFeeDistro,threeCrv)
	})
	.then(function() {
		return deployer.deploy(ArbitratorVault,booster.address)
	}).then(function(instance) {
		arb = instance
		systemContracts["aribatratorVault"] = arb.address;
		return booster.setArbitrator(arb.address)
	})
	.then(function() {
		var chefCvx = new BN(distroList.lpincentives);
		var numberOfBlocks = new BN(6000*365*4);
		var rewardPerBlock = new BN(chefCvx).div(numberOfBlocks)
		console.log("cvx to chef: " +chefCvx.toString())
		console.log("rewards per block: " +rewardPerBlock.toString());
		return deployer.deploy(ConvexMasterChef,cvx.address,rewardPerBlock, rewardsStart, rewardsStart+80220 )
	}).then(function(instance) {
		chef = instance;
		systemContracts["chef"] = chef.address;
	})
	.then(function() {
		return deployer.deploy(ClaimZap,cvxRewards.address, ccrvRewards.address, chef.address)
	}).then(function(instance) {
		systemContracts["claimZap"] = instance.address;
	})
	.then(function() {
		//vecrv holder rewards changed to instant drop
		//no need to set a funding contract
		return deployer.deploy(VestedEscrow,cvx.address, rewardsStart, rewardsEnd, cvxRewards.address, admin)
	})
	.then(function(instance) {
		vecrvVesting = instance;
		systemContracts["vestedEscrow"] = vecrvVesting.address;
		return cvx.approve(vecrvVesting.address, distroList.vested.total);
	})
	.then(function() {
		return vecrvVesting.addTokens(distroList.vested.total);
	})
	.then(function() {
		return vecrvVesting.fund(distroList.vested.team.addresses,distroList.vested.team.amounts);
	})
	.then(function() {
		return vecrvVesting.fund(distroList.vested.investor.addresses,distroList.vested.investor.amounts);
	})
	.then(function() {
		return vecrvVesting.unallocatedSupply();
	})
	.then(function(unallocatedSupply) {
		console.log("vesting unallocatedSupply: " +unallocatedSupply)
		return vecrvVesting.initialLockedSupply();
	})
	.then(function(initialLockedSupply) {
		console.log("vesting initialLockedSupply: " +initialLockedSupply)
	})
	.then(function() {
		return deployer.deploy(MerkleAirdropFactory)
	})
	.then(function(dropFactory) {
		systemContracts["dropFactory"] = dropFactory.address;
		return dropFactory.CreateMerkleAirdrop()
	})
	.then(function(tx) {
      	console.log("factory return: " +tx.logs[0].args.drop)
  		return MerkleAirdrop.at(tx.logs[0].args.drop);
  	})
  	.then(function(instance) {
  		airdrop = instance;
  		systemContracts["airdrop"] = airdrop.address;
  		return airdrop.setRewardToken(cvx.address)
  	})
  	.then(function() {
  		return cvx.transfer(airdrop.address, distroList.vecrv);
  	})
  	.then(function() {
		return cvx.balanceOf(airdrop.address);
	})
	.then(function(dropBalance) {
		console.log("airdrop balance: " +dropBalance);
	})
	// .then(function() {
	// 	return deployer.deploy(MerkleAirdrop)
	// }).then(function(instance) {
	// 	airdrop = instance;
	// 	return true;
	// })
	// .then(function() {
	// 	return IUniswapV2Router01.at(sushiswapRouter)
	// }).then(function(instance) {
	// 	sushiRouter = instance;
	// 	return IUniswapV2Factory.at(sushiswapFactory)
	// }).then(function(instance) {
	// 	sushiFactory = instance;
	// 	console.log("sushiRouter: " +sushiRouter.address)
	// 	console.log("sushiFactory: " +sushiFactory.address)
	// 	return cvx.approve(sushiRouter.address,web3.utils.toWei("12000", "ether"))
	// }).then(function() {
	// 	console.log("approved")
	// 	return sushiRouter.addLiquidityETH(cvx.address,web3.utils.toWei("12000", "ether"),web3.utils.toWei("12000", "ether"),web3.utils.toWei("1.0", "ether"),admin,Date.now()+3000,{value:web3.utils.toWei("1.0", "ether")})
	// }).then(function() {
	// 	return sushiFactory.getPair(cvx.address,weth)
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
		poolNames.push("3pool");
		return pools.addPool(threeCrvSwap,threeCrvGauge,0)
	})
	.then(function() {
		poolNames.push("pbtc");
		return pools.addPool("0x7F55DDe206dbAD629C080068923b36fe9D6bDBeF","0xd7d147c6Bb90A718c3De8C0568F9B560C79fa416",2)
	})
	.then(function() {
		poolNames.push("susd");
		return pools.addPool("0xA5407eAE9Ba41422680e2e00537571bcC53efBfD","0xA90996896660DEcC6E997655E065b23788857849",1)
	})
	.then(function() {
		poolNames.push("eurs");
		return pools.addPool("0x0Ce6a5fF5217e38315f87032CF90686C96627CAA","0x90Bb609649E0451E5aD952683D64BD2d1f245840",2)
	})
	.then(function() {
		return booster.poolLength()
	})
	.then(function(poolCount) {
		var pList = [];
		for(var i = 0; i < poolCount; i++){
			pList.push(booster.poolInfo(i));
		}
		//var pinfo = await booster.poolInfo(0)
		return Promise.all(pList);
	})
	.then(function(poolInfoList) {
		//console.log("poolInfo: " +JSON.stringify(poolInfoList));
		for(var i = 0; i < poolInfoList.length; i++){
			delete poolInfoList[i]["0"];
			delete poolInfoList[i]["1"];
			delete poolInfoList[i]["2"];
			delete poolInfoList[i]["3"];
			delete poolInfoList[i]["4"];
			delete poolInfoList[i]["5"];
			delete poolInfoList[i]["shutdown"];
			var crvrewards = poolInfoList[i]["crvRewards"];
			var rewardList = [];
			rewardList.push({rToken:crv,rAddress:crvrewards})
			poolInfoList[i].rewards = rewardList;
			poolInfoList[i].name = poolNames[i];
			poolInfoList[i].id = i;
			poolsContracts.push(poolInfoList[i]);
		}
	})
	.then(function() {
		var contractListOutput = JSON.stringify(contractList,null,4);
		console.log(contractListOutput);
		fs.writeFileSync("contracts.json",contractListOutput, function(err) {
			if (err) {
				return console.log("Error writing file: " + err);
			}
		});
	});
};
