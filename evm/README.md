# Audit
The purpose of this audit was to indicate the correctness of the contract’s operation, check the quality of the code and general help in further development.

This audit covered the solidity code at the commit [ba8a4ab10149b6bbf3f11566e7172f44d6d4b7a1](https://github.com/BitHalo/Ethalo/tree/ba8a4ab10149b6bbf3f11566e7172f44d6d4b7a1). No logic or security flaws have been found.

##### Disclosure
This audit was conducted on 2024-03-09 on code retrieved from the client on the days prior.

### Summary
Overall the auditor found the smart contract well written and no vulnerabilities were found. No logic or security flaws have been found. There are given recommendations to improve efectiveness of routines, logic flows and operations in the smart contracts, add migration interfaces for possible further smart contract upgrades. It is opinion of the auditor that the contract is safe from exploits.

### Major Concern

#### Missed way to set custodian for `all contracts of the user`
There is a check for custodians like: `isAuthorized[user][msg.sender][bytes32(0)]` which would means `any contract of the user`.
But there is no path to setup it for `any contract of the user` in `authorizeContract` because there is a check:
```
require(contracts[hash].sender == msg.sender || contracts[hash].recipient == msg.sender);
```

### Low Severity

#### `timelimits` validity is not checked
The validity of `timelimits` is completely dependent on frontend implementation. If zeros or too small then dde-contract is immediately outdated. As nature of solidity contracts allows to connect any 3rd-party frontend this case could be considered and minimum validation of `timelimits` to be done in the contract codes.

#### `requestExtension` call depends completely on block.timestamp
There is one business-logic-important method `requestExtension` has the critical dependency to the `block.timestamp`. Such logic can be a subject of the case when ethereum mempool is over-crowed and transactions are stuck (up to 2 days and if not mined they removed from the mempool). There is possibility to loose the agreed extension even if consensus is reached by all parties of the business. 

It can be considered the second/alternative way of executing `requestExtension` by getting data from `last_resort_proof_contract` which can be an oracle or bridge to get the proof of the dde-contract extension from the other chain. Then the extension can be reached even after passing the deadline due to technical issues.

Example: `ETH` chain is over-crowded, so requestExtension data is published on `BAY` chain, after the mempool relaxed (but deadline is passed), the `ETH requestExtension` is called and picked up the data from bridge contract to make the extension happen.

### Specific concerns

#### Default affiliate fee collector
By default, when there is no affiliate set explicit, it is seen the fees are just burn. It could be reconsidered to have default affiliate (could be a minter by default).

### Known attacks in context of the smart contracts
#### Integer Overflow and Underflow
It was a general recommendation for the usage of `SafeMath` prior to the release of Solidity 0.8. Because the contract relys on the ^0.8 version it is generally not needed (may note the exception of the usage of `**` operation which is not relevant to the context and the logic of the audited contract).

#### Timestamp Dependence
The `block.timestamp` is widely used in the contract for hashing and timelimits definitions. Though because the usage is based on the timelimits set for the contracts checkpoints in time which are generally working with long durations the attacks based on the block timestamps manipulations are not relevant to exploit the logics. 
TODO: if there checks needed on contract creations to prevent the frontend errors and the time maniputation?
TODO: if some preventions to avoid the mempool long processing times.

#### Reetrancy Attack
There are no space for reetrancy attack approach. The deployment is safe as no the other contracts are called except the erc20 contracts which are protected by `lock`.

### Recommendations

#### Documentation
There is general recommendation to have better documentation for all contract methods.

#### Using latest compiler
The contract depends on versions `^0.8.0`. It is always recommended to explicitly set the latest version of the solidy compiler (latest `0.8.24` at the time of the audit) to prevent the contract compilation and deployment to the production using the previous version of the compiler.

#### Contract deployment size
Due to its size, the contract deployment completely depends on the solc optimizer covering the "compression" from 44493 to the bytesize of 23432. (a limit introduced in the [EIP-170](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-170.md) update placed the bytesize contract limit to 24576). It is recommended not to heavily rely to the bytesize optimizer as its behavior and effectiveness is the subject of the changes in the future releases of solc. It can be explored the way of splitting the contract to the libaries to be deployed separately.

#### ERC20 EIP-2612 extension
There is recommendation to use `EIP-2612` extension to simplify the user contract comminication to avoid ERC-20 `approve` required by `transferFrom`. Instead of `approve` which requires the `msg.sender` that implys only user to set allowance, the EIP-2612 replaces this to signatures which can obsolete the extra call to the token contract as a need of setting allowance by user. It is relevant for new tokens deployed after 2020 (setup of EIP), reference [ERC20Permit](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20#ERC20Permit) in OpenZeppelin.

### Test Suite Results
The project had no test coverage, though I recommend to always have the tests simulating the complete lifecicle of the contract involving all operations and also to have written tests cover both negative (tests when functions should fail) and positive (tests when functions should pass) cases together with the replays attempts of the every contract api endpoint.

For this contract the test suite is designed and written using Truffle Suite:

```
Compiling your contracts...
===========================
> Compiling ./contracts/DDE.sol
> Compiling ./contracts/ERC20.sol
> Compiling ./contracts/IERC20.sol
> Compiling ./contracts/TDAI.sol
> Compiling ./contracts/WETH.sol
> Artifacts written to /tmp/test--18928-pjEiu1C2p9r4
> Compiled successfully using:
   - solc: 0.8.24+commit.e11b9ed9.Emscripten.clang
DDE dsize: 23432

  Contract: DDE
    ✔ pre-check-1 tdai balance 100M
    ✔ pre-check-2 defaults
    ✔ change-minter-1 (51ms)
    ✔ change-minter-2 (61ms)
    ✔ change-threshold-1 (55ms)
    ✔ deposit-1 (1020ms)
    ✔ deposit-2 (331ms)
    ✔ deposit-3 (607ms)
    ✔ withdraw-1 (104ms)
    ✔ withdraw-2 (104ms)
    ✔ withdraw-3 (101ms)
    ✔ createContract-1 (235ms)
    ✔ acceptOffer-1 (320ms)
    ✔ completeEscrow-1 (112ms)
    ✔ completeEscrow-2 (136ms)
    ✔ dde-one-go-1 (756ms)
    ✔ dde-one-go-2-cancel-1 (764ms)
    ✔ dde-one-go-2-cancel-2 (796ms)
    ✔ dde-one-go-with-remove-1 (1077ms)
    ✔ change-fee-1 (42ms)
    ✔ dde-one-go-with-fee-1 (745ms)
    ✔ collected-fee-1
    ✔ dde-one-go-with-update-quantity-1 (834ms)
    ✔ collected-fee-2
    ✔ dde-one-go-with-expire-1 (820ms)
    ✔ dde-one-go-with-tags-and-extension-1 (1275ms)
    ✔ dde-one-go-private-cancel-1 (715ms)
    ✔ dde-one-go-private-1 (1190ms)
    ✔ change-cooldown-1
    ✔ changeAffiliate-1 (93ms)
    ✔ promoteAffiliate-1
    ✔ changeAffiliate-2


  32 passing (13s)

```

Truffle test suite package report provided as an archive. (`Ethalo-test-suite.tgz`)

### Code Coverage Results

Using Truffle Suite, the code coverage was executed to see the codes covered and not-covered by test suite.

```
Code coverage of DDE.sol is 80.1%
```

Code coverage report provided as an archive. (`Ethalo-code-coverage.tgz`)

