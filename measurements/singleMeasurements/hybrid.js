const states = require('./../sharedCode/hangmanStates');
const SE = require('./../sharedCode/signAndEncode');
const names = require('./../sharedCode/names');

module.exports = {

  //What do we want to do
  // Create and directly lock an instance
  // Fast close the instance directly after creation
  testFastClose: function(web3js, hangmanChannelAddress, hangmanChannelAbi, logger, accounts, testName, callback) {

    //Contract reference
    var hangmanChannel = new web3js.eth.Contract(hangmanChannelAbi, hangmanChannelAddress);

    //Create states and signatures
    var _finalState = SE.getHybridDisputeboardChannelInfo(hangmanChannelAddress, hangmanChannelAddress, states.getStateAfterRightT());  //First argument would be disputeBoardAddress but we do not need it here

    //Submit final state and close
    hangmanChannel.methods.fastClose(_finalState.fastCloseStage, _finalState.fastClosedSignatures)
      .send({
        from: accounts[0],
        gas: 1000000
      }, logger.getLogCallback(testName, names.fastClose, callback));
  },

  testNormal: function(web3js, hangmanChannelAddress, disputeBoardAddress, hangmanChannelAbi, disputeBoardAbi, logger, accounts, testName, callback) {
    //Contract references
    var hangmanChannel = new web3js.eth.Contract(hangmanChannelAbi, hangmanChannelAddress);
    var disputeBoard = new web3js.eth.Contract(disputeBoardAbi, disputeBoardAddress);

    //Create states and signatures
    var _state1 = SE.getHybridDisputeboardChannelInfo(disputeBoardAddress, hangmanChannelAddress, states.getStateAfterCommit());
    var _state2 = SE.getHybridDisputeboardChannelInfo(disputeBoardAddress, hangmanChannelAddress, states.getStateAfterGuessE());
    var _state3 = SE.getHybridDisputeboardChannelInfo(disputeBoardAddress, hangmanChannelAddress, states.getStateAfterRightE());

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

    this.performDisputeTillFirstMove(disputeBoard, hangmanChannel, _state1, _state2, _state3, logger, testName, accounts);
  },

  performDisputeTillFirstMove: function(disputeBoard, hangmanChannel, _state1, _state2, _state3, logger, testName, accounts) {
    //Start dispute at the dispute board
    disputeBoard.methods.dispute(_state1.id, _state1.version, _state1.stateHash, _state1.signatures)
      .send({
        from: accounts[0],
        gas: 1000000
      }, function(err, res) {
        logger.getLogCallback(testName, names.startDispute)(err, res);
        if (res) {
          //Provide more current state
          disputeBoard.methods.dispute(_state2.id, _state2.version, _state2.stateHash, _state2.signatures)
            .send({
              from: accounts[1],
              gas: 1000000
            }, function(err, res) {
              logger.getLogCallback(testName, names.updateDispute)(err, res);
              if (res) {
                //Provide most current state
                disputeBoard.methods.dispute(_state3.id, _state3.version, _state3.stateHash, _state3.signatures)
                  .send({
                    from: accounts[0],
                    gas: 1000000
                  }, function(err, res) {
                    logger.getLogCallback(testName, names.updateDispute)(err, res);
                    if (res) {
                      //Wait till unlock is possible -> unlock and first move
                      setTimeout(function () {
                        //Finalize
                        hangmanChannel.methods.unlock(_state3.state.hashedWord, _state3.state.guessed, _state3.state.word, _state3.state.currentGuess, _state3.state.wordLength,  _state3.state.missingLetters, _state3.state.tries, _state3.state.stage)
                          .send({
                            from: accounts[0],
                            gas: 1000000
                          }, function(err, res) {
                            logger.getLogCallback(testName, names.unlock)(err, res);
                            if (res) {
                              //Perform first onchain-move -> guess N
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
