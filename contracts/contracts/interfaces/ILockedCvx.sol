// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface ILockedCvx{
    function lock(address _account, uint256 _amount, uint256 _spendRatio) external;
    function processExpiredLocks(bool _relock, uint256 _spendRatio, address _withdrawTo) external;
    function getReward(address _account, bool _stake) external;
    function balanceAtEpochOf(uint256 _epoch, address _user) view external returns(uint256 amount);
    function totalSupplyAtEpoch(uint256 _epoch) view external returns(uint256 supply);
    function epochCount() external view returns(uint256);
    function checkpointEpoch() external;
    function balanceOf(address _account) external view returns(uint256);
    function totalSupply() view external returns(uint256 supply);
}