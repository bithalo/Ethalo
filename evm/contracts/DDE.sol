// SPDX-License-Identifier: Jelurida Public License
pragma solidity ^0.8.0;

import "./IBoard.sol";
import "./IVault.sol";

contract TwoPartyEscrow {

    uint8 constant C_Status_None = 0;
    uint8 constant C_Status_Accepted = 1;
    uint8 constant C_Status_Completed = 4;
    uint8 constant C_Status_Cancelled = 4;
    uint8 constant C_Status_Expired = 5;

    uint constant C_Year_Secs = 31556952;
    uint constant C_3Days_Secs = 259200;
    uint constant C_Num_Promote = 10;

    address public board;
    address public vault;
    mapping(bytes32 => Board.Contract) public contracts;
    mapping(bytes32 => bool) public initialized;
    mapping(address => bytes32[]) public privateOffers;
    mapping(address => bytes32[]) public escrows;

    mapping(address => uint[3]) public completed;
    mapping(address => address) public referral;
    mapping(address => uint) public customFee; //Users may want to give special offers
    mapping(address => uint) public minimumFeeThreshold;
    mapping(address => mapping(address => bool)) public isCustodian; //Users can authorize a cosignee for selected contracts
    mapping(address => mapping(address => mapping(bytes32 => bool))) public isAuthorized;
    mapping(address => address[]) public custodianList;
    mapping(address => address[]) public custodianList2;
    mapping(address => uint) public cooldown;
    uint public affiliateFee;
    address public minter;

    constructor(address _vault, address _board) {
        board = _board;
        vault = _vault;
        minter = msg.sender;
        cooldown[address(0)] = C_3Days_Secs;
    }

    receive() external payable {
        assert(false);
    }

    //If no affiliate is set, the fee is burned with up to .1% added to encourage using the system
    function changeAffiliate(address affiliate) public {
        require(completed[affiliate][2] >= C_Num_Promote); //Active users of the markets are the ones to promote it
        require(affiliate != address(0));
        referral[msg.sender] = affiliate;
    }

    // admin/minter api

    modifier onlyMinter() {
        require(msg.sender == minter);
        _;
    }

    function promoteAffiliate(address affiliate) onlyMinter public {
        require(affiliate != address(0));
        if (completed[affiliate][2] < C_Num_Promote) {
            completed[affiliate][2] = C_Num_Promote;
        }
    }

    function changeMinter(address new_minter) onlyMinter public {
        minter = new_minter;
    }

    function changeFee(uint newfee) onlyMinter public {
        require(newfee >= 0 && newfee <= 100); //1% maximum
        affiliateFee = newfee;
    }

    function changeThreshold(address token, uint newfee) onlyMinter public {
        minimumFeeThreshold[token] = newfee;
    }

    function changeCooldown(uint newtime) onlyMinter public {
        cooldown[address(0)] = newtime;
    }

    // custodians api

    function authorizeCustodian(address custodian, bool status) public {
        if (isCustodian[msg.sender][custodian] == false && status) {
            custodianList[msg.sender].push(custodian);
            custodianList2[custodian].push(msg.sender);
        }
        isCustodian[msg.sender][custodian] = status;
    }

    function authorizeContract(address custodian, bytes32 hash, bool status) public {
        isAuthorized[msg.sender][custodian][hash] = status;
    }

    function changeCustomFee(uint newfee) public {
        require(newfee >= affiliateFee && newfee <= 5000);
        customFee[msg.sender] = newfee;
    }

    function acceptOffer(bytes32 hash, uint quantity, uint offerlimit, address affiliate) public {
        if (affiliate != address(0) && completed[affiliate][2] >= C_Num_Promote) {
            if (referral[msg.sender] == address(0)) {
                referral[msg.sender] = affiliate;
            }
        } else {
            if (referral[msg.sender] != address(0)) {
                affiliate = referral[msg.sender];
            }
        }
        address sender = Board(board).getContract(hash).sender;
        address recipient = Board(board).getContract(hash).recipient;
        bool finalOffer = (sender != address(0) && recipient != address(0));
        require(quantity > 0);
        if (Board(board).getContract(hash).timelimit[1] != 0) {
            require(block.timestamp < Board(board).getContract(hash).timelimit[1]); //Offer has expired
        }
        if (finalOffer) {
            require(sender == msg.sender || recipient == msg.sender);
            require(quantity == Board(board).getContract(hash).quantity[0]);
            if (Board(board).getContract(hash).status[0] > C_Status_None && msg.sender == sender) {
                require(false);
            }
            if (Board(board).getContract(hash).status[1] > C_Status_None && msg.sender == recipient) {
                require(false);
            }
            //TODO
            // contracts_board[hash].status = [C_Status_Accepted,C_Status_Accepted];
            // if (contracts_board[hash].rfee == 0) {
            //     contracts_board[hash].rfee = affiliateFee;
            // }
        }
        Board.Contract memory newContract = Board(board).getContract(hash);
        uint style = 0;
        if (!finalOffer) { //It's an open offer on the markets
            require(Board(board).userMarketID(hash) != 0); //Offer is no longer available
            require(quantity <= Board(board).getContract(hash).quantity[0] && 
                    quantity <= Board(board).getContract(hash).quantity[1]);
            newContract.amount *= quantity;
            newContract.depositSender *= quantity;
            newContract.depositRecipient *= quantity;
            style = newContract.status[0] % 2;
            newContract.referred = affiliate;
            if (newContract.rfee == 0) {
                newContract.rfee = affiliateFee;
                if (sender == address(0)) {
                    if (customFee[recipient] > affiliateFee) {
                        newContract.rfee = customFee[recipient];
                    }
                }
            }
            if (style == 0) {
                Board(board).reduceQuantity0(hash, quantity);
                newContract.status = [C_Status_Accepted,C_Status_Accepted]; // both accepted (instant)
            } else {                
                if (sender == address(0)) {
                    newContract.status = [C_Status_Accepted,C_Status_None]; // counter offer: sender accepted
                } else {
                    newContract.status = [C_Status_None,C_Status_Accepted]; // counter offer: recipient accepted
                }
            }
            if (sender == address(0)) {
                sender = msg.sender;
            } else {
                recipient = msg.sender;
            }
            require(sender != recipient);
        }
        newContract.quantity[0] = quantity;
        newContract.sender = sender;
        newContract.recipient = recipient;
        if (style == 0) {
            newContract.timelimit[0] += block.timestamp;
            Vault(vault).escrowIn(recipient, newContract.token, newContract.depositRecipient);
            Vault(vault).escrowIn(sender, newContract.token, newContract.amount + newContract.depositSender);
            bytes32 acceptedhash = keccak256(abi.encodePacked(
                sender, 
                recipient, 
                newContract.token, 
                newContract.amount, 
                newContract.depositSender, 
                newContract.depositRecipient, 
                newContract.timelimit[0], 
                newContract.message
            ));
            require(initialized[acceptedhash] == false);
            initialized[acceptedhash] = true;
            newContract.timelimit[1] = 0;
            newContract.timelimit[2] = 0;
            contracts[acceptedhash] = newContract;
            escrows[sender].push(acceptedhash);
            escrows[recipient].push(acceptedhash);
        } else {
            bytes32 counterhash = keccak256(abi.encodePacked(
                sender, 
                recipient, 
                newContract.token, 
                newContract.amount, 
                newContract.depositSender, 
                newContract.depositRecipient, 
                newContract.timelimit[0], 
                newContract.message, 
                block.timestamp
            ));
            require(initialized[counterhash] == false);
            initialized[counterhash] = true;
            newContract.timelimit[1] = offerlimit;
            newContract.timelimit[2] = 0;
            contracts[counterhash] = newContract;
            privateOffers[sender].push(counterhash);
            privateOffers[recipient].push(counterhash);
        }
    }

    modifier onlyActiveContract(bytes32 hash1) {
        require(contracts[hash1].status[0] < C_Status_Completed && contracts[hash1].status[1] < C_Status_Cancelled); // the deal no yet completed
        require(contracts[hash1].status[0] > C_Status_None && contracts[hash1].status[1] > C_Status_None); // can only apply to active one
        _;
    }

    modifier allowCustodianOrParticipant(bytes32 hash1, address user1) {
        if (msg.sender != user1) {
            require(isCustodian[user1][msg.sender]);            // only custodian of user1
            require(isAuthorized[user1][msg.sender][hash1]      // custodian for specific contract
                || isAuthorized[user1][msg.sender][bytes32(0)]  // custodian for all contracts of the user
                || isAuthorized[user1][address(0)][bytes32(0)]  // custodian for all contracts
            );
        }
        require(contracts[hash1].sender == user1 || contracts[hash1].recipient == user1);
        _;
    }

    modifier notExpiredContract(bytes32 hash1) {
        require(block.timestamp < contracts[hash1].timelimit[0]);
        _;
    }

    function requestExtension(bytes32 hash, address user, uint timelimit) onlyActiveContract(hash) notExpiredContract(hash) allowCustodianOrParticipant(hash, user) public {
        require(timelimit > contracts[hash].timelimit[0]);
        if (user == contracts[hash].sender) {
            contracts[hash].timelimit[1] = timelimit;
        } else {
            contracts[hash].timelimit[2] = timelimit;
        }
        if (contracts[hash].timelimit[1] == contracts[hash].timelimit[2]) {
            contracts[hash].timelimit[0] = timelimit;
        }
    }

    function cancelEscrow(bytes32 hash, address user) onlyActiveContract(hash) notExpiredContract(hash) allowCustodianOrParticipant(hash, user) public {
        if (user == contracts[hash].sender) {
            require(contracts[hash].status[1] != 2); // recipient 1,3
            contracts[hash].status[1] += 1;          // recipient 2,4
        } else {
            require(contracts[hash].status[1] != 3); // recipient 1,2
            contracts[hash].status[1] += 2;          // recipient 3,4
        }
        if (contracts[hash].status[1] == C_Status_Cancelled) { // recipient has done
            Vault(vault).escrowOut(contracts[hash].recipient, contracts[hash].token, contracts[hash].depositRecipient);
            Vault(vault).escrowOut(contracts[hash].sender, contracts[hash].token, contracts[hash].amount + contracts[hash].depositSender);
        }
    }

    function completeEscrow(bytes32 hash, address user) onlyActiveContract(hash) notExpiredContract(hash) allowCustodianOrParticipant(hash, user) public {
        if (user == contracts[hash].sender) {
            require(contracts[hash].status[0] != 2); // sender 1,3
            contracts[hash].status[0] += 1;          // sender 2,4
        } else {
            require(contracts[hash].status[0] != 3); // sender 1,2
            contracts[hash].status[0] += 2;          // sender 3,4
        }
        if (contracts[hash].status[0] == C_Status_Completed) { // sender has done
            uint total = 0;
            uint afee = contracts[hash].rfee;
            if (afee != 0) {
                address theReferred = contracts[hash].referred;
                if (theReferred == address(0)) {
                    theReferred = referral[contracts[hash].sender];
                }
                if (theReferred != address(0)) {
                    total = ((contracts[hash].amount) * afee) / 10000;
                    Vault(vault).escrowOut(theReferred, contracts[hash].token, total);
                } else {
                    if (afee > 100) {
                        afee = 100;
                    }
                    if (afee < 90) {
                        total = ((contracts[hash].amount) * (afee + 10)) / 10000;
                    } else {
                        total = ((contracts[hash].amount) * 100) / 10000;
                    }
                    Vault(vault).escrowOut(address(0), contracts[hash].token, total);
                }
            }
            Vault(vault).escrowOut(contracts[hash].recipient, contracts[hash].token, (contracts[hash].amount - total) + contracts[hash].depositRecipient);
            Vault(vault).escrowOut(contracts[hash].sender, contracts[hash].token, contracts[hash].depositSender);
            if (total >= minimumFeeThreshold[contracts[hash].token] && minimumFeeThreshold[contracts[hash].token] != 0) {
                if (cooldown[contracts[hash].sender] < block.timestamp) {
                    cooldown[contracts[hash].sender] = block.timestamp + cooldown[address(0)];
                    completed[contracts[hash].sender][2] += 1;
                }
                if (cooldown[contracts[hash].recipient] < block.timestamp) {
                    cooldown[contracts[hash].recipient] = block.timestamp + cooldown[address(0)];
                    completed[contracts[hash].recipient][2] += 1;
                }
            }
        }
        completed[contracts[hash].sender][0] += 1;
        completed[contracts[hash].recipient][0] += 1;
    }

    function expireEscrow(bytes32 hash, address user) onlyActiveContract(hash) allowCustodianOrParticipant(hash, user) public { //Useful for a reputation system
        require(block.timestamp > contracts[hash].timelimit[0]);
        completed[contracts[hash].sender][1] += 1;
        completed[contracts[hash].recipient][1] += 1;
        contracts[hash].status = [C_Status_Expired, C_Status_Expired];
    }

    function cancelPrivateOffer(bytes32 hash, address user) allowCustodianOrParticipant(hash, user) public {
        bool valid;
        if (contracts[hash].status[0] == C_Status_Accepted && contracts[hash].status[1] == C_Status_None) {
            valid = true;
        }
        if (contracts[hash].status[0] == C_Status_None && contracts[hash].status[1] == C_Status_Accepted) {
            valid = true;
        }
        require(valid);
        contracts[hash].status = [C_Status_Completed, C_Status_Cancelled];
    }

    function changeReferralFee(bytes32 hash, uint newfee) public {
        require(contracts[hash].sender == address(0) && contracts[hash].recipient == msg.sender);
        require(newfee >= affiliateFee && newfee <= 5000);
        contracts[hash].rfee = newfee;
    }

    function getCompleted(address user) public view returns (uint[3] memory){
        return completed[user];
    }

    function getBoardContract(bytes32 hash) public view returns (Board.Contract memory) {
        return Board(board).getContract(hash);
    }

    function getContract(bytes32 hash) public view returns (Board.Contract memory) {
        return contracts[hash];
    }

    function getArrayLength(address user, uint arrayId) public view returns (uint) {
        if (arrayId == 1) {
            return privateOffers[user].length;
        }
        if (arrayId == 2) {
            return escrows[user].length;
        }
        if (arrayId == 4) {
            return custodianList[user].length;
        } 
        if (arrayId == 5) {
            return custodianList2[user].length;
        }
        return 0;
    }
}