const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');

const MerkleTree = require('./helpers/merkleTree');
var jsonfile = require('jsonfile');
var droplist = jsonfile.readFileSync('../airdrop/drop_proofs.json');
var contractList = jsonfile.readFileSync('./contracts.json');

const ConvexToken = artifacts.require("ConvexToken");
const MerkleAirdrop = artifacts.require("MerkleAirdrop");
const MerkleAirdropFactory = artifacts.require("MerkleAirdropFactory");
const VestedEscrow = artifacts.require("VestedEscrow");

const Multicaller = artifacts.require("Multicaller");
const MulticallerView = artifacts.require("MulticallerView");


contract("Airdrop Test", async accounts => {
  it("should claim airdrop for all users", async () => {

    //system
    let cvx = await ConvexToken.at(contractList.system.cvx);
    let airdrop = await MerkleAirdrop.at(contractList.system.airdrop);
    console.log("airdrop at: " +airdrop.address);
    let mroot = await airdrop.merkleRoot();
    console.log("airdrop root: " +mroot);
    let vecrvVesting = await VestedEscrow.at(contractList.system.vestedEscrow);
    let multicaller = await Multicaller.at("0x5e227AD1969Ea493B43F840cfF78d08a6fc17796");
    let multicallerview = await MulticallerView.at("0x5e227AD1969Ea493B43F840cfF78d08a6fc17796");


    var dropAddresses = Object.keys(droplist.users);
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
    var totalClaimed = new BN(0);
    callDataList = [];
    var userbalances = [];
    for(var i = 0; i < dropAddresses.length; i++){
        var info = droplist.users[dropAddresses[i]];
        var amount = info.amount;
        var proof = info.proof;
        proof = proof.map(e=>Buffer.from(e,'hex'));
        // await airdrop.claim(proof,dropAddresses[i],amount).catch(a=>console.log("--> could not claim"));
        // await cvx.balanceOf(dropAddresses[i]).then(a => console.log("claimed: " +a));

        var calldata = cvx.contract.methods.balanceOf(dropAddresses[i]).encodeABI();
        callDataList.push([cvx.address,calldata]);

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
    for(var i = 0; i < dropAddresses.length; i++){
        var info = droplist.users[dropAddresses[i]];
        var amount = info.amount;
        console.log("should claim: " +amount +", claimed: " +userbalances[i]);
        assert.equal(amount.toString(),userbalances[i].toString(),"claimed amount doesnt match");
        totalClaimed = totalClaimed.add(new BN(userbalances[i].toString()))
    }
    console.log("total claimed: " +totalClaimed.toString());

    //remove to test double claims
    return;

    console.log("trying to claim again...");
    for(var i = 0; i < dropAddresses.length; i++){
        var info = droplist.users[dropAddresses[i]];
        var amount = info.amount;
        var proof = info.proof;
        proof = proof.map(e=>Buffer.from(e,'hex'));
        let hasClaimed = airdrop.hasClaimed(dropAddresses[i]);
        console.log("has claimed? "+hasClaimed);
        assert.equal(hasClaimed==true,"should have claimed but false");
        await airdrop.claim(proof,dropAddresses[i],amount).catch(a=>console.log("--> could not claim"));
    }

    //If vested..
    // for(var i = 0; i < 13; i++){
    //     await time.increase(35*86400);
    //     await time.advanceBlock();
    //     await time.advanceBlock();
    //     await time.advanceBlock();
       
    //     await time.latest().then(a=>console.log("advance time..."+a));
    //     await vecrvVesting.totalTime().then(a=>console.log("vesting total time: " +a));
    //     await vecrvVesting.initialLockedSupply().then(a=>console.log("vesting initialLockedSupply: " +a));
    //     await vecrvVesting.unallocatedSupply().then(a=>console.log("vesting unallocatedSupply: " +a));
    //     await vecrvVesting.vestedSupply().then(a=>console.log("vesting vestedSupply: " +a));

    //     await vecrvVesting.lockedOf(lastaddress).then(a=>console.log("user locked: " +a))
    //     await vecrvVesting.balanceOf(lastaddress).then(a=>console.log("user balance: " +a))
    //     await vecrvVesting.vestedOf(lastaddress).then(a=>console.log("user vested: " +a))
    // }

    // await vecrvVesting.claim(lastaddress);
    // await cvx.balanceOf(lastaddress).then(a=>console.log("cvx balance in wallet: " +a))
  });
});


