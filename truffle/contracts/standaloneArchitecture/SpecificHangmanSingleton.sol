pragma solidity 0.5.10;
pragma experimental "ABIEncoderV2";

import "contracts/sharedCode/SigVerifier.sol";
import "contracts/sharedCode/AbstractHangmanSingleton.sol";

//We assume that players only sign / produce states that can occur in a proper execution
//For example, they do not sign / produce a state in which a player has used all of his ten tries but still is in stage WaitingForGuess
contract SpecificHangmanSingleton is SigVerifier, AbstractHangmanSingleton{
    
    //******************
    // Variables, enums, structures
    
    //Model specific dispute constants
    uint timeoutPeriod;
    
    //Channel Instances -> We divide the variables to be able to reuse the code
    mapping(bytes32 => DisputeVariables) disputeState;
    
    //Events
    event EventDispute(bytes32 id);
    
    //Structures
    struct DisputeVariables {
        uint timeout;
        uint version;
    }
    
    //****************
    //Constructor
    constructor(uint _maxTries, uint _minFunding, uint _timeoutPeriod, uint _challengePeriod) public AbstractHangmanSingleton(_maxTries, _minFunding, _challengePeriod){
        timeoutPeriod = _timeoutPeriod;
    }
    
    
    //****************
    //Channel logic
    
    //Function called by the inherrited function "createInstance"
    function setInitialDisputeState(bytes32 _id) internal {
        disputeState[_id] = DisputeVariables(0,0);
    }

    //Function to start a dispute
    function dispute(bytes32 _id, uint _version, bytes memory _encodedState, bytes memory _signatures) public {
        
        //Can only be called if channel has been created and dispute timeout has not elapsed yet and version is larger than the submitted one
        require(instanceState[_id].status == ChannelStatus.OFFCHAIN || (instanceState[_id].status == ChannelStatus.DISPUTE && disputeState[_id].timeout > now && _version > disputeState[_id].version));

        //Check signatures:
        verifySignatures(instanceState[_id].parties, abi.encode(address(this), _id, _version, _encodedState), _signatures);
        
        //Set timeout, status and emit event if this is the first call
        if(instanceState[_id].status == ChannelStatus.OFFCHAIN){
            instanceState[_id].status = ChannelStatus.DISPUTE;
            disputeState[_id].timeout = now + timeoutPeriod;
            emit EventDispute(_id);
        }
        
        //Store the version as the most current one
        disputeState[_id].version = _version;
        
        //Decode the state
        applicationState[_id] = abi.decode(_encodedState,(ApplicationVariables));
    }
    
    //Function to finalie a dispute
    function finalizeDispute(bytes32 _id) external{
        require(instanceState[_id].status == ChannelStatus.DISPUTE && disputeState[_id].timeout <= now);
        instanceState[_id].status = ChannelStatus.ONCHAIN;
    }
    
    //Function to perform a fast closing (without dispute)
    function fastClose(bytes32 _id, uint _version, bytes memory _encodedState, bytes memory _signatures) public {
        
        //Not when closed or not created
        require(instanceState[_id].status == ChannelStatus.OFFCHAIN || instanceState[_id].status == ChannelStatus.ONCHAIN && instanceState[_id].status == ChannelStatus.DISPUTE);
        
        //Check signatures
        verifySignatures(instanceState[_id].parties, abi.encode(address(this), _id, _version, _encodedState), _signatures);
        
        //Decode state and pass stage to the closing procedure
        ApplicationVariables memory _appState = abi.decode(_encodedState,(ApplicationVariables));
        internalClose(_id, _appState.stage);
    }
    
    //******************
    // Getter
    
    function getInstance(bytes32 _id) external view returns (MaintainanceVariables memory, ApplicationVariables memory, DisputeVariables memory){
        return (instanceState[_id], applicationState[_id], disputeState[_id]) ;
    }
}
