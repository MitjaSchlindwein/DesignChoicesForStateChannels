pragma solidity ^0.5.10;
pragma experimental "ABIEncoderV2";

import "contracts/sharedCode/SigVerifier.sol";


//Can be used by both: normal and singleton applications
contract HybridRelockableDisputeBoard is SigVerifier {
    
    //******************
    // Variables, enums, structures
    
    
    //Managing variables
    mapping(bytes32 => ChannelInstance) channels;
    uint public timeoutPeriod;          
    
    //Enum for statuses
    enum Status{NONE, INITIALIZED, SUBMITTED}
    
    //Events to notify parties about dispute and forcefully execution
    event EventDispute(bytes32 id);
    
    struct ChannelInstance {
        //Maintainance
        Status status;
        uint timeout;
        address[] parties;
        
        //Identify latest
        uint lockCount;
        uint version;
        
        //State-Hash
        bytes32 stateHash;
    }
    
    //******************
    // Constructor
    
    //Constructor to initialize global constants
    constructor(uint _timeoutPeriod) public {
        timeoutPeriod = _timeoutPeriod;
    }
    
    //******************
    // Channel logic
    
    //During the first time to lock the channel the contract tells the dispute board the set of parties which needs to sign states
    function initializeChannel(bytes32 _foreignId, address[] calldata _parties) external returns(bytes32) {
        
        bytes32 _internalId = keccak256(abi.encode(msg.sender, _foreignId)); 
        
        require(channels[_internalId].status == Status.NONE); //May not be necessary
        
        channels[_internalId] = ChannelInstance(Status.INITIALIZED, 0, _parties, 0, 0, 0);
        
        return _internalId;
        
    }
	
	//Function to provide evidence -> When a new lockcount is encountered or this is the first submission a dispute is started
	    //Parties need to first agree on the first state after the lock before they actuall lock an application. This approach might be a little bit messy but faster and easier to implement and thus fits better for this prototype implementation
    function dispute(bytes32 _id, uint _lockCount, uint _version, bytes32 _stateHash, bytes calldata _signatures) external {
        
        //Read corresponding instance
        ChannelInstance memory _instance = channels[_id];
        
        //Check that the provided evidence is more current than the existing one
            //If status is NONE, there is nothing to submit
            //If it is the first evidence (status INITIALIZED) each evidence is the most current -> new dispute
            //If there has already been an evidence (status SUBMITTED) the new evidence needs either a higher lockCount or (a higher version, the same lockCount and before the timeout)
                //If the lockCount is higher a new submission starts a dispute
        require(_instance.status == Status.INITIALIZED ||(_instance.status == Status.SUBMITTED && (_instance.lockCount < _lockCount || (_instance.lockCount == _lockCount && _instance.version < _version && _instance.timeout > now))),"Wrong version submitted");
        
        //Check signatures
        verifySignatures(_instance.parties, abi.encode(address(this), _id, _lockCount, _version, _stateHash), _signatures);
        
        //Set timeout, status and emit event if this is a new dispute (new dispute means status INITIALIZED or higher lockCount)
        if(_instance.status == Status.INITIALIZED || _instance.lockCount < _lockCount){
            channels[_id].status = Status.SUBMITTED;
            channels[_id].timeout = now + timeoutPeriod;
            emit EventDispute(_id);
        }
        
        //Update state
        channels[_id].version = _version;
        channels[_id].lockCount = _lockCount;
        channels[_id].stateHash = _stateHash;
    }
    
    //Getter for the channel state and if last dispute is finalized
    function getChannelInstance(bytes32 _id) external view returns (uint, uint, bytes32, bool){
        
        bool _unlockable = false;
        
        //Can only be unlocked if the latest state has successfully been disputed (Double unlocks need to be prevented by the application contract)
        if(channels[_id].status == Status.SUBMITTED && channels[_id].timeout < now){
            _unlockable = true;
        }
        
        return (channels[_id].lockCount, channels[_id].version,  channels[_id].stateHash, _unlockable);
    }
} 
