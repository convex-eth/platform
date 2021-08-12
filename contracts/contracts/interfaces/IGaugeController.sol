// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IGaugeController {
    function get_gauge_weight(address _gauge) external view returns(uint256);
    function vote_user_slopes(address,address) external view returns(uint256,uint256,uint256);//slope,power,end
}