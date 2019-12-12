const states = require('./../sharedCode/hangmanStates');
const SE = require('./../sharedCode/signAndEncode');
const names = require('./../sharedCode/names');

module.exports = {

  //What do we want to do
  // Create and directly lock an instance
  // Fast close the instance directly after creation
  testFastClose: function(web3js, hybridSingletonAddress, hybridSingletonAbi, logger, accounts, testName, callback) {

    //Reference contracts
    var hybridSingleton = new web3js.eth.Contract(hybridSingletonAbi, hybridSingletonAddress);

    //Create the channel
    hybridSingleton.methods.createInstance(SE.getRandomNonce(),[accounts[0], accounts[1]]).send({
      from: accounts[0],
      gas: 1000000,
      value: 4200000000000000000
    }, logger.getLogCallback(testName, names.initializeChannel));

    //Actions in the new channel -> Reaection to event new channel
    var subscription = hybridSingleton.events.newChannel((error, event) => {
      if (error) {
        console.log(error);
      } else {

        //Unsubscribe to make sure not to fast close the instances of other tests
        subscription.unsubscribe();

        //Create offchain-state
        var _finalState = SE.getHybridDisputeboardSingletonInfo(hybridSingletonAddress, hybridSingletonAddress, event.returnValues.id, states.getStateAfterRightT());  //Actually we do not need the first parameter (dispute board address, so we can just as well insert the hybrid Singleton Address)

        //Invoke fast closing
        hybridSingleton.methods.fastClose(event.returnValues.id, _finalState.fastCloseStage, _finalState.fastClosedSignatures)
          .send({
            from: accounts[0],
            gas: 1000000
          }, logger.getLogCallback(testName, names.fastClose, callback));

      }
    });
  },

  //What do we want to do
  // Create and directly lock
  // Dispute with state 1, provide 2 then 3
  // Unlock
  // Execute till termination
  testNormal: function(web3js, hybridSingletonAddress, disputeBoardAddress, hybridSingletonAbi, disputeBoardAbi, logger, accounts, testName, callback) {

    //Reference contracts
    var hybridSingleton = new web3js.eth.Contract(hybridSingletonAbi, hybridSingletonAddress);
    var disputeBoard = new web3js.eth.Contract(disputeBoardAbi, disputeBoardAddress);

    //React to move performed
    var _focusedId = undefined; //To handle only events of the newly created channel
    var _actions = 0; //Action counter to be able to just add one action after another without evaluating the state
    hybridSingleton.events.movePerformed((error, event) => {
      if (error || _focusedId != event.returnValues.id) {
        return;
      }
      if (_actions == 0) {
        //Wrong N
        hybridSingleton.methods.wrong(_focusedId).send({
          from: accounts[0],
          gas: 1000000
        }, logger.getLogCallback(testName, names.wrongN));
      } else if (_actions == 1) {
        //Guess S
        hybridSingleton.methods.guess(_focusedId, 83).send({
          from: accounts[1],
          gas: 1000000
        }, logger.getLogCallback(testName, names.guessS));
      } else if (_actions == 2) {
        //Correct S
        hybridSingleton.methods.correct(_focusedId, [2]).send({
          from: accounts[0],
          gas: 1000000
        }, logger.getLogCallback(testName, names.correctS));
      } else if (_actions == 3) {
        //Guess A
        hybridSingleton.methods.guess(_focusedId, 65).send({
          from: accounts[1],
          gas: 1000000
        }, logger.getLogCallback(testName, names.guessA));
      } else if (_actions == 4) {
        //Wrong A
        hybridSingleton.methods.wrong(_focusedId).send({
          from: accounts[0],
          gas: 1000000
        }, logger.getLogCallback(testName, names.wrongA));
      } else if (_actions == 5) {
        //Guess T
        hybridSingleton.methods.guess(_focusedId, 84).send({
          from: accounts[1],
          gas: 1000000
        }, logger.getLogCallback(testName, names.guessT));
      } else if (_actions == 6) {
        //Correct T
        hybridSingleton.methods.correct(_focusedId, [0, 3]).send({
          from: accounts[0],
          gas: 1000000
        }, logger.getLogCallback(testName, names.correctT));
      } else if (_actions == 7) {
        //Close
        hybridSingleton.methods.close(_focusedId).send({
          from: accounts[0],
          gas: 1000000
        }, logger.getLogCallback(testName, names.close, callback));
      }
      _actions++;
    });

    //Create the channel
    hybridSingleton.methods.createInstance(SE.getRandomNonce(),[accounts[0], accounts[1]]).send({
      from: accounts[0],
      gas: 1000000,
      value: 4200000000000000000
    }, logger.getLogCallback(testName, names.initializeChannel));

    //Actions in the new channel -> Reaection to event new channel: Dispute 3 times, unlock, execute first move
    hybridSingleton.events.newChannel((error, event) => {
      if (error) {
        console.log(error);
      } else {

        //Prevent overwriting of the focusedId
        if(_focusedId){
          return;
        }

        //Save ID to be able to ignore events from other IDs
        _focusedId = event.returnValues.id;

        //Create offchain-states
        var _state1 = SE.getHybridDisputeboardSingletonInfo(disputeBoardAddress, hybridSingletonAddress, event.returnValues.id, states.getStateAfterCommit());
        var _state2 = SE.getHybridDisputeboardSingletonInfo(disputeBoardAddress, hybridSingletonAddress, event.returnValues.id, states.getStateAfterGuessE());
        var _state3 = SE.getHybridDisputeboardSingletonInfo(disputeBoardAddress, hybridSingletonAddress, event.returnValues.id, states.getStateAfterRightE());

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
                          setTimeout(function() {
                            //Finalize
                            hybridSingleton.methods.unlock(event.returnValues.id, _state3.state)
                              .send({
                                from: accounts[0],
                                gas: 1000000
                              }, function(err, res) {
                                logger.getLogCallback(testName, names.unlock)(err, res);
                                if (res) {
                                  //Perform first onchain-move -> guess N
                                  hybridSingleton.methods.guess(event.returnValues.id, 78).send({
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
