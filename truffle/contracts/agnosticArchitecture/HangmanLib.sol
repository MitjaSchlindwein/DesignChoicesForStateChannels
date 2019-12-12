pragma solidity 0.5.10;
pragma experimental "ABIEncoderV2";

import "contracts/agnosticArchitecture/OffchainLibrary.sol";

//We assume that players only sign / produce states that can occur in a proper execution
//For example, they do not sign / produce a state in which a player has used all of his ten tries but still is in stage WaitingForGuess
contract HangmanLib is OffchainLibrary{
  
  //Define global constants here
  uint constant MAX_TRIES = 7;
  uint constant TIMEOUT_PERIOD = 42;

  //We recommend to use an enum for the action type and the different stages (reflect approximately a state transition diagram)
  // 0: Nothing
  // 1: Commit
  // 2. Guess
  // 3: Correct
  // 4: Wrong
  // 5: Open
  // 6: Challenge
  // 7: ResolveChallenge
  
  enum Stage {
      WaitingForCommit, WaitingForGuess, WaitingForResponse, WaitingForOpen, Failed, Success
  }
  
  //We recommend to define a state with a structure. This should always contain the current stage
  struct AppState {
      bytes32 hashedWord;
      bool[26] guessed; //Originally we used a mapping but we cant use mapping in memory-structures
      bytes word;
      uint8 currentGuess; //Uint representation of a capital letter's ascii byte
      uint wordLength;
      uint missingLetters;
      uint tries;
      Stage stage;

      uint challenge;
  }
 
  //Applies the action in non-terminal states
  //A previous call of getTurnTaker ensures that only the acting party is allowed to execute
  function callAction(
    bytes calldata encodedState, uint _actionId, bytes calldata encodedAction, address[] calldata parties, address actor
  )
    external
    view
    returns (bytes memory)
  {
    //Convert state and input
    AppState memory appState = abi.decode(encodedState, (AppState));
    
    //Logic to challenge a move and terminate if challenge has not been responded
    if(_actionId == 6){   //Challenge counterparty to execute its move
        return challenge(appState);
    }
    if(_actionId == 7){
        return resolveChallenge(appState);
    }
    
    //Check that acting party is allowed to make a move
    //Party 2 (Guesser), if phase WaitingForGuess
    if(_actionId == 2){
        require(actor == parties[1]);
    } else {
    //Party 1 (Challenger) otherwise: WaitingForResponse, WaitingForOpen
        require(actor == parties[0]);
    }
   
    //Execute action according to input
    if(_actionId == 2){ //Guess
        return guess(appState, encodedAction);
    } else if(_actionId == 3) { //Correct-Guess
        return correct(appState,encodedAction);
    } else if(_actionId == 4) { //Wrong-Guess
        return wrong(appState);
    } else if(_actionId == 5) { //Open the challenge
        return open(appState, encodedAction);
    } else if(_actionId == 1){
        return commit(appState, encodedAction);
    } else {
        revert("No valid action has been specified");
    }
  }
 
  //Computes the outcome (Needs a terminal state)
  function getOutcome(bytes calldata encodedState, uint funding)
    external
    pure
    returns (uint[] memory)
  {
    //Convert the state
    AppState memory appState = abi.decode(encodedState, (AppState));
    
    uint[] memory _outcome = new uint[](2);
    
    if(appState.stage == Stage.Failed){
        _outcome[0] = funding;
        _outcome[1] = 0;
        return _outcome;
    }
    if(appState.stage == Stage.Success){
        _outcome[0] = 0;
        _outcome[1] = funding;
        return _outcome;
    }
    revert("No terminal state"); //No terminal state
  }
 
  
  //Private functions with the actual logic
  function challenge (AppState memory appState) internal view returns (bytes memory) {
   
    //May only challenge if no terminal state and no running challenge
    require(appState.challenge == 0);
    require(appState.stage != Stage.Failed && appState.stage != Stage.Success);
   
    appState.challenge = now + 42;
   
    return abi.encode(appState);
  }
  
  function resolveChallenge (AppState memory appState) internal view returns (bytes memory) {
   
    //Challenge can only be resolved if timeout period has elapsed and no terminal stage
    require(appState.challenge <= now);
    require(appState.stage != Stage.Failed && appState.stage != Stage.Success);
    
    //If Party2 (Guesser) is challenged and has not reacted he loses
    if(appState.stage == Stage.WaitingForGuess){
        appState.stage == Stage.Failed;
    } else {
    //If Party 2 (Challenger) is challenged and has not reacted the guesser wins
        appState.stage == Stage.Success;
    }
    
    appState.challenge = 0;
   
    return abi.encode(appState);
  }
  
  function commit (AppState memory appState, bytes memory input) internal pure returns (bytes memory) {
   
    //Check stage
    require(appState.stage == Stage.WaitingForCommit,"Not in the right stage for a commitment");
    
    //Decode Input
    (bytes32 _hashedWord, uint _wordLength)  = abi.decode(input, (bytes32, uint));
   
    appState.hashedWord = _hashedWord;
    appState.wordLength = _wordLength;
    appState.stage = Stage.WaitingForGuess;
    appState.missingLetters = _wordLength;
    appState.word = new bytes(_wordLength);
    appState.challenge = 0;
   
    return abi.encode(appState);
  }
 
  function guess (AppState memory appState, bytes memory input) internal pure returns (bytes memory) {
   
    //Check stage
    require(appState.stage == Stage.WaitingForGuess,"Not in the right stage for a guess");
    
    //Decode Input
    uint8 _letter = abi.decode(input, (uint8));
   
    //Convert byte to number
    uint8 position = _letter - 65;
   
    //Needs to be a capital letter: (ASCII-65 bis ASCII-90)
    require(position < 26, "Not a valid letter");
   
    //Check if letter has not been handled yet
    require(appState.guessed[position] == false,"Letter has already been guessed");
   
    //Set state and return new state
    appState.currentGuess = _letter;
    appState.stage = Stage.WaitingForResponse;
    appState.challenge = 0;
    return abi.encode(appState);
  }
 
  function correct (AppState memory appState, bytes memory input) internal pure returns (bytes memory){
   
    //Check stage
    require(appState.stage == Stage.WaitingForResponse,"Not in the right stage for a response");
    
    //Decode Input
    uint8[] memory _hits = abi.decode(input, (uint8[]));
    
    //Check input
    require(_hits.length > 0);
   
    //Set letters in the word
    for(uint i = 0; i < _hits.length ; i++){
        //Check that challenger behaves correct (no set letter, no index above maximal letters)
        if(_hits[i] >= appState.wordLength || appState.word[_hits[i]] != "\x00"){
            appState.stage = Stage.Success;
            return abi.encode(appState);
        }
       
        //Set letter for the active word
        appState.word[_hits[i]] = byte(appState.currentGuess);
    }
   
    //Decrement missing letters
    appState.missingLetters = appState.missingLetters - _hits.length;
   
    //Set letter as guessed
    appState.guessed[appState.currentGuess - 65] = true; //Shift from "A" (ASCII-65) to index 0
   
    //Set next stage
    if (appState.missingLetters < 1){
        appState.stage = Stage.Success;
    } else {
        appState.stage = Stage.WaitingForGuess;
    }
   
   appState.challenge = 0;
   
    return abi.encode(appState);
  }
 
  function wrong (AppState memory appState) internal pure returns (bytes memory) {
     
      //Check stage
      require(appState.stage == Stage.WaitingForResponse, "Not in the right stage for a response");
     
      //Set letter as guessed
      appState.guessed[appState.currentGuess - 65] = true; //Shift from "A" (ASCII-65) to index 0
     
      //Increment trues
      appState.tries++;
     
      //Set next stage
      if(appState.tries == MAX_TRIES){
          appState.stage = Stage.WaitingForOpen;
      } else {
          appState.stage = Stage.WaitingForGuess;
      }
     
     appState.challenge = 0;
     
      return abi.encode(appState);
  }
 
  function open (AppState memory appState, bytes memory input) internal pure returns (bytes memory) {
     
      //Check stage
      require(appState.stage == Stage.WaitingForOpen, "Not in the right stage for an opening");
      
      //Decode Input
      (bytes memory _opening, bytes32 _nonce) = abi.decode(input, (bytes, bytes32));
      
      //Check input
      require(_opening.length == appState.wordLength);
     
      //Check that there are no letters that no letter has been opened wrong
      for(uint i = 0; i < appState.wordLength; i++){
          //Missbehaviour if a solution-letter does not match the working letter although it has been guessed
          if(appState.word[i] != _opening[i] && appState.guessed[uint8(_opening[i]) - 65]){
              appState.stage = Stage.Success;
              return abi.encode(appState);
          }
      }
     
      //Check that given opening corresponds to the comitted hash
      if(keccak256(abi.encode(_nonce, _opening)) != appState.hashedWord){
          appState.stage = Stage.Success;
          return abi.encode(appState);
      }
     
      //TODO Check that word really exists (Dictionary?) -> No need to implement
     
      //If all checks passed: Failure of guesser -> Challenger wins
      appState.stage = Stage.Failed;
      appState.challenge = 0;
      return abi.encode(appState);
  }

}
