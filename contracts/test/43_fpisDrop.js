const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const fs = require('fs');
const MerkleTree = require('./helpers/merkleTree');
var jsonfile = require('jsonfile');

var droplist = jsonfile.readFileSync('../airdrop/fpis/drop_proofs.json');
var contractList = jsonfile.readFileSync('./contracts.json');

const IERC20 = artifacts.require("IERC20");
const MerkleAirdrop = artifacts.require("MerkleAirdrop");
const MerkleAirdropFactory = artifacts.require("MerkleAirdropFactory");

const Multicaller = artifacts.require("Multicaller");
const MulticallerView = artifacts.require("MulticallerView");

const progressFile = "drop_progress.json";
if (fs.existsSync(progressFile)) {
    drop_progress = jsonfile.readFileSync(progressFile);
} else {
    drop_progress = {
        progress: 0
    };
}

const unlockAccount = async (address) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_unlockUnknownAccount",
        params: [address],
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};


contract("Airdrop Test", async accounts => {
  it("should claim airdrop for all users", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    var dropAddresses = Object.keys(droplist.users);
    //system    
    let fpis = await IERC20.at("0xc2544A32872A91F4A553b404C6950e89De901fdb");

    //test move
    let proxy = "0x59CFCD384746ec3035299D90782Be065e466800B";
    await unlockAccount(proxy);
    let balOnProxy = await fpis.balanceOf(proxy);
    await fpis.transfer(deployer,balOnProxy,{from:proxy,gasPrice:0});
    await fpis.balanceOf(deployer).then(a=>console.log("balance: "+a));

    let airdrop = await MerkleAirdrop.at("0x61A1f84F12Ba9a56C22c31dDB10EC2e2CA0ceBCf");
    console.log("airdrop at: " +airdrop.address);

    //set reward token
    await airdrop.setRewardToken(fpis.address,{from:deployer});
    console.log("set reward token")

    // transfer fpis
    var fpisbalance = await fpis.balanceOf(deployer);
    console.log("transfering balance... " +fpisbalance);
    await fpis.transfer(airdrop.address,fpisbalance,{from:deployer});
    fpisbalance = await fpis.balanceOf(airdrop.address);
    console.log("fpis drop total: " +fpisbalance);
    var total = new BN(0);
    for(var i = 0; i < dropAddresses.length; i++){
        var userAmount = droplist.users[dropAddresses[i]].amount;
        total = total.add(new BN(userAmount.toString()));
    }
    console.log("total from drop data: " +total.toString());
    assert.equal(fpisbalance.toString(),total.toString(),"address balance and drop data balance dont match");
    
    //set merkle root
    await airdrop.setRoot(droplist.root,{from:deployer})
    let mroot = await airdrop.merkleRoot();
    console.log("airdrop root: " +mroot);

    // return;

    let multicaller = await Multicaller.at("0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441");
    let multicallerview = await MulticallerView.at("0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441");

    //get balances
    

    //claiming
    console.log("claiming for " +dropAddresses.length +" users");
    var beforecallDataList = [];
    var callDataList = [];
    var aftercallDataList = [];
    var claimcount = 0;
    var claimsize = 20;
    for(var i = drop_progress.progress; i < dropAddresses.length; i++){
        var info = droplist.users[dropAddresses[i]];
        var amount = info.amount;
        var proof = info.proof;
        proof = proof.map(e=>Buffer.from(e,'hex'));

       // console.log("claiming " +i +" amount: " +amount +"  user: " +dropAddresses[i]);
        // await airdrop.claim(proof,dropAddresses[i],amount);
        // console.log("claimed " +i);
        var balancecalldata = fpis.contract.methods.balanceOf(dropAddresses[i]).encodeABI();
        var calldata = airdrop.contract.methods.claim(proof,dropAddresses[i],amount).encodeABI();
        beforecallDataList.push([fpis.address,balancecalldata]);
        callDataList.push([airdrop.address,calldata]);
        aftercallDataList.push([fpis.address,balancecalldata]);

        if(callDataList.length == claimsize){
            claimcount++;
            console.log("call multi claim " +(i-claimsize+1) +"~" +(i));

            var beforeUserbalances = [];
            var afterUserbalances = [];
            let retData = await multicallerview.aggregate(beforecallDataList);
            
            for(var d = 0; d < retData[1].length; d++){
                //console.log("add balance bn2: " +web3.utils.toBN(retData[1][d]).toString());
                beforeUserbalances.push(web3.utils.toBN(retData[1][d]).toString());
            }
            await multicaller.aggregate(callDataList);
            let retDataAfter = await multicallerview.aggregate(aftercallDataList);
            for(var d = 0; d < retDataAfter[1].length; d++){
                //console.log("add balance bn2: " +web3.utils.toBN(retDataAfter[1][d]).toString());
                afterUserbalances.push(web3.utils.toBN(retDataAfter[1][d]).toString());
            }
            for(var x = 0; x < beforeUserbalances.length; x++){
                var claimedAmount = new BN(afterUserbalances[x]).sub(new BN(beforeUserbalances[x]))
                var info = droplist.users[dropAddresses[i-claimsize+1+x]];
                var amount = info.amount;
                //console.log("assert: " +claimedAmount.toString() +" == " +amount.toString())
                assert.equal(claimedAmount.toString(),amount.toString(),"claimed amount doesnt match");
            }

            drop_progress.progress = i+1;
            jsonfile.writeFileSync(progressFile, drop_progress, { spaces: 4 });
            beforecallDataList = [];
            callDataList = [];
            aftercallDataList = [];
        }
    }
    if(callDataList.length > 0){
        console.log("call multi claim final " +(dropAddresses.length-callDataList.length) +"~" +(dropAddresses.length) );
        // await multicaller.aggregate(callDataList);

        var beforeUserbalances = [];
        var afterUserbalances = [];
        let retData = await multicallerview.aggregate(beforecallDataList);
        for(var d = 0; d < retData[1].length; d++){
            //console.log("add balance bn2: " +web3.utils.toBN(retData[1][d]).toString());
            beforeUserbalances.push(web3.utils.toBN(retData[1][d]).toString());
        }
        await multicaller.aggregate(callDataList);
        let retDataAfter = await multicallerview.aggregate(aftercallDataList);
        for(var d = 0; d < retDataAfter[1].length; d++){
            //console.log("add balance bn2: " +web3.utils.toBN(retDataAfter[1][d]).toString());
            afterUserbalances.push(web3.utils.toBN(retDataAfter[1][d]).toString());
        }
        for(var x = 0; x < beforeUserbalances.length; x++){
            var claimedAmount = new BN(afterUserbalances[x]).sub(new BN(beforeUserbalances[x]))
            var info = droplist.users[dropAddresses[ dropAddresses.length-callDataList.length+x]];
            var amount = info.amount;
            // console.log("assert: " +claimedAmount.toString() +" == " +amount.toString())
            assert.equal(claimedAmount.toString(),amount.toString(),"claimed amount doesnt match");
        }
        beforecallDataList = [];
        callDataList = [];
        aftercallDataList = [];
    }


  });
});


