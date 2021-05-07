const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');



contract("Move Time", async accounts => {
  it("should advance time 1 day", async () => {

    await time.latest().then(a=>console.log("current time: " +a))
    await time.latestBlock().then(a=>console.log("current block: " +a));
    await time.increase(86400);
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    await time.advanceBlock();
    console.log("advance time...");
    await time.latest().then(a=>console.log("current time: " +a))
    await time.latestBlock().then(a=>console.log("current block: " +a));
  });
});


