// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface ERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);    
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IWETH {
    function deposit() external payable;
    function transfer(address to, uint256 value) external returns (bool);
    function withdraw(uint256) external;
}

contract TwoPartyEscrow {
    struct Contract {
        address sender;
        address recipient;
        address token;
        uint amount;
        uint depositSender;
        uint depositRecipient;
        uint quantity;
        uint[3] timelimit;
        uint[2] status;
        string message;
    }

    mapping(address => mapping(address => uint)) public userBalance;

    bytes32[] public markets;
    uint public marketslength;
    mapping(bytes32 => Contract) public contracts;
    mapping(bytes32 => bool) public initialized;
    mapping(bytes32 => uint) public userMarketID;
    mapping(address => bytes32[]) public openOffers;
    mapping(address => bytes32[]) public privateOffers;
    mapping(address => bytes32[]) public escrows;
    mapping(address => string[]) public userdata;
    string[] public publicdata;
    uint lock;
    address WETH;

    constructor(address _WETH) {
        WETH = _WETH;
    }
    
    receive() external payable {
        assert(msg.sender == WETH);
    }

    function deposit(address token, uint amount) public {
        require(lock != 1);
        require(token != WETH);
        lock = 1;
        require(amount > 0);
        ERC20 erc20 = ERC20(token);
        require(erc20.balanceOf(msg.sender) >= amount);
        require(erc20.transferFrom(msg.sender, address(this), amount));
        userBalance[msg.sender][token] += amount;
        lock = 0;
    }

    function depositWETH() public payable {
        require(lock != 1);
        lock = 1;
        uint amount = msg.value;
        IWETH(WETH).deposit{value: amount}();
        require(amount > 0);
        userBalance[msg.sender][WETH] += amount;
        lock = 0;
    }

    function withdraw(address token, uint amount) public {
        require(lock != 1);
        lock = 1;
        require(amount > 0);
        require(userBalance[msg.sender][token] >= amount, "Insufficient balance");
        if(token != WETH) {
            require(ERC20(token).transfer(msg.sender, amount));
        } else {
            IWETH(WETH).withdraw(amount);
            safeTransferETH(msg.sender, amount);
        }
        userBalance[msg.sender][token] -= amount;
        lock = 0;
    }

    function createContract(
        address _sender,
        address _recipient,
        address _token,
        uint256 _amount,
        uint256 _depositSender,
        uint256 _depositRecipient,
        uint256 _quantity,
        uint256 _timelimit,
        uint256 style,
        string memory _message
    ) public returns (bytes32) {        
        require(_quantity > 0, "Quantity must be greater than 0");
        require(_sender == msg.sender || _recipient == msg.sender);
        require(style < 2); //0 allows instant acceptance, 1 only allows for counters
        if(_sender == msg.sender) {
            require(userBalance[msg.sender][_token] >= (_amount + _depositSender) * _quantity, "Insufficient balance");
        } else {
            require(userBalance[msg.sender][_token] >= (_depositRecipient) * _quantity, "Insufficient balance");
        }

        Contract memory newContract;
        bytes32 hash = keccak256(abi.encodePacked(_sender, _recipient, _token, _amount, _depositSender, _depositRecipient, _timelimit, _message));
        require(initialized[hash] == false);
        newContract = Contract({
            sender: _sender,
            recipient: _recipient,
            token: _token,
            amount: _amount,
            depositSender: _depositSender,
            depositRecipient: _depositRecipient,
            quantity: _quantity,
            timelimit: [_timelimit,0,0],
            status: [style,uint(0)],
            message: _message
        });
        if(marketslength == 0) {
            marketslength += 1;
            if(markets.length == 0) {
                markets.push(0x0);
            }
        }        
        if(_sender != address(0) && _recipient != address(0)) {
            if(_sender == msg.sender) {
                newContract.status = [uint(1),uint(0)];
            } else {
                newContract.status = [uint(0),uint(1)];
            }
            privateOffers[_recipient].push(hash);
            privateOffers[_sender].push(hash);
        } else {
            if(markets.length == marketslength) {
                markets.push(0x0);
            }
            markets[marketslength] = hash;
            userMarketID[hash] = marketslength;
            marketslength += 1;            
            openOffers[msg.sender].push(hash);
        }
        contracts[hash] = newContract;
        initialized[hash] = true;
        return hash;
    }
    function acceptOffer(bytes32 hash, uint quantity) public {
        address sender = contracts[hash].sender;
        address recipient = contracts[hash].recipient;
        require(quantity > 0);
        if(sender != address(0) && recipient != address(0)) {
            require(sender == msg.sender || recipient == msg.sender);
            require(quantity == contracts[hash].quantity);
            if(contracts[hash].status[0] > 0 && msg.sender == sender) {
                require(false);
            }
            if(contracts[hash].status[1] > 0 && msg.sender == recipient) {
                require(false);
            }
            contracts[hash].status = [uint(1),uint(1)];
        }
        Contract memory newContract = contracts[hash];
        uint style = 0;
        if(sender == address(0) || recipient == address(0)) {
            require(userMarketID[hash] != 0,"This offer is no longer available.");
            require(quantity <= contracts[hash].quantity);
            style = newContract.status[0];
            if(style == 0) {
                contracts[hash].quantity -= quantity;
                if(contracts[hash].quantity == 0) {
                    uint marketId = userMarketID[hash];
                    require(markets[marketId] == hash);
                    marketslength -= 1;
                    userMarketID[markets[marketslength]] = marketId;
                    userMarketID[markets[marketId]] = 0;
                    markets[marketId] = markets[marketslength];
                    markets[marketslength] = 0;
                }
                newContract.status = [uint(1),uint(1)];
                if(sender == address(0)) {
                    sender = msg.sender;
                } else {
                    recipient = msg.sender;
                }
            } else {                
                if(sender == address(0)) {
                    newContract.status = [uint(1),uint(0)];
                    sender = msg.sender;
                } else {
                    newContract.status = [uint(0),uint(1)];
                    recipient = msg.sender;
                }
            }
            require(sender != recipient);
        }
        newContract.quantity = quantity;
        newContract.sender = sender;
        newContract.recipient = recipient;
        newContract.amount *= quantity;
        newContract.depositSender *= quantity;
        newContract.depositRecipient *= quantity;
        if(style == 0) {
            newContract.timelimit[0] += block.timestamp;
            require(userBalance[recipient][newContract.token] >= (newContract.depositRecipient), "Insufficient recipient balance");
            userBalance[recipient][newContract.token] -= (newContract.depositRecipient);
            require(userBalance[sender][newContract.token] >= (newContract.amount + newContract.depositSender), "Insufficient sender balance");
            userBalance[sender][newContract.token] -= (newContract.amount + newContract.depositSender);
            bytes32 acceptedhash = keccak256(abi.encodePacked(sender, recipient, newContract.token, newContract.amount, newContract.depositSender, newContract.depositRecipient, newContract.timelimit[0], newContract.message, uint(1)));
            require(initialized[acceptedhash] == false);
            initialized[acceptedhash] = true;
            contracts[acceptedhash] = newContract;
            escrows[sender].push(acceptedhash);
            escrows[recipient].push(acceptedhash);
        } else {
            bytes32 counterhash = keccak256(abi.encodePacked(sender, recipient, newContract.token, newContract.amount, newContract.depositSender, newContract.depositRecipient, newContract.timelimit[0], newContract.message, block.timestamp));
            require(initialized[counterhash] == false);
            initialized[counterhash] = true;
            contracts[counterhash] = newContract;
            privateOffers[sender].push(counterhash);
            privateOffers[recipient].push(counterhash);
        }
    }
    function requestExtension(bytes32 hash, uint timelimit) public {
        require(block.timestamp < contracts[hash].timelimit[0], "Escrow has expired. The contracts funds have been destroyed.");
        require(contracts[hash].status[0] < 4 && contracts[hash].status[1] < 4, "The deal has already completed");
        require(timelimit > contracts[hash].timelimit[0]);
        require(contracts[hash].sender == msg.sender || contracts[hash].recipient == msg.sender);
        if(msg.sender == contracts[hash].sender) {
            contracts[hash].timelimit[1] = timelimit;
        } else {
            contracts[hash].timelimit[2] = timelimit;
        }
        if(contracts[hash].timelimit[1] == contracts[hash].timelimit[2]) {
            contracts[hash].timelimit[0] = timelimit;
        }
    }
    function cancelEscrow(bytes32 hash) public {
        require(block.timestamp < contracts[hash].timelimit[0], "Escrow has expired. The contracts funds have been destroyed.");
        require(contracts[hash].status[0] < 4 && contracts[hash].status[1] < 4, "The deal has already completed");
        address sender = contracts[hash].sender;
        address recipient = contracts[hash].recipient; 
        require(sender == msg.sender || recipient == msg.sender);
        if(msg.sender == sender) {
            require(contracts[hash].status[1] != 2);
            contracts[hash].status[1] += 1;
        } else {
            require(contracts[hash].status[1] != 3);
            contracts[hash].status[1] += 2;
        }
        if(contracts[hash].status[1] == 4) {
            userBalance[recipient][contracts[hash].token] += (contracts[hash].depositRecipient);
            userBalance[sender][contracts[hash].token] += (contracts[hash].amount + contracts[hash].depositSender);
        }
    }
    function completeEscrow(bytes32 hash) public {
        require(block.timestamp < contracts[hash].timelimit[0], "Escrow has expired. The contracts funds have been destroyed.");
        require(contracts[hash].status[0] < 4 && contracts[hash].status[1] < 4, "The deal has already completed");
        address sender = contracts[hash].sender;
        address recipient = contracts[hash].recipient; 
        require(sender == msg.sender || recipient == msg.sender);
        if(msg.sender == sender) {
            require(contracts[hash].status[0] != 2);
            contracts[hash].status[0] += 1;
        } else {
            require(contracts[hash].status[0] != 3);
            contracts[hash].status[0] += 2;
        }
        if(contracts[hash].status[0] == 4) {
            userBalance[recipient][contracts[hash].token] += (contracts[hash].amount + contracts[hash].depositRecipient);
            userBalance[sender][contracts[hash].token] += (contracts[hash].depositSender);
        }
    }
    function cancelPrivateOffer(bytes32 hash) public {
        require(contracts[hash].sender == msg.sender || contracts[hash].recipient == msg.sender);
        bool valid;
        if(contracts[hash].status[0] == 1 && contracts[hash].status[1] == 0) {
            valid = true;
        }
        if(contracts[hash].status[0] == 0 && contracts[hash].status[1] == 1) {
            valid = true;
        }
        require(valid);
        contracts[hash].status = [uint(1),uint(1)];
    }
    function removeMarketOffer(bytes32 hash) public {
        uint marketId = userMarketID[hash];
        require(contracts[markets[marketId]].sender == address(0) || contracts[markets[marketId]].recipient == address(0));
        require(contracts[markets[marketId]].sender == msg.sender || contracts[markets[marketId]].recipient == msg.sender);
        marketslength -= 1;
        userMarketID[markets[marketslength]] = marketId;
        userMarketID[markets[marketId]] = 0;
        markets[marketId] = markets[marketslength];
        markets[marketslength] = 0;
    }
    function updateQuantity(bytes32 hash, uint quantity) public {
        uint marketId = userMarketID[hash];
        require(quantity != 0);
        require(contracts[markets[marketId]].sender == address(0) || contracts[markets[marketId]].recipient == address(0));
        require(contracts[markets[marketId]].sender == msg.sender || contracts[markets[marketId]].recipient == msg.sender);
        contracts[markets[marketId]].quantity = quantity;
    }
    function getMarketOffer(uint marketId) public view returns (Contract memory) {
        return contracts[markets[marketId]];
    }
    function getContract(bytes32 hash) public view returns (Contract memory) {
        return contracts[hash];
    }
    function safeTransferETH(address to, uint value) internal {
        (bool success,) = to.call{value:value}(new bytes(0));
        require(success, 'Transfer failed');
    }
    function adddata(string memory data) public {
        publicdata.push(data);
    }
    function adduserdata(string memory data) public {
        userdata[msg.sender].push(data);
    }
    function getArrayLength(address user, uint arrayId) public view returns (uint) {
        if(arrayId == 0) {
            return openOffers[user].length;
        }
        if(arrayId == 1) {
            return privateOffers[user].length;
        }
        if(arrayId == 2) {
            return escrows[user].length;
        }
        if(arrayId == 3) {
            return userdata[user].length;
        } else {
            return publicdata.length;
        }
    }
}