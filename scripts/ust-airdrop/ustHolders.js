const fs = require('fs');
const { ethers } = require("ethers");
const jsonfile = require('jsonfile');
const { CRV_ABI, MASTERCHEF_ABI, UNITVAULT_ABI, MULTICALL_ABI, REWARDS_ABI, MASTERCHEFVTWO_ABI, GAUGE_ABI } = require('./abi');
var BN = require('big-number');

const ObjectsToCsv = require('objects-to-csv');
const config = jsonfile.readFileSync('./config.json');

//var startBlock = 12451018;
const wormholeUst_creationBlock = 13415127;
const mimust_creationBlock = 13338726;
const ustw_creationBlock = 11466549;
const preAttack_block = 14730462;
const postAttack_block = 14849042;

const deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";


const ustwormholePreAttack_file = 'ustwormhole_preattack.json';
const ustwrappedPreAttack_file = 'ustwrapped_preattack.json';
const ustmimPreAttack_file = 'ustmim_preattack.json';

const ustwormholePostAttack_file = 'ustwormhole_postattack.json';
const ustwrappedPostAttack_file = 'ustwrapped_postattack.json';
const ustmimPostAttack_file = 'ustmim_postattack.json';

const ustWrappedCombinedPreAttack_file = 'ustwCombo_preattack.json';
const ustWrappedCombinedPostAttack_file = 'ustwCombo_postattack.json';

const ustfinal_file = 'ust_final.json';

const ustCSV = 'ust_csv.csv'


/*
Add config.json file to script folder

{
    "NETWORK":"mainnet",
    "INFURA_KEY":"KEYINFURAKEY",
    "ALCHEMY_KEY":"SOMEALCHEMYKEY",
    "USE_PROVIDER":"infura/alchemy"
}
*/

//Setup ethers providers
var provider;
if(config.USE_PROVIDER == "infura"){
    provider = new ethers.providers.InfuraProvider(config.NETWORK, config.INFURA_KEY);
}else if(config.USE_PROVIDER == "alchemy"){
    provider = new ethers.providers.AlchemyProvider (config.NETWORK, config.ALCHEMY_KEY);
}else{
    provider = new ethers.providers.JsonRpcProvider(config.GETH_NODE, config.NETWORK);
}

const voteProxy = "0x989AEb4d175e16225E39E87d0D97A3360524AD80";

const ustWormholeAddress = '0xa693B19d2931d498c5B318dF961919BB4aee87a5';
const ustWrappedAddress = '0xa47c8bf37f92aBed4A126BDA807A7b7498661acD';

const curveFactoryPool_ustwormhole = "0xCEAF7747579696A2F0bb206a14210e3c9e6fB269";
const curveFactoryGauge_ustwormhole = "0xb0f5d00e5916c8b8981e99191A1458704B587b2b";

const curveFactoryPool_ustwrapped = "0x94e131324b6054c0D789b190b2dAC504e4361b53";
const curveFactoryGauge_ustwrapped = "0x3B7020743Bc2A4ca9EaF9D0722d42E20d6935855";
const curveFactorySwap_ustwrapped = "0x890f4e345B1dAED0367A877a1612f86A1f86985f";

const curveFactoryPool_ustmim = "0x55A8a39bc9694714E2874c1ce77aa1E599461E18";
const curveFactoryGauge_ustmim = "0xB518f5e3242393d4eC792BD3f44946A3b98d0E48";

const convexustWormholeRewards = "0x7e2b9B5244bcFa5108A76D5E7b507CFD5581AD4A";
const convexustWormholeToken = "0x2d2006135e682984a8a2eB74F5C87c2251cC71E9";

const convexustWrappedRewards = "0xd4Be1911F8a0df178d6e7fF5cE39919c273E2B7B";
const convexustWrappedToken = "0x67c4f788FEB82FAb27E3007daa3d7b90959D5b89";

const convexustmimRewards = "0xC62DE533ea77D46f3172516aB6b1000dAf577E89";
const convexustmimToken = "0x766A8D4DE01D3eD575CdEf0587Eaf615eCB46726";

const ustWormholeContract = new ethers.Contract(ustWormholeAddress, CRV_ABI, provider);
const ustWormholeInstance = ustWormholeContract.connect(provider);

const ustWrappedContract = new ethers.Contract(ustWrappedAddress, CRV_ABI, provider);
const ustWrappedInstance = ustWrappedContract.connect(provider);

const multicallContract = new ethers.Contract("0x5e227AD1969Ea493B43F840cfF78d08a6fc17796", MULTICALL_ABI, provider);
const multicallInstance = multicallContract.connect(provider);


function compare( a, b ) {
  return b.num._compare(a.num);
}

const getBalances = async (token, userAddresses, snapshotBlock) => {
    let querySize = 50;
    let iface = new ethers.utils.Interface(CRV_ABI)
    var balances = {};

    var addressArray = [];
    for (var i in userAddresses) {
        addressArray.push(i);
    }
   // console.log(addressArray);
    console.log("address length: " +addressArray.length);
    var groups = Number( (addressArray.length/querySize) + 1).toFixed(0);
    console.log("address groups: " +groups);
    await Promise.all([...Array(Number(groups)).keys()].map(async i => {
        var start = i*querySize;
        var finish = i*querySize + querySize - 1;
        if(finish >= addressArray.length){
            finish = addressArray.length - 1;
        }
        console.log("get balances from " + start + " to " +finish);
        var calldata = [];
        var addresses = [];
        for(var c = start; c <= finish; c++){
            // console.log("queuery for " +addressArray[c]);
            var enc = iface.encodeFunctionData("balanceOf(address)",[addressArray[c]]);
            calldata.push([token,enc]);
            addresses.push(addressArray[c]);
        }
        //console.log(calldata);
        let returnData = await multicallInstance.aggregate(calldata, { blockTag: snapshotBlock });
        var balData = returnData[1];
        //console.log(returnData);
        for(var d = 0; d < balData.length; d++){
            // if(balData[d] == "0x")continue;
            // console.log("baldata[d]: " +balData[d]);
            var bal = ethers.BigNumber.from(balData[d]);
            if(bal > 0){
                balances[addresses[d]] = bal.toString();
            }
        }
    }));
    return balances; 
}


const getFactoryPoolHolders = async (startBlock, snapshotBlock, convexHolders, factorypoolAddress, swapAddress, curveFactoryGauge, rewardContract, filename, whichUST, boolWormhole = false) => {
    var curvePool = null;
    if (fs.existsSync(filename)) {
        curvePool = jsonfile.readFileSync(filename);
    } else {
        curvePool = { addresses:{} };
    }
    const factorypoolContract = new ethers.Contract(factorypoolAddress, CRV_ABI, provider);
    const factorypoolInstance = factorypoolContract.connect(provider);
    const factorygaugeContract = new ethers.Contract(curveFactoryGauge, GAUGE_ABI, provider);
    const factorygaugeInstance = factorygaugeContract.connect(provider);
    console.log("Getting curve factory pool Holders");
    var logCount = 20000;
    var sblock = startBlock;
    for (var i = sblock; i <= snapshotBlock;) {
        var logs = await factorypoolInstance.queryFilter(factorypoolContract.filters.Transfer(), i, i + logCount)
        var progress = ((i - sblock) / (snapshotBlock - sblock)) * 100;
        console.log('Current Block: ' + i + ' Progress: ' + progress.toFixed(2) + '%');

        for (var x = 0; x < logs.length; x++) {
            var from = logs[x].args[0];
            var to = logs[x].args[1];
            var pool = logs[x].args[1].toString();
            if(to.toLowerCase() == "0x0000000000000000000000000000000000000000") continue;

            //console.log("curve pool transfer to " +to);
            curvePool.addresses[to] = "0";
        }
        if (i==snapshotBlock) {
            break;
        }
        i = i + logCount;
        if (i > snapshotBlock) {
            i = snapshotBlock;
        }
    }
    console.log("Getting curve factory gauge");
    //get deposit into gauge since someone could deposit on behalf of someone else
    for (var i = sblock; i <= snapshotBlock;) {
        var logs = await factorygaugeInstance.queryFilter(factorygaugeContract.filters.Deposit(), i, i + logCount)
        var progress = ((i - sblock) / (snapshotBlock - sblock)) * 100;
        console.log('Current Block: ' + i + ' Progress: ' + progress.toFixed(2) + '%');
        for (var x = 0; x < logs.length; x++) {
            //log("log: " +JSON.stringify(logs[x].args));
            var from = logs[x].args[0];

            curvePool.addresses[from] = "0";
        }
        if (i==snapshotBlock) {
            break;
        }
        i = i + logCount;
        if (i > snapshotBlock) {
            i = snapshotBlock;
        }
    }

    delete curvePool.addresses[deployer];
    delete curvePool.addresses[curveFactoryGauge];
    delete curvePool.addresses[voteProxy];
    delete curvePool.addresses[rewardContract];
    jsonfile.writeFileSync(filename, curvePool, { spaces: 4 });

    var poolAddresses = await getBalances(factorypoolAddress,curvePool.addresses,snapshotBlock );
    var gaugeAddresses = await getBalances(curveFactoryGauge,curvePool.addresses,snapshotBlock );

    //combine
    for (var i in poolAddresses) {
        if(gaugeAddresses[i] == undefined){
            gaugeAddresses[i] = poolAddresses[i];
        }else{
            //add
            var stake = new BN(poolAddresses[i]);
            var balance = new BN(gaugeAddresses[i]).add(stake);
            gaugeAddresses[i] = balance.toString();
        }
    }
    for (var i in convexHolders.addresses) {
        if(gaugeAddresses[i] == undefined){
            gaugeAddresses[i] = convexHolders.addresses[i];
        }else{
            //add
            var stake = new BN(convexHolders.addresses[i]);
            var balance = new BN(gaugeAddresses[i]).add(stake);
            gaugeAddresses[i] = balance.toString();
        }
    }
    curvePool.addresses = gaugeAddresses;
    delete curvePool.addresses[deployer];
    delete curvePool.addresses[curveFactoryGauge];
    delete curvePool.addresses[voteProxy];
    delete curvePool.addresses[rewardContract];

    var poolBalance = await whichUST.balanceOf(swapAddress, { blockTag: snapshotBlock });
    if (boolWormhole) {
        poolBalance = poolBalance.mul(1e12);
    }
    console.log("poolBalance: "+poolBalance);

    var totallpAmount = new BN(0);
    for (var i in curvePool.addresses) {
        var lp = new BN(curvePool.addresses[i]);
        totallpAmount = totallpAmount.add(lp);
    }
    console.log("total lp balance: " +totallpAmount.toString())

    var ustToLp = new BN(poolBalance.toString()).multiply(1e18).div(totallpAmount);
    console.log("ustToLp: " +ustToLp.toString())

    var totallpust = BN(0);
    var lpholders = {
        addresses: {}
    };
    for (var i in curvePool.addresses) {
        var cvxcrv = new BN(ustToLp).multiply(new BN(curvePool.addresses[i])).div(1e18);
        totallpust.add(cvxcrv);
        lpholders.addresses[i] = cvxcrv.toString();
    }
    console.log("total ust in curve pool: " +totallpust.toString());
    curvePool = lpholders;

    jsonfile.writeFileSync(filename, curvePool, { spaces: 4 });
}


const convexHolders = async(startBlock, snapshotBlock, tokenContract, rewardContract) => {
    const convexTokenContract = new ethers.Contract(tokenContract, CRV_ABI, provider);
    const convexTokenInstance = convexTokenContract.connect(provider);
    const convexRewardContract = new ethers.Contract(rewardContract, REWARDS_ABI, provider);
    const convexRewardInstance = convexRewardContract.connect(provider);
    console.log("Getting convex stakers");
    var sblock = startBlock;
    var logCount = 20000;
    var convexTokenHolders = { addresses:{} };
    //get holders
    for (var i = sblock; i <= snapshotBlock;) {
        var logs = await convexTokenInstance.queryFilter(convexTokenInstance.filters.Transfer(), i, i + logCount)
        var progress = ((i - sblock) / (snapshotBlock - sblock)) * 100;
        console.log('Current Block: ' + i + ' Progress: ' + progress.toFixed(2) + '%');
        for (var x = 0; x < logs.length; x++) {
            //log("log: " +JSON.stringify(logs[x].args));
            var from = logs[x].args[0];
            var to = logs[x].args[1];
            var pool = logs[x].args[1].toString();

            // if(to == stakeAddress) continue;
            if(to == "0x0000000000000000000000000000000000000000") continue;

            //log("cvxcrv transfor to: " +to);
            convexTokenHolders.addresses[to] = "0";
        }
        if (i==snapshotBlock) {
            break;
        }
        i = i + logCount;
        if (i > snapshotBlock) {
            i = snapshotBlock;
        }
    }
    //get stakers. cant look at transfer since you can use stakeFor()
    for (var i = sblock; i <= snapshotBlock;) {
        var logs = await convexRewardInstance.queryFilter(convexRewardInstance.filters.Staked(), i, i + logCount)
        var progress = ((i - sblock) / (snapshotBlock - sblock)) * 100;
        console.log('Current Block: ' + i + ' Progress: ' + progress.toFixed(2) + '%');
        for (var x = 0; x < logs.length; x++) {
            //log("log: " +JSON.stringify(logs[x].args));
            var from = logs[x].args[0];

            convexTokenHolders.addresses[from] = "0";
        }
        if (i==snapshotBlock) {
            break;
        }
        i = i + logCount;
        if (i > snapshotBlock) {
            i = snapshotBlock;
        }
    }

    console.log(convexTokenHolders);
    console.log("cnt: " +Object.keys(convexTokenHolders.addresses).length);

    console.log("getting holder balances...");
    var holders = await getBalances(tokenContract,convexTokenHolders.addresses,snapshotBlock );
    console.log("getting staker balances...");
    var stakers = await getBalances(rewardContract,convexTokenHolders.addresses,snapshotBlock );

    //combine
    var total = new BN(0);
    for (var i in stakers) {
        var stake = new BN(stakers[i]);
        if(holders[i] == undefined){
            holders[i] = stakers[i];
        }else{
            //add
            var balance = new BN(holders[i]).add(stake);
            holders[i] = balance.toString();
        }
        total = total.add(stake);
    }
    console.log("total: " +total.toString());
    var convexTokenHolders = { addresses:{} };
    convexTokenHolders.addresses = holders;

    return convexTokenHolders;
}


const main = async () => {
    var snapshotBlock = await provider.getBlockNumber();
    console.log('snapshotBlock block:' + snapshotBlock)

    //UST-Wormhole
    //Pre-Attack
    var ustWormholePreAttackHolders = await convexHolders(wormholeUst_creationBlock, preAttack_block, convexustWormholeToken, convexustWormholeRewards);
    await getFactoryPoolHolders(wormholeUst_creationBlock, preAttack_block, ustWormholePreAttackHolders, curveFactoryPool_ustwormhole, curveFactoryPool_ustwormhole, curveFactoryGauge_ustwormhole, convexustWormholeRewards, ustwormholePreAttack_file, ustWormholeInstance, true);
    //Post-Attack
    var ustWormholePostAttackHolders = await convexHolders(wormholeUst_creationBlock, postAttack_block, convexustWormholeToken, convexustWormholeRewards);
    await getFactoryPoolHolders(wormholeUst_creationBlock, postAttack_block, ustWormholePostAttackHolders, curveFactoryPool_ustwormhole, curveFactoryPool_ustwormhole, curveFactoryGauge_ustwormhole, convexustWormholeRewards, ustwormholePostAttack_file, ustWormholeInstance, true);

    //UST Wrapped
    //Pre-Attack
    var ustWrappedPreAttackHolders = await convexHolders(ustw_creationBlock, preAttack_block, convexustWrappedToken, convexustWrappedRewards);
    await getFactoryPoolHolders(ustw_creationBlock, preAttack_block, ustWrappedPreAttackHolders, curveFactoryPool_ustwrapped, curveFactorySwap_ustwrapped, curveFactoryGauge_ustwrapped, convexustWrappedRewards, ustwrappedPreAttack_file, ustWrappedInstance);
    // Post-Attack
    var ustWrappedPostAttackHolders = await convexHolders(ustw_creationBlock, postAttack_block, convexustWrappedToken, convexustWrappedRewards);
    await getFactoryPoolHolders(ustw_creationBlock, postAttack_block, ustWrappedPostAttackHolders, curveFactoryPool_ustwrapped, curveFactorySwap_ustwrapped, curveFactoryGauge_ustwrapped, convexustWrappedRewards, ustwrappedPostAttack_file, ustWrappedInstance);

    //UST-MIM
    //Pre-Attack
    var ustmimPreAttackHolders = await convexHolders(mimust_creationBlock, preAttack_block, convexustmimToken, convexustmimRewards);
    await getFactoryPoolHolders(mimust_creationBlock, preAttack_block, ustmimPreAttackHolders, curveFactoryPool_ustmim, curveFactoryPool_ustmim, curveFactoryGauge_ustmim, convexustmimRewards, ustmimPreAttack_file, ustWrappedInstance);
    //Post-Attack
    var ustmimPostAttackHolders = await convexHolders(mimust_creationBlock, postAttack_block, convexustmimToken, convexustmimRewards);
    await getFactoryPoolHolders(mimust_creationBlock, postAttack_block, ustmimPostAttackHolders, curveFactoryPool_ustmim, curveFactoryPool_ustmim, curveFactoryGauge_ustmim, convexustmimRewards, ustmimPostAttack_file, ustWrappedInstance);

    //Combine UST-Wrapped Pool
    
    //PreAttack
    var ustWrappedRawPreAttack = jsonfile.readFileSync(ustwrappedPreAttack_file);
    var ustMimRawPreAttack = jsonfile.readFileSync(ustmimPreAttack_file);
    for (var i in ustMimRawPreAttack.addresses) {
        if (ustWrappedRawPreAttack.addresses[i] == undefined) {
            ustWrappedRawPreAttack.addresses[i] = ustMimRawPreAttack.addresses[i];
        } else {
            var addAmount = new BN(ustMimRawPreAttack.addresses[i]);
            var balance = new BN(ustWrappedRawPreAttack.addresses[i]).add(addAmount);
            ustWrappedRawPreAttack.addresses[i] = balance;
        }
    }
    jsonfile.writeFileSync(ustWrappedCombinedPreAttack_file, ustWrappedRawPreAttack, { spaces: 4 });
    //Post Attack
    var ustWrappedRawPostAttack = jsonfile.readFileSync(ustwrappedPostAttack_file);
    var ustMimRawPostAttack = jsonfile.readFileSync(ustmimPostAttack_file);
    for (var i in ustMimRawPostAttack.addresses) {
        if (ustWrappedRawPostAttack.addresses[i] == undefined) {
            ustWrappedRawPostAttack.addresses[i] = ustMimRawPostAttack.addresses[i];
        } else {
            var addAmount = new BN(ustMimRawPostAttack.addresses[i]);
            var balance = new BN(ustWrappedRawPostAttack.addresses[i]).add(addAmount);
            ustWrappedRawPostAttack.addresses[i] = balance;
        }
    }
    jsonfile.writeFileSync(ustWrappedCombinedPostAttack_file, ustWrappedRawPostAttack, { spaces: 4 });
    
    //Combine All Files
    var ustComboPreAttack = jsonfile.readFileSync(ustWrappedCombinedPreAttack_file);
    var ustComboPostAttack = jsonfile.readFileSync(ustWrappedCombinedPostAttack_file);

    var ustWormholePreAttack = jsonfile.readFileSync(ustwormholePreAttack_file);
    var ustWormholePostAttack = jsonfile.readFileSync(ustwormholePostAttack_file);

    var CombineUstObj = [];
    //Combine UST Pre Attack
    for (var i in ustComboPreAttack.addresses) {
        var convertBalance = Number(ustComboPreAttack.addresses[i]) / 1e18;
        CombineUstObj.push({
            height: preAttack_block,
            user_address: i,
            token_address: ustWrappedAddress,
            amount: convertBalance.toFixed(18)
        })
    };
    //Combine UST Post Attack
    for (var i in ustComboPostAttack.addresses) {
        var convertBalance = Number(ustComboPostAttack.addresses[i]) / 1e18;
        CombineUstObj.push({
            height: postAttack_block,
            user_address: i,
            token_address: ustWrappedAddress,
            amount: convertBalance.toFixed(18)
        })
    };
    //Combine USTWormhole Pre Attack
    for (var i in ustWormholePreAttack.addresses) {
        var convertBalance = Number(ustWormholePreAttack.addresses[i]) / 1e18;
        CombineUstObj.push({
            height: preAttack_block,
            user_address: i,
            token_address: ustWormholeAddress,
            amount: convertBalance.toFixed(6)
        })
    };
    //Combine USTWormhole Post Attack
    for (var i in ustWormholePostAttack.addresses) {
        var convertBalance = Number(ustWormholePostAttack.addresses[i]) / 1e18;
        CombineUstObj.push({
            height: postAttack_block,
            user_address: i,
            token_address: ustWormholeAddress,
            amount: convertBalance.toFixed(6)
        })
    };

    jsonfile.writeFileSync(ustfinal_file, CombineUstObj, { spaces: 4 });
    const csv = new ObjectsToCsv(CombineUstObj);
    await csv.toDisk(ustCSV);
}

main();