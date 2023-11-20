// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;


contract TreasuryRegistry {

    address public immutable owner;
    address[] public registry;

    constructor(address _owner) public {
        owner = _owner;
        registry.push(address(0x1389388d01708118b497f59521f6943Be2541bb7)); //main
        registry.push(address(0xa25B17D7deEE59f9e326e45cC3C0C1B158E74316)); //cvxcrv
        registry.push(address(0xeB8121b44a290eE16981D87B92fc16b2366dE6B3)); //cvxfxs
        registry.push(address(0x858847c21B075e45727fcB0B544BD843CD750361)); //cvxfpis
        registry.push(address(0x148e58bB8d9c5278b6505b40923e6152B5238Cf8)); //cvxfxn
        registry.push(address(0xBb48c21E9101A85EE6D00B4F1A7B946dF1B09EA7)); //cvxprisma
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");
        _;
    }

    function addToRegistry(address _address) external onlyOwner{
        registry.push(_address);
    }

    function removeFromRegistry(uint256 _index) external onlyOwner{
        registry[_index] = registry[registry.length-1];
        registry.pop();
    }

    function registryLength() external view returns(uint256){
        return registry.length;
    }

    function registryList() external view returns(address[] memory list){
        list = new address[](registry.length);

        for(uint256 i = 0; i < registry.length; i++){
            list[i] = registry[i];
        }
    }
}
