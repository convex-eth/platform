const fs = require('fs');
const { ethers } = require("ethers");
const jsonfile = require('jsonfile');
const { CRV_ABI, ARB_ABI } = require('./abi');
var BN = require('big-number');

const config = jsonfile.readFileSync('./config.json');

const data_file = 'arbdata_stkaave.json';

//Setup ethers providers
//const provider = new ethers.providers.InfuraProvider(config.NETWORK, config.INFURA_KEY);
const provider = new ethers.providers.AlchemyProvider (config.NETWORK, config.ALCHEMY_KEY);
//const provider = new ethers.providers.JsonRpcProvider(config.GETH_NODE, config.NETWORK);

const stkaave = '0x4da27a545c0c5B758a6BA100e3a049001de870f5';
const aaveGauge = "0xd662908ADA2Ea1916B3318327A97eB18aD588b5d";
const saaveGauge = "0x462253b8F74B72304c145DB0e4Eebd326B22ca39";
const convex = "0x989AEb4d175e16225E39E87d0D97A3360524AD80";
const arbVault = "0x25E12482a25CF36EC70fDA2A09C1ED077Fc21616";
const aavePid = 24;
const saavePid = 26;

const aaveRewards = "0x00469d388b06127221D6310843A43D079eb2bB18";
const saaveRewards = "0x20165075174b51a2f9Efbf7d6D8F3c72BBc63064";

const aaveStash = "0x5D4CF00939aa5F7C2cEb10c88615E9bcb0dd67fa";
const saaveStash = "0xd2D46004b981FdE1e4D39d0C24E1Be1e93689DD9";

const stkaaveContract = new ethers.Contract(stkaave, CRV_ABI, provider);
const stkaaveInstance = stkaaveContract.connect(provider);

const vaultContract = new ethers.Contract(arbVault, ARB_ABI, provider);
const vaultInstance = vaultContract.connect(provider);

//Load any previous work
if (fs.existsSync(data_file)) {
    arbData = jsonfile.readFileSync(data_file);
} else {
    arbData = [];
}
function compare( a, b ) {
  return b.num._compare(a.num);
}

const getTransferRecords = async (fromBlock, toBlock, isFirst) => {
	console.log("Getting transfer records");
    var logCount = 20000;

    var transfers = [];
    var preprocessed = [];
    for (var i = fromBlock; i <= toBlock;) {
        var logs = await stkaaveInstance.queryFilter(stkaaveInstance.filters.Transfer(), i, i + logCount)
        var progress = ((i - fromBlock) / (toBlock - fromBlock)) * 100;
        console.log('Current Block: ' + i + ' Progress: ' + progress.toFixed(2) + '%');
        for (var x = 0; x < logs.length; x++) {
            var from = logs[x].args[0];
            var to = logs[x].args[1];
            var value = logs[x].args[2].toString();
           

            //if first time, we need to filter out any balance that was
            //already moved from stashes to reward contracts
            //TODO: will need some modifying for when rewards end
            if(isFirst){
                if(from == aaveStash && to == aaveRewards){
                    var tx = {from: aaveGauge, value:value};
                    preprocessed.push(tx);
                    continue;   
                }
                if(from == saaveStash && to == saaveRewards){
                    var tx = {from: saaveGauge, value:value};
                    preprocessed.push(tx);
                    continue;   
                }
            }

            if(from != aaveGauge && from != saaveGauge) continue;
            if(to != convex) continue;

            var tx = {from:from,value:value};
            transfers.push(tx);
        }
        if (i==toBlock) {
            break;
        }
        i = i + logCount;
        if (i > toBlock) {
            i = toBlock;
        }
    }
    console.log(preprocessed);
    var totals = {
        startBlock: fromBlock,
        endBlock: toBlock,
        total: 0,
        distribution: {}
    };
    //tally up all transfers
    for(var i in transfers){
        var tx = transfers[i];
        if(totals.distribution[tx.from] == undefined){
            totals.distribution[tx.from] = tx.value;
        }else{
            var before = new BN(totals.distribution[tx.from]);
            var balance = new BN(tx.value).add(before);
            totals.distribution[tx.from] = balance.toString();
        }
        
    }
    //remove amount already sent to rewards
    for(var i in preprocessed){
        var tx = preprocessed[i];
        var before = new BN(totals.distribution[tx.from]);
        var remove = new BN(tx.value);
        var balance = before.subtract(remove);
        totals.distribution[tx.from] = balance.toString();
    }

    //build final json data
    var pids = [];
    var amounts = [];
    for(var i in totals.distribution){
        if( i == aaveGauge){
            pids.push(aavePid);
        }else if( i == saaveGauge){
            pids.push(saavePid);
        }
        amounts.push(totals.distribution[i])

        var bnvalue = new BN(totals.distribution[i]);
        var totalValue = new BN(totals.total).add(bnvalue);
        totals.total = totalValue.toString();
    }
    console.log(pids);
    console.log(amounts);

    //build calldata
    let iface = new ethers.utils.Interface(ARB_ABI);
    var enc = iface.encodeFunctionData("distribute(address, uint256[], uint256[])",[stkaave,pids,amounts]);
    console.log(enc);
    totals.calldata = enc;
    console.log(totals);
    arbData.push(totals);
    jsonfile.writeFileSync(data_file, arbData, { spaces: 4 });
}


const main = async () => {
    var snapshotBlock = await provider.getBlockNumber();

    console.log('snapshotBlock block:' + snapshotBlock)

    var startblock = 12451018;
    var isFirst = true;
    if(arbData.length > 0){
        for(var i in arbData){
            if(arbData[i].endBlock > startblock){
                startblock = arbData[i].endBlock;
                isFirst = false;
            }
        }
    }

	await getTransferRecords(startblock, snapshotBlock, isFirst);
}

main();