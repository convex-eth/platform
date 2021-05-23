// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;


contract SimpleProxy {

    address public owner;
    address public pendingOwner;

    constructor() public {
        owner = msg.sender;
    }

    function setPendingOwner(address _owner) external{
        require(msg.sender == owner,"!auth");
        pendingOwner = _owner;
    }

    function acceptOwner() external{
        require(msg.sender == pendingOwner,"!auth");
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) payable external returns (bool, bytes memory) {
        require(msg.sender == owner,"!auth");

        (bool success, bytes memory result) = _to.call{value:_value}(_data);

        return (success, result);
    }

}