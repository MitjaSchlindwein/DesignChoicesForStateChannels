const states = require('./../sharedCode/hangmanStates');
const SE = require('./../sharedCode/signAndEncode');
const names = require('./../sharedCode/names');


module.exports = {
  testFastClose: function(web3js, channelManagerAddress, libraryAddress, channelManagerAbi, logger, accounts, testName, callback) {

    //Create reference to the contract
    var channelManager = new web3js.eth.Contract(channelManagerAbi, channelManagerAddress);

    //Initialize a channel
    setTimeout(function() {
      channelManager.methods.createOffchainApplication(SE.getRandomNonce(), [accounts[0], accounts[1]], libraryAddress).send({
        from: accounts[0],
        gas: 1000000,
        value: 4200000000000000000
      }, logger.getLogCallback(testName, names.initializeChannel));
    }, 3000);

    //Actions in the new channel -> Reaection to event new channel
    var subscription = channelManager.events.EventNewChannel((error, event) => {
      if (error) {
        console.log(error);
      } else {

        //Unsubscribe to make sure not to fast close the instances of other tests
        subscription.unsubscribe();

        //Create offchain-final-state
        var _finalState = SE.getChannelManagerStateInfo(channelManagerAddress, event.returnValues.id, states.getStateAfterRightT());

        //Invoke fast closing
        channelManager.methods.fastClose(_finalState.id, _finalState.version, _finalState.encodedState, _finalState.signatures)
          .send({
            from: accounts[0],
            gas: 1000000
          }, logger.getLogCallback(testName, names.fastClose, callback));
      }
    });

  },
  testNormal: function(web3js, channelManagerAddress, libraryAddress, channelManagerAbi, logger, accounts, testName, callback) {

    //Create reference to the contract
    var channelManager = new web3js.eth.Contract(channelManagerAbi, channelManagerAddress);

    //React to events forcefully executed and steps by step execut till finalization
    var _focusedId = undefined; //To handle only events of the newly created channel
    var _actions = 0; //Action counter to be able to just add one action after another without evaluating the state
    channelManager.events.EventForcefullyExecuted((error, event) => {
      if (error || _focusedId != event.returnValues.id) {
        return;
      }
      if (_actions == 0) {
        //Wrong N
        channelManager.methods.forcefullyExecute(_focusedId, 4, "0x").send({
          from: accounts[0],
          gas: 1000000
        }, logger.getLogCallback(testName, names.wrongN));
      } else if (_actions == 1) {
        //Guess S
        channelManager.methods.forcefullyExecute(_focusedId, 2, web3js.eth.abi.encodeParameters(["uint8"], [83])).send({
          from: accounts[1],
          gas: 1000000
        }, logger.getLogCallback(testName, names.guessS));
      } else if (_actions == 2) {
        //Correct S
        channelManager.methods.forcefullyExecute(_focusedId, 3, web3js.eth.abi.encodeParameters(["uint8[]"], [
          [2]
        ])).send({
          from: accounts[0],
          gas: 1000000
        }, logger.getLogCallback(testName, names.correctS));
      } else if (_actions == 3) {
        //Guess A
        channelManager.methods.forcefullyExecute(_focusedId, 2, web3js.eth.abi.encodeParameters(["uint8"], [65])).send({
          from: accounts[1],
          gas: 1000000
        }, logger.getLogCallback(testName, names.guessA));
      } else if (_actions == 4) {
        //Wrong A
        channelManager.methods.forcefullyExecute(_focusedId, 4, "0x").send({
          from: accounts[0],
          gas: 1000000
        }, logger.getLogCallback(testName, names.wrongA));
      } else if (_actions == 5) {
        //Guess T
        channelManager.methods.forcefullyExecute(_focusedId, 2, web3js.eth.abi.encodeParameters(["uint8"], [84])).send({
          from: accounts[1],
          gas: 1000000
        }, logger.getLogCallback(testName, names.guessT));
      } else if (_actions == 6) {
        //Correct T
        channelManager.methods.forcefullyExecute(_focusedId, 3, web3js.eth.abi.encodeParameters(["uint8[]"], [
          [0, 3]
        ])).send({
          from: accounts[0],
          gas: 1000000
        }, logger.getLogCallback(testName, names.correctT));
      } else if (_actions == 7) {
        //Close
        channelManager.methods.closeChannel(_focusedId).send({
          from: accounts[0],
          gas: 1000000
        }, logger.getLogCallback(testName, names.close, callback));
      }
      _actions++;
    });

    //React to newly created channel by disputing till state after right E and performing first move: guess N
    channelManager.events.EventNewChannel((error, event) => {
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
        var _state1 = SE.getChannelManagerStateInfo(channelManagerAddress, event.returnValues.id, states.getStateAfterCommit());
        var _state2 = SE.getChannelManagerStateInfo(channelManagerAddress, event.returnValues.id, states.getStateAfterGuessE());
        var _state3 = SE.getChannelManagerStateInfo(channelManagerAddress, event.returnValues.id, states.getStateAfterRightE());

        //Start dispute with old state and update it with more current ones (twice)
        channelManager.methods.dispute(_state1.id, _state1.version, _state1.encodedState, _state1.signatures)
          .send({
            from: accounts[0],
            gas: 1000000
          }, function(err, res) {
            logger.getLogCallback(testName, names.startDispute)(err, res);
            if (err) {
              return;
            } else {
              //Provide more current state
              channelManager.methods.dispute(_state2.id, _state2.version, _state2.encodedState, _state2.signatures)
                .send({
                  from: accounts[1],
                  gas: 1000000
                }, function(err2, res2) {
                  logger.getLogCallback(testName, names.updateDispute)(err2, res2);
                  if (err) {
                    return;
                  } else {
                    //Provide most current state
                    channelManager.methods.dispute(_state2.id, _state3.version, _state3.encodedState, _state3.signatures)
                      .send({
                        from: accounts[0],
                        gas: 1000000
                      }, function(err3, res3) {
                        logger.getLogCallback(testName, names.updateDispute)(err3, res3);
                        if (err3) {
                          return;
                        } else {
                          //Wait till finalization is possible -> Then finalize -> We are at guess N
                          setTimeout(function() {
                            //Finalize
                            channelManager.methods.finalizeDispute(event.returnValues.id)
                              .send({
                                from: accounts[0],
                                gas: 1000000
                              }, function(err4, res4) {
                                logger.getLogCallback(testName, names.finalizeDispute)(err4, res4);
                                if (err4) {
                                  return;
                                } else {
                                  //Perform first onchain-move
                                  channelManager.methods.forcefullyExecute(event.returnValues.id, 2, web3js.eth.abi.encodeParameters(["uint8"], [78])).send({
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

    //Initialize a channel
    setTimeout(function() {
      channelManager.methods.createOffchainApplication(SE.getRandomNonce(),[accounts[0], accounts[1]], libraryAddress).send({
        from: accounts[0],
        gas: 1000000,
        value: 4200000000000000000
      }, logger.getLogCallback(testName, names.initializeChannel));
    }, 3000);
  }
}
