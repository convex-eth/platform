// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


contract FakeGauge {
    using SafeERC20 for IERC20;

    IERC20 token;

    constructor(IERC20 _token) public {
        token = _token;
    }

    function deposit(uint256 amount) public {
        token.safeTransferFrom(msg.sender, address(this), amount);
    }
}