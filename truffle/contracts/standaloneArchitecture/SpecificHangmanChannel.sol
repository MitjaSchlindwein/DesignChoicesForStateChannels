pragma solidity 0.5.10;
pragma experimental "ABIEncoderV2";

import "contracts/sharedCode/SigVerifier.sol";
import "contracts/sharedCode/AbstractHangmanChannel.sol";

//We assume that players only sign / produce states that can occur in a proper execution
//For example, they do not sign / produce a state in which a player has used all of his ten tries but still is in stage WaitingForGuess
contract SpecificHangmanChannel is AbstractHangmanChannel, SigVerifier{
    
    //******************
    // Variables, enums, structures
    
    //constant after initialization
    uint timeoutPeriod;

    //Channel variables
    uint timeout;
    uint version;
    
    //Events
    event EventDispute();
    event Log(uint _length, string message);
    
    //****************
    //Constructor
    constructor(uint _maxTries, uint _timeoutPeriod, uint _challengePeriod, address[] memory _parties) public payable AbstractHangmanChannel(_maxTries, _challengePeriod, _parties){
        //constants
        timeoutPeriod = _timeoutPeriod;
        
        //channel initialuzation
        status = ChannelStatus.OFFCHAIN;
        version = 0;
    }
    
    //****************
    //Channel logic
    
    //Function to start a dispute -> Parties should always sign a first initial offchain-state (version 1) before they deploy this contract 
    function dispute(uint _version, bytes32 _hashedWord, bool[26] memory _guessed, bytes memory _word, uint8 _currentGuess, uint _wordLength, uint _missingLetters, uint _tries, Stage _stage, bytes memory _signatures) public {
        
        //Can only be called if channel has been created and dispute timeout has not elapsed yet and version is larger than the submitted one
        require(status == ChannelStatus.OFFCHAIN || (status == ChannelStatus.DISPUTE && timeout > now && _version > version), "Status, timeout or version");

        //Check signatures
        verifySignatures(parties, abi.encode(address(this), _version, _hashedWord, _guessed, _word, _currentGuess, _wordLength, _missingLetters, _tries, _stage), _signatures);
        
        //Set timeout, status and emit event if this is the first call
        if(status == ChannelStatus.OFFCHAIN){
            status =ChannelStatus.DISPUTE;
            timeout = now + timeoutPeriod;
            emit EventDispute();
        }
        
        //Store the version as the most current one
        version = _version;
        
        //Update state
        hashedWord = _hashedWord;
        guessed = _guessed;
        word = _word;
        currentGuess = _currentGuess;
        wordLength = _wordLength;
        missingLetters = _missingLetters;
        tries = _tries;
        stage = _stage;
    }
    
    //Function to finalie a dispute
    function finalizeDispute() external{
        require(status == ChannelStatus.DISPUTE && timeout <= now);
        status = ChannelStatus.ONCHAIN;
    }
    
    //Function to close without a dispute
    function fastClose(uint _version, bytes32 _hashedWord, bool[26] memory _guessed, bytes memory _word, uint8 _currentGuess, uint _wordLength, uint _missingLetters, uint _tries, Stage _stage, bytes memory _signatures) public {
        //Check signatures
        verifySignatures(parties, abi.encode(address(this), _version, _hashedWord, _guessed, _word, _currentGuess, _wordLength, _missingLetters, _tries, _stage), _signatures);
        //call close (checks stage and performs the closure)
        internalClose(_stage);
    }
    
    //****************
    //Application logic is inherited
    
    //****************
    //Getters
    function getState() external view returns (ChannelStatus, uint, uint, address[] memory, bytes32, bool[26] memory, bytes memory, uint8, uint, uint, uint, Stage){
        return (status, timeout, version, parties, hashedWord, guessed, word, currentGuess, wordLength, missingLetters, tries, stage);
    }

}
