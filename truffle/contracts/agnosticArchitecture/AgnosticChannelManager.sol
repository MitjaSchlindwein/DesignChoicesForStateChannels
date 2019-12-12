pragma solidity ^0.5.10;
pragma experimental "ABIEncoderV2";

import "contracts/agnosticArchitecture/OffchainLibrary.sol";
import "contracts/sharedCode/SigVerifier.sol";

contract AgnosticChannelManager is SigVerifier {
    
    //******************
    // Variables, enums, structures
    
    //Managing variables
    mapping(bytes32 => ChannelInstance) channels;
    uint public timeoutPeriod;          
    uint public minFunding;                
    
    //Enum for statuses
    enum Status{NONE, CREATED, DISPUTE, REGISTERED, CLOSED}
    
    //Events to notify parties about dispute and forcefully execution
    event EventNewChannel(bytes32 id);
    event EventDispute(bytes32 id);
    event EventForcefullyExecuted(bytes32 id);
    
    struct ChannelInstance {
        //DB-Specifics
        Status status;
        uint timeout;
        
        //Instace-Specifics
        OffchainLibrary applicationLogic;
        uint version;
        address[] parties;  //The ordering of addresses identifies the players' roles in the application
        uint funding;
        bytes state;    //We leave it to the application to manage balances
    }
    
    //******************
    // Constructor
    
    //Constructor to initialize global constants
    constructor(uint _timeoutPeriod, uint _minFunding) public {
        timeoutPeriod = _timeoutPeriod;
        minFunding = _minFunding;
    }
    
    //******************
    // Channel logic
    
    //We do not care about fair funding and that an initial state with balances exists -> Parties need to ensure this themselfes (maybe with an additional contract)
    //!!! Parties are supposed to sign an initial state with version 1 before calling this function
    function createOffchainApplication(bytes32 _nonce, address[] calldata _parties, address _libraryAddress) external payable {
	    
	    //Determine the id by the senders-address, the library-address and a nonce -> Enables parties to sign states of isntances that has not been created yet
	    bytes32 _id = keccak256(abi.encode(_nonce, _parties, _libraryAddress));
        
        //Checks
        require(channels[_id].status == Status.NONE && _parties.length >= 2 && msg.value >= minFunding);   //Overflow check

	    //Create channel instance
        channels[_id] = ChannelInstance(Status.CREATED, 0, OffchainLibrary(_libraryAddress), 0, _parties, msg.value, "0x00");
        
        emit EventNewChannel(_id);
	}
	
	//Function to start a dispute
    function dispute(bytes32 _id, uint _version, bytes calldata _state, bytes calldata _signatures) external {
        
        //Read corresponding instance
        ChannelInstance memory _instance = channels[_id];
        
        //Can only be called if channel has been created and dispute timeout has not elapsed yet
        require(_instance.status == Status.CREATED || (_instance.status == Status.DISPUTE && _instance.timeout > now));
        //Version needs to be more current than the stored one
        require(_version > _instance.version);  //It is in the parties responsibility to ensure that there is at least one valid state before creating the channel
        
        //Check signatures
        verifySignatures(_instance.parties, abi.encode(address(this), _id, _version, _state), _signatures);
        
        //Set timeout, status and emit event if this is the first call
        if(_instance.status == Status.CREATED){
            channels[_id].status = Status.DISPUTE;
            channels[_id].timeout = now + timeoutPeriod;
            emit EventDispute(_id);
        }
        
        channels[_id].version = _version;
        channels[_id].state = _state;   //It is in the parties responsibility to ensure that the signed states are well-formed
    }
    
    //Function to finalize a dispute
    function finalizeDispute(bytes32 _id) external{
        require(channels[_id].status == Status.DISPUTE && channels[_id].timeout <= now);
        channels[_id].status = Status.REGISTERED;
    }
    
    //******************
    // Execution and Closing
    
    //Function to execute an application instance
    function forcefullyExecute(bytes32 _id, uint _actionType, bytes calldata _action) external {
        require(channels[_id].status == Status.REGISTERED);
        channels[_id].state = channels[_id].applicationLogic.callAction(channels[_id].state, _actionType, _action, channels[_id].parties, msg.sender); //The application logic performs all the relevant checks
        emit EventForcefullyExecuted(_id);
    }
    
    //Function to fast close a channel (no dispute, just provide final state)
    function fastClose(bytes32 _id, uint _version, bytes calldata _finalState, bytes calldata _signatures) external {
        
        //Only in channels that are created or in dispute
        require(channels[_id].status == Status.CREATED || channels[_id].status == Status.DISPUTE);
        
        //Check signatures
        verifySignatures(channels[_id].parties, abi.encode(address(this), _id, _version, _finalState), _signatures);
        
        //Close
        internalClose(_id, _finalState);
    }
    
    //Function to close a channel (The channel has to be registered (disputed) first)
    function closeChannel(bytes32 _id) external {
        
        //Only registered instances can be closed
        require(channels[_id].status == Status.REGISTERED);
        
        //Close
        internalClose(_id, channels[_id].state);
        
    }
    
    //Internally used close function (by both normal and fast close)
    function internalClose(bytes32 _id, bytes memory _state) private {
        uint[] memory _payout = channels[_id].applicationLogic.getOutcome(_state, channels[_id].funding);
        
        //Check that _payout does not disburse more coins than invested and does not produce an overflow
        uint _sum = 0;
        for(uint i = 0; i <_payout.length; i++){
            require(_sum + _payout[i] >= _sum); //Overflow check
            _sum = _sum + _payout[i];
            address(uint160(channels[_id].parties[i])).transfer(_payout[i]); //We can directly call the transfer because the previous check reverts this call as well
        }
        require(_sum <= channels[_id].funding);
        
        //Set the status to closed
        channels[_id].status = Status.CLOSED;
    }
    
    //******************
    // Getter
    
    //Getter for the channel state
    function getInstance(bytes32 _id) external view returns (ChannelInstance memory){
        return channels[_id];
    }
} 
