const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');

var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");

contract("Earmark Pools", async accounts => {
  it("should earmark all pools", async () => {

    let booster = await Booster.at(contractList.system.booster);
    let poolCount = await booster.poolLength();
    for(var i = 0; i < poolCount; i++){
    	await booster.earmarkRewards(i);
    	console.log("earmark pool " +i +" complete");
    }
  });
});


