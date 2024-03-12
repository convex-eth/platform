// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';


interface IHarvestable{
    function earmarkRewards(uint256 _pid) external returns(bool);
}

contract Harvester{
    using SafeERC20 for IERC20;

    address private constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address private constant checkaddress = address(0x1389388d01708118b497f59521f6943Be2541bb7);

    address private immutable owner;
    address private immutable booster;

    constructor(address _owner, address _booster) public {
        owner = _owner;
        booster = _booster;
    }

    function earmark(uint256 _data) external{
        //earmark
        while(_data > 0){
            IHarvestable(booster).earmarkRewards(_data & 0xFFF);
            _data = _data >> 12;
        }
    }

    function earmarkWithCheck(uint256 _data) external{
        //check
        require( (IERC20(crv).balanceOf(checkaddress) & 0xFFF) == (_data & 0xFFF),"change");
        _data = _data >> 12;

        //earmark
        while(_data > 0){
            IHarvestable(booster).earmarkRewards(_data & 0xFFF);
            _data = _data >> 12;
        }
    }

    function returnToken(address _token) external{
        IERC20(_token).safeTransfer(owner,IERC20(_token).balanceOf(address(this)));
    }
}