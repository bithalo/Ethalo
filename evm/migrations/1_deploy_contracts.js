
const WETH = artifacts.require("WETH9");
const TDAI = artifacts.require("TDAI");
const DDE = artifacts.require("TwoPartyEscrow");
const DDE_Board = artifacts.require("DDE_Board");
const DDE_Vault = artifacts.require("DDE_Vault");

module.exports = async function(deployer) {
  await deployer.deploy(WETH);
  await deployer.deploy(TDAI);
  //await deployer.deploy(TDAI, 33);
  await deployer.deploy(DDE_Board);
  await deployer.deploy(DDE_Vault, WETH.address);
  await deployer.deploy(DDE, DDE_Vault.address, DDE_Board.address);

  var dsize1 = (DDE.deployedBytecode.length / 2) - 1 ;
  var dsize2 = (DDE_Board.deployedBytecode.length / 2) - 1 ;
  var dsize3 = (DDE_Vault.deployedBytecode.length / 2) - 1 ;
  console.log("DDE dsize:", dsize1);
  console.log("Board dsize:", dsize2);
  console.log("Vault dsize:", dsize3);
};
