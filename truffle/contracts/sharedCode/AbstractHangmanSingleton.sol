pragma solidity 0.5.10;
pragma experimental "ABIEncoderV2";


//This is shared code between the two models using a singleton for managing all instances witht he same application

//We assume that players only sign / produce states that can occur in a proper execution
//For example, they do not sign / produce a state in which a player has used all of his ten tries but still is in stage WaitingForGuess
contract AbstractHangmanSingleton{
    
    //******************
    // Variables, enums, structures
    
    //constant after initialization
    uint maxTries;
    uint minFunding;
    uint challengePeriod;
    
    //Channel Instances -> We divide the variables to be able to reuse the code
    mapping(bytes32 => ApplicationVariables) applicationState;
    mapping(bytes32 => MaintainanceVariables) instanceState;
    uint nextFreeId = 0;
    
    //Events
    event newChannel(bytes32 id);
    event movePerformed(bytes32 id, Stage newStage);
    
    //Enums
    enum Stage {
      WaitingForCommit, WaitingForGuess, WaitingForResponse, WaitingForOpen, Failed, Success
    }
    
    enum ChannelStatus {
        NONE, OFFCHAIN, DISPUTE, ONCHAIN, CLOSED
    }
    
    //Structures
    struct MaintainanceVariables {
        ChannelStatus status;
        uint funding;
        address[] parties;
    }
    
    struct ApplicationVariables {
        bytes32 hashedWord;
        bool[26] guessed;
        bytes word;
        uint8 currentGuess;
        uint wordLength;
        uint missingLetters;
        uint tries ;
        Stage stage;
        
        uint challenged;
    }
    
    //****************
    //Constructor
    constructor(uint _maxTries, uint _minFunding, uint _challengePeriod) public{
        //constants
        maxTries = _maxTries;
        minFunding = _minFunding;
        challengePeriod = _challengePeriod;
    }
    
    //****************
    //Shared Singleton logic
    function createInstance(bytes32 _nonce, address[] calldata _parties) external payable {
        
        //Determine the id by the senders-address, the library-address and a nonce -> Enables parties to sign states of isntances that has not been created yet
	    bytes32 _id = keccak256(abi.encode(_nonce, _parties));
        
        //Checks
        require(instanceState[_id].status == ChannelStatus.NONE && _parties.length >= 2);
	    
	    //Check that sent coins aren't below the minimum investment
	    require(msg.value >= minFunding);
	    
	    //Create channel instance
	    bool[26] memory _boolArray; //I hope this already initializes the array
	    instanceState[_id] = MaintainanceVariables(ChannelStatus.OFFCHAIN, msg.value, _parties);
	    applicationState[_id] = ApplicationVariables(0, _boolArray, "\x00", 0, 0, 0, 0, Stage.WaitingForCommit, 0);
	    setInitialDisputeState(_id);

        //Notification
        emit newChannel(_id);
    }
    
    function setInitialDisputeState(bytes32 _id) internal;
    
    //****************
    //Application logic
    
    //As there is a fixed move sequence this function challenges the acting party to perform its move
    function challenge(bytes32 _id) external isChannelStatus(_id, ChannelStatus.ONCHAIN) {
        
        //May only challenge if no terminal state and no running challenge
        require(applicationState[_id].challenged == 0);
        require(applicationState[_id].stage != Stage.Failed && applicationState[_id].stage != Stage.Success);
        require(msg.sender == instanceState[_id].parties[0] || msg.sender == instanceState[_id].parties[1]);
        
        applicationState[_id].challenged = now + challengePeriod;
        
        emit movePerformed(_id, applicationState[_id].stage);
    }
    
    //If the acting party has not performed its move it is punished with losing the game
    function finalizeChallenge(bytes32 _id) external isChannelStatus(_id, ChannelStatus.ONCHAIN) {
        
        //Challenge can only be finalized if timeout period has elapsed and no terminal stage
        require(applicationState[_id].challenged <= now);
        require(applicationState[_id].stage != Stage.Failed && applicationState[_id].stage != Stage.Success);
        require(msg.sender == instanceState[_id].parties[0] || msg.sender == instanceState[_id].parties[1]);
        
        //If Party2 (Guesser) is challenged and has not reacted he loses
        if(applicationState[_id].stage == Stage.WaitingForGuess){
            applicationState[_id].stage == Stage.Failed;
        } else {
        //If Party 2 (Challenger) is challenged and has not reacted the guesser wins
            applicationState[_id].stage == Stage.Success;
        }
        
        finishAction(_id);
    }
    
    //Commit to the word
    function commit (bytes32 _id, bytes32 _hashedWord, uint8 _wordLength) external isParty(instanceState[_id].parties[0]) isStage(_id, Stage.WaitingForCommit) isChannelStatus(_id, ChannelStatus.ONCHAIN) {
        
        //Set application variables
        applicationState[_id].hashedWord = _hashedWord;
        applicationState[_id].wordLength = _wordLength;
        applicationState[_id].stage = Stage.WaitingForGuess;
        applicationState[_id].missingLetters = _wordLength;
        applicationState[_id].word = new bytes(_wordLength);
        
        finishAction(_id);
    }
    
    //Guess a letter
    function guess (bytes32 _id, uint8 _letter) external isParty(instanceState[_id].parties[1]) isStage(_id, Stage.WaitingForGuess) isChannelStatus(_id, ChannelStatus.ONCHAIN) {
        
        //Convert byte to number
        uint8 _position = _letter - 65;
        
        //Needs to be a capital letter: (ASCII-65 bis ASCII-90)
        require(_position < 26);
        
        //Check if letter has not been handled yet
        require(applicationState[_id].guessed[_position] == false);
        
        //Set state and return new state
        applicationState[_id].currentGuess = _letter;
        applicationState[_id].stage = Stage.WaitingForResponse;
        
        finishAction(_id);
    }
    
    //The letter is part of the secret word
    function correct (bytes32 _id, uint8[] calldata _hits) external isParty(instanceState[_id].parties[0]) isStage(_id, Stage.WaitingForResponse) isChannelStatus(_id, ChannelStatus.ONCHAIN){
        
        //Check input
        require(_hits.length > 0);
        
        //Set letters in the word
        for(uint i = 0; i < _hits.length ; i++){
            //Check that challenger behaves correct (no set letter, no index above maximal letters)
            if(_hits[i] >= applicationState[_id].wordLength || applicationState[_id].word[_hits[i]] != "\x00"){
                finishAction(_id);
                return;
            }
           
            //Set letter for the active word
            applicationState[_id].word[_hits[i]] = byte(applicationState[_id].currentGuess);
        }
        
        //Decrement missing letters
        applicationState[_id].missingLetters = applicationState[_id].missingLetters - _hits.length;
        
        //Set letter as guessed
        applicationState[_id].guessed[applicationState[_id].currentGuess - 65] = true; //Shift from "A" (ASCII-65) to index 0
        
        //Set next stage
        if (applicationState[_id].missingLetters < 1){
            applicationState[_id].stage = Stage.Success;
        } else {
            applicationState[_id].stage = Stage.WaitingForGuess;
        }
        
        finishAction(_id);
    }
    
    //The letter is not part of the secret word
    function wrong (bytes32 _id) external isParty(instanceState[_id].parties[0]) isStage(_id, Stage.WaitingForResponse) isChannelStatus(_id, ChannelStatus.ONCHAIN){
        
        //Set letter as guessed
        applicationState[_id].guessed[applicationState[_id].currentGuess - 65] = true; //Shift from "A" (ASCII-65) to index 0
        
        //Increment tries
        applicationState[_id].tries++;
        
        //Set next stage
        if(applicationState[_id].tries == maxTries){
          applicationState[_id].stage = Stage.WaitingForOpen;
        } else {
          applicationState[_id].stage = Stage.WaitingForGuess;
        }
        
        finishAction(_id);
    }
    
    //Open the secret word after it has not been guessed successfully
    function open (bytes32 _id, bytes32 _nonce, bytes calldata _opening) external isParty(instanceState[_id].parties[0]) isStage(_id, Stage.WaitingForOpen) isChannelStatus(_id, ChannelStatus.ONCHAIN){
    
        //Check stage and input
        require(applicationState[_id].stage == Stage.WaitingForOpen);
        require(_opening.length == applicationState[_id].wordLength);
        
        //Check that there are no letters that no letter has been opened wrong
        for(uint i = 0; i < applicationState[_id].wordLength; i++){
          //Missbehaviour if a solution-letter does not match the working letter although it has been guessed
          if(applicationState[_id].word[i] != _opening[i] && applicationState[_id].guessed[uint8(_opening[i]) - 65]){
              applicationState[_id].stage = Stage.Success;
              finishAction(_id);
              return;
          }
        }
        
        //Check that given opening corresponds to the comitted hash
        if(keccak256(abi.encode(_nonce, _opening)) != applicationState[_id].hashedWord){
            applicationState[_id].stage = Stage.Success;
        } else {
            applicationState[_id].stage = Stage.Failed;
        }
        
        finishAction(_id);
    }
    
    //Resets the challenge timeout and notifies parties about a performed move
    function finishAction(bytes32 _id) internal {
        applicationState[_id].challenged = 0;
        emit movePerformed(_id, applicationState[_id].stage);
    }
 
    //Computes the outcome (Needs a terminal state)
    function close(bytes32 _id) external isChannelStatus(_id, ChannelStatus.ONCHAIN) {
        internalClose(_id, applicationState[_id].stage);
    }
    
    //Actually performs the closing (called by normal and fast close)
    function internalClose(bytes32 _id, Stage _stage) internal {
        if(_stage == Stage.Failed){
            address(uint160(instanceState[_id].parties[0])).transfer(instanceState[_id].funding);
            instanceState[_id].status = ChannelStatus.CLOSED;
        } else if(_stage == Stage.Success){
            address(uint160(instanceState[_id].parties[1])).transfer(instanceState[_id].funding);
            instanceState[_id].status = ChannelStatus.CLOSED;
        } else {
            revert("No terminal state"); //No terminal state
        }
    }
    
    //****************
    //Modifiers
    modifier isParty(address _party){
        require(msg.sender == _party);
        _;
    }
    
    modifier isStage(bytes32 _id, Stage _stage){
        require(applicationState[_id].stage == _stage);
        _;
    }
    
    modifier isChannelStatus(bytes32 _id, ChannelStatus _status){
        require(instanceState[_id].status == _status);
        _;
    }
    
}
