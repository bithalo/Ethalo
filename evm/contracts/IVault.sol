// SPDX-License-Identifier: Jelurida Public License
pragma solidity ^0.8.0;

interface Vault {
    function userBalance(address user, address token) external returns (uint);
    function escrowOut(address user, address token, uint amount) external returns (bool);
    function escrowIn(address user, address token, uint amount) external returns (bool);
}
