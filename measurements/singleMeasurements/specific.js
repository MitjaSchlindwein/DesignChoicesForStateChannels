const states = require('./../sharedCode/hangmanStates');
const SE = require('./../sharedCode/signAndEncode');
const names = require('./../sharedCode/names');

module.exports = {

  testFastClose: function(web3js, hangmanChannelAddress, hangmanChannelAbi, logger, accounts, testName, callback) {

    //Contract reference
    var hangmanChannel = new web3js.eth.Contract(hangmanChannelAbi, hangmanChannelAddress);

    //Create sand sign final state
    var _finalState = states.getStateAfterRightT();
    var _signatures = SE.getEncodedSignaturesFromPlayer1And2(SE.hashInstanceState(hangmanChannelAddress,_finalState));

    //Fast close
    //Submit final state and close
    hangmanChannel.methods.fastClose(_finalState.version, _finalState.hashedWord, _finalState.guessed, _finalState.word, _finalState.currentGuess, _finalState.wordLength, _finalState.missingLetters, _finalState.tries, _finalState.stage, _signatures)
      .send({
        from: accounts[0],
        gas: 1000000
      }, logger.getLogCallback(testName, names.fastClose, callback));
  },

  testNormal: function(web3js, hangmanChannelAddress, hangmanChannelAbi, logger, accounts, testName, callback) {

    //Contract reference
    var hangmanChannel = new web3js.eth.Contract(hangmanChannelAbi, hangmanChannelAddress);

    //Create states and signatures
    var _state1 = states.getStateAfterCommit();
    var _state2 = states.getStateAfterGuessE();
    var _state3 = states.getStateAfterRightE();
    var _signatures1 = SE.getEncodedSignaturesFromPlayer1And2(SE.hashInstanceState(hangmanChannelAddress,_state1));
    var _signatures2 = SE.getEncodedSignaturesFromPlayer1And2(SE.hashInstanceState(hangmanChannelAddress,_state2));
    var _signatures3 = SE.getEncodedSignaturesFromPlayer1And2(SE.hashInstanceState(hangmanChannelAddress,_state3));

    //React to event move performed
    var _actions = 0; //Action counter to be able to just add one action after another without evaluating the state
    hangmanChannel.events.movePerformed((error, event) => {
      if(error) {
        return;
      }
      if(_actions == 0){
        //Wrong N
        hangmanChannel.methods.wrong().send({from: accounts[0], gas: 1000000}, logger.getLogCallback(testName, names.wrongN));
      } else if (_actions == 1){
        //Guess S
        hangmanChannel.methods.guess(83).send({from: accounts[1], gas: 1000000}, logger.getLogCallback(testName, names.guessS));
      } else if (_actions == 2){
        //Correct S
        hangmanChannel.methods.correct([2]).send({from: accounts[0], gas: 1000000}, logger.getLogCallback(testName, names.correctS));
      } else if (_actions == 3){
        //Guess A
        hangmanChannel.methods.guess(65).send({from: accounts[1], gas: 1000000}, logger.getLogCallback(testName, names.guessA));
      } else if (_actions == 4){
        //Wrong A
        hangmanChannel.methods.wrong().send({from: accounts[0], gas: 1000000}, logger.getLogCallback(testName, names.wrongA));
      } else if (_actions == 5){
        //Guess T
        hangmanChannel.methods.guess(84).send({from: accounts[1], gas: 1000000}, logger.getLogCallback(testName, names.guessT));
      } else if (_actions == 6){
        //Correct T
        hangmanChannel.methods.correct([0,3]).send({from: accounts[0], gas: 1000000}, logger.getLogCallback(testName, names.correctT));
      } else if (_actions == 7){
        //Close
        hangmanChannel.methods.close().send({from: accounts[0], gas: 1000000}, logger.getLogCallback(testName, names.close, callback));
      }
      _actions++;
    });

    //Start dispute - update- finalize - first move
    hangmanChannel.methods.dispute(_state1.version, _state1.hashedWord, _state1.guessed, _state1.word, _state1.currentGuess, _state1.wordLength, _state1.missingLetters, _state1.tries, _state1.stage, _signatures1)
      .send({
        from: accounts[0],
        gas: 1000000
      }, function(err, res) {
        logger.getLogCallback(testName, names.startDispute)(err, res);
        if (res) {
          hangmanChannel.methods.dispute(_state2.version, _state2.hashedWord, _state2.guessed, _state2.word, _state2.currentGuess, _state2.wordLength, _state2.missingLetters, _state2.tries, _state2.stage, _signatures2)
            .send({
              from: accounts[1],
              gas: 1000000
            }, function(err, res) {
              logger.getLogCallback(testName, names.updateDispute)(err, res);
              if (res) {
                hangmanChannel.methods.dispute(_state3.version, _state3.hashedWord, _state3.guessed, _state3.word, _state3.currentGuess, _state3.wordLength, _state3.missingLetters, _state3.tries, _state3.stage, _signatures3)
                  .send({
                    from: accounts[0],
                    gas: 1000000
                  }, function(err, res) {
                    logger.getLogCallback(testName, names.updateDispute)(err, res);
                    if (res) {
                      //Wait till finalization is possible -> Then finalize -> We are after guess N -> So tell that N is false
                      setTimeout(function () {
                        //Finalize
                        hangmanChannel.methods.finalizeDispute()
                          .send({
                            from: accounts[0],
                            gas: 1000000
                          }, function(err, res) {
                            logger.getLogCallback(testName, names.finalizeDispute)(err, res);
                            if (res) {
                              //Perform first onchain-move
                              hangmanChannel.methods.guess(78).send({from: accounts[1], gas: 1000000}, logger.getLogCallback(testName, names.guessN));
                            }
                          });
                      }, 11000);
                    }
                  });
              }
            });
        }
      });
  }
}
