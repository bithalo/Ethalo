
const WETH = artifacts.require("WETH9");
const TDAI = artifacts.require("TDAI");
const DDE = artifacts.require("TwoPartyEscrow");

module.exports = async function(deployer) {
  await deployer.deploy(WETH);
  await deployer.deploy(TDAI);
  await deployer.deploy(DDE, WETH.address);

  var dsize1 = (DDE.deployedBytecode.length / 2) - 1 ;
  console.log("DDE dsize:", dsize1);
};
