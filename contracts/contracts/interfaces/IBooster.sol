// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IBooster {
    function owner() external view returns(address);
    function setVoteDelegate(address _voteDelegate) external;
    function vote(uint256 _voteId, address _votingAddress, bool _support) external returns(bool);
    function voteGaugeWeight(address[] calldata _gauge, uint256[] calldata _weight ) external returns(bool);
    function poolInfo(uint256 _pid) external view returns(address _lptoken, address _token, address _gauge, address _crvRewards, address _stash, bool _shutdown);
}