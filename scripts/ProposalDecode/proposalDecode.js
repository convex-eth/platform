const fs = require('fs');
const { ethers } = require("ethers");
const jsonfile = require('jsonfile');
const { ARAGON_VOTING, ARGAON_AGENT, GAUGE_CONTROLLER, SIDE_GAUGE_FACTORY, OWNER_PROXY, WHITELIST_CHECKER } = require('./abi');
var BN = require('big-number');

const config = jsonfile.readFileSync('./config.json');

/*
Decode proposal data and check for valid gauges

To use: 
npm i
Create a config.json with necessary keys: USE_PROVIDER, NETWORK, XXX_KEY
node proposalDecode proposalID
*/


//Setup ethers providers
var provider;
if (config.USE_PROVIDER == "infura") {
  provider = new ethers.providers.InfuraProvider(config.NETWORK, config.INFURA_KEY);
} else if (config.USE_PROVIDER == "alchemy") {
  provider = new ethers.providers.AlchemyProvider(config.NETWORK, config.ALCHEMY_KEY);
} else {
  provider = new ethers.providers.JsonRpcProvider(config.GETH_NODE, config.NETWORK);
}

const proposalAddress = "0xe478de485ad2fe566d49342cbd03e49ed7db3356";
const proposalContract = new ethers.Contract(proposalAddress, ARAGON_VOTING, provider);
const proposalInstance = proposalContract.connect(provider);

const proposalParameterAddress = "0xBCfF8B0b9419b9A88c44546519b1e909cF330399";
const proposalParameterContract = new ethers.Contract(proposalParameterAddress, ARAGON_VOTING, provider);
const proposalParameterInstance = proposalParameterContract.connect(provider);

const sideGaugeFactoryContract = new ethers.Contract("0xabC000d88f23Bb45525E447528DBF656A9D55bf5", SIDE_GAUGE_FACTORY, provider);
const sideGaugeFactoryInstance = sideGaugeFactoryContract.connect(provider);


function byteToHexString(uint8arr) {
  if (!uint8arr) {
    return '';
  }
  
  var hexStr = '';
  for (var i = 0; i < uint8arr.length; i++) {
    var hex = (uint8arr[i] & 0xff).toString(16);
    hex = (hex.length === 1) ? '0' + hex : hex;
    hexStr += hex;
  }
  
  return hexStr.toLowerCase();
}

function hexStringToByte(str) {
  if (!str) {
    return new Uint8Array();
  }
  
  var a = [];
  for (var i = 0, len = str.length; i < len; i+=2) {
    a.push(parseInt(str.substr(i,2),16));
  }
  
  return new Uint8Array(a);
}


function intFromByteArray(array) {
    var value = 0;
    for (var i = 0; i < array.length; i++) {
        value = (value * 256) + array[i];
    }
    return value;
}

function etherscan(address){
    return "(https://etherscan.io/address/"+address+")";
}

function gaugeType(type){
    if(type == "0"){
        return "Ethereum Chain";
    }
    if(type == "1"){
        return "Fantom Chain";
    }
    if(type == "2"){
        return "Polygon/Matic Chain";
    }
    if(type == "4"){
        return "xDai Chain";
    }
    if(type == "5"){
        return "Ethereum Chain (Crypto Pools)";
    }
    if(type == "7"){
        return "Arbitrum Chain";
    }
    if(type == "8"){
        return "Avalanche Chain";
    }
    if(type == "9"){
        return "Harmony Chain";
    }
    return "Unknown Type " +type;
}

function addressName(address){
    if(address.toLowerCase() == "0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB".toLowerCase() ){
        return "Curve Gauge Controller"
    }
    if(address.toLowerCase() == "0x2EF1Bc1961d3209E5743C91cd3fBfa0d08656bC3".toLowerCase() ){
        return "Curve Owner Proxy"
    }
    if(address.toLowerCase() == "0x5a8fdC979ba9b6179916404414F7BA4D8B77C8A1".toLowerCase() ){
        return "Curve Crypto Owner Proxy"
    }
    if(address.toLowerCase() == "0x742C3cF9Af45f91B109a81EfEaf11535ECDe9571".toLowerCase() ){
        return "Curve StableSwap Owner Proxy"
    }
    if(address.toLowerCase() == "0x017dB2B92233018973902858B31269Ed071E1D39".toLowerCase() ){
        return "Curve Root Gauge Owner Proxy"
    }
    if(address.toLowerCase() == "0xca719728Ef172d0961768581fdF35CB116e0B7a4".toLowerCase() ){
        return "Curve Whitelist Checker"
    }
    return "Unknown " +address
}

const isValidGauge = async(address) => {
    const VALID_BYTECODE = [
        '0x363d3d373d3d3d363d73dc892358d55d5ae1ec47a531130d62151eba36e55af43d82803e903d91602b57fd5bf3',
        '0x363d3d373d3d3d363d735ae854b098727a9f1603a1e21c50d52dc834d8465af43d82803e903d91602b57fd5bf3'
    ]

    let address_bytecode = await provider.getCode(address);
    var result = ethers.utils.isAddress(address) && VALID_BYTECODE.includes(address_bytecode.toLowerCase());

    if(!result){
        //need to check if its a sidechain gauge
        result = await sideGaugeFactoryInstance.is_valid_gauge(address);
    }

    return result;
}

const decodeGaugeControllerData = async (calldata) => {
    // console.log("gauge calldata: " +calldata)
    var scriptbytes = hexStringToByte(calldata);
    var calldataFunction = scriptbytes.slice(1,5);
    // console.log("function: " +byteToHexString(calldataFunction))
    var report = "";
    if(byteToHexString(calldataFunction) == "18dfe921"){
        let iface = new ethers.utils.Interface(GAUGE_CONTROLLER)
        report += "Function: AddGauge\n";
        var dec = iface.decodeFunctionData("add_gauge(address,int128,uint256)",calldata);
        report += "Gauge: " +dec.addr +" " +etherscan(dec.addr) +"\n";
        report += "Type: " +gaugeType(dec.gauge_type.toString()) +"\n";
        report += "Weight: "+dec.weight.toString() +"\n";

        var isvalid = await isValidGauge(dec.addr) +"\n";
        report += "Is official gauge? " +isvalid;
    }else{
        report += "Function Unknown: " +byteToHexString(calldataFunction) +"\n";
        report += "Calldata: " +calldata +"\n";
    }
    return report;
}

const decodeOwnerProxyData = async (calldata) => {
    // console.log("calldata: " +calldata)
    var scriptbytes = hexStringToByte(calldata);
    var calldataFunction = scriptbytes.slice(1,5);
    // console.log("function: " +byteToHexString(calldataFunction))
    var report = "";
    let iface = new ethers.utils.Interface(OWNER_PROXY)

    if(byteToHexString(calldataFunction) == "4344ce71"){    
        report += "Function: set_killed\n";
        var dec = iface.decodeFunctionData("set_killed(address,bool)",calldata);
        report += "Gauge: " +dec[0] +" " +etherscan(dec[0]) +"\n";
        report += "Is Killed? " +dec[1] +"\n";
    }else if(byteToHexString(calldataFunction) == "9d4a4380"){    
        report += "Function: ramp_A\n";
        var dec = iface.decodeFunctionData("ramp_A(address,uint256,uint256)",calldata);
        report += "Gauge: " +dec[0] +" " +etherscan(dec[0]) +"\n";
        report += "Future A: " +dec[1] +"\n";
        report += "Future Time: " +dec[2] +"\n";
    }else{
        report += "Function Unknown: " +byteToHexString(calldataFunction) +"\n";
        report += "Calldata: " +calldata +"\n";
    }
    return report;
}

const decodeWhitelist = async (calldata) => {
    // console.log("gauge calldata: " +calldata)
    var scriptbytes = hexStringToByte(calldata);
    var calldataFunction = scriptbytes.slice(1,5);
    // console.log("function: " +byteToHexString(calldataFunction))
    var report = "";
    if(byteToHexString(calldataFunction) == "0fcb0ae5"){
        let iface = new ethers.utils.Interface(WHITELIST_CHECKER)
        report += "Function: approveWallet\n";
        var dec = iface.decodeFunctionData("approveWallet(address)",calldata);
        report += "Address: " +dec +" " +etherscan(dec) +"\n";
    }else if(byteToHexString(calldataFunction) == "808a9d40"){
        let iface = new ethers.utils.Interface(WHITELIST_CHECKER)
        report += "Function: revokeWallet\n";
        var dec = iface.decodeFunctionData("revokeWallet(address)",calldata);
        report += "Address: " +dec +" " +etherscan(dec) +"\n";
    }else{
        report += "Function Unknown: " +byteToHexString(calldataFunction) +"\n";
        report += "Calldata: " +calldata +"\n";
    }
    return report;
}

const decodeProposal = async (vote_id, isOwnership) => {
    var votedata;
    if(isOwnership){
        votedata = await proposalInstance.getVote(vote_id);
    }else{
        votedata = await proposalParameterInstance.getVote(vote_id);
    }
    var script = votedata.script;

    // console.log(script);
    var scriptbytes = hexStringToByte(script);
    var idx = 5;
    var report = "";
    var actions = 1;
    while (idx < scriptbytes.length){
        console.log("decoding action " +actions +"...");
        report += "\n\nAction " +actions +"\n----------\n";
        var targetContract = scriptbytes.slice(idx, idx + 20);
        // console.log("targetContract: 0x" +byteToHexString(targetContract));
        idx += 20;
        var cdataLength = scriptbytes.slice(idx,idx+4);
        var cdataLength = intFromByteArray(scriptbytes.slice(idx,idx+4));
        idx += 4;
        var calldata = scriptbytes.slice(idx, idx + cdataLength);
        var cdstring = "0x"+byteToHexString(calldata);

        let iface = new ethers.utils.Interface(ARGAON_AGENT)
        var dec = iface.decodeFunctionData("execute(address,uint256,bytes)",cdstring);
        // console.log("decoded calldata: " +dec);

        if(dec[0] == "0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB"){ //gauge controller
            report += "To: "+addressName(dec[0]) +"\n";
            report += await decodeGaugeControllerData(dec[2]);
        }else if(dec[0] == "0x2EF1Bc1961d3209E5743C91cd3fBfa0d08656bC3"){ //factory owner proxy
            report += "To: "+addressName(dec[0]) +"\n";
            report += await decodeOwnerProxyData(dec[2]);
        }else if(dec[0] == "0x5a8fdC979ba9b6179916404414F7BA4D8B77C8A1"){ //crypto factory owner proxy
            report += "To: "+addressName(dec[0]) +"\n";
            report += await decodeOwnerProxyData(dec[2]);
        }else if(dec[0] == "0x742C3cF9Af45f91B109a81EfEaf11535ECDe9571"){ //stableswap factory owner proxy
            report += "To: "+addressName(dec[0]) +"\n";
            report += await decodeOwnerProxyData(dec[2]);
        }else if(dec[0] == "0x017dB2B92233018973902858B31269Ed071E1D39"){ //root gauge factory owner proxy
            report += "To: "+addressName(dec[0]) +"\n";
            report += await decodeOwnerProxyData(dec[2]);
        }else if(dec[0] == "0xca719728Ef172d0961768581fdF35CB116e0B7a4"){ //whitelist checker
            report += "To: "+addressName(dec[0]) +"\n";
            report += await decodeWhitelist(dec[2]);
        }else{
            report += "To: " +addressName(dec[0]) +" " +etherscan(dec[0]) +"\n";
            report += "Calldata: " +dec[2] + "\n";
        }

        idx += cdataLength;

        actions++;
    }
    return report;
}


const main = async () => {

    const cmdArgs = process.argv.slice(2);
    var proposal = cmdArgs[0];
    var isOwnership = cmdArgs[1] != "false";
    console.log("decoding proposal " +proposal +", isOwnership? " +isOwnership)
    var report = await decodeProposal(proposal,isOwnership);
    console.log(report);
}

main();