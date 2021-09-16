// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

//template for hold funds. hook for deposits
contract RewardDeposit{
    using SafeERC20 for IERC20;
    using Address for address;

    address public operator;
    event WithdrawTo(address indexed user, uint256 amount);
    event Deposit(address indexed token, uint256 amount);

    constructor(address _operator) public {
        operator = _operator;
    }

    function setOperator(address _op) external {
        require(msg.sender == operator, "!auth");
        operator = _op;
    }
    
    function withdrawTo(IERC20 _asset, uint256 _amount, address _to) external {
        require(msg.sender == operator, "!auth");

        _asset.safeTransfer(_to, _amount);
        emit WithdrawTo(_to, _amount);
    }

    function depositNotify(address _token, uint256 _amount) external{
        emit Deposit(_token, _amount);
    }

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool, bytes memory) {
        require(msg.sender == operator,"!auth");

        (bool success, bytes memory result) = _to.call{value:_value}(_data);

        return (success, result);
    }

}