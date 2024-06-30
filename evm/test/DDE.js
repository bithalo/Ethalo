// TwoPartyEscrow test suite

const DDE = artifacts.require("TwoPartyEscrow");
const WETH = artifacts.require("WETH9");
const TDAI = artifacts.require("TDAI");

require('chai')
  .use(require('chai-as-promised'))
  .should()

//let elliptic = require('elliptic');
//let ec = new elliptic.ec('secp256k1');
//let sha3 = require('js-sha3');
//let sha256 = require('crypto-js/sha256');
//let cjs = require('crypto-js');
let ethers = require('ethers');

const helper = require("./helpers/truffleTestHelper");
const zeroaddr = "0x0000000000000000000000000000000000000000";
const zero = "0x0000000000000000000000000000000000000000000000000000000000000000";
function ether(n) { return new web3.utils.BN(web3.utils.toWei(n.toString(), 'ether')); }

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let dde;
let weth;
let tdai;
let dde_contract_1;
let dde_contract_2;

let init1 = async function() {
  weth = await WETH.deployed();
  tdai = await TDAI.deployed();
  dde = await DDE.deployed(weth.address);
};

contract('DDE', (accounts) => {

  beforeEach(async function() {
    if (dde == null || dde == undefined) {
      await init1();
    }
  })

  it('pre-check-1 tdai balance 100M', async () => {
    const a1 = await tdai.balanceOf(accounts[0]);
    assert.equal(a1.toString(), ether(100000000).toString(), "match tdai balance of user0");
  });

  it('pre-check-2 defaults', async () => {
    const a2 = await dde.minter();
    const a3 = await dde.cooldown(zeroaddr);
    assert.equal(a2.toString(), accounts[0], "match minter addr");
    assert.equal(a3.toString(), "259200", "match cooldown default");
  });

  it('change-minter-1', async () => {
    await dde.changeMinter(accounts[1]);
    const a2 = await dde.minter();
    assert.equal(a2.toString(), accounts[1], "match minter addr");
  });

  it('change-minter-2', async () => {
    const a1 = await dde.minter();
    assert.equal(a1.toString(), accounts[1], "match minter addr");

    await dde.changeMinter(accounts[0], { from: accounts[1] });

    const a2 = await dde.minter();
    assert.equal(a2.toString(), accounts[0], "match minter addr");
  });

  it('change-threshold-1', async () => {

    await dde.changeThreshold(tdai.address, 1, { from: accounts[0] });

    const a2 = await dde.minimumFeeThreshold(tdai.address);
    assert.equal(a2.toString(), "1", "match minimumFeeThreshold tdai");
  });

  it('deposit-1', async () => {
    const a1 = await dde.userBalance(accounts[0], tdai.address);
    assert.equal(a1.toString(), ether(0).toString(), "match user0 tdai balance");

    await dde.deposit(tdai.address, ether(100)).should.be.rejected; // no allowance
    await tdai.approve(dde.address, ether(101));
    await dde.deposit(tdai.address, ether(100));
    await dde.deposit(tdai.address, ether(100)).should.be.rejected; // no replay no-allowance
    await dde.deposit(tdai.address, ether(1)); // OK replay
    await dde.deposit(tdai.address, ether(1)).should.be.rejected; // no replay no-allowance

    const a2 = await dde.userBalance(accounts[0], tdai.address);
    assert.equal(a2.toString(), ether(101).toString(), "match user0 tdai balance");
    const a3 = await tdai.balanceOf(dde.address);
    assert.equal(a3.toString(), ether(101).toString(), "match dde tdai balance");
  });

  it('deposit-2', async () => {
    const a1 = await dde.userBalance(accounts[0], weth.address);
    assert.equal(a1.toString(), ether(0).toString(), "match user0 weth balance");

    await dde.depositWETH({ value: ether(10) });
    await dde.depositWETH({ value: ether(1) });

    const a2 = await dde.userBalance(accounts[0], weth.address);
    assert.equal(a2.toString(), ether(11).toString(), "match user0 weth balance");
    const a3 = await weth.balanceOf(dde.address);
    assert.equal(a3.toString(), ether(11).toString(), "match dde weth balance");
  });

  it('deposit-3', async () => {
    const a1 = await dde.userBalance(accounts[1], tdai.address);
    assert.equal(a1.toString(), ether(0).toString(), "match user1 tdai balance");

    await tdai.transfer(accounts[1], ether(101));
    await dde.deposit(tdai.address, ether(100), { from: accounts[1] }).should.be.rejected; // no allowance
    await tdai.approve(dde.address, ether(101), { from: accounts[1] });
    await dde.deposit(tdai.address, ether(100), { from: accounts[1] });
    await dde.deposit(tdai.address, ether(100), { from: accounts[1] }).should.be.rejected; // no replay no-allowance
    await dde.deposit(tdai.address, ether(1), { from: accounts[1] }); // OK replay
    await dde.deposit(tdai.address, ether(1), { from: accounts[1] }).should.be.rejected; // no replay no-allowance

    const a2 = await dde.userBalance(accounts[1], tdai.address);
    assert.equal(a2.toString(), ether(101).toString(), "match user1 tdai balance");
    const a3 = await tdai.balanceOf(dde.address);
    assert.equal(a3.toString(), ether(202).toString(), "match dde tdai balance");
  });

  it('withdraw-1', async () => {
    const a1 = await dde.userBalance(accounts[0], tdai.address);
    assert.equal(a1.toString(), ether(101).toString(), "match user0 tdai balance");

    await dde.withdraw(tdai.address, ether(102)).should.be.rejected; // no amount
    await dde.withdraw(tdai.address, ether(1));

    const a2 = await dde.userBalance(accounts[0], tdai.address);
    assert.equal(a2.toString(), ether(100).toString(), "match user0 tdai balance");
    const a3 = await tdai.balanceOf(dde.address);
    assert.equal(a3.toString(), ether(201).toString(), "match dde tdai balance");
  });

  it('withdraw-2', async () => {
    const a1 = await dde.userBalance(accounts[0], weth.address);
    assert.equal(a1.toString(), ether(11).toString(), "match user0 weth balance");

    await dde.withdraw(weth.address, ether(12)).should.be.rejected; // no amount
    await dde.withdraw(weth.address, ether(1));

    const a2 = await dde.userBalance(accounts[0], weth.address);
    assert.equal(a2.toString(), ether(10).toString(), "match user0 weth balance");
    const a3 = await weth.balanceOf(dde.address);
    assert.equal(a3.toString(), ether(10).toString(), "match dde weth balance");
  });

  it('withdraw-3', async () => {
    const a1 = await dde.userBalance(accounts[1], tdai.address);
    assert.equal(a1.toString(), ether(101).toString(), "match user1 tdai balance");

    await dde.withdraw(tdai.address, ether(102), { from: accounts[1] }).should.be.rejected; // no amount
    await dde.withdraw(tdai.address, ether(1), { from: accounts[1] });

    const a2 = await dde.userBalance(accounts[1], tdai.address);
    assert.equal(a2.toString(), ether(100).toString(), "match user1 tdai balance");
    const a3 = await tdai.balanceOf(dde.address);
    assert.equal(a3.toString(), ether(200).toString(), "match dde tdai balance");
  });

  // style
  // 0 instant acceptance or counters,
  // 1 no instant with counters,
  // 2 instant no counters,
  // 3 no instant no counters,
  // 4 private offer with recipient custom fee

  it('createContract-1', async () => {

    const _sender = accounts[0];
    const _recepient = [zeroaddr, zeroaddr];
    const _token = tdai.address;
    const _amount = ether(10);
    const _depositSender = ether(1);
    const _depositRecipient = ether(1);
    const _quantity = [1,1];
    const _timelimit = [3600,0]; // 1h
    const _style = 0;
    const _message = "test";
    const _hashtags = [];

    await dde.createContract(

      _sender,
      _recepient,
      _token,
      _amount,
      _depositSender,
      _depositRecipient,
      _quantity,
      _timelimit,
      _style,
      _message,
      _hashtags

    );

    // read hash via markets
    const marketslength = await dde.marketslength();
    assert.equal(marketslength.toString(), "2", "match marketslength");

    const dde_contract_hash1 = await dde.markets(1);
    const a1 = await dde.initialized(dde_contract_hash1);
    const dde_contract_obj = await dde.getContract(dde_contract_hash1);

    //console.log("contract obj:", dde_contract_obj);

    assert.equal(a1, true, "match initialized");

    assert.equal(dde_contract_obj.sender, accounts[0], "match sender");
    assert.equal(dde_contract_obj.token, tdai.address, "match token");
    assert.equal(dde_contract_obj.message, "test", "match message");
    assert.equal(dde_contract_obj.status[0], "0", "match status");
    assert.equal(dde_contract_obj.status[1], "0", "match status");
    assert.equal(dde_contract_obj.quantity[0], "1", "match quantity");
    assert.equal(dde_contract_obj.quantity[1], "1", "match quantity");

    dde_contract_1 = dde_contract_hash1;
  });

  it('acceptOffer-1', async () => {
    const a2 = await dde.userMarketID(dde_contract_1);
    assert.equal(a2.toString(), "1", "match userMarketID");

    await dde.acceptOffer(

      dde_contract_1,
      1, // quantity
      0, // offerlimit
      zeroaddr,

      { from: accounts[1] }
    );

    const dde_contract_obj1 = await dde.getContract(dde_contract_1);
    assert.equal(dde_contract_obj1.quantity[0], "0", "match quantity");
    assert.equal(dde_contract_obj1.quantity[1], "1", "match quantity");

    const dde_contract_hash2 = await dde.escrows(accounts[0],0);
    const dde_contract_obj2 = await dde.getContract(dde_contract_hash2);

    //console.log("contract obj:", dde_contract_obj2);

    // user balances reduced by deposit and amount

    const a3 = await dde.userBalance(accounts[0], tdai.address);
    const a4 = await dde.userBalance(accounts[1], tdai.address);
    assert.equal(a3.toString(), ether(89).toString(), "match user0 tdai balance");
    assert.equal(a4.toString(), ether(99).toString(), "match user1 tdai balance");

    dde_contract_2 = dde_contract_hash2;
  });

  it('completeEscrow-1', async () => {

    await dde.completeEscrow(

      dde_contract_2,
      accounts[0],

      { from: accounts[0] }
    );

    const dde_contract_obj2 = await dde.getContract(dde_contract_2);

    //console.log("contract obj:", dde_contract_obj2);

    const a3 = await dde.userBalance(accounts[0], tdai.address);
    const a4 = await dde.userBalance(accounts[1], tdai.address);
    assert.equal(a3.toString(), ether(89).toString(), "match user0 tdai balance");
    assert.equal(a4.toString(), ether(99).toString(), "match user1 tdai balance");

  });

  it('completeEscrow-2', async () => {

    await dde.completeEscrow(

      dde_contract_2,
      accounts[1],

      { from: accounts[1] }
    );

    const dde_contract_obj2 = await dde.getContract(dde_contract_2);

    //console.log("contract obj:", dde_contract_obj2);

    const a3 = await dde.userBalance(accounts[0], tdai.address);
    const a4 = await dde.userBalance(accounts[1], tdai.address);
    assert.equal(a3.toString(), ether(90).toString(), "match user0 tdai balance");
    assert.equal(a4.toString(), ether(110).toString(), "match user1 tdai balance");

  });

  it('dde-one-go-1', async () => {

    const _sender = accounts[0];
    const _recepient = [zeroaddr, zeroaddr];
    const _token = tdai.address;
    const _amount = ether(10);
    const _depositSender = ether(1);
    const _depositRecipient = ether(1);
    const _quantity = [1,1];
    const _timelimit = [3600,0]; // 1h
    const _style = 0;
    const _message = "test2";
    const _hashtags = [];

    await dde.createContract(

      _sender,
      _recepient,
      _token,
      _amount,
      _depositSender,
      _depositRecipient,
      _quantity,
      _timelimit,
      _style,
      _message,
      _hashtags

    );

    // read hash via markets
    const marketslength = await dde.marketslength();
    assert.equal(marketslength.toString(), "2", "match marketslength");

    const dde_contract_1 = await dde.markets(1);
    const a1 = await dde.initialized(dde_contract_1);
    const dde_contract_obj = await dde.getContract(dde_contract_1);

    //console.log("contract obj1:", dde_contract_obj);

    assert.equal(a1, true, "match initialized");

    assert.equal(dde_contract_obj.sender, accounts[0], "match sender");
    assert.equal(dde_contract_obj.token, tdai.address, "match token");
    assert.equal(dde_contract_obj.message, "test2", "match message");
    assert.equal(dde_contract_obj.status[0], "0", "match status");
    assert.equal(dde_contract_obj.status[1], "0", "match status");
    assert.equal(dde_contract_obj.quantity[0], "1", "match quantity");
    assert.equal(dde_contract_obj.quantity[1], "1", "match quantity");

    const a2 = await dde.userMarketID(dde_contract_1);
    assert.equal(a2.toString(), "1", "match userMarketID");

    { // accept-offer-1

      await dde.acceptOffer(

        dde_contract_1,
        1, // quantity
        0, // offerlimit
        zeroaddr,

        { from: accounts[1] }
      );

      const dde_contract_obj1 = await dde.getContract(dde_contract_1);
      assert.equal(dde_contract_obj1.quantity[0], "0", "match quantity");
      assert.equal(dde_contract_obj1.quantity[1], "1", "match quantity");

      dde_contract_2 = await dde.escrows(accounts[0],1);
      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj2:", dde_contract_obj2);

      // user balances reduced by deposit and amount

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(79).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(109).toString(), "match user1 tdai balance");
    }

    { // completeEscrow-1

      await dde.completeEscrow(

        dde_contract_2,
        accounts[0],

        { from: accounts[0] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(79).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(109).toString(), "match user1 tdai balance");
    }

    {  // completeEscrow-2

      await dde.completeEscrow(

        dde_contract_2,
        accounts[1],

        { from: accounts[1] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(80).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(120).toString(), "match user1 tdai balance");

    }

  });


  it('dde-one-go-2-cancel-1', async () => {

    const _sender = accounts[0];
    const _recepient = [zeroaddr, zeroaddr];
    const _token = tdai.address;
    const _amount = ether(10);
    const _depositSender = ether(1);
    const _depositRecipient = ether(1);
    const _quantity = [1,1];
    const _timelimit = [3600,0]; // 1h
    const _style = 0;
    const _message = "test3";
    const _hashtags = [];

    await dde.createContract(

      _sender,
      _recepient,
      _token,
      _amount,
      _depositSender,
      _depositRecipient,
      _quantity,
      _timelimit,
      _style,
      _message,
      _hashtags

    );

    // read hash via markets
    const marketslength = await dde.marketslength();
    assert.equal(marketslength.toString(), "2", "match marketslength");

    const dde_contract_1 = await dde.markets(1);
    const a1 = await dde.initialized(dde_contract_1);
    const dde_contract_obj = await dde.getContract(dde_contract_1);

    //console.log("contract obj1:", dde_contract_obj);

    assert.equal(a1, true, "match initialized");

    assert.equal(dde_contract_obj.sender, accounts[0], "match sender");
    assert.equal(dde_contract_obj.token, tdai.address, "match token");
    assert.equal(dde_contract_obj.message, "test3", "match message");
    assert.equal(dde_contract_obj.status[0], "0", "match status");
    assert.equal(dde_contract_obj.status[1], "0", "match status");
    assert.equal(dde_contract_obj.quantity[0], "1", "match quantity");
    assert.equal(dde_contract_obj.quantity[1], "1", "match quantity");

    const a2 = await dde.userMarketID(dde_contract_1);
    assert.equal(a2.toString(), "1", "match userMarketID");

    { // accept-offer-1

      await dde.acceptOffer(

        dde_contract_1,
        1, // quantity
        0, // offerlimit
        zeroaddr,

        { from: accounts[1] }
      );

      const dde_contract_obj1 = await dde.getContract(dde_contract_1);
      assert.equal(dde_contract_obj1.quantity[0], "0", "match quantity");
      assert.equal(dde_contract_obj1.quantity[1], "1", "match quantity");

      dde_contract_2 = await dde.escrows(accounts[0],2);
      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj2:", dde_contract_obj2);

      // user balances reduced by deposit and amount

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(69).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(119).toString(), "match user1 tdai balance");
    }

    { // completeEscrow-1

      await dde.completeEscrow(

        dde_contract_2,
        accounts[0],

        { from: accounts[0] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(69).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(119).toString(), "match user1 tdai balance");
    }

    { // cancelEscrow-user1

      await dde.cancelEscrow(

        dde_contract_2,
        accounts[1],

        { from: accounts[1] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(69).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(119).toString(), "match user1 tdai balance");

    }

    { // cancelEscrow-user0

      await dde.cancelEscrow(

        dde_contract_2,
        accounts[0],

        { from: accounts[0] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(80).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(120).toString(), "match user1 tdai balance");

    }

  });



  it('dde-one-go-2-cancel-2', async () => {

    const _sender = accounts[0];
    const _recepient = [zeroaddr, zeroaddr];
    const _token = tdai.address;
    const _amount = ether(10);
    const _depositSender = ether(1);
    const _depositRecipient = ether(1);
    const _quantity = [1,1];
    const _timelimit = [3600,0]; // 1h
    const _style = 0;
    const _message = "test4";
    const _hashtags = [];

    await dde.createContract(

      _sender,
      _recepient,
      _token,
      _amount,
      _depositSender,
      _depositRecipient,
      _quantity,
      _timelimit,
      _style,
      _message,
      _hashtags

    );

    // read hash via markets
    const marketslength = await dde.marketslength();
    assert.equal(marketslength.toString(), "2", "match marketslength");

    const dde_contract_1 = await dde.markets(1);
    const a1 = await dde.initialized(dde_contract_1);
    const dde_contract_obj = await dde.getContract(dde_contract_1);

    //console.log("contract obj1:", dde_contract_obj);

    assert.equal(a1, true, "match initialized");

    assert.equal(dde_contract_obj.sender, accounts[0], "match sender");
    assert.equal(dde_contract_obj.token, tdai.address, "match token");
    assert.equal(dde_contract_obj.message, "test4", "match message");
    assert.equal(dde_contract_obj.status[0], "0", "match status");
    assert.equal(dde_contract_obj.status[1], "0", "match status");
    assert.equal(dde_contract_obj.quantity[0], "1", "match quantity");
    assert.equal(dde_contract_obj.quantity[1], "1", "match quantity");

    const a2 = await dde.userMarketID(dde_contract_1);
    assert.equal(a2.toString(), "1", "match userMarketID");

    { // accept-offer-1

      await dde.acceptOffer(

        dde_contract_1,
        1, // quantity
        0, // offerlimit
        zeroaddr,

        { from: accounts[1] }
      );

      const dde_contract_obj1 = await dde.getContract(dde_contract_1);
      assert.equal(dde_contract_obj1.quantity[0], "0", "match quantity");
      assert.equal(dde_contract_obj1.quantity[1], "1", "match quantity");

      dde_contract_2 = await dde.escrows(accounts[0],3);
      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj2:", dde_contract_obj2);

      // user balances reduced by deposit and amount

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(69).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(119).toString(), "match user1 tdai balance");
    }

    { // completeEscrow-1

      await dde.completeEscrow(

        dde_contract_2,
        accounts[0],

        { from: accounts[0] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(69).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(119).toString(), "match user1 tdai balance");
    }

    { // cancelEscrow-user0

      await dde.cancelEscrow(

        dde_contract_2,
        accounts[0],

        { from: accounts[0] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(69).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(119).toString(), "match user1 tdai balance");

    }

    { // cancelEscrow-user1

      await dde.cancelEscrow(

        dde_contract_2,
        accounts[1],

        { from: accounts[1] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(80).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(120).toString(), "match user1 tdai balance");
    }



  });



  it('dde-one-go-with-remove-1', async () => {

    const _sender = accounts[0];
    const _recepient = [zeroaddr, zeroaddr];
    const _token = tdai.address;
    const _amount = ether(10);
    const _depositSender = ether(1);
    const _depositRecipient = ether(1);
    const _quantity = [1,1];
    const _timelimit = [3600,0]; // 1h
    const _style = 0;
    const _message = "test5";
    const _hashtags = [];

    await dde.createContract(

      _sender,
      _recepient,
      _token,
      _amount,
      _depositSender,
      _depositRecipient,
      _quantity,
      _timelimit,
      _style,
      _message,
      _hashtags

    );

    // read hash via markets
    const marketslength = await dde.marketslength();
    assert.equal(marketslength.toString(), "2", "match marketslength");

    const dde_contract_1 = await dde.markets(1);
    const a1 = await dde.initialized(dde_contract_1);
    const dde_contract_obj = await dde.getContract(dde_contract_1);

    //console.log("contract obj1:", dde_contract_obj);

    assert.equal(a1, true, "match initialized");

    assert.equal(dde_contract_obj.sender, accounts[0], "match sender");
    assert.equal(dde_contract_obj.token, tdai.address, "match token");
    assert.equal(dde_contract_obj.message, "test5", "match message");
    assert.equal(dde_contract_obj.status[0], "0", "match status");
    assert.equal(dde_contract_obj.status[1], "0", "match status");
    assert.equal(dde_contract_obj.quantity[0], "1", "match quantity");
    assert.equal(dde_contract_obj.quantity[1], "1", "match quantity");

    const a2 = await dde.userMarketID(dde_contract_1);
    assert.equal(a2.toString(), "1", "match userMarketID");

    { // accept-offer-1

      await dde.acceptOffer(

        dde_contract_1,
        1, // quantity
        0, // offerlimit
        zeroaddr,

        { from: accounts[1] }
      );

      const dde_contract_obj1 = await dde.getContract(dde_contract_1);
      assert.equal(dde_contract_obj1.quantity[0], "0", "match quantity");
      assert.equal(dde_contract_obj1.quantity[1], "1", "match quantity");

      dde_contract_2 = await dde.escrows(accounts[0],4);
      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj2:", dde_contract_obj2);

      // user balances reduced by deposit and amount

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(69).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(119).toString(), "match user1 tdai balance");
    }

    { // now removeMarketOffer

      await dde.removeMarketOffer(

        dde_contract_1,
        zeroaddr,

        { from: accounts[0] }
      );

      const dde_contract_obj1 = await dde.getContract(dde_contract_1);
      assert.equal(dde_contract_obj1.quantity[0], "0", "match quantity");
      assert.equal(dde_contract_obj1.quantity[1], "1", "match quantity");

      dde_contract_2 = await dde.escrows(accounts[0],4);
      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj2:", dde_contract_obj2);

      // user balances reduced by deposit and amount

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(69).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(119).toString(), "match user1 tdai balance");
    }

    { // completeEscrow-1

      await dde.completeEscrow(

        dde_contract_2,
        accounts[0],

        { from: accounts[0] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(69).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(119).toString(), "match user1 tdai balance");
    }

    {  // completeEscrow-2

      await dde.completeEscrow(

        dde_contract_2,
        accounts[1],

        { from: accounts[1] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(70).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(130).toString(), "match user1 tdai balance");

    }

  });

  it('change-fee-1', async () => {

    /// await dde.changeAffiliate(accounts[2]); // for user0, user2 gets the fee TODO rates to collect

    await dde.changeFee(100);

    const a2 = await dde.affiliateFee();
    assert.equal(a2.toString(), 100, "match affiliateFee");
  });

  it('dde-one-go-with-fee-1', async () => {

    const _sender = accounts[0];
    const _recepient = [zeroaddr, zeroaddr];
    const _token = tdai.address;
    const _amount = ether(10);
    const _depositSender = ether(1);
    const _depositRecipient = ether(1);
    const _quantity = [1,1];
    const _timelimit = [3600,0]; // 1h
    const _style = 0;
    const _message = "test6";
    const _hashtags = [];

    await dde.createContract(

      _sender,
      _recepient,
      _token,
      _amount,
      _depositSender,
      _depositRecipient,
      _quantity,
      _timelimit,
      _style,
      _message,
      _hashtags

    );

    // read hash via markets
    const marketslength = await dde.marketslength();
    assert.equal(marketslength.toString(), "2", "match marketslength");

    const dde_contract_1 = await dde.markets(1);
    const a1 = await dde.initialized(dde_contract_1);
    const dde_contract_obj = await dde.getContract(dde_contract_1);

    //console.log("contract obj1:", dde_contract_obj);

    assert.equal(a1, true, "match initialized");

    assert.equal(dde_contract_obj.sender, accounts[0], "match sender");
    assert.equal(dde_contract_obj.token, tdai.address, "match token");
    assert.equal(dde_contract_obj.message, "test6", "match message");
    assert.equal(dde_contract_obj.status[0], "0", "match status");
    assert.equal(dde_contract_obj.status[1], "0", "match status");
    assert.equal(dde_contract_obj.quantity[0], "1", "match quantity");
    assert.equal(dde_contract_obj.quantity[1], "1", "match quantity");

    const a2 = await dde.userMarketID(dde_contract_1);
    assert.equal(a2.toString(), "1", "match userMarketID");

    { // accept-offer-1

      await dde.acceptOffer(

        dde_contract_1,
        1, // quantity
        0, // offerlimit
        accounts[2], // fee collector

        { from: accounts[1] }
      );

      const dde_contract_obj1 = await dde.getContract(dde_contract_1);
      assert.equal(dde_contract_obj1.quantity[0], "0", "match quantity");
      assert.equal(dde_contract_obj1.quantity[1], "1", "match quantity");

      dde_contract_2 = await dde.escrows(accounts[0],5);
      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj2:", dde_contract_obj2);
      assert.equal(dde_contract_obj2.rfee, 100, "match rfee");

      // user balances reduced by deposit and amount

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(59).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(129).toString(), "match user1 tdai balance");
    }

    { // completeEscrow-1

      await dde.completeEscrow(

        dde_contract_2,
        accounts[0],

        { from: accounts[0] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(59).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(129).toString(), "match user1 tdai balance");
    }

    {  // completeEscrow-2

      await dde.completeEscrow(

        dde_contract_2,
        accounts[1],

        { from: accounts[1] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(60).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(139.9).toString(), "match user1 tdai balance");

    }

  });

  it('collected-fee-1', async () => {

      const a2 = await dde.userBalance(accounts[2], tdai.address);
      assert.equal(a2.toString(), ether(0.1).toString(), "match user2 tdai balance (collected fee)");

  });


  it('dde-one-go-with-update-quantity-1', async () => {

    const _sender = accounts[0];
    const _recepient = [zeroaddr, zeroaddr];
    const _token = tdai.address;
    const _amount = ether(10);
    const _depositSender = ether(1);
    const _depositRecipient = ether(1);
    const _quantity = [1,1];
    const _timelimit = [3600,0]; // 1h
    const _style = 0;
    const _message = "test7";
    const _hashtags = [];

    await dde.createContract(

      _sender,
      _recepient,
      _token,
      _amount,
      _depositSender,
      _depositRecipient,
      _quantity,
      _timelimit,
      _style,
      _message,
      _hashtags

    );

    // read hash via markets
    const marketslength = await dde.marketslength();
    assert.equal(marketslength.toString(), "2", "match marketslength");

    const dde_contract_1 = await dde.markets(1);
    const a1 = await dde.initialized(dde_contract_1);
    const dde_contract_obj = await dde.getContract(dde_contract_1);

    //console.log("contract obj1:", dde_contract_obj);

    assert.equal(a1, true, "match initialized");

    assert.equal(dde_contract_obj.sender, accounts[0], "match sender");
    assert.equal(dde_contract_obj.token, tdai.address, "match token");
    assert.equal(dde_contract_obj.message, "test7", "match message");
    assert.equal(dde_contract_obj.status[0], "0", "match status");
    assert.equal(dde_contract_obj.status[1], "0", "match status");
    assert.equal(dde_contract_obj.quantity[0], "1", "match quantity");
    assert.equal(dde_contract_obj.quantity[1], "1", "match quantity");

    const a2 = await dde.userMarketID(dde_contract_1);
    assert.equal(a2.toString(), "1", "match userMarketID");

    { // updateQuantity

      await dde.updateQuantity(

        dde_contract_1,
        [2,2],

        { from: accounts[0] }
      );
    }

    { // accept-offer-1

      await dde.acceptOffer(

        dde_contract_1,
        2, // quantity
        0, // offerlimit
        accounts[2], // fee collector

        { from: accounts[1] }
      );

      const dde_contract_obj1 = await dde.getContract(dde_contract_1);
      assert.equal(dde_contract_obj1.quantity[0], "0", "match quantity");
      assert.equal(dde_contract_obj1.quantity[1], "2", "match quantity");

      dde_contract_2 = await dde.escrows(accounts[0],6);
      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj2:", dde_contract_obj2);
      assert.equal(dde_contract_obj2.rfee, 100, "match rfee");

      // user balances reduced by deposit and amount

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(38).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(137.9).toString(), "match user1 tdai balance");
    }

    { // completeEscrow-1

      await dde.completeEscrow(

        dde_contract_2,
        accounts[0],

        { from: accounts[0] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(38).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(137.9).toString(), "match user1 tdai balance");
    }

    {  // completeEscrow-2

      await dde.completeEscrow(

        dde_contract_2,
        accounts[1],

        { from: accounts[1] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(40).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(159.7).toString(), "match user1 tdai balance");

    }

  });

  it('collected-fee-2', async () => {

      const a2 = await dde.userBalance(accounts[2], tdai.address);
      assert.equal(a2.toString(), ether(0.3).toString(), "match user2 tdai balance (collected fee)"); // +0.2 for two items

  });


  it('dde-one-go-with-expire-1', async () => {

    const _sender = accounts[0];
    const _recepient = [zeroaddr, zeroaddr];
    const _token = tdai.address;
    const _amount = ether(10);
    const _depositSender = ether(1);
    const _depositRecipient = ether(1);
    const _quantity = [1,1];
    const _timelimit = [1,0]; // 1sec
    const _style = 0;
    const _message = "test8";
    const _hashtags = [];

    await dde.createContract(

      _sender,
      _recepient,
      _token,
      _amount,
      _depositSender,
      _depositRecipient,
      _quantity,
      _timelimit,
      _style,
      _message,
      _hashtags

    );

    // read hash via markets
    const marketslength = await dde.marketslength();
    assert.equal(marketslength.toString(), "2", "match marketslength");

    const dde_contract_1 = await dde.markets(1);
    const a1 = await dde.initialized(dde_contract_1);
    const dde_contract_obj = await dde.getContract(dde_contract_1);

    //console.log("contract obj1:", dde_contract_obj);

    assert.equal(a1, true, "match initialized");

    assert.equal(dde_contract_obj.sender, accounts[0], "match sender");
    assert.equal(dde_contract_obj.token, tdai.address, "match token");
    assert.equal(dde_contract_obj.message, "test8", "match message");
    assert.equal(dde_contract_obj.status[0], "0", "match status");
    assert.equal(dde_contract_obj.status[1], "0", "match status");
    assert.equal(dde_contract_obj.quantity[0], "1", "match quantity");
    assert.equal(dde_contract_obj.quantity[1], "1", "match quantity");

    const a2 = await dde.userMarketID(dde_contract_1);
    assert.equal(a2.toString(), "1", "match userMarketID");

    { // accept-offer-1

      await dde.acceptOffer(

        dde_contract_1,
        1, // quantity
        0, // offerlimit
        zeroaddr,

        { from: accounts[1] }
      );

      const dde_contract_obj1 = await dde.getContract(dde_contract_1);
      assert.equal(dde_contract_obj1.quantity[0], "0", "match quantity");
      assert.equal(dde_contract_obj1.quantity[1], "1", "match quantity");

      dde_contract_2 = await dde.escrows(accounts[0],7);
      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj2:", dde_contract_obj2);

      // user balances reduced by deposit and amount
      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(29).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(158.7).toString(), "match user1 tdai balance");
    }

    {
      await dde.authorizeCustodian(

        accounts[2],
        true,

        { from: accounts[0] }
      );
    }

    {
      await dde.authorizeContract(

        accounts[2],
        //dde_contract_2, // todo: all of them (bug)
        zeroaddr,
        true,

        { from: accounts[0] }
      );
    }

    await helper.advanceTimeAndBlock(100); // +100sec

    { // now expireEscrow

      await dde.expireEscrow(

        dde_contract_2,
        accounts[0],

        { from: accounts[2] }
      );

      const dde_contract_obj1 = await dde.getContract(dde_contract_1);
      assert.equal(dde_contract_obj1.quantity[0], "0", "match quantity");
      assert.equal(dde_contract_obj1.quantity[1], "1", "match quantity");

      dde_contract_2 = await dde.escrows(accounts[0],7);
      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj2:", dde_contract_obj2);

      // user balances reduced by deposit and amount
      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(29).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(158.7).toString(), "match user1 tdai balance");
    }



  });



  it('dde-one-go-with-tags-and-extension-1', async () => {

    const _sender = accounts[1];
    const _recepient = [zeroaddr, zeroaddr];
    const _token = tdai.address;
    const _amount = ether(10);
    const _depositSender = ether(1);
    const _depositRecipient = ether(1);
    const _quantity = [1,1];
    const _timelimit = [3600,0]; // 1h
    const _style = 0;
    const _message = "test9";
    const _hashtags = ["abc","bcd"];

    await dde.createContract(

      _sender,
      _recepient,
      _token,
      _amount,
      _depositSender,
      _depositRecipient,
      _quantity,
      _timelimit,
      _style,
      _message,
      _hashtags,

      { from: accounts[1] }
    );

    // read hash via markets
    const marketslength = await dde.marketslength();
    assert.equal(marketslength.toString(), "2", "match marketslength");

    const dde_contract_1 = await dde.markets(1);
    const a1 = await dde.initialized(dde_contract_1);
    const dde_contract_obj = await dde.getContract(dde_contract_1);

    //console.log("contract obj1:", dde_contract_obj);

    assert.equal(a1, true, "match initialized");

    assert.equal(dde_contract_obj.sender, accounts[1], "match sender");
    assert.equal(dde_contract_obj.token, tdai.address, "match token");
    assert.equal(dde_contract_obj.message, "test9", "match message");
    assert.equal(dde_contract_obj.status[0], "0", "match status");
    assert.equal(dde_contract_obj.status[1], "0", "match status");
    assert.equal(dde_contract_obj.quantity[0], "1", "match quantity");
    assert.equal(dde_contract_obj.quantity[1], "1", "match quantity");

    const a2 = await dde.userMarketID(dde_contract_1);
    assert.equal(a2.toString(), "1", "match userMarketID");

    { // accept-offer-1

      await dde.acceptOffer(

        dde_contract_1,
        1, // quantity
        0, // offerlimit
        accounts[2], // fee collector

        { from: accounts[0] }
      );

      const dde_contract_obj1 = await dde.getContract(dde_contract_1);
      assert.equal(dde_contract_obj1.quantity[0], "0", "match quantity");
      assert.equal(dde_contract_obj1.quantity[1], "1", "match quantity");

      dde_contract_2 = await dde.escrows(accounts[0],8);
      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj2:", dde_contract_obj2);
      assert.equal(dde_contract_obj2.rfee, 100, "match rfee");

      // user balances reduced by deposit and amount

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(28).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(147.7).toString(), "match user1 tdai balance");
    }

    { // removeTags-1

      await dde.removeExpiredTags(

        dde_contract_1,

        { from: accounts[1] }
      );
    }

    { // completeEscrow-1

      await dde.completeEscrow(

        dde_contract_2,
        accounts[1],

        { from: accounts[1] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);
      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(28).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(147.7).toString(), "match user1 tdai balance");
    }

    let t_end = Math.floor(Date.now() / 1000);
    t_end += 3600*24; // +1day

    { // make extension


      await dde.requestExtension(

        dde_contract_2,
        accounts[1], // sender
        t_end, // +1day

        { from: accounts[1] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);
      assert.equal(dde_contract_obj2.timelimit[1], t_end, "match timelimit sender");

      await dde.requestExtension(

        dde_contract_2,
        accounts[0], // receiver
        t_end, // +1day

        { from: accounts[0] }
      );

      const dde_contract_obj3 = await dde.getContract(dde_contract_2);
      assert.equal(dde_contract_obj3.timelimit[2], t_end, "match timelimit receiver");
      assert.equal(dde_contract_obj3.timelimit[0], t_end, "match timelimit");
    }

    {  // completeEscrow-2

      await dde.completeEscrow(

        dde_contract_2,
        accounts[0],

        { from: accounts[0] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(38.9).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(148.7).toString(), "match user1 tdai balance");

    }

    { // completeEscrow-3, make a retry to check

      await dde.completeEscrow(

        dde_contract_2,
        accounts[1],

        { from: accounts[1] }
      ).should.be.rejected; // no amount;

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(38.9).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(148.7).toString(), "match user1 tdai balance");

    }

  });



  it('dde-one-go-private-cancel-1', async () => {

    const _sender = accounts[1];
    const _recepient = [zeroaddr, zeroaddr];
    const _token = tdai.address;
    const _amount = ether(10);
    const _depositSender = ether(1);
    const _depositRecipient = ether(1);
    const _quantity = [1,1];
    const _timelimit = [3600,0]; // 1h
    const _style = 1;
    const _message = "test10";
    const _hashtags = ["abc","bcd"];

    await dde.createContract(

      _sender,
      _recepient,
      _token,
      _amount,
      _depositSender,
      _depositRecipient,
      _quantity,
      _timelimit,
      _style,
      _message,
      _hashtags,

      { from: accounts[1] }
    );

    // read hash via markets
    const marketslength = await dde.marketslength();
    assert.equal(marketslength.toString(), "2", "match marketslength");

    const dde_contract_1 = await dde.markets(1);
    const a1 = await dde.initialized(dde_contract_1);
    const dde_contract_obj = await dde.getContract(dde_contract_1);

    //console.log("contract obj1:", dde_contract_obj);

    assert.equal(a1, true, "match initialized");

    assert.equal(dde_contract_obj.sender, accounts[1], "match sender");
    assert.equal(dde_contract_obj.token, tdai.address, "match token");
    assert.equal(dde_contract_obj.message, "test10", "match message");
    assert.equal(dde_contract_obj.status[0], "1", "match status");
    assert.equal(dde_contract_obj.status[1], "0", "match status");
    assert.equal(dde_contract_obj.quantity[0], "1", "match quantity");
    assert.equal(dde_contract_obj.quantity[1], "1", "match quantity");

    const a2 = await dde.userMarketID(dde_contract_1);
    assert.equal(a2.toString(), "1", "match userMarketID");

    { // accept-offer-1

      { // before
        const a3 = await dde.userBalance(accounts[0], tdai.address);
        const a4 = await dde.userBalance(accounts[1], tdai.address);
        assert.equal(a3.toString(), ether(38.9).toString(), "match user0 tdai balance");
        assert.equal(a4.toString(), ether(148.7).toString(), "match user1 tdai balance");
      }

      await dde.acceptOffer(

        dde_contract_1,
        1, // quantity
        0, // offerlimit
        accounts[2], // fee collector

        { from: accounts[0] }
      );

      const dde_contract_obj1 = await dde.getContract(dde_contract_1);
      assert.equal(dde_contract_obj1.quantity[0], "1", "match quantity");
      assert.equal(dde_contract_obj1.quantity[1], "1", "match quantity");

      dde_contract_2 = await dde.privateOffers(accounts[1],0);
      const dde_contract_obj2 = await dde.getContract(dde_contract_2);
      //console.log("contract obj2:", dde_contract_obj2);

      assert.equal(dde_contract_obj2.rfee, 100, "match rfee");

      // user balances reduced by deposit and amount

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(38.9).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(148.7).toString(), "match user1 tdai balance");
    }

    { // cancelPrivateOffer-1

      await dde.cancelPrivateOffer(

        dde_contract_2,
        accounts[1],

        { from: accounts[1] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);
      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(38.9).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(148.7).toString(), "match user1 tdai balance");
    }

  });

  it('dde-one-go-private-1', async () => {

    const _sender = accounts[1];
    const _recepient = [zeroaddr, zeroaddr];
    const _token = tdai.address;
    const _amount = ether(10);
    const _depositSender = ether(1);
    const _depositRecipient = ether(1);
    const _quantity = [1,1];
    const _timelimit = [3600,0]; // 1h
    const _style = 1;
    const _message = "test11";
    const _hashtags = ["abc","bcd"];

    await dde.createContract(

      _sender,
      _recepient,
      _token,
      _amount,
      _depositSender,
      _depositRecipient,
      _quantity,
      _timelimit,
      _style,
      _message,
      _hashtags,

      { from: accounts[1] }
    );

    // read hash via markets
    const marketslength = await dde.marketslength();
    assert.equal(marketslength.toString(), "3", "match marketslength");

    const dde_contract_1 = await dde.markets(2);
    const a1 = await dde.initialized(dde_contract_1);
    const dde_contract_obj = await dde.getContract(dde_contract_1);
    //console.log("contract obj1:", dde_contract_obj);

    assert.equal(a1, true, "match initialized");

    assert.equal(dde_contract_obj.sender, accounts[1], "match sender");
    assert.equal(dde_contract_obj.token, tdai.address, "match token");
    assert.equal(dde_contract_obj.message, "test11", "match message");
    assert.equal(dde_contract_obj.status[0], "1", "match status");
    assert.equal(dde_contract_obj.status[1], "0", "match status");
    assert.equal(dde_contract_obj.quantity[0], "1", "match quantity");
    assert.equal(dde_contract_obj.quantity[1], "1", "match quantity");

    const a2 = await dde.userMarketID(dde_contract_1);
    assert.equal(a2.toString(), "2", "match userMarketID");

    { // accept-offer-1

      { // before
        const a3 = await dde.userBalance(accounts[0], tdai.address);
        const a4 = await dde.userBalance(accounts[1], tdai.address);
        assert.equal(a3.toString(), ether(38.9).toString(), "match user0 tdai balance");
        assert.equal(a4.toString(), ether(148.7).toString(), "match user1 tdai balance");
      }

      await dde.acceptOffer(

        dde_contract_1,
        1, // quantity
        0, // offerlimit
        accounts[2], // fee collector

        { from: accounts[0] }
      );

      const dde_contract_obj1 = await dde.getContract(dde_contract_1);
      assert.equal(dde_contract_obj1.quantity[0], "1", "match quantity");
      assert.equal(dde_contract_obj1.quantity[1], "1", "match quantity");

      dde_contract_2 = await dde.privateOffers(accounts[1],1);
      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj2:", dde_contract_obj2);
      assert.equal(dde_contract_obj2.rfee, 100, "match rfee");

      // user balances reduced by deposit and amount

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(38.9).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(148.7).toString(), "match user1 tdai balance");
    }

    { // accept-offer-2

      { // before
        const a3 = await dde.userBalance(accounts[0], tdai.address);
        const a4 = await dde.userBalance(accounts[1], tdai.address);
        assert.equal(a3.toString(), ether(38.9).toString(), "match user0 tdai balance");
        assert.equal(a4.toString(), ether(148.7).toString(), "match user1 tdai balance");
      }

      await dde.acceptOffer(

        dde_contract_2,
        1, // quantity
        0, // offerlimit
        accounts[2], // fee collector

        { from: accounts[1] }
      );

      const dde_contract_obj1 = await dde.getContract(dde_contract_1);
      assert.equal(dde_contract_obj1.quantity[0], "1", "match quantity");
      assert.equal(dde_contract_obj1.quantity[1], "1", "match quantity");

      dde_contract_2 = await dde.escrows(accounts[1],9);
      const dde_contract_obj2 = await dde.getContract(dde_contract_2);

      //console.log("contract obj2:", dde_contract_obj2);
      assert.equal(dde_contract_obj2.rfee, 100, "match rfee");

      // user balances reduced by deposit and amount

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(37.9).toString(), "match user0 tdai balance"); // -1
      assert.equal(a4.toString(), ether(137.7).toString(), "match user1 tdai balance"); // -10 -1
    }

    { // completeEscrow-1

      await dde.completeEscrow(

        dde_contract_2,
        accounts[1],

        { from: accounts[1] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);
      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(37.9).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(137.7).toString(), "match user1 tdai balance");
    }

    {  // completeEscrow-2

      await dde.completeEscrow(

        dde_contract_2,
        accounts[0],

        { from: accounts[0] }
      );

      const dde_contract_obj2 = await dde.getContract(dde_contract_2);
      //console.log("contract obj:", dde_contract_obj2);

      const a3 = await dde.userBalance(accounts[0], tdai.address);
      const a4 = await dde.userBalance(accounts[1], tdai.address);
      assert.equal(a3.toString(), ether(48.8).toString(), "match user0 tdai balance");
      assert.equal(a4.toString(), ether(138.7).toString(), "match user1 tdai balance");

    }

  });

  it('change-cooldown-1', async () => {

    await dde.changeCooldown(1); // just one sec

  });

  it('changeAffiliate-1', async () => {

    const a1 = await dde.completed(accounts[0], 0);
    const a2 = await dde.completed(accounts[0], 1);
    const a3 = await dde.completed(accounts[0], 2);

    assert.equal(a1.toString(), "16", "match user0 completed0");
    assert.equal(a2.toString(), "1", "match user0 completed1");
    assert.equal(a3.toString(), "1", "match user0 completed2");

    // because completed2 is 1 (due to tests run fast, cooldown) first promote it

    await dde.promoteAffiliate(

      accounts[0],

      { from: accounts[0] }
    );

    await dde.changeAffiliate(

      accounts[0], // user0 is now affiliate for user3

      { from: accounts[3] }
    );

  });

  it('promoteAffiliate-1', async () => {

    await dde.promoteAffiliate(

      accounts[3],

      { from: accounts[0] }
    );

  });

  it('changeAffiliate-2', async () => {

    await dde.changeAffiliate(

      accounts[3],

      { from: accounts[1] }
    );

  });

});
