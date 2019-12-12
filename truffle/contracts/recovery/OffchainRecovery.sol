pragma solidity 0.5.10;
pragma experimental "ABIEncoderV2";

import "contracts/sharedCode/SigVerifier.sol";

//We assume that players only sign / produce states that can occur in a proper execution
//For example, they do not sign / produce a state in which a player has used all of his ten tries but still is in stage WaitingForGuess
contract OffchainRecovery is SigVerifier{
    
    //constant after initialization
    uint maxTries;
    uint timeoutPeriod;
    uint challengePeriod;
    
    //Channel variables
    ChannelStatus status;
    uint timeout;
    uint version;
    address[] parties;
    
    //execution specific variables
    bytes32 hashedWord;
    bool[26] guessed; //Originally we used a mapping but we cant use mapping in memory-structures
    bytes word;
    uint8 currentGuess; //Uint representation of a capital letter's ascii byte
    uint wordLength;
    uint missingLetters;
    uint tries ;
    Stage stage;
    
    //Events
    event Dispute();
    event DisputeResolved();
    
    //Enums
    enum Stage {
      WaitingForCommit, WaitingForGuess, WaitingForResponse, WaitingForOpen, Failed, Success
    }
    
    enum ChannelStatus {
        NONE, OFFCHAIN, DISPUTE, EXECUTED
    }
    
    //****************
    //Constructor
    constructor(uint _maxTries, uint _timeoutPeriod, uint _challengePeriod, address[] memory _parties) public payable{
        //constants
        maxTries = _maxTries;
        timeoutPeriod = _timeoutPeriod;
        challengePeriod = _challengePeriod;
        
        //channel initialuzation
        parties = _parties;
        status = ChannelStatus.OFFCHAIN;
        version = 0;
        
        //Required application initializations
        tries = 0;
        stage = Stage.WaitingForCommit;
    }
    
    //****************
    //Channel logic
    
    //A party starts a dispute -> each party can call functions during dispute (only the acting party's function is accepted because of fixed move sequence)
    // -> this directly updates the state but not the version (a more current evidence overwrites the move's result) -> One successful call locks the state until finalization of the dispute
    // -> After the timeout the dispute can be finalized and the version is now incremented and can only be overwritten by 2 more current versions (does not happen if 1 party is honest)
    
    //Function to submit the latest evidence -> Can always be submitted
    function evidence(uint _version, bytes32 _hashedWord, bool[26] memory _guessed, bytes memory _word, uint8 _currentGuess, uint _wordLength, uint _missingLetters, uint _tries, Stage _stage, bytes memory _signatures) public {
        
        require(_version > version);
        
        //Check signatures
        verifySignatures(parties, abi.encode(address(this), _version, _hashedWord, _guessed, _word, _currentGuess, _wordLength, _missingLetters, _tries, _stage),_signatures);
        
        //If there is a dispute, it is directly resolved
        if(status == ChannelStatus.DISPUTE || status == ChannelStatus.EXECUTED){
            status = ChannelStatus.OFFCHAIN;
            emit DisputeResolved();
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
    
    //Function to start a dispute
    function dispute() external isChannelStatus(ChannelStatus.OFFCHAIN){
        
        //Prevent any party from calling this
        require(msg.sender == parties[0] || msg.sender == parties[1]);
        
        //Dispute can only be started if the current state is not terminal -> Allows a party to withdraw from a terminal state whenever it wants to
        require(stage != Stage.Success && stage != Stage.Failed);
        
        //Change into dispute-mode -> Parties can invoke functions
        status = ChannelStatus.DISPUTE;
        timeout = now + timeoutPeriod;
        emit Dispute();
    }
    
    //Function to finalie a dispute
    function finalizeDispute() external{
        
        //Check the status and that timeout has elapsed
        require((status == ChannelStatus.DISPUTE || status == ChannelStatus.EXECUTED) && timeout <= now);
        
        //If no input has been submitted the current player loses -> application specific because we have a fixed move sequence
        if(status == ChannelStatus.DISPUTE) {
            if(getCurrentPlayer() == parties[0])
                stage = Stage.Success; 
            else {
                stage = Stage.Failed;
            }
        }
        
        //Finalize DISPUTE
        //Increment version to prevent overwritting of the state with a possibly existing evidence for the next step (current version + 2 should not exist because an honest party signs only curent version + 1 and submits its most curent evidence in case of dispute)
        version = version + 1;
        status = ChannelStatus.OFFCHAIN;
        emit DisputeResolved();
    }
    
    //Computes the outcome -> Cannot be called when status is EXECUTED, because there may exist a more current valid evidence in this phase only
    function close() external {
        require(status != ChannelStatus.EXECUTED, "Finalize the dispute before closing the application");
        internalClose(stage);
    }
    
    //Invoke a fast closure if a terminal state is signed by each party
    function fastClose(uint _version, bytes32 _hashedWord, bool[26] memory _guessed, bytes memory _word, uint8 _currentGuess, uint _wordLength, uint _missingLetters, uint _tries, Stage _stage, bytes memory _signatures) public {
        //Check signatures
        verifySignatures(parties, abi.encode(address(this), _version, _hashedWord, _guessed, _word, _currentGuess, _wordLength, _missingLetters, _tries, _stage),_signatures);
        
        //Call closing
        internalClose(_stage);
    }
    
    //Actual internal closing used by both closing procedures
    function internalClose(Stage _stage) internal {
        if(_stage == Stage.Failed){
            selfdestruct(address(uint160(parties[0])));
        } else if(_stage == Stage.Success){
            selfdestruct(address(uint160(parties[1])));
        } else {
            revert("No terminal state"); //No terminal state
        }
    }
    
    //****************
    //Application logic

    
    //Commit to the word
    function commit (bytes32 _hashedWord, uint8 _wordLength) external isParty(parties[0]) isStage(Stage.WaitingForCommit) isChannelStatus(ChannelStatus.DISPUTE) {
        
        //Set application variables
        hashedWord = _hashedWord;
        wordLength = _wordLength;
        stage = Stage.WaitingForGuess;
        missingLetters = _wordLength;
        word = new bytes(_wordLength);
        
        endMove();
    }
    
    //Guess a letter
    function guess (uint8 _letter) external isParty(parties[1]) isStage(Stage.WaitingForGuess) isChannelStatus(ChannelStatus.DISPUTE) {
        
        //Convert byte to number
        uint8 _position = _letter - 65;
        
        //Needs to be a capital letter: (ASCII-65 bis ASCII-90)
        require(_position < 26, "Not a valid letter");
        
        //Check if letter has not been handled yet
        require(guessed[_position] == false,"Letter has already been guessed");
        
        //Set state and return new state
        currentGuess = _letter;
        stage = Stage.WaitingForResponse;
        
        endMove();
    }
    
    //The letter is part of the secret word
    function correct (uint8[] calldata _hits) external isParty(parties[0]) isStage(Stage.WaitingForResponse) isChannelStatus(ChannelStatus.DISPUTE){
        
        //Check input
        require(_hits.length > 0);
        
        //Set letters in the word
        for(uint i = 0; i < _hits.length ; i++){
            //Check that challenger behaves correct (no set letter, no index above maximal letters)
            if(_hits[i] >= wordLength || word[_hits[i]] != "\x00"){
                endMove();
                return;
            }
           
            //Set letter for the active word
            word[_hits[i]] = byte(currentGuess);
        }
        
        //Decrement missing letters
        missingLetters = missingLetters - _hits.length;
        
        //Set letter as guessed
        guessed[currentGuess - 65] = true; //Shift from "A" (ASCII-65) to index 0
        
        //Set next stage
        if (missingLetters < 1){
            stage = Stage.Success;
        } else {
            stage = Stage.WaitingForGuess;
        }
        
        endMove();
    }
    
    //The letter is not part of the secret word
    function wrong () external isParty(parties[0]) isStage(Stage.WaitingForResponse) isChannelStatus(ChannelStatus.DISPUTE){
        
        //Set letter as guessed
        guessed[currentGuess - 65] = true; //Shift from "A" (ASCII-65) to index 0
        
        //Increment tries
        tries++;
        
        //Set next stage
        if(tries == maxTries){
          stage = Stage.WaitingForOpen;
        } else {
          stage = Stage.WaitingForGuess;
        }
        
        endMove();
    }
    
    //Open the secret word after it has not been guessed successfully
    function open (bytes32 _nonce, bytes calldata _opening) external isParty(parties[0]) isStage(Stage.WaitingForOpen) isChannelStatus(ChannelStatus.DISPUTE){
    
        //Check stage and input
        require(stage == Stage.WaitingForOpen, "Not in the right stage for an opening");
        require(_opening.length == wordLength);
        
        //Check that there are no letters that no letter has been opened wrong
        for(uint i = 0; i < wordLength; i++){
          //Missbehaviour if a solution-letter does not match the working letter although it has been guessed
          if(word[i] != _opening[i] && guessed[uint8(_opening[i]) - 65]){
              stage = Stage.Success;
              endMove();
              return;
          }
        }
        
        //Check that given opening corresponds to the comitted hash
        if(keccak256(abi.encode(_nonce, _opening)) != hashedWord){
            stage = Stage.Success;
        } else {
            stage = Stage.Failed;
        }
        
        endMove();
    }
    
    //After a successful function call the new status is EXECUTED
    function endMove() private {
        status = ChannelStatus.EXECUTED;
    }
    
    //****************
    //Helper
    
    function getCurrentPlayer() internal returns (address){
        if(stage == Stage.WaitingForGuess){
            return parties[1];
        } else {
            return parties[0];
        }
    }
    
    //****************
    //Modifiers
    
    modifier isParty(address _party){
        require(msg.sender == _party, "Not the right party to call this function");
        _;
    }
    
    modifier isStage(Stage _stage){
        require(stage == _stage, "Not the right stage to call this function");
        _;
    }
    
    modifier isChannelStatus(ChannelStatus _status){
        require(status == _status, "Not the right channel status to call this function");
        _;
    }
    
    //****************
    //Getters
    
    function getState() external view returns (ChannelStatus, uint, uint, address[] memory, bytes32, bool[26] memory, bytes memory, uint8, uint, uint, uint, Stage){
        return (status, timeout, version, parties, hashedWord, guessed, word, currentGuess, wordLength, missingLetters, tries, stage);
    }
}
