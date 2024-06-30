// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./ERC20.sol";

contract TDAI is STDERC20 {
    constructor() STDERC20("TestnetDAI", "DAI") {
        _mint(msg.sender, 100000000 * 10 ** uint(decimals));
    }
}
