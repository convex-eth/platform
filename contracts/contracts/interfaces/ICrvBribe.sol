// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface ICrvBribe {
   function rewards_per_gauge(address gauge) external view returns (address[] memory);
   function gauges_per_reward(address reward) external view returns (address[] memory);
   function add_reward_amount(address gauge, address reward_token, uint amount) external returns (bool);
   function claimable(address user, address gauge, address reward_token) external view returns (uint);
   function claim_reward(address user, address gauge, address reward_token) external returns (uint);
}