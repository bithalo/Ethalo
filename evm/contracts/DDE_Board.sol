// SPDX-License-Identifier: Jelurida Public License
pragma solidity ^0.8.0;

import "./IBoard.sol";

contract DDE_Board is Board {

    uint8 constant C_Type_Instant_and_Counters = 0;
    uint8 constant C_Type_NoInstant_and_Counters = 1;
    uint8 constant C_Type_Instant_and_NoCounters = 2;
    uint8 constant C_Type_NoInstant_and_NoCounters = 3;
    uint8 constant C_Type_Private = 4;
    uint8 constant C_Types = 5;

    uint constant C_Year_Secs = 31556952;

    mapping(bytes32 => Board.Contract) public board;

    bytes32[] public markets;
    uint public marketslength;
    mapping(bytes32 => uint) public userMarketID;
    mapping(bytes32 => bool) public initialized;

    mapping(address => bytes32[]) public openOffers;
    mapping(address => bytes32[]) public privateOffers;

    // fees
    mapping(address => uint) public customFee; //Users may want to give special offers
    uint public affiliateFee;

    // tags
    mapping(bytes32 => string[]) public tagdata;
    mapping(bytes32 => uint[]) public tagposition;
    mapping(string => bytes32[]) public hashtag; //References for searching
    mapping(string => uint) public taglength;

    mapping(string => uint[]) public openslot;
    mapping(string => uint) public openslotlength;

    // datas
    mapping(address => string[]) public userdata;
    string[] public publicdata;

    address public minter;

    constructor() {
        minter = msg.sender;
    }

    function createContract(
        address _sender,
        address[2] memory _recipient,
        address _token,
        uint256 _amount,
        uint256 _depositSender,
        uint256 _depositRecipient,
        uint256[2] memory _quantity,
        uint256[2] memory _timelimit,
        uint8 style,
        string memory _message,
        string[] memory _hashtags //Only use for chains that can handle the data cost or use short common word references
    ) public returns (bytes32) {
        require(_quantity[0] > 0 && _quantity[1] > 0);
        require(_sender == msg.sender || _recipient[0] == msg.sender);
        require(style < C_Types);
        if (_sender == msg.sender) {
            if (style == C_Type_Instant_and_Counters || 
                style == C_Type_Instant_and_NoCounters || 
                style == C_Type_Private) {
                //require(Vault(vault).userBalance(msg.sender,_token) >= (_amount + _depositSender) * _quantity[0]);
            } else {
                //require(Vault(vault).userBalance(msg.sender,_token) >= (_amount + _depositSender));
            }
        } else {
            if (style == C_Type_Instant_and_Counters || 
                style == C_Type_Instant_and_NoCounters || 
                style == C_Type_Private) {
                //require(Vault(vault).userBalance(msg.sender,_token) >= (_depositRecipient) * _quantity[0]);
            } else {
                //require(Vault(vault).userBalance(msg.sender,_token) >= (_depositRecipient));
            }
        }
        Board.Contract memory newContract;
        bytes32 hash = keccak256(abi.encodePacked(
            _sender, 
            _recipient[0], 
            _token, 
            _amount, 
            _depositSender, 
            _depositRecipient, 
            _timelimit, 
            _message, 
            block.timestamp
        ));
        require(initialized[hash] == false); // prevent same contract in same block more then once
        newContract = Board.Contract({
            sender: _sender,
            recipient: _recipient[0],
            token: _token,
            referred: address(0),
            amount: _amount,
            depositSender: _depositSender,
            depositRecipient: _depositRecipient,
            quantity: _quantity,
            rfee: uint(0),
            timelimit: [_timelimit[0],_timelimit[1],block.timestamp],
            status: [style,uint8(0)],
            message: _message
        });
        if (marketslength == 0) {
            marketslength += 1;
            if (markets.length == 0) {
                markets.push(0x0);
            }
        }        
        if (_sender != address(0) && _recipient[0] != address(0)) {
            if (_sender == msg.sender) {
                if (_recipient[1] != address(0)) {
                    newContract.referred = _recipient[1];
                    newContract.rfee = affiliateFee;
                    if (style == 4 && customFee[_recipient[0]] > affiliateFee) {
                        newContract.rfee = customFee[_recipient[0]];
                    }
                }
                newContract.status = [uint8(1),uint8(0)];
            } else {
                newContract.status = [uint8(0),uint8(1)];
            }
            privateOffers[_recipient[0]].push(hash);
            privateOffers[_sender].push(hash);
        } else {
            if (markets.length == marketslength) {
                markets.push(0x0);
            }
            markets[marketslength] = hash;
            userMarketID[hash] = marketslength;
            marketslength += 1;
            openOffers[msg.sender].push(hash);
        }
        if (_hashtags.length > 0) {
            require(_hashtags.length < 11);
            require(_sender == address(0) || _recipient[0] == address(0));
            uint x = 0;
            string memory mytag;            
            while(x < _hashtags.length) {
                mytag = _hashtags[x];
                require(bytes(mytag).length <= 32);
                if (openslotlength[mytag] > 0) {
                    openslotlength[mytag] -= 1;
                    tagposition[hash].push(openslot[mytag][openslotlength[mytag]]);
                    hashtag[mytag][openslot[mytag][openslotlength[mytag]]] = hash;
                } else {
                    tagposition[hash].push(taglength[mytag]);
                    taglength[mytag] += 1;
                    hashtag[mytag].push(hash);
                }
                x += 1;
            }
            tagdata[hash] = _hashtags;
        }
        board[hash] = newContract;
        initialized[hash] = true;
        return hash;
    }

    function getContract(bytes32 hash1) public view returns (Contract memory) {
        return board[hash1];
    }
    function setContract(bytes32 hash1, Contract memory c) external returns (bool) {
        board[hash1] = c;
        return true;
    }

    function reduceQuantity0(bytes32 hash1, uint quantity) external returns (bool) {
        board[hash1].quantity[0] -= quantity;   
        if (board[hash1].quantity[0] == 0) {
            if (tagdata[hash1].length > 0) {
                removeTags(hash1);
            }
            uint marketId = userMarketID[hash1];
            require(markets[marketId] == hash1);
            marketslength -= 1;
            userMarketID[markets[marketslength]] = marketId;
            userMarketID[markets[marketId]] = 0;
            markets[marketId] = markets[marketslength];
            markets[marketslength] = 0;
        }
        return true;
    }
    function updateQuantity0(bytes32 hash1, uint quantity) external returns (bool) {
        board[hash1].quantity[0] = quantity;
        return true;
    }
    function updateQuantity1(bytes32 hash1, uint quantity) external returns (bool) {
        board[hash1].quantity[1] = quantity;
        return true;
    }

    function updateQuantity(bytes32 hash1, uint[2] memory quantity) public {
         uint marketId = userMarketID[hash1];
        require(quantity[0] > 0 && quantity[1] > 0);
        require(board[markets[marketId]].sender == address(0) || board[markets[marketId]].recipient == address(0));
        require(board[markets[marketId]].sender == msg.sender || board[markets[marketId]].recipient == msg.sender);
        board[markets[marketId]].quantity = quantity;
    }

    function removeMarketOffer(bytes32 hash, address user) public {
        uint marketId = userMarketID[hash];
        require(board[markets[marketId]].sender == address(0) || board[markets[marketId]].recipient == address(0));
        if (block.timestamp < board[markets[marketId]].timelimit[2] + C_Year_Secs) {
            // TODO
            // if (msg.sender != user) {
            //     require(isCustodian[user][msg.sender]);
            //     require(isAuthorized[user][msg.sender][hash] || isAuthorized[user][msg.sender][bytes32(0)] || isAuthorized[user][address(0)][bytes32(0)]);
            // }
            require(board[markets[marketId]].sender == user || board[markets[marketId]].recipient == user);
        }
        if (tagdata[hash].length > 0) {
            removeTags(hash);
        }
        marketslength -= 1;
        userMarketID[markets[marketslength]] = marketId;
        userMarketID[markets[marketId]] = 0;
        markets[marketId] = markets[marketslength];
        markets[marketslength] = 0;
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
    function removeTags(bytes32 hash) internal {
        uint x = 0;
        uint hashpos = 0;
        string memory mytag;
        mytag = tagdata[hash][tagdata[hash].length - 1];
        if (compareStrings(mytag,"")) { 
            return;
        }
        while(x < tagdata[hash].length) {
            hashpos = tagposition[hash][x];
            mytag = tagdata[hash][x];
            hashtag[mytag][hashpos] = 0x0;
            if (openslotlength[mytag] == openslot[mytag].length) {
                openslot[mytag].push(0);
            }
            openslot[mytag][openslotlength[mytag]] = hashpos;
            openslotlength[mytag] += 1;
            x += 1;
        }
        tagdata[hash].push("");
    }

    function removeExpiredTags(bytes32 hash) public {
        require(board[hash].sender == address(0) || board[hash].recipient == address(0));
        if (block.timestamp < board[hash].timelimit[2] + C_Year_Secs) {
            require(board[hash].sender == msg.sender || board[hash].recipient == msg.sender);
        }
        removeTags(hash);
    } 

    function getMarketOffer(uint marketId) public view returns (Board.Contract memory) {
        return board[markets[marketId]];
    }
    function getTags(bytes32 hash) public view returns (string[] memory) {
        return tagdata[hash];
    }

    function adddata(string memory data) public {
        publicdata.push(data);
    }
    
    function adduserdata(string memory data) public {
        userdata[msg.sender].push(data);
    }

    function getArrayLength(address user, uint arrayId) public view returns (uint) {
        if (arrayId == 0) {
            return openOffers[user].length;
        }
        if (arrayId == 1) {
            return privateOffers[user].length;
        }
        if (arrayId == 3) {
            return userdata[user].length;
        } 
        else {
            return publicdata.length;
        }
    }

}
