const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');

const MerkleTree = require('./helpers/merkleTree');
var jsonfile = require('jsonfile');
var droplist = jsonfile.readFileSync('../airdrop/eps/2021_5_27/drop_proofs.json');
var contractList = jsonfile.readFileSync('./contracts.json');

const IERC20 = artifacts.require("IERC20");
const MerkleAirdrop = artifacts.require("MerkleAirdrop");
const MerkleAirdropFactory = artifacts.require("MerkleAirdropFactory");

const Multicaller = artifacts.require("Multicaller");
const MulticallerView = artifacts.require("MulticallerView");


contract("Airdrop Test", async accounts => {
  it("should claim airdrop for all users", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";

    //system
    let eps = await IERC20.at("0xA7f552078dcC247C2684336020c03648500C6d9F");
    let factory = await MerkleAirdropFactory.at("0xF403C135812408BFbE8713b5A23a04b3D48AAE31");
    // await factory.CreateMerkleAirdrop();
    // let airdrop = await MerkleAirdrop.at("0x5F863EDFB62575fe3A838C2afB4919dEd7b511D9");//week 1
    let airdrop = await MerkleAirdrop.at("0x48389D205Ae9B345C34B1048407fEfa848DfC06F");//week 2
    console.log("airdrop at: " +airdrop.address);

    //set reward token
    await airdrop.setRewardToken(eps.address,{from:deployer});

    //transfer eps
    var epsbalance = await eps.balanceOf(deployer);
    await eps.transfer(airdrop.address,epsbalance,{from:deployer});
    epsbalance = await eps.balanceOf(airdrop.address);
    console.log("eps drop total: " +epsbalance);

    //set merkle root
    // await airdrop.setRoot("0x9851f34e9d88d0887d72a52fa21a8c2e5a48e32fc38a4063aedd657feee45dca",{from:deployer})//week 1
    await airdrop.setRoot("0xec6549daaf9d46d37eef727a44a0826ee1614d763b018964a41ac10ac463815e",{from:deployer})//week 2
    let mroot = await airdrop.merkleRoot();
    console.log("airdrop root: " +mroot);

    //return;

    let multicaller = await Multicaller.at("0x1Ee38d535d541c55C9dae27B12edf090C608E6Fb");
    let multicallerview = await MulticallerView.at("0x1Ee38d535d541c55C9dae27B12edf090C608E6Fb");

    //get balances
    var dropAddresses = Object.keys(droplist.users);
    console.log("checking before balances...");
   
    var callDataList = [];
    var userBeforebalances = [];
    for(var i = 0; i < dropAddresses.length; i++){
        var info = droplist.users[dropAddresses[i]];
        var amount = info.amount;
        var proof = info.proof;
        proof = proof.map(e=>Buffer.from(e,'hex'));
        // await airdrop.claim(proof,dropAddresses[i],amount).catch(a=>console.log("--> could not claim"));
        // await eps.balanceOf(dropAddresses[i]).then(a => console.log("claimed: " +a));

        var calldata = eps.contract.methods.balanceOf(dropAddresses[i]).encodeABI();
        callDataList.push([eps.address,calldata]);

        if(callDataList.length == 100){
            console.log("call multi balanceOf");
            let retData = await multicallerview.aggregate(callDataList);
            for(var d = 0; d < retData[1].length; d++){
                //console.log("add balance bn2: " +web3.utils.toBN(retData[1][d]).toString());
                userBeforebalances.push(web3.utils.toBN(retData[1][d]).toString());
            }
            callDataList = [];
        }
    }
    if(callDataList.length > 0){
        console.log("call multi balanceOf final");
        let retData = await multicallerview.aggregate(callDataList);
        for(var d = 0; d < retData[1].length; d++){
            userBeforebalances.push(web3.utils.toBN(retData[1][d]).toString());
        }
        callDataList = [];
    }


    //claiming
    console.log("claiming for " +dropAddresses.length +" users");
    var callDataList = [];
    for(var i = 0; i < dropAddresses.length; i++){
        var info = droplist.users[dropAddresses[i]];
        var amount = info.amount;
        var proof = info.proof;
        proof = proof.map(e=>Buffer.from(e,'hex'));

        var calldata = airdrop.contract.methods.claim(proof,dropAddresses[i],amount).encodeABI();
        callDataList.push([airdrop.address,calldata]);

        if(callDataList.length == 30){
            console.log("call multi claim");
            await multicaller.aggregate(callDataList);
            callDataList = [];
        }
    }
    if(callDataList.length > 0){
        console.log("call multi claim final");
        await multicaller.aggregate(callDataList);
    }

    //get balances
    console.log("checking after balances...");
   
    callDataList = [];
    var userbalances = [];
    for(var i = 0; i < dropAddresses.length; i++){
        var info = droplist.users[dropAddresses[i]];
        var amount = info.amount;
        var proof = info.proof;
        proof = proof.map(e=>Buffer.from(e,'hex'));
        // await airdrop.claim(proof,dropAddresses[i],amount).catch(a=>console.log("--> could not claim"));
        // await eps.balanceOf(dropAddresses[i]).then(a => console.log("claimed: " +a));

        var calldata = eps.contract.methods.balanceOf(dropAddresses[i]).encodeABI();
        callDataList.push([eps.address,calldata]);

        if(callDataList.length == 100){
            console.log("call multi balanceOf");
            let retData = await multicallerview.aggregate(callDataList);
            for(var d = 0; d < retData[1].length; d++){
                //console.log("add balance bn2: " +web3.utils.toBN(retData[1][d]).toString());
                userbalances.push(web3.utils.toBN(retData[1][d]).toString());
            }
            callDataList = [];
        }
    }
    if(callDataList.length > 0){
        console.log("call multi balanceOf final");
        let retData = await multicallerview.aggregate(callDataList);
        for(var d = 0; d < retData[1].length; d++){
            userbalances.push(web3.utils.toBN(retData[1][d]).toString());
        }
        callDataList = [];
    }

    //check balances
     var totalClaimed = new BN(0);
    for(var i = 0; i < dropAddresses.length; i++){
        var info = droplist.users[dropAddresses[i]];
        var amount = info.amount;
        var claimedAmount = new BN(userbalances[i]).sub(new BN(userBeforebalances[i]))
        console.log("should claim: " +amount +", claimed: " +claimedAmount);
        assert.equal(amount.toString(),claimedAmount.toString(),"claimed amount doesnt match");
        totalClaimed = totalClaimed.add(new BN(claimedAmount.toString()))
    }
    console.log("total claimed: " +totalClaimed.toString());

  });
});


