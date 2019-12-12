pragma solidity 0.5.10;
pragma experimental "ABIEncoderV2";

//This is shared code between the two models deploying a contract for each application instance

//We assume that players only sign / produce states that can occur in a proper execution
//For example, they do not sign / produce a state in which a player has used all of his ten tries but still is in stage WaitingForGuess
contract AbstractHangmanChannel{
    
    //******************
    // Variables, enums, structures
    
    //constant after initialization
    uint maxTries;
    uint challengePeriod;
    
    event LogStatus(string _text, ChannelStatus _status);
    
    //Enums
    enum Stage {
      WaitingForCommit, WaitingForGuess, WaitingForResponse, WaitingForOpen, Failed, Success
    }
    
    //Channel specific variables
    address[] parties;
    ChannelStatus status;
    uint challenged;
    
    enum ChannelStatus {
        NONE, OFFCHAIN, DISPUTE, ONCHAIN
    }
    
    //Execution specific variables
    bytes32 hashedWord;
    bool[26] guessed; //Originally we used a mapping but we cant use mapping in memory-structures
    bytes word;
    uint8 currentGuess; //Uint representation of a capital letter's ascii byte
    uint wordLength;
    uint missingLetters;
    uint tries ;
    Stage stage;
    
    //Events
    event movePerformed(Stage newStage);
    
    //****************
    // Super constructor
    
    constructor(uint _maxTries, uint _challengePeriod, address[] memory _parties) public payable{
        //constants
        maxTries = _maxTries;
        challengePeriod = _challengePeriod;
        
        //Channel initialization
        parties = _parties;
        challenged = 0;
        
        //Application initializations
        tries = 0;
        stage = Stage.WaitingForCommit;
    }
    
    //****************
    //Logic to enforce a move
    
    //As there is a fixed move sequence this function challenges the acting party to perform its move
    function challenge() external isChannelStatus(ChannelStatus.ONCHAIN) {
        
        //May only challenge if no terminal state and no running challenge
        require(challenged == 0);
        require(stage != Stage.Failed && stage != Stage.Success);
        require(msg.sender == parties[0] || msg.sender == parties[1]);
        
        challenged = now + challengePeriod;
        
        emit movePerformed(stage);
    }
    
    //If the acting party has not performed its move it is punished with losing the game
    function finalizeChallenge() external isChannelStatus(ChannelStatus.ONCHAIN) {
        
        //Challenge can only be finalized if timeout period has elapsed and no terminal stage
        require(challenged <= now);
        require(stage != Stage.Failed && stage != Stage.Success);
        require(msg.sender == parties[0] || msg.sender == parties[1]);
        
        //If Party2 (Guesser) is challenged and has not reacted he loses
        if(stage == Stage.WaitingForGuess){
            stage == Stage.Failed;
        } else {
        //If Party 2 (Challenger) is challenged and has not reacted the guesser wins
            stage == Stage.Success;
        }
        
        finishAction();
    }
    
    //****************
    //Application logic
    
    //Commit to the word
    function commit (bytes32 _hashedWord, uint8 _wordLength) external isParty(parties[0]) isStage(Stage.WaitingForCommit) isChannelStatus(ChannelStatus.ONCHAIN) {
        
        //Set application variables
        hashedWord = _hashedWord;
        wordLength = _wordLength;
        stage = Stage.WaitingForGuess;
        missingLetters = _wordLength;
        word = new bytes(_wordLength);
        
        finishAction();
    }
    
    //Guess a letter
    function guess (uint8 _letter) external isParty(parties[1]) isStage(Stage.WaitingForGuess) isChannelStatus(ChannelStatus.ONCHAIN) {
        
        //Convert byte to number
        uint8 _position = _letter - 65;
        
        //Needs to be a capital letter: (ASCII-65 bis ASCII-90)
        require(_position < 26, "Not a valid letter");
        
        //Check if letter has not been handled yet
        require(guessed[_position] == false,"Letter has already been guessed");
        
        //Set state and return new state
        currentGuess = _letter;
        stage = Stage.WaitingForResponse;
        
        finishAction();
    }
    
    //The letter is part of the secret word
    function correct (uint8[] calldata _hits) external isParty(parties[0]) isStage(Stage.WaitingForResponse) isChannelStatus(ChannelStatus.ONCHAIN){
        
        //Check input
        require(_hits.length > 0);
        
        //Set letters in the word
        for(uint i = 0; i < _hits.length ; i++){
            //Check that challenger behaves correct (no set letter, no index above maximal letters)
            if(_hits[i] >= wordLength || word[_hits[i]] != "\x00"){
                finishAction();
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
        
        finishAction();
    }
    
    //The letter is not part of the secret word
    function wrong () external isParty(parties[0]) isStage(Stage.WaitingForResponse) isChannelStatus(ChannelStatus.ONCHAIN){
        
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
        
        finishAction();
    }
    
    //Open the secret word after it has not been guessed successfully
    function open (bytes32 _nonce, bytes calldata _opening) external isParty(parties[0]) isStage(Stage.WaitingForOpen) isChannelStatus(ChannelStatus.ONCHAIN){
    
        //Check stage and input
        require(stage == Stage.WaitingForOpen, "Not in the right stage for an opening");
        require(_opening.length == wordLength);
        
        //Check that there are no letters that no letter has been opened wrong
        for(uint i = 0; i < wordLength; i++){
          //Missbehaviour if a solution-letter does not match the working letter although it has been guessed
          if(word[i] != _opening[i] && guessed[uint8(_opening[i]) - 65]){
              stage = Stage.Success;
              finishAction();
              return;
          }
        }
        
        //Check that given opening corresponds to the comitted hash
        if(keccak256(abi.encode(_nonce, _opening)) != hashedWord){
            stage = Stage.Success;
        } else {
            stage = Stage.Failed;
        }
        
        finishAction();
    }
    
    //Resets the challenge timeout and notifies parties about a performed move
    function finishAction() internal {
        challenged = 0;
        emit movePerformed(stage);
    }
 
    //Computes the outcome (Needs a terminal state)
    function close() external isChannelStatus(ChannelStatus.ONCHAIN) {
        internalClose(stage);
    }
    
    //Actually performs the closing (called by normal and fast close)
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
}
