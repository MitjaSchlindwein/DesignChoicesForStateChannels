const states = require('./../sharedCode/hangmanStates');
const SE = require('./../sharedCode/signAndEncode');
const names = require('./../sharedCode/names');

module.exports = {
  testFastClose: function(web3js, specificSingletonAddress, specificSingletonAbi, logger, accounts, testName, callback) {

    //Contract reference
    var specificSingleton = new web3js.eth.Contract(specificSingletonAbi, specificSingletonAddress);

    //Create the channel
    specificSingleton.methods.createInstance(SE.getRandomNonce(),[accounts[0], accounts[1]]).send({
      from: accounts[0],
      gas: 1000000,
      value: 4200000000000000000
    }, logger.getLogCallback(testName, names.initializeChannel));

    //Fast close direct after creation
    var subscription = specificSingleton.events.newChannel((error, event) => {
      if (error) {
        console.log(error);
      } else {

        //Stop subscription to prevent fast closing in the other tests
        subscription.unsubscribe();

        //Create offchain-states
        var _finalState = SE.getChannelManagerStateInfo(specificSingletonAddress, event.returnValues.id, states.getStateAfterRightT());

        //Invoke fast closing
        specificSingleton.methods.fastClose(_finalState.id, _finalState.version, _finalState.encodedState, _finalState.signatures)
          .send({
            from: accounts[0],
            gas: 1000000
          }, logger.getLogCallback(testName, names.fastClose, callback));
      }
    });
  },
  testNormal: function(web3js, specificSingletonAddress, specificSingletonAbi, logger, accounts, testName, callback) {

    //Contract reference
    var specificSingleton = new web3js.eth.Contract(specificSingletonAbi, specificSingletonAddress);

    //React to the event "movePerformed"
    var _focusedId = undefined; //To handle only events of the newly created channel
    var _actions = 0; //Action counter to be able to just add one action after another without evaluating the state
    specificSingleton.events.movePerformed((error, event) => {
      if (error || _focusedId != event.returnValues.id) {
        return;
      }
      if (_actions == 0) {
        //Wrong N
        specificSingleton.methods.wrong(_focusedId).send({
          from: accounts[0],
          gas: 1000000
        }, logger.getLogCallback(testName, names.wrongN));
      } else if (_actions == 1) {
        //Guess S
        specificSingleton.methods.guess(_focusedId, 83).send({
          from: accounts[1],
          gas: 1000000
        }, logger.getLogCallback(testName, names.guessS));
      } else if (_actions == 2) {
        //Correct S
        specificSingleton.methods.correct(_focusedId, [2]).send({
          from: accounts[0],
          gas: 1000000
        }, logger.getLogCallback(testName, names.correctS));
      } else if (_actions == 3) {
        //Guess A
        specificSingleton.methods.guess(_focusedId, 65).send({
          from: accounts[1],
          gas: 1000000
        }, logger.getLogCallback(testName, names.guessA));
      } else if (_actions == 4) {
        //Wrong A
        specificSingleton.methods.wrong(_focusedId).send({
          from: accounts[0],
          gas: 1000000
        }, logger.getLogCallback(testName, names.wrongA));
      } else if (_actions == 5) {
        //Guess T
        specificSingleton.methods.guess(_focusedId, 84).send({
          from: accounts[1],
          gas: 1000000
        }, logger.getLogCallback(testName, names.guessT));
      } else if (_actions == 6) {
        //Correct T
        specificSingleton.methods.correct(_focusedId, [0, 3]).send({
          from: accounts[0],
          gas: 1000000
        }, logger.getLogCallback(testName, names.correctT));
      } else if (_actions == 7) {
        //Close
        specificSingleton.methods.close(_focusedId).send({
          from: accounts[0],
          gas: 1000000
        }, logger.getLogCallback(testName, names.close, callback));
      }
      _actions++;
    });

    //Create the channel
    specificSingleton.methods.createInstance(SE.getRandomNonce(),[accounts[0], accounts[1]]).send({
      from: accounts[0],
      gas: 1000000,
      value: 4200000000000000000
    }, logger.getLogCallback(testName, names.initializeChannel));

    //Actions in the new channel -> Reaection to event new channel
    specificSingleton.events.newChannel((error, event) => {
      if (error) {
        console.log(error);
      } else {

        //Prevent overwriting of the focusedId
        if (_focusedId) {
          return;
        }

        //Save ID to be able to ignore events from other IDs
        _focusedId = event.returnValues.id;

        //Create offchain-states
        var _state1 = SE.getChannelManagerStateInfo(specificSingletonAddress, event.returnValues.id, states.getStateAfterCommit());
        var _state2 = SE.getChannelManagerStateInfo(specificSingletonAddress, event.returnValues.id, states.getStateAfterGuessE());
        var _state3 = SE.getChannelManagerStateInfo(specificSingletonAddress, event.returnValues.id, states.getStateAfterRightE());

        //Start dispute with old state and update it with more current ones (twice)
        specificSingleton.methods.dispute(_state1.id, _state1.version, _state1.encodedState, _state1.signatures)
          .send({
            from: accounts[0],
            gas: 1000000
          }, function(err, res) {
            logger.getLogCallback(testName, names.startDispute)(err, res);
            if (res) {
              //Provide more current state
              specificSingleton.methods.dispute(_state2.id, _state2.version, _state2.encodedState, _state2.signatures)
                .send({
                  from: accounts[1],
                  gas: 1000000
                }, function(err, res) {
                  logger.getLogCallback(testName, names.updateDispute)(err, res);
                  if (res) {
                    //Provide most current state
                    specificSingleton.methods.dispute(_state2.id, _state3.version, _state3.encodedState, _state3.signatures)
                      .send({
                        from: accounts[0],
                        gas: 1000000
                      }, function(err, res) {
                        logger.getLogCallback(testName, names.updateDispute)(err, res);
                        if (res) {
                          //Wait till finalization is possible -> Then finalize -> We are at guess N
                          setTimeout(function() {
                            //Finalize
                            specificSingleton.methods.finalizeDispute(event.returnValues.id)
                              .send({
                                from: accounts[0],
                                gas: 1000000
                              }, function(err, res) {
                                logger.getLogCallback(testName, names.finalizeDispute)(err, res);
                                if (res) {
                                  //Perform first onchain-move
                                  specificSingleton.methods.guess(event.returnValues.id, 78).send({
                                    from: accounts[1],
                                    gas: 1000000
                                  }, logger.getLogCallback(testName, names.guessN));
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
    });
  }
}
