const states = require('./../sharedCode/hangmanStates');
const SE = require('./../sharedCode/signAndEncode');
const names = require('./../sharedCode/names');

module.exports = {

  //Send 10 ether by each party -> Onchain

  //Sign tx to install application at each type with 2 ether dependent on nonce = 1 -> Offchain
  //Sign tx to payout each party 7 coins ((20 - 6) / 2) dependent on nonce = 1 -> Offchain
  //Sign a nonce update to nonce = 1 -> Offchain

  //Sign tx to install application at each type with 4 ether dependent on nonce = 2 -> Offchain
  //Sign tx to payout each party 4 coins ((20 - 12) / 2) dependent on nonce = 2 -> Offchain
  //Sign a nonce update to nonce = 2 -> Offchain

  //Submit all transactions (nonce 1 and 2) -> Onchain
  //Submit the nonce update -> Onchain

  //Try executing all transactions with nonce 2 after the timeout-> Onchain

  testNormal: function(web3js, fullWalletAddress, channelManagerAddress, hangmanLibAddress, specificSingletonAddress, hybridSingletonAddress, disputeBoardAddress, moneyDispatcherAddress, fullWalletAbi, channelManagerAbi, specificSingletonAbi, hybridSingletonAbi, moneyDispatcherAbi, logger, accounts, testName, callback) {

    //Reference contracts
    var fullWallet = new web3js.eth.Contract(fullWalletAbi, fullWalletAddress);
    var channelManager = new web3js.eth.Contract(channelManagerAbi, channelManagerAddress);
    var specificSingleton = new web3js.eth.Contract(specificSingletonAbi, specificSingletonAddress);
    var hybridSingleton = new web3js.eth.Contract(hybridSingletonAbi, hybridSingletonAddress);
    var moneyDispatcher = new web3js.eth.Contract(moneyDispatcherAbi, moneyDispatcherAddress);

    //**********************
    //Create all the required states and signatures

    var firstInstallValue = web3js.utils.toWei("2", "ether");
    var secondInstallValue = web3js.utils.toWei("4", "ether");
    var seed1 = "random42";
    var seed2 = "random43";
    var nonce1 = 1;
    var nonce2 = 2;

    //Encode and sign transactions and nonce updates
    var cmInstallEncoding = channelManager.methods.createOffchainApplication(SE.getRandomNonce(),[accounts[0], accounts[1]], hangmanLibAddress).encodeABI();
    var cmTxInfo1 = SE.getFullWalletTxInfo(seed1, nonce1, fullWalletAddress, channelManagerAddress, firstInstallValue, cmInstallEncoding);
    var cmTxInfo2 = SE.getFullWalletTxInfo(seed2, nonce2, fullWalletAddress, channelManagerAddress, secondInstallValue, cmInstallEncoding);

    var spSiInstallEncoding = specificSingleton.methods.createInstance(SE.getRandomNonce(),[accounts[0], accounts[1]]).encodeABI();
    var spSiTxInfo1 = SE.getFullWalletTxInfo(seed1, nonce1, fullWalletAddress, specificSingletonAddress, firstInstallValue, spSiInstallEncoding);
    var spSiTxInfo2 = SE.getFullWalletTxInfo(seed2, nonce2, fullWalletAddress, specificSingletonAddress, secondInstallValue, spSiInstallEncoding);

    var hySiInstallEncoding = hybridSingleton.methods.createInstance(SE.getRandomNonce(),[accounts[0], accounts[1]]).encodeABI();
    var hySiTxInfo1 = SE.getFullWalletTxInfo(seed1, nonce1, fullWalletAddress, hybridSingletonAddress, firstInstallValue, hySiInstallEncoding);
    var hySiTxInfo2 = SE.getFullWalletTxInfo(seed2, nonce2, fullWalletAddress, hybridSingletonAddress, secondInstallValue, hySiInstallEncoding);

    var mdTxEncoding1 = moneyDispatcher.methods.dispatch([accounts[0], accounts[1]], [web3js.utils.toWei("7", "ether"), web3js.utils.toWei("7", "ether")]).encodeABI();
    var mdTxEncoding2 = moneyDispatcher.methods.dispatch([accounts[0], accounts[1]], [web3js.utils.toWei("4", "ether"), web3js.utils.toWei("4", "ether")]).encodeABI();
    var mdTxInfo1 = SE.getFullWalletTxInfo(seed1, nonce1, fullWalletAddress, moneyDispatcherAddress, web3js.utils.toWei("14", "ether"), mdTxEncoding1);
    var mdTxInfo2 = SE.getFullWalletTxInfo(seed2, nonce2, fullWalletAddress, moneyDispatcherAddress, web3js.utils.toWei("8", "ether"), mdTxEncoding2);

    var nonceUpdate1 = SE.getFullWalletNonceUpdateSignatures(fullWalletAddress, nonce1);
    var nonceUpdate2 = SE.getFullWalletNonceUpdateSignatures(fullWalletAddress, nonce2);

    //**********************
    //Reused functions to submit, execute and revoke transactions via the multisig-wallet
    var submitTx = function(_txInfo, _id, _accIndex){
      fullWallet.methods.submitTx(_txInfo.nonce, _txInfo.hash,  _txInfo.signatures).send({
        from: accounts[_accIndex],
        gas: 1000000
      }, logger.getLogCallback(testName, names.submitTx));
    }

    var execTx = function(_txInfo, _id, _accIndex, _name, _callback){
      fullWallet.methods.executeTx(_txInfo.rand, _txInfo.to, _txInfo.value, _txInfo.data).send({
        from: accounts[_accIndex],
        gas: 1000000
      }, logger.getLogCallback(testName, _name, _callback));
    }

    var updateNonce = function(_newNonce, _signatures, _id, _accIndex){
      fullWallet.methods.updateNonce(_newNonce, _signatures).send({
        from: accounts[_accIndex],
        gas: 1000000
      }, logger.getLogCallback(testName, names.updateNonce));
    }

    //**********************
    //Actual execution

    //Each party transfers 10 ether
    web3js.eth.sendTransaction({to:fullWalletAddress, from:accounts[0], value:web3js.utils.toWei("10", "ether")}, logger.getLogCallback(testName, names.transfer));
    web3js.eth.sendTransaction({to:fullWalletAddress, from:accounts[1], value:web3js.utils.toWei("10", "ether")}, logger.getLogCallback(testName, names.transfer));

    //We submit all the transactions depending on nonce 1 by party 0
    submitTx(cmTxInfo1, "CM-1", 0);
    submitTx(spSiTxInfo1, "SpSi-1", 0);
    submitTx(hySiTxInfo1, "HySi-1", 0);
    submitTx(mdTxInfo1, "RD-1", 0);

    //We submit all the transactions depending on nonce 2 by party 1
    submitTx(cmTxInfo2, "CM-1", 1);
    submitTx(spSiTxInfo2, "SpSi-2", 1);
    submitTx(hySiTxInfo2, "HySi-2", 1);
    submitTx(mdTxInfo2, "RD-2", 1);

    //We wait 2 seconds to post the nonce update to nonce = 1 by party 0
    setTimeout(function () {
      updateNonce(nonce1, nonceUpdate1, "NU-2", 1);
    }, 2000);

    //We wait 4 seconds to post the nonce update to nonce = 2 by party 1
    setTimeout(function () {
      updateNonce(nonce2, nonceUpdate2, "NU-1", 0);
    }, 4000);

    //We wait 11 seconds and try to execute all the transactions depending on nonce 1 -> Should fail
    // setTimeout(function () {
    //   execTx(cmTxInfo1, "CM-1", 0);
    //   execTx(spSiTxInfo1, "SpSi-1", 0);
    //   execTx(hySiTxInfo1, "HySi-1", 0);
    //   execTx(mdTxInfo1, "RD-1", 0);
    // }, 11000);

    //We wait 15 seconds and try to execute all the transactions depending on nonce 2 -> Should be successful
    setTimeout(function () {
      execTx(cmTxInfo2, "CM-2", 1, names.executeTx);
      execTx(spSiTxInfo2, "SpSi-2", 1, names.executeTx);
      execTx(hySiTxInfo2, "HySi-2", 1, names.executeTx);
      setTimeout(function () {
        execTx(mdTxInfo2, "RD-2", 1, names.executePayout, callback);
      },1000)
    }, 15000);

  }
}

//**********************
//Event reaction to execute the fast closing
// channelManager.events.EventNewChannel((error, event) => {
//   if (error) {
//     console.log(error);
//   } else {
//     //Create offchain-final-state
//     var _finalState = SE.getChannelManagerStateInfo(channelManagerAddress, event.returnValues.id, states.getStateAfterRightT());
//     //Invoke fast closing
//     channelManager.methods.fastClose(_finalState.id, _finalState.version, _finalState.encodedState, _finalState.signatures)
//       .send({
//         from: accounts[0],
//         gas: 1000000
//       }, function(err, res) {
//         if (err) {
//           console.log("Error while fast closing via channel manager: " + err);
//           return;
//         } else {
//           console.log("Success while fast closing via channel manager");
//         }
//       });
//   }
// });
//
// specificSingleton.events.newChannel((error, event) => {
//   if (error) {
//     console.log(error);
//   } else {
//     //Create offchain-states
//     var _finalState = SE.getChannelManagerStateInfo(specificSingletonAddress, event.returnValues.id, states.getStateAfterRightT());
//     //Invoke fast closing
//     specificSingleton.methods.fastClose(_finalState.id, _finalState.version, _finalState.encodedState, _finalState.signatures)
//       .send({
//         from: accounts[0],
//         gas: 1000000
//       }, function(err, res) {
//         if (err) {
//           console.log("Error while fast closing via specific singleton: " + err);
//           return;
//         } else {
//           console.log("Success while fast closing via specific singleton");
//         }
//       });
//   }
// });
//
// hybridSingleton.events.newChannel((error, event) => {
//   if (error) {
//     console.log(error);
//   } else {
//     //Create offchain-state
//     var _finalState = SE.getHybridDisputeboardSingletonInfo(disputeBoardAddress, hybridSingletonAddress, event.returnValues.id, 0, states.getStateAfterRightT());
//     //Invoke fast closing
//     hybridSingleton.methods.fastClose(event.returnValues.id, _finalState.fastCloseStage, _finalState.fastClosedSignatures)
//       .send({
//         from: accounts[0],
//         gas: 1000000
//       }, function(err, res) {
//         if (err) {
//           console.log("Error while fast closing via hybrid singleton: " + err);
//           return;
//         } else {
//           console.log("Success while fast closing via hybrid singleton");
//         }
//       });
//   }
// });
