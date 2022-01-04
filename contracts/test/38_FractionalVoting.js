const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const IVoting = artifacts.require("IVoting");
const IVoteStarter = artifacts.require("IVoteStarter");
const IERC20 = artifacts.require("IERC20");
const VoteDelegateExtension = artifacts.require("VoteDelegateExtension");


contract("Voting Test", async accounts => {
  it("should test voting system with fractional weights", async () => {

    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let treasury = "0x1389388d01708118b497f59521f6943Be2541bb7";
    let addressZero = "0x0000000000000000000000000000000000000000"

    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let threeCrv = await IERC20.at("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let vecrv = await IERC20.at("0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2");
    let vote = await IVoting.at("0xE478de485ad2fe566d49342Cbd03E49ed7DB3356");
    let votestart = await IVoteStarter.at("0xE478de485ad2fe566d49342Cbd03E49ed7DB3356");

    let admin = accounts[0];
    let userA = accounts[1];
    let userB = accounts[2];
    let caller = accounts[3];

    const advanceTime = async (secondsElaspse) => {
      await time.increase(secondsElaspse);
      await time.advanceBlock();
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;

    //system
    let voteproxy = await CurveVoterProxy.at(contractList.system.voteProxy);
    let booster = await Booster.at(contractList.system.booster);
    
    
    var proposalId = 114
    let currentVote = await vote.getVote(proposalId);
    console.log("current vote status: " +currentVote[0]);
    console.log("current vote yea: " +currentVote[6]);
    console.log("current vote nay: " +currentVote[7]);
    
    //deploy extention
    let extension = await VoteDelegateExtension.new();
    console.log("VoteExtension: " +extension.address);
    await extension.owner().then(a=>console.log("owner: " +a))
    await extension.daoOperator().then(a=>console.log("daoOperator: " +a))
    await extension.gaugeOperator().then(a=>console.log("gaugeOperator: " +a))

    //insert
    await booster.voteDelegate().then(a=>console.log("voteDelegate: " +a))
    await booster.setVoteDelegate(extension.address,{from:multisig,gasPrice:0});
    await booster.voteDelegate().then(a=>console.log("voteDelegate: " +a))
    await extension.revertControl().catch(a=>console.log("revert permission fail: " +a))
    await extension.revertControl({from:multisig,gasPrice:0});
    console.log("revert control")
    await booster.voteDelegate().then(a=>console.log("voteDelegate: " +a))
    await booster.setVoteDelegate(extension.address,{from:multisig,gasPrice:0});
    console.log("set again")
    await booster.voteDelegate().then(a=>console.log("voteDelegate: " +a))

    //test permission
    await extension.DaoVote(proposalId,true,true).catch(a=>console.log("revert vote permission fail: " +a))

    //vote (full vote)
    // await extension.DaoVote(proposalId,true,true,{from:multisig,gasPrice:0});
    // console.log("voted");

    //vote (fractional)
    var yay = 6773;
    var nay = 3227;
    console.log("fractional vote: yay = " +yay +", nay = " +nay)
    await extension.DaoVoteWithWeights(proposalId,yay,nay, true,{from:multisig,gasPrice:0});
    console.log("voted");


    //after vote stats
    let updatedVote = await vote.getVote(proposalId);
    console.log("current vote status: " +updatedVote[0]);
    console.log("current vote yea: " +updatedVote[6]);
    console.log("current vote nay: " +updatedVote[7]);

  });
});
