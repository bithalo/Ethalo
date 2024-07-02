// SPDX-License-Identifier: Jelurida Public License
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

contract DDE_Vault {

    uint constant C_Locked = 1;
    uint constant C_UnLocked = 2;

    mapping(address => mapping(address => uint)) public userBalance;
    address public WETH;
    address public dde;
    uint lock;
    uint escrow;

    constructor(address _WETH) {
        WETH = _WETH;
        lock = C_UnLocked;
        dde = msg.sender; // until pair
    }

    receive() external payable {
        assert(msg.sender == WETH);
    }

    function pair(address _dde) public {
        require(msg.sender == dde);
        dde = _dde;
    }

    function deposit(address token, uint amount) public {
        require(lock != C_Locked);
        require(token != WETH);
        lock = C_Locked;
        require(amount > 0);
        ERC20 erc20 = ERC20(token);
        require(erc20.balanceOf(msg.sender) >= amount);
        require(erc20.transferFrom(msg.sender, address(this), amount));
        userBalance[msg.sender][token] += amount;
        lock = C_UnLocked;
    }

    function depositWETH() public payable {
        require(lock != C_Locked);
        lock = C_Locked;
        uint amount = msg.value;
        IWETH(WETH).deposit{value: amount}();
        require(amount > 0);
        userBalance[msg.sender][WETH] += amount;
        lock = C_UnLocked;
    }

    function withdraw(address token, uint amount) public {
        require(lock != C_Locked);
        lock = C_Locked;
        require(amount > 0);
        require(userBalance[msg.sender][token] >= amount);
        if(token != WETH) {
            require(ERC20(token).transfer(msg.sender, amount));
        } else {
            IWETH(WETH).withdraw(amount);
            safeTransferETH(msg.sender, amount);
        }
        userBalance[msg.sender][token] -= amount;
        lock = C_UnLocked;
    }
    function safeTransferETH(address to, uint value) internal {
        (bool success,) = to.call{value:value}(new bytes(0));
        require(success, 'Transfer failed');
    }

    function escrowOut(address user, address token, uint amount) public returns (bool) {
        require(msg.sender == dde);
        userBalance[user][token] += amount;
        escrow -= amount;
        return true;
    }
    function escrowIn(address user, address token, uint amount) public returns (bool) {
        require(msg.sender == dde);
        userBalance[user][token] -= amount;
        escrow += amount;
        return true;
    }

}