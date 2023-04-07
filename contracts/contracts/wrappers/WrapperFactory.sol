// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../interfaces/IProxyFactory.sol";
import "../interfaces/IStakingWrapper.sol";


//Factory to create wrapped staking positions
contract WrapperFactory{
   
    address public constant proxyFactory = address(0x66807B5598A848602734B82E432dD88DBE13fC8f);
    
    address public owner;
    address public pendingOwner;

    address public wrapperImplementation;

    event SetPendingOwner(address indexed _address);
    event OwnerChanged(address indexed _address);
    event ImplementationChanged(address _implementation);
    event WrapperCreated(address _wrapper, uint256 _pid);

    constructor() public{
        owner = msg.sender;
        emit OwnerChanged(msg.sender);
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");
        _;
    }

    //set next owner
    function setPendingOwner(address _po) external onlyOwner{
        pendingOwner = _po;
        emit SetPendingOwner(_po);
    }

    //claim ownership
    function acceptPendingOwner() external {
        require(msg.sender == pendingOwner, "!p_owner");

        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnerChanged(owner);
    }

    function setImplementation(address _imp) external onlyOwner{
        wrapperImplementation = _imp;
        emit ImplementationChanged(_imp);
    }

    function CreateWrapper(uint256 _pid) external returns (address) {
        //create
        address wrapper = IProxyFactory(proxyFactory).clone(wrapperImplementation);
        emit WrapperCreated(wrapper, _pid);

        //init
        IStakingWrapper(wrapper).initialize(_pid);
        
        return wrapper;
    }
}