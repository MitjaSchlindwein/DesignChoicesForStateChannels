const states = require('./../sharedCode/hangmanStates');
const SE = require('./../sharedCode/signAndEncode');
const names = require('./../sharedCode/names');

module.exports = {

  testFastClose: function(web3js, offchainRecovererAddress, offchainRecovererAbi, logger, accounts, testName, callback) {

    //Reference contract
    var offchainRecoverer = new web3js.eth.Contract(offchainRecovererAbi, offchainRecovererAddress);

    //Create states and signatures for the final state
    var _finalState = states.getStateAfterRightT();
    var _signatures = SE.getEncodedSignaturesFromPlayer1And2(SE.hashInstanceState(offchainRecovererAddress,_finalState));

    //Just provide final state to fast closure
    offchainRecoverer.methods.fastClose(_finalState.version, _finalState.hashedWord, _finalState.guessed, _finalState.word, _finalState.currentGuess, _finalState.wordLength, _finalState.missingLetters, _finalState.tries, _finalState.stage, _signatures)
      .send({
        from: accounts[0],
        gas: 1000000
      }, logger.getLogCallback(testName, names.fastClose, callback));

  },

  //What do we want to do?

  //Provide evidence 1 -> start dispute -> resolve offchain with evidence 2 -> start dispute -> provide input (move: Right E) -> resolve offchain with evidence 3 -> provide evidence 4 -> dispute -> provide input 5 (wrong N) -> Finalize dispute
  // -> dispute -> provide input 6 (Guess S) -> Finalize dispute -> Provide evidence 10 -> Dispute -> provide input 11 (right with 2 hits) -> finalize -> Close

  testNormal: function(web3js, offchainRecovererAddress, offchainRecovererAbi, logger, accounts, testName, callback) {

    //Reference contract
    var offchainRecoverer = new web3js.eth.Contract(offchainRecovererAbi, offchainRecovererAddress);

    //Create states and signatures
    var _states = [];
    _states[1] = states.getStateAfterCommit();
    _states[2] = states.getStateAfterGuessE();
    _states[3] = states.getStateAfterRightE();
    _states[4] = states.getStateAfterGuessN();
    _states[5] = states.getStateAfterWrongN();
    _states[6] = states.getStateAfterGuessS();
    _states[7] = states.getStateAfterRightS();
    _states[8] = states.getStateAfterGuessA();
    _states[9] = states.getStateAfterWrongA();
    _states[10] = states.getStateAfterGuessT();
    _states[11] = states.getStateAfterGuessT();
    var _signatures = [];
    for(var i = 1; i <= 11; i++){
      _signatures[i] = SE.getEncodedSignaturesFromPlayer1And2(SE.hashInstanceState(offchainRecovererAddress,_states[i]));
    }

    //Helper functions
    var sendEvidence = function(_partyId, _stateId, _delay){
      setTimeout(function () {
        offchainRecoverer.methods.evidence(_states[_stateId].version, _states[_stateId].hashedWord, _states[_stateId].guessed, _states[_stateId].word, _states[_stateId].currentGuess, _states[_stateId].wordLength, _states[_stateId].missingLetters, _states[_stateId].tries, _states[_stateId].stage, _signatures[_stateId]).send({
          from: accounts[_partyId],
          gas: 1000000
        }, logger.getLogCallback(testName, names.submitEvidence));
      }, _delay);
    }

    var startDispute = function(_partyId, _delay){
      setTimeout(function () {
        offchainRecoverer.methods.dispute().send({
          from: accounts[_partyId],
          gas: 1000000
        }, logger.getLogCallback(testName, names.startDispute));
      }, _delay);
    }

    var finalizeDispute = function(_partyId, _delay){
      setTimeout(function () {
        offchainRecoverer.methods.finalizeDispute().send({
          from: accounts[_partyId],
          gas: 1000000
        }, logger.getLogCallback(testName, names.finalizeDispute));
      }, _delay);
    }

    //Execute the test

    //Evidence 1
    sendEvidence(0, 1, 0);
    //Dispute for state 2
    startDispute(0,2000);
    //Resolve with state 2
    sendEvidence(1, 2, 4000);
    //Dispute for state 3
    startDispute(1,6000);
    //Provide input for state 3
    setTimeout(function () {
      offchainRecoverer.methods.correct([1]).send({
        from: accounts[0],
        gas: 1000000
      }, logger.getLogCallback(testName, names.correctE));
    }, 8000);
    //Still resolve with state 3
    sendEvidence(1, 3, 10000);
    //Provide evidence for state 4
    sendEvidence(0, 4, 12000);
    //Start dispute for state 5
    startDispute(1,14000);
    //Provide input for state 5 (wrong N)
    setTimeout(function () {
      offchainRecoverer.methods.wrong().send({
        from: accounts[0],
        gas: 1000000
      }, logger.getLogCallback(testName, names.wrongN));
    }, 16000);
    //Finalize dispute for state 5
    finalizeDispute(0, 28000);
    //Start dispute for state 6
    startDispute(0, 30000);
    //Provide input for state 5 (guess S)
    setTimeout(function () {
      offchainRecoverer.methods.guess(83).send({
        from: accounts[1],
        gas: 1000000
      }, logger.getLogCallback(testName, names.guessS));
    }, 32000);
    //Finalize dispute for state 6
    finalizeDispute(1, 44000);
    //Provide evidence for state 10
    sendEvidence(0, 10, 46000);
    //Start dispute for state 11
    startDispute(0,48000);
    //Provide input for state 11 (correct T)
    setTimeout(function () {
      offchainRecoverer.methods.correct([0,3]).send({
        from: accounts[0],
        gas: 1000000
      }, logger.getLogCallback(testName, names.correctT));
    }, 50000);
    //Finalize dispute for state 11
    finalizeDispute(1, 62000);
    //Close channel
    setTimeout(function () {
      offchainRecoverer.methods.close().send({
        from: accounts[0],
        gas: 1000000
      }, logger.getLogCallback(testName, names.close, callback));
    }, 64000);

  }
}
