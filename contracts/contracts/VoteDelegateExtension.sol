// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./interfaces/IBooster.sol";

/*
Add a layer to voting to easily apply data packing into vote id, as well as simplify calling functions
*/
contract VoteDelegateExtension{

    address public constant voteOwnership = address(0xE478de485ad2fe566d49342Cbd03E49ed7DB3356);
    address public constant voteParameter = address(0xBCfF8B0b9419b9A88c44546519b1e909cF330399);
    address public constant booster = address(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);

    uint256 private constant MAX_UINT_128  = (2**128) - 1;
    uint256 private constant MAX_UINT_64  = (2**64) - 1;
    uint256 private constant MAX_VOTE = 1e18;

    address public owner;
    address public daoOperator;
    address public gaugeOperator;

    constructor() public {
        //default to multisig
        owner = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB);
        daoOperator = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB);
        gaugeOperator = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB);
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");
        _;
    }

    modifier onlyDaoOperator() {
        require(daoOperator == msg.sender, "!dop");
        _;
    }

    modifier onlyGaugeOperator() {
        require(gaugeOperator == msg.sender, "!gop");
        _;
    }

    //set owner - only OWNER
    function setOwner(address _owner) external onlyOwner{
        owner = _owner;
    }

    //set operator - only OWNER
    function setDaoOperator(address _operator) external onlyOwner{
        daoOperator = _operator;
    }

    function setGaugeOperator(address _operator) external onlyOwner{
        gaugeOperator = _operator;
    }

    //revert to booster's owner
    function revertControl() external{
        IBooster(booster).setVoteDelegate(IBooster(booster).owner());
    }

    //pack data by shifting and ORing
    function _encodeData(uint256 _value, uint256 _shiftValue, uint256 _base) internal pure returns(uint256) {
        return uint256((_value << _shiftValue) | _base);
    }

    //Submit a DAO vote (with weights)
    function DaoVoteWithWeights(uint256 _voteId, uint256 _yay, uint256 _nay, bool _isOwnership) external onlyDaoOperator returns(bool){
        //TODO: maybe just accept a 0~10,000 value and convert to 1e18 for easier input

        require(_yay.add(_nay) == MAX_VOTE, "!equal max_vote");

        uint256 encode = _encodeData(_yay, 192, 0);
        encode = _encodeData(_nay,128,encode);
        encode = _encodeData(_voteId, 0, encode);

        //vote with enocded vote id.  "supported" needs to be false if doing this type
        return IBooster(booster).vote(encode, _isOwnership ? voteOwnership : voteParameter, false);
    }

    //Submit a DAO vote
    function DaoVote(uint256 _voteId, bool _support, bool _isOwnership) external onlyDaoOperator returns(bool){
        //vote with full voting power on either choice
        return IBooster(booster).vote(_voteId, _isOwnership ? voteOwnership : voteParameter, _support);
    }

    //Submit Gauge Weights
    function GaugeVote(address[] calldata _gauge, uint256[] calldata _weight) external onlyGaugeOperator returns(bool){
        //vote for gauge weights
        return IBooster(booster).voteGaugeWeight(_gauge, _weight);
    }
}