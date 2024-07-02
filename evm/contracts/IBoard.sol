// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface Board {
    struct Contract {
        address sender;
        address recipient;
        address token;
        address referred;
        uint amount;
        uint depositSender;
        uint depositRecipient;
        uint[2] quantity;
        uint rfee;
        uint[3] timelimit;
            // 0 contract (same)
            // 1 sender
            // 2 recepient
        uint8[2] status;
            // 0 sender
            // 1 recepient
        string message;
    }

    function getContract(bytes32 hash1) external view returns (Contract memory);
    function setContract(bytes32 hash1, Contract memory c) external returns (bool);
    function reduceQuantity0(bytes32 hash1, uint quantity) external returns (bool);
    function userMarketID(bytes32 hash1) external view returns (uint);
}
