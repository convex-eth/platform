// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./ConvexStakingWrapper.sol";
import "../interfaces/IProxyFactory.sol";
import "../interfaces/IOwner.sol";


interface IFraxFarmDistributor {
    function initialize(address _farm, address _wrapper) external;
}

//Staking wrapper for Frax Finance platform
//use convex LP positions as collateral while still receiving rewards
//
//This version directs all rewards from the vault(fxs gauge) to a distributor contract
//which will feed the rewards back into the vault
contract ConvexStakingWrapperFrax is ConvexStakingWrapper {
    using SafeERC20
    for IERC20;
    using SafeMath
    for uint256;

    address public immutable distroImplementation;
    address public immutable factory;
    address public constant proxyFactory = address(0x66807B5598A848602734B82E432dD88DBE13fC8f);

    address public distroContract;
    bool public distroSealed;

    constructor(address _distributor, address _factory) public{
        distroImplementation = _distributor;
        factory = _factory;
    }

    modifier onlyOwner() override{
        require(owner() == msg.sender, "Ownable: caller is not the owner");
        _;
    }

    function owner() public view override returns(address) {
        return IOwner(factory).owner();
    }


    function initialize(uint256 _poolId)
    override external {
        require(!isInit,"already init");
        // _owner = msg.sender;
        // emit OwnershipTransferred(address(0), _owner);

        (address _lptoken, address _token, , address _rewards, , ) = IBooster(convexBooster).poolInfo(_poolId);
        curveToken = _lptoken;
        convexToken = _token;
        convexPool = _rewards;
        convexPoolId = _poolId;

        _tokenname = string(abi.encodePacked("Staked ", ERC20(_token).name(), " Frax" ));
        _tokensymbol = string(abi.encodePacked("stk", ERC20(_token).symbol(), "-frax"));
        isShutdown = false;
        isInit = true;

        //add rewards
        addRewards();
        setApprovals();
    }

    function setVault(address _vault) external onlyOwner{
        //set distro contract to take care of rewards
        require(distroContract == address(0), "already set");
        
        //create a distro contract
        distroContract = IProxyFactory(proxyFactory).clone(distroImplementation);
        IFraxFarmDistributor(distroContract).initialize(_vault, address(this));

        //forward rewards from vault to distro
        rewardRedirect[_vault] = distroContract;
    }

    //Also resetting of distributor while this feature is new
    //Seal once battle tested
    //Future versions should remove this
    function setDistributor(address _vault, address _distro) external onlyOwner{
        require(rewardRedirect[_vault] == distroContract, "!vault");
        require(!distroSealed,"sealed");

        distroContract = _distro;
        IFraxFarmDistributor(_distro).initialize(_vault, address(this));
        rewardRedirect[_vault] = _distro;
    }

    function sealDistributor() external onlyOwner{
        distroSealed = true;
    }

}