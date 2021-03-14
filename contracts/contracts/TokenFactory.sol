// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "./DepositToken.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


contract TokenFactory {
    using Address for address;

    address public operator;

    constructor(address _operator) public {
        operator = _operator;
    }

    function CreateDepositToken(address _lptoken) external returns(address){
        require(msg.sender == operator, "!authorized");

        DepositToken dtoken = new DepositToken(operator,_lptoken);
        return address(dtoken);
    }
}
