const states = require('./../sharedCode/hangmanStates');
const SE = require('./../sharedCode/signAndEncode');
const names = require('./../sharedCode/names');

module.exports = {
  //Send 5 ether party 1
  //Send 5 ether party 2
  //Sign Tx to install application at specific singleton with 1 ether
  //Sign Tx to install application at hybrid singleton with 1 ether
  //Sign Tx to install application at channel manager with 1 ether
  //Revoke each of the previos tx
  //Sign Tx to install application at specific singleton with 2 ether
  //Sign Tx to install application at hybrid singleton with 2 ether
  //Sign Tx to install application at channel manager with 2 ether
  //Execute Tx to install application at specific singleton with 2 ether
  //Execute Tx to install application at hybrid singleton with 2 ether
  //Execute Tx to install application at channel manager with 2 ether
  //Fast close all of the previos installed channels
  testNormal: function(web3js, halfWalletAddress, channelManagerAddress, hangmanLibAddress, specificSingletonAddress, hybridSingletonAddress, disputeBoardAddress, moneyDispatcherAddress, halfWalletAbi, channelManagerAbi, specificSingletonAbi, hybridSingletonAbi, moneyDispatcherAbi, logger, accounts, testName, callback) {

    //Reference contracts
    var halfWallet = new web3js.eth.Contract(halfWalletAbi, halfWalletAddress);
    var channelManager = new web3js.eth.Contract(channelManagerAbi, channelManagerAddress);
    var specificSingleton = new web3js.eth.Contract(specificSingletonAbi, specificSingletonAddress);
    var hybridSingleton = new web3js.eth.Contract(hybridSingletonAbi, hybridSingletonAddress);
    var moneyDispatcher = new web3js.eth.Contract(moneyDispatcherAbi, moneyDispatcherAddress);

    var firstInstallValue = web3js.utils.toWei("1", "ether");
    var secondInstallValue = web3js.utils.toWei("2", "ether");
    var seed1 = "random44";
    var seed2 = "random45";

    //Encode the installation, revocation and fast close via the channel manager
    var cmInstallEncoding = channelManager.methods.createOffchainApplication(SE.getRandomNonce(), [accounts[0], accounts[1]], hangmanLibAddress).encodeABI();
    var cmInstallSignatures = SE.getHalfWalletTxInfo(seed1, halfWalletAddress, channelManagerAddress, firstInstallValue, cmInstallEncoding, [0,web3js.utils.toWei("1", "ether")]);
    var cmInstallSignatures2 = SE.getHalfWalletTxInfo(seed2, halfWalletAddress, channelManagerAddress, secondInstallValue, cmInstallEncoding, [0,web3js.utils.toWei("2", "ether")]);

    //Encode the installation, revocation and fast close via the specificSingleton
    var spSiInstallEncoding = specificSingleton.methods.createInstance(SE.getRandomNonce(),[accounts[0], accounts[1]]).encodeABI();
    var spSiInstallSignatures = SE.getHalfWalletTxInfo(seed1, halfWalletAddress, specificSingletonAddress, firstInstallValue, spSiInstallEncoding, [0,web3js.utils.toWei("1", "ether")]);
    var spSiInstallSignatures2 = SE.getHalfWalletTxInfo(seed2, halfWalletAddress, specificSingletonAddress, secondInstallValue, spSiInstallEncoding, [0,web3js.utils.toWei("2", "ether")]);

    //Encode the installation, revocation and fast close via the hybridSingleton
    var hySiInstallEncoding = hybridSingleton.methods.createInstance(SE.getRandomNonce(),[accounts[0], accounts[1]]).encodeABI();
    var hySiInstallSignatures = SE.getHalfWalletTxInfo(seed1, halfWalletAddress, hybridSingletonAddress, firstInstallValue, hySiInstallEncoding, [0,web3js.utils.toWei("1", "ether")]);
    var hySiInstallSignatures2 = SE.getHalfWalletTxInfo(seed2, halfWalletAddress, hybridSingletonAddress, secondInstallValue, hySiInstallEncoding, [0,web3js.utils.toWei("2", "ether")]);

    //Dispatch some coins
    var mdTxEncoding = moneyDispatcher.methods.dispatch([accounts[0], accounts[1]], [web3js.utils.toWei("1", "ether"), web3js.utils.toWei("1", "ether")]).encodeABI();
    var mdTxSignatures = SE.getHalfWalletTxInfo(seed1, halfWalletAddress, moneyDispatcherAddress, secondInstallValue, mdTxEncoding, []);
    var mdTxSignatures2 = SE.getHalfWalletTxInfo(seed2, halfWalletAddress, moneyDispatcherAddress, secondInstallValue, mdTxEncoding, []);

    //Reused function to call executeTx and devalidateTx via the multisig-wallet
    var execTx = function(_rand, _address, _value, _data, _signatures, _id, _accIndex, _name, _callback){
      halfWallet.methods.executeTx(_rand, _address, _value, _data, _signatures).send({
        from: accounts[_accIndex],
        gas: 1000000
      }, logger.getLogCallback(testName, _name, _callback));
    }

    var revokeTx = function(_hash, _payout, _signatures, _id, _accIndex, _name){
      halfWallet.methods.devalidateTx(_hash, _payout, _signatures).send({
        from: accounts[_accIndex],
        gas: 1000000
      }, logger.getLogCallback(testName, _name));
    }

    //Test execution

    //Each party transfers 10 ether to the wallet
    web3js.eth.sendTransaction({to:halfWalletAddress, from:accounts[0], value:web3js.utils.toWei("10", "ether")}, logger.getLogCallback(testName, names.transfer));
    web3js.eth.sendTransaction({to:halfWalletAddress, from:accounts[1], value:web3js.utils.toWei("10", "ether")}, logger.getLogCallback(testName, names.transfer));

    //Submit each of the revocations after 2 seconds (otherwise there is no money yet)
    setTimeout(function () {
      revokeTx(cmInstallSignatures.hash, cmInstallSignatures.payout, cmInstallSignatures.revokeSig, "CM-1", 0, names.revokeTxWithPayout);
      revokeTx(spSiInstallSignatures.hash, spSiInstallSignatures.payout, spSiInstallSignatures.revokeSig, "SpSi-1", 0, names.revokeTxWithPayout);
      revokeTx(hySiInstallSignatures.hash, hySiInstallSignatures.payout, hySiInstallSignatures.revokeSig, "HySi-1", 0, names.revokeTxWithPayout);
      revokeTx(mdTxSignatures.hash, mdTxSignatures.payout, mdTxSignatures.revokeSig, "MD-1", 0, names.revokeTxWithoutPayout);
    }, 2000);

    //Wait 5-7 seconds and try to execute the unrevoked transactions
    setTimeout(function () {
      execTx(cmInstallSignatures2.rand, channelManagerAddress, secondInstallValue, cmInstallEncoding, cmInstallSignatures2.installSig, "CM-2", 0, names.executeTx);
      execTx(spSiInstallSignatures2.rand, specificSingletonAddress, secondInstallValue, spSiInstallEncoding, spSiInstallSignatures2.installSig, "SpSi-2", 0, names.executeTx);
      execTx(hySiInstallSignatures2.rand, hybridSingletonAddress, secondInstallValue, hySiInstallEncoding, hySiInstallSignatures2.installSig, "HySi-2", 0, names.executeTx);
    }, 5000);

    setTimeout(function () {
      execTx(mdTxSignatures2.rand, moneyDispatcherAddress, secondInstallValue, mdTxEncoding, mdTxSignatures2.installSig, "HySi-2", 0, names.executePayout, callback); //Last one executes callback
    }, 7000);

    //Perform a payout with 1 coin to each party



    //We might consider to directly execute the fast close, but this is already measured in the architecture specific measurements

    //Wait 10 seconds and try to execute the revoked transactions
    // setTimeout(function () {
    //   execTx(cmInstallSignatures.rand, channelManagerAddress, firstInstallValue, cmInstallEncoding, cmInstallSignatures.installSig, "CM-1", 0);
    //   execTx(spSiInstallSignatures.rand, specificSingletonAddress, firstInstallValue, spSiInstallEncoding, spSiInstallSignatures.installSig, "SpSi-1", 0);
    //   execTx(hySiInstallSignatures.rand, hybridSingletonAddress, firstInstallValue, hySiInstallEncoding, hySiInstallSignatures.installSig, "HySi-1", 0);
    // }, 10000);
  }
}
