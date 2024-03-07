// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./ConvexStakingWrapper.sol";
import "../interfaces/IBooster.sol";
import "../interfaces/IOwner.sol";
import "../interfaces/IMorpho.sol";


/*
Staking wrapper for Morpho
Use convex LP positions as collateral while still receiving rewards

This is a non standard token which only mints itself to the morpho vault and disallows all transfers.
Because morpho does state changes before token transfer, the wrapper itself must be the only
entry to morpho to ensure it gets to act first by checkpointing user balances before state changes.

By disabling typical transfers we can reduce gas costs of wrapping when depositing.
Only allow "transfers" out of morpho for withdraws or liquidations.
Override the normal transfer logic for a burn+unwrap to the target address.

The downside of this design is that withdraws and liquidations could cause uncheckpointed rewards to be lost.
As the wrapper has no information on who was liquidated and when, it can not keep track.
For normal withdraws, users will need to claim rewards or checkpoint before removing collateral from Morpho.
*/
contract ConvexStakingWrapperMorpho is ConvexStakingWrapper {
    using SafeERC20
    for IERC20;
    using SafeMath
    for uint256;

    address public immutable morpho;
    bytes32 morphoId;
    
    constructor(address _morpho) public{
        morpho = _morpho;
    }

    modifier onlyOwner() override{
        require(owner() == msg.sender, "Ownable: caller is not the owner");
        _;
    }

    function owner() public view override returns(address) {
        return IOwner(morpho).owner();
    }

    function initialize(uint256 _poolId)
    override external {
        require(!isInit,"already init");
        emit OwnershipTransferred(address(0), morpho);

        (address _lptoken, address _token, , address _rewards, , ) = IBooster(convexBooster).poolInfo(_poolId);
        curveToken = _lptoken;
        convexToken = _token;
        convexPool = _rewards;
        convexPoolId = _poolId;

        _tokenname = string(abi.encodePacked("Staked ", ERC20(_token).name(), " Morpho" ));
        _tokensymbol = string(abi.encodePacked("stk", ERC20(_token).symbol(), "-morpho"));
        isShutdown = false;
        isInit = true;

        //add rewards
        addRewards();
        setApprovals();
        IERC20(address(this)).safeApprove(morpho, uint256(-1));
    }

    function setMorphoId(bytes32 _id) external{
        require(morphoId == bytes32(0), "already set");
        IMorpho.MarketParams memory mp = IMorpho(morpho).idToMarketParams(_id);
        require(mp.collateralToken == address(this),"invalid id");
        morphoId = _id;
    }

    //4626 interface
    function asset() external view returns(address){
        return curveToken;
    }

    //wrapped erc20 interface
    function underlying() external view returns(address){
        return curveToken;
    }

    //deposit a curve token, wrap, and supply collateral to morpho
    function _depositToMorpho(IMorpho.MarketParams memory marketParams, uint256 assets, address onBehalf, bytes memory data) internal returns (bool){
        require(!isShutdown, "shutdown");

        //call checkpoint on onBehalf
        _checkpoint([onBehalf, address(0)]);

        if (assets > 0) {
            //mint directly on morpho
            //this is gas trickery as we can skip transfer logic when supplying
            //so that we're not paying an extra transfer
            _mint(morpho, assets);
            IERC20(curveToken).safeTransferFrom(msg.sender, address(this), assets);
            IConvexDeposits(convexBooster).deposit(convexPoolId, assets, true);

            //supply to morpho
            //checkpointed above so safe to change morpho state of onBehalf
            IMorpho(morpho).supplyCollateral(marketParams, assets, onBehalf, data);
        }

        emit Deposited(msg.sender, onBehalf, assets, true);
        return true;
    }

    //normal deposit
    function deposit(uint256 _amount, address _to) external override{
        //gracefully do nothing
    }

    //wrapped erc20 interface
    function depositFor(address _to, uint256 _amount) external returns (bool){
        return _depositToMorpho(IMorpho(morpho).idToMarketParams(morphoId), _amount, _to, new bytes(0));
    }

    function stake(uint256 _amount, address _to) external override{
        //gracefully do nothing
    }

    function withdraw(uint256 _amount) external override{
        //gracefully do nothing
    }

    function withdrawAndUnwrap(uint256 _amount) external override{
        //gracefully do nothing
    }

    function _getDepositedBalance(address _account) internal override view returns(uint256) {
        if (_account == address(0) || _account == morpho) {
            return 0;
        }

        //return morpho collateral balance (can ignore wrapper token balance)
        return IMorpho(morpho).position(morphoId, _account).collateral;
    }

    function _beforeTokenTransfer(address /*_from*/, address /*_to*/, uint256 /*_amount*/) internal override {
        //dont need to checkpoint as we already are doing so directly in deposit
    }

    function _transfer(address _from, address _to, uint256 _amount) internal override {
        //Only legit transfer is from morpho
        //which doesnt even transfer but just burns+unwraps to the target.
        //Let other transfers fail without error.
        if(_from == morpho){

            //normally we would do a checkpoint before burning...
            //however since a liquidation will cause a 
            //user to lose their uncheckedpointed rewards, a checkpoint here would brick those rewards.
            //if we dont checkpoint now then those rewards could be at least distributed
            //to the remaining users
            // _checkpoint([address(0),address(0)]);

            //unwrap to curve lp token and transfer that instead
            if (_amount > 0) {
                _burn(_from, _amount);
                IRewardStaking(convexPool).withdrawAndUnwrap(_amount, false);
                IERC20(curveToken).safeTransfer(_to, _amount);
                emit Withdrawn(_from, _amount, true);
                emit Transfer(_from, _to, _amount);
            }        
        }else if(_from != address(this)){
            //any other call to transfer just act as a checkpoint instead of actually transferring
            //..just checkpoint to as this is more of a workaround to get a checkpoint in to a specific address
            //   and we dont have to pay for check pointing 2 addresses
            _checkpoint([_to, address(0)]);
        }
    }
}