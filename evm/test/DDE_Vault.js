// TwoPartyEscrow test suite

const DDE_Vault = artifacts.require("DDE_Vault");
const WETH = artifacts.require("WETH9");
const TDAI = artifacts.require("TDAI");

require('chai')
  .use(require('chai-as-promised'))
  .should()

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
  dde = await DDE_Vault.deployed(weth.address);
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

});
