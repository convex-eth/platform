// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IVotingEligibility{
    function isEligible(address _account) external view returns(bool);
}