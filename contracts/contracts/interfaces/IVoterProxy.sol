// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IVoterProxy {
    function setOperator(address _operator) external;
    function setOwner(address _owner) external;
    function owner() external returns(address);
    function operator() external returns(address);
    function depositor() external returns(address);
    function setDepositor(address _depositor) external;
}