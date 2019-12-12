pragma solidity 0.5.10;
pragma experimental "ABIEncoderV2";

import "contracts/hybridArchitecture/HybridDisputeBoard.sol";
import "contracts/sharedCode/SigVerifier.sol";
import "contracts/sharedCode/AbstractHangmanSingleton.sol";


//We assume that players only sign / produce states that can occur in a proper execution
//For example, they do not sign / produce a state in which a player has used all of his ten tries but still is in stage WaitingForGuess
contract HybridHangmanSingleton is SigVerifier, AbstractHangmanSingleton{
    
    //******************
    // Variables, enums, structures
    
    //constant after initialization
    HybridDisputeBoard db;
    
    //Events
    event eventLocked(bytes32 id);
    event eventUnlocked(bytes32 id);
    
    //The enus for the channel status ONCHAIN and OFFCHAIN would fit here better to UNLOCKED = ONCHAIN and LOCKED = OFFCHAIN
    
    //****************
    //Constructor
    constructor(uint _maxTries, uint _minFunding, uint _challengePeriod, address _db) public AbstractHangmanSingleton(_maxTries, _minFunding, _challengePeriod){
        db = HybridDisputeBoard(_db);
    }
    
    //****************
    //Channel logic
    
    //Function called by the inherrited function "createInstance"
    function setInitialDisputeState(bytes32 _id) internal {
        db.initializeChannel(_id, instanceState[_id].parties);
    }
    
    //In the off-chain application they sign tuples of (address, lockCount, version, state-hash); the address uniquely identifies the instance, the lockCount is the lockCount used to lock the application, the version starts for each lock with 0 and is incremented with each state update
    //The state-hash is constructed on the application contract's address and all state variables
    function unlock(bytes32 _id, bytes calldata _encodedState) external isChannelStatus(_id, ChannelStatus.OFFCHAIN){
        
        //Read the current channel's information from the dispute board
        (,bytes32 _stateHash, bool _unlockable) = db.getChannelInstance(keccak256(abi.encode(address(this), _id)));

        
        //Check that instance is unlockable
        require(_unlockable);
        
        //Check that the right state has been provided
        require(_stateHash == keccak256(_encodedState));
        
        //Update state
        applicationState[_id] = abi.decode(_encodedState,(ApplicationVariables));
        
        //Unlock the instance, icrement the lockcount to prevent replays and notify users
        instanceState[_id].status = ChannelStatus.ONCHAIN;
        emit eventUnlocked(_id);
    }
    
    //Function to close without a dispute: As this contact has no default funtionality to handle signed states we simply sign the address and the final stage / not state (dispute board handles signed hashes and this channel handles signed lock-requests)
    function fastClose(bytes32 _id, Stage _stage, bytes memory _signatures) public {
        
        //Not when closed or not created
        require(instanceState[_id].status == ChannelStatus.OFFCHAIN || instanceState[_id].status == ChannelStatus.ONCHAIN || instanceState[_id].status == ChannelStatus.DISPUTE);
        
        //Check signatures
        verifySignatures(instanceState[_id].parties, abi.encode(address(this), _id, _stage), _signatures);
        
        //call close (checks stage and performs the closure)
        internalClose(_id, _stage);
    }
    
    //****************
    //Application logic is inherited
    
    //******************
    // Getter
    function getInstance(bytes32 _id) external view returns (MaintainanceVariables memory, ApplicationVariables memory){
        return (instanceState[_id], applicationState[_id]) ;
    }

}
