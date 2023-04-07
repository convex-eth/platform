// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IFpisClaim{
    function claimFees(address _distroContract, address _token) external;
}
interface IFpisProxy{
    function operator() external view returns(address);
}

//hook that claims vefxs fees
contract FpisRewardHook{

    address public constant voteproxy = address(0xf3BD66ca9b2b43F6Aa11afa6F4Dfdc836150d973);
    address public constant fpis = address(0xc2544A32872A91F4A553b404C6950e89De901fdb);
    address public constant distro = address(0xE6D31C144BA99Af564bE7E81261f7bD951b802F6);
    address public constant stash = address(0x3a562a8CEB9866BcF39bB5EdA32F282d619e08E0);
    address public constant hookManager = address(0x723f9Aa67FDD9B0e375eF8553eB2AFC28eCD4a96);
    address public constant owner = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB);

    constructor() public {}

    function getReward(address _account) external{
        require(msg.sender == hookManager,"!auth");

        //check if any fpis made its way here by other means
        uint256 bal = IERC20(fpis).balanceOf(address(this));
        if(bal > 0){
            IERC20(fpis).transfer(stash,bal);
        }

        //ask the current operator to claim fees
        IFpisClaim( IFpisProxy(voteproxy).operator() ) .claimFees(distro,fpis);
    }

    function recoverERC20(address _tokenAddress, uint256 _tokenAmount, address _withdrawTo) external{
        require(msg.sender == owner, "!auth");
        require(_tokenAddress != fpis, "protected");
        IERC20(_tokenAddress).transfer(_withdrawTo, _tokenAmount);
    }

}