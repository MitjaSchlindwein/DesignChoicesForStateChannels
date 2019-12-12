pragma solidity 0.5.10;
pragma experimental "ABIEncoderV2";

import "contracts/hybridArchitecture/HybridDisputeBoard.sol";
import "contracts/sharedCode/AbstractHangmanChannel.sol";
import "contracts/sharedCode/SigVerifier.sol";


//We assume that players only sign / produce states that can occur in a proper execution
//For example, they do not sign / produce a state in which a player has used all of his ten tries but still is in stage WaitingForGuess
contract HybridHangmanChannel is AbstractHangmanChannel, SigVerifier{
    
    //******************
    // Variables, enums, structures
    
    //Channel variables
    HybridDisputeBoard db;
    
    //Events
    event eventLocked();
    event eventUnlocked();
    
    //The enums for the channel status ONCHAIN and OFFCHAIN would fit here better to UNLOCKED = ONCHAIN and LOCKED = OFFCHAIN
    
    //****************
    //Constructor
    constructor(uint _maxTries, uint _challengePeriod, address[] memory _parties, address _db) public payable AbstractHangmanChannel(_maxTries, _challengePeriod, _parties){
        
        //We are starting off-chain
        status = ChannelStatus.OFFCHAIN;
        db = HybridDisputeBoard(_db);
        db.initializeChannel(0, parties);   //Need to send a 0 as well, because dispute board is used by the singleton extension as well
        
    }
    
    //****************
    //Unlock logic

    
    //In the off-chain application they sign tuples of (hash(0, address), lockCount, version, state-hash); the hash(0,address) uniquely identifies the instance, the lockCount is the lockCount used to lock the application, the version starts for each lock with 0 and is incremented with each state update
    //The state-hash is constructed on the application contract's address and all state variables
    function unlock(bytes32 _hashedWord, bool[26] calldata _guessed, bytes calldata _word, uint8 _currentGuess, uint _wordLength, uint _missingLetters, uint _tries, Stage _stage) external isChannelStatus(ChannelStatus.OFFCHAIN){
        
        //Read the current channel's information from the dispute board
        ( ,bytes32 _stateHash, bool _unlockable) = db.getChannelInstance(keccak256(abi.encode(address(this), 0)));
        
        //Check that instance is unlockable
        require(_unlockable, "Instance is not unlockable, either the latest dispute period has not been finished or the instance has never been locked");
        
        //Check that the right state has been provided
        require(_stateHash == keccak256(abi.encode(_hashedWord, _guessed, _word, _currentGuess, _wordLength, _missingLetters, _tries, _stage)), "Wrong state has been provided");
        
        //Update state
        hashedWord = _hashedWord;
        guessed = _guessed;
        word = _word;
        currentGuess = _currentGuess;
        wordLength = _wordLength;
        missingLetters = _missingLetters;
        tries = _tries;
        stage = _stage;
        
        //Unlock the instance, icrement the lockcount to prevent replays and notify users
        status = ChannelStatus.ONCHAIN;
        emit eventUnlocked();
    }
    
    //Function to close without a dispute: As this contact has no default funtionality to handle signed states we simply sign the address and the final stage / not state (dispute board handles signed hashes and this channel handles signed lock-requests)
    function fastClose(Stage _stage, bytes memory _signatures) public {
        //Check signatures
        verifySignatures(parties, abi.encode(address(this), _stage), _signatures);
        //call close (checks stage and performs the closure)
        internalClose(_stage);
    }
    
    //****************
    //Application logic is inherited
    
    //****************
    //Getters
    function getState() external view returns (ChannelStatus, address[] memory, bytes32, bool[26] memory, bytes memory, uint8, uint, uint, uint, Stage){
        return (status, parties, hashedWord, guessed, word, currentGuess, wordLength, missingLetters, tries, stage);
    }
}
