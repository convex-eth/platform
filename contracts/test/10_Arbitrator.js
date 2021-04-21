// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const CrvDepositor = artifacts.require("CrvDepositor");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const ExtraRewardStashV1 = artifacts.require("ExtraRewardStashV1");
const ExtraRewardStashV2 = artifacts.require("ExtraRewardStashV2");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const VirtualBalanceRewardPool = artifacts.require("VirtualBalanceRewardPool");
const cvxRewardPool = artifacts.require("cvxRewardPool");
const ConvexToken = artifacts.require("ConvexToken");
const cCrvToken = artifacts.require("cCrvToken");
const StashFactory = artifacts.require("StashFactory");
const RewardFactory = artifacts.require("RewardFactory");
const ArbitratorVault = artifacts.require("ArbitratorVault");
const PoolManager = artifacts.require("PoolManager");


const IExchange = artifacts.require("IExchange");
const ISPool = artifacts.require("ISPool");
const I2CurveFi = artifacts.require("I2CurveFi");
const IERC20 = artifacts.require("IERC20");
const ICurveGauge = artifacts.require("ICurveGauge");
const ISnxRewards = artifacts.require("ISnxRewards");


//3. extra rewards, but with v1 gauges

contract("ExtraRewardsTest v1", async accounts => {
  it("should deposit and claim crv/cvx as well as extra incentives", async () => {

    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let threeCrv = await IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let dai = await IERC20.at("0x6b175474e89094c44da98b954eedeac495271d0f");
    let eurs = await IERC20.at("0xdb25f211ab05b1c97d595516f45794528a807ad8");
    let snx = await IERC20.at("0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f");
    let exchange = await IExchange.at("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
    let susdswap = await ISPool.at("0xA5407eAE9Ba41422680e2e00537571bcC53efBfD");
    let eursswap = await I2CurveFi.at("0x0Ce6a5fF5217e38315f87032CF90686C96627CAA");
    let susdlp = await IERC20.at("0xC25a3A3b969415c80451098fa907EC722572917F");
    let eurslp = await IERC20.at("0x194eBd173F6cDacE046C53eACcE9B953F28411d1");
    let susdGauge = await ICurveGauge.at("0xA90996896660DEcC6E997655E065b23788857849");
    let eursGauge = await ICurveGauge.at("0x90Bb609649E0451E5aD952683D64BD2d1f245840");
    let susdGaugeDebug = await ISPool.at("0xA90996896660DEcC6E997655E065b23788857849");

    let admin = accounts[0];
    let userA = accounts[1];
    let userB = accounts[2];
    let caller = accounts[3];

    //system
    let voteproxy = await CurveVoterProxy.deployed();
    let booster = await Booster.deployed();
    let rewardFactory = await RewardFactory.deployed();
    let stashFactory = await StashFactory.deployed();
    let poolManager = await PoolManager.deployed();
    let cvx = await ConvexToken.deployed();
    let cCrv = await cCrvToken.deployed();
    let crvDeposit = await CrvDepositor.deployed();
    let cCrvRewards = await booster.lockRewards();
    let cvxRewards = await booster.stakerRewards();
    let cCrvRewardsContract = await BaseRewardPool.at(cCrvRewards);
    let cvxRewardsContract = await cvxRewardPool.at(cvxRewards);

    var poolId = contractList.pools.find(pool => pool.name == "susd").id;
    let poolinfo = await booster.poolInfo(poolId);
    let rewardPoolAddress = poolinfo.crvRewards;
    let rewardPool = await BaseRewardPool.at(rewardPoolAddress);
    console.log("reward contract at " +rewardPool.address);
    let stash = poolinfo.stash;
    let rewardStash = await ExtraRewardStashV1.at(stash);
    console.log("stash contract at " +rewardStash.address);
    
    //earmark to make sure snx is registered
    await booster.earmarkRewards(poolId,{from:caller});
    
    //make sure statsh is v1
    let stashName = await rewardStash.getName();
    console.log("stash name: " +stashName);
   

    let starttime = await time.latest();
    console.log("current block time: " +starttime)
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //exchange and deposit for susd lp
    await weth.sendTransaction({value:web3.utils.toWei("5.0", "ether"),from:userA});
    let startingWeth = await weth.balanceOf(userA);
    await weth.approve(exchange.address,startingWeth,{from:userA});
    await exchange.swapExactTokensForTokens(startingWeth,0,[weth.address,dai.address],userA,starttime+3000,{from:userA});
    let startingdai = await dai.balanceOf(userA);
    await dai.approve(susdswap.address,0,{from:userA});
    await dai.approve(susdswap.address,startingdai,{from:userA});
    await susdswap.add_liquidity([startingdai,0,0,0],0,{from:userA});
    let startinglp = await susdlp.balanceOf(userA);
    console.log("s pool lp: " +startinglp);
 
    //approve and deposit
    await susdlp.approve(booster.address,0,{from:userA});
    await susdlp.approve(booster.address,startinglp,{from:userA});
    await booster.depositAll(poolId,true,{from:userA});
    console.log("user A, susd deposit complete");

    //confirm deposit
    await susdlp.balanceOf(userA).then(a=>console.log("userA susdlp: " +a));
    await rewardPool.balanceOf(userA).then(a=>console.log("deposited lp: " +a));
    await susdGauge.balanceOf(voteproxy.address).then(a=>console.log("gaugeBalance: " +a));
    await snx.balanceOf(rewardStash.address).then(a=>console.log("snx on stash (==0): " +a));
    await snx.balanceOf(voteproxy.address).then(a=>console.log("snx on voter (==0): " +a));
    await snx.balanceOf(booster.address).then(a=>console.log("snx on deposit (==0): " +a));

    //advance time
    await time.increase(86400);
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time...");
    await time.latest().then(a=>console.log("current block time: " +a));
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //collect and distribute rewards off gauge
    await booster.earmarkRewards(poolId,{from:caller});
    console.log("earmark 1")

    //get new snx reward contract
    //await rewardPool.extraRewardsLength().then(a=>console.log("reward pool extra rewards: " +a));
   // let tokenInfo = await rewardStash.tokenInfo();
   // console.log("snx token rewards (from stash): " +tokenInfo.rewardAddress);
    let snxRewardsAddress = await rewardPool.extraRewards(0);
    let snxRewards = await VirtualBalanceRewardPool.at(snxRewardsAddress);
    console.log("snx token rewards (from main rewards): " +snxRewards.address);

    //make sure crv and snx is where they should be
    // await crv.balanceOf(voteproxy.address).then(a=>console.log("crv at voteproxy " +a));
    // await crv.balanceOf(booster.address).then(a=>console.log("crv at booster " +a));
    // await crv.balanceOf(caller).then(a=>console.log("crv at caller " +a));
    // await crv.balanceOf(rewardPool.address).then(a=>console.log("crv at reward pool " +a));
    // await crv.balanceOf(cCrvRewards).then(a=>console.log("crv at cCrvRewards " +a));
    // await crv.balanceOf(cvxRewards).then(a=>console.log("crv at cvxRewards " +a));
    // await crv.balanceOf(userA).then(a=>console.log("userA crv: " +a))
    // await rewardPool.earned(userA).then(a=>console.log("rewards earned(unclaimed): " +a));

    await snx.balanceOf(rewardStash.address).then(a=>console.log("snx on stash (==0): " +a));
    await snx.balanceOf(voteproxy.address).then(a=>console.log("snx on voter (==0): " +a));
    await snx.balanceOf(booster.address).then(a=>console.log("snx on deposit (==0): " +a));
    await snx.balanceOf(snxRewards.address).then(a=>console.log("snx on rewards (>0): " +a));
    
    //get eurs for user b
    await weth.sendTransaction({value:web3.utils.toWei("5.0", "ether"),from:userB});
    let startingWeth2 = await weth.balanceOf(userB);
    console.log("user b weth: " +startingWeth2);
    await weth.approve(exchange.address,startingWeth2,{from:userB});
    await exchange.swapExactTokensForTokens(startingWeth2,0,[weth.address,eurs.address],userB,starttime+3000,{from:userB});
    let startingeurs = await eurs.balanceOf(userB);
    console.log("user b eurs: " +startingeurs);
    await eurs.approve(eursswap.address,0,{from:userB});
    await eurs.approve(eursswap.address,startingeurs,{from:userB});
    await eursswap.add_liquidity([startingeurs,0],0,{from:userB});
    let startingeurslp = await eurslp.balanceOf(userB);
    console.log("eurs pool lp: " +startingeurslp);

    //eurs pool
    var eurspoolId = contractList.pools.find(pool => pool.name == "eurs").id;
    let eurspoolinfo = await booster.poolInfo(eurspoolId);
    let eursrewardPoolAddress = eurspoolinfo.crvRewards;
    let eursrewardPool = await BaseRewardPool.at(eursrewardPoolAddress);
    console.log("reward contract at " +eursrewardPool.address);
    let eursStash = eurspoolinfo.stash;
    console.log("stash contract at " +eursStash);

    await eurslp.approve(booster.address,0,{from:userB});
    await eurslp.approve(booster.address,startinglp,{from:userB});
    await booster.depositAll(eurspoolId,true,{from:userB});
    console.log("user B, eurs deposit complete");
    await booster.earmarkRewards(eurspoolId,{from:caller});
    console.log("earmark eurs to get started");

    let snxRewardsAddress2 = await eursrewardPool.extraRewards(0);
    let eursSnxRewards = await VirtualBalanceRewardPool.at(snxRewardsAddress2);
    console.log("eursSnxRewards at: " +eursSnxRewards.address);

    //advance time
    await time.increase(86400);
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time...");
    await time.latest().then(a=>console.log("current block time: " +a));
    await time.latestBlock().then(a=>console.log("current block: " +a));

    //collect and distribute rewards off gauge
    await booster.earmarkRewards(eurspoolId,{from:caller});
    console.log("earmark 2")

    await snx.balanceOf(rewardStash.address).then(a=>console.log("snx on stash (==0): " +a));
    await snx.balanceOf(voteproxy.address).then(a=>console.log("snx on voter (==0): " +a));
    await snx.balanceOf(booster.address).then(a=>console.log("snx on deposit (==0): " +a));
    await snx.balanceOf(snxRewards.address).then(a=>console.log("snx on spool rewards: " +a));
    await snx.balanceOf(eursSnxRewards.address).then(a=>console.log("snx on eurs rewards: " +a));
    console.log("snx on eurs is done so should not be any on eurs");
    await booster.earmarkRewards(poolId,{from:caller});
    console.log("earmark 1")
    await snx.balanceOf(snxRewards.address).then(a=>console.log("snx on spool rewards: " +a));
    await snx.balanceOf(eursSnxRewards.address).then(a=>console.log("snx on eurs rewards: " +a));



    //give eurs contract some snx and call update on reward contract
    //reward contract: 0xc0d8994Cd78eE1980885DF1A0C5470fC977b5cFe
    //owner: 0xDe910777C787903F78C89e7a0bf7F4C435cBB1Fe
    let snxowner = "0xDe910777C787903F78C89e7a0bf7F4C435cBB1Fe";
    await weth.sendTransaction({value:web3.utils.toWei("5.0", "ether")});
    let wethforsnx = await weth.balanceOf(admin);
    await weth.approve(exchange.address,wethforsnx);
    await exchange.swapExactTokensForTokens(wethforsnx,0,[weth.address,snx.address],admin,starttime+3000,{from:admin});
    let startingsnx = await snx.balanceOf(admin);
    console.log("snx to inject: " +startingsnx);
    let snxcontract = await ISnxRewards.at("0xc0d8994Cd78eE1980885DF1A0C5470fC977b5cFe");
    await snx.transfer(snxcontract.address, startingsnx);
    console.log("sent snx");
    await snxcontract.notifyRewardAmount(startingsnx,{from:snxowner});
    console.log("snx rewards restarted");
    
    //get arb address
    let arbitrator = await ArbitratorVault.deployed();
    await snx.balanceOf(snxRewards.address).then(a=>console.log("snx on spool rewards: " +a));
    await snx.balanceOf(eursSnxRewards.address).then(a=>console.log("snx on eurs rewards: " +a));
    await snx.balanceOf(arbitrator.address).then(a=>console.log("snx arbitrator: " +a));
    //claim from susd, should go up
    await time.increase(86400);
    await time.advanceBlock();
    await booster.earmarkRewards(poolId,{from:caller});
    console.log("----update----");
    await snx.balanceOf(snxRewards.address).then(a=>console.log("snx on spool rewards: " +a));
    await snx.balanceOf(eursSnxRewards.address).then(a=>console.log("snx on eurs rewards: " +a));
    await snx.balanceOf(arbitrator.address).then(a=>console.log("snx arbitrator: " +a));
    //claim from eurs, should go to arb
    await booster.earmarkRewards(eurspoolId,{from:caller});
    console.log("----update----");
    await snx.balanceOf(snxRewards.address).then(a=>console.log("snx on spool rewards: " +a));
    await snx.balanceOf(eursSnxRewards.address).then(a=>console.log("snx on eurs rewards: " +a));
    await snx.balanceOf(arbitrator.address).then(a=>console.log("snx arbitrator: " +a));
    //claim from susd, should go to arb
    await time.increase(86400);
    await time.advanceBlock();
    await booster.earmarkRewards(poolId,{from:caller});
    console.log("----update----");
    await snx.balanceOf(snxRewards.address).then(a=>console.log("snx on spool rewards: " +a));
    await snx.balanceOf(eursSnxRewards.address).then(a=>console.log("snx on eurs rewards: " +a));
    await snx.balanceOf(arbitrator.address).then(a=>console.log("snx arbitrator: " +a));
    //susd should run out before eurs
    //keep claiming until susd goes inactive and eurs should start receiving directly
    await time.increase(4*86400);
    await time.advanceBlock();
    await booster.earmarkRewards(poolId,{from:caller});
    await booster.earmarkRewards(eurspoolId,{from:caller});
    console.log("----update----");
    await snx.balanceOf(snxRewards.address).then(a=>console.log("snx on spool rewards: " +a));
    await snx.balanceOf(eursSnxRewards.address).then(a=>console.log("snx on eurs rewards: " +a));
    await snx.balanceOf(arbitrator.address).then(a=>console.log("snx arbitrator: " +a));
    
    
    await time.increase(4*86400);
    await time.advanceBlock();
    await booster.earmarkRewards(poolId,{from:caller});
    await booster.earmarkRewards(eurspoolId,{from:caller});
    console.log("----update----");
    await snx.balanceOf(snxRewards.address).then(a=>console.log("snx on spool rewards: " +a));
    await snx.balanceOf(eursSnxRewards.address).then(a=>console.log("snx on eurs rewards: " +a));
    await snx.balanceOf(arbitrator.address).then(a=>console.log("snx arbitrator: " +a));
    await time.increase(4*86400);
    await time.advanceBlock();
    await booster.earmarkRewards(poolId,{from:caller});
    await booster.earmarkRewards(eurspoolId,{from:caller});
    console.log("----update----");
    await snx.balanceOf(snxRewards.address).then(a=>console.log("snx on spool rewards: " +a));
    await snx.balanceOf(eursSnxRewards.address).then(a=>console.log("snx on eurs rewards: " +a));
    await snx.balanceOf(arbitrator.address).then(a=>console.log("snx arbitrator: " +a));

    console.log("----redistribute----");
    //let arbSnx = await snx.balanceOf(arbitrator.address);
    await snx.balanceOf(rewardStash.address).then(a=>console.log("snx on susd stash: " +a));
    await snx.balanceOf(eursStash).then(a=>console.log("snx on eurs stash: " +a));
    await arbitrator.distribute(snx.address,[poolId,eurspoolId],[1111,2222]);
    console.log("distribute complete")
    // await booster.earmarkRewards(1,{from:caller});
    // await booster.earmarkRewards(eurspoolId,{from:caller});
    await snx.balanceOf(rewardStash.address).then(a=>console.log("snx on susd stash: " +a));
    await snx.balanceOf(eursStash).then(a=>console.log("snx on eurs stash: " +a));
    await snx.balanceOf(arbitrator.address).then(a=>console.log("snx arbitrator: " +a));
  });
});


