const web3 = require('web3');
const log = require('./../sharedCode/gasUsageLogger');
const accounts = require('./../sharedCode/accounts');
const names = require('./../sharedCode/names');
const fs = require('fs');
const offchainRecovery = require('./../singleMeasurements/offchainRecovery');
const agnostic = require('./../singleMeasurements/agnostic');
const specific = require('./../singleMeasurements/specific');
const specificSingleton = require('./../singleMeasurements/specificSingleton');
const hybrid = require('./../singleMeasurements/hybrid');
const hybridSingleton = require('./../singleMeasurements/hybridSingleton');
const halfWallet = require('./../singleMeasurements/halfWallet');
const fullWallet = require('./../singleMeasurements/fullWallet');

//Web3js
web3js = new web3(new web3.providers.WebsocketProvider("ws://127.0.0.1:7545"));

//Addresses
var offchainRecoveryAddress1 = "0x505ff77915553242006e72Cc5F8b7cD478512580";
var offchainRecoveryAddress2 = "0xdf34484Ee84961817182b8416C7D49b656b9A4c6";

var channelManagerAddress = "0xEF2858f5BE63E06326d42F52AFA5873aC0163093";
var libraryAddress = "0xa040D03b5eFEb07b673bD1c7daF4142A1CE62590";

var specificAddress1 = "0x2B89f0Dc51D1AB8715cD3efa04680a4Ba5b1f3ff";
var specificAddress2 = "0x3485d12bD62580d13a17f50AaFa46A06830c8291";
var specificAddress3 = "0x5649847647Dc7a8D980479eAF2C31b90C5788c7B";
var specificSingletonAddress = "0x8d4F512F1d68C0C05872A500B21D97725eDe67f9";

var hybridAddress1 = "0xdc384F92C4364b5533f5EB7788CB1064611b63C5";
var hybridAddress2 = "0xC39d371fdB079EFec4578aB3EB8CFB11BbC98070";
var hybridAddress3 = "0x476Ee5c0551eF27b2B4e43E5207E950fce313B01";
var hybridSingletonAddress = "0x2d7cFa6F60aBB1ee470C712d8Feb4Cab3CE33886";
var disputeBoardAddress = "0x54c43c3805724758fA5cfAC47f689d18b1722d69";

var halfWalletAddress = "0xbb60B23f07808b0073337BF7D509BDd73a43f1A7";
var fullWalletAddress = "0x51B9dc74CFebcdd00d20979C178a00d051860C86";
var moneyDispatcherAddress = "0x933Ad515Dd62c581A44332DBa04f1C089b773e4D";

//Abis
var offchainRecoveryAbi = JSON.parse(fs.readFileSync('./../../truffle/build/contracts/OffchainRecovery.json')).abi;

var disputeBoardAbi = JSON.parse(fs.readFileSync('./../../truffle/build/contracts/HybridDisputeBoard.json')).abi;

var specificAbi = JSON.parse(fs.readFileSync('./../../truffle/build/contracts/SpecificHangmanChannel.json')).abi;
var specificSingletonAbi = JSON.parse(fs.readFileSync('./../../truffle/build/contracts/SpecificHangmanSingleton.json')).abi;

var hybridAbi = JSON.parse(fs.readFileSync('./../../truffle/build/contracts/HybridHangmanChannel.json')).abi;
var hybridSingletonAbi = JSON.parse(fs.readFileSync('./../../truffle/build/contracts/HybridHangmanSingleton.json')).abi;
var channelManagerAbi = JSON.parse(fs.readFileSync('./../../truffle/build/contracts/AgnosticChannelManager.json')).abi;

var halfWalletAbi = JSON.parse(fs.readFileSync('./../../truffle/build/contracts/HalfOffchainMultiAppWallet.json')).abi;
var fullWalletAbi = JSON.parse(fs.readFileSync('./../../truffle/build/contracts/FullOffchainMultiAppWallet.json')).abi;
var moneyDispatcherAbi = JSON.parse(fs.readFileSync('./../../truffle/build/contracts/MoneyDispatcher.json')).abi;

//Create logger and specify function to receive gas usage
var logger = log.getGasLogger("AllTests");
logger.getLogCallback = function(test, step, callback) {
  return function(err, res) {
    if (err) {
      console.log("ERROR: [" + test + " - " + step + "]:" + err);
    } else {
      web3js.eth.getTransactionReceipt(res, function(err2, res2) {
        if (err2) {
          console.log(err2);
        } else {
          logger.addLog(test, step, res2.gasUsed);
          if (callback) {
            callback(test);
          }
        }
      });
    }
  }
};

//Callback to get notified by finished tests
var totalTests = 14;
var finishedTests = 0;

var callback = function(testName) {
  console.log("Finished measurement: " + testName);
  finishedTests++;
  if (finishedTests == totalTests) {
    console.log("Final log: " + logger.log.length);

    fs.writeFileSync("./../results/rawData/allTransactions.json", JSON.stringify(logger.log));

    process.exit(1);
  }
}

//Perform tests

//Offchain recovery
offchainRecovery.testFastClose(web3js, offchainRecoveryAddress1, offchainRecoveryAbi, logger, accounts, names.execORFC, callback);
setTimeout(function() {
  offchainRecovery.testNormal(web3js, offchainRecoveryAddress2, offchainRecoveryAbi, logger, accounts, names.execOR, callback);
}, 10000);

//Agnostic normal and fast close
agnostic.testFastClose(web3js, channelManagerAddress, libraryAddress, channelManagerAbi, logger, accounts, names.execAFC, callback);
setTimeout(function() {
  agnostic.testNormal(web3js, channelManagerAddress, libraryAddress, channelManagerAbi, logger, accounts, names.execA, callback);
}, 5000);

//Specific normal and fast close
specific.testFastClose(web3js, specificAddress1, specificAbi, logger, accounts, names.execSpFC, callback);
setTimeout(function() {
  specific.testNormal(web3js, specificAddress2, specificAbi, logger, accounts, names.execSp, callback);
}, 10000);

//Hybrid channel normal, with relock and fast close
hybrid.testFastClose(web3js, hybridAddress1, hybridAbi, logger, accounts, names.execHyFC, callback);
setTimeout(function() {
  hybrid.testNormal(web3js, hybridAddress3, disputeBoardAddress, hybridAbi, disputeBoardAbi, logger, accounts, names.execHy, callback);
}, 5000);

//Specific singleton normal and fast close
specificSingleton.testFastClose(web3js, specificSingletonAddress, specificSingletonAbi, logger, accounts, names.execSpSiFC, callback);
setTimeout(function() {
  specificSingleton.testNormal(web3js, specificSingletonAddress, specificSingletonAbi, logger, accounts, names.execSpSi, callback);
}, 5000);

//Hybrid singleton normal, with relock and fast close
hybridSingleton.testFastClose(web3js, hybridSingletonAddress, hybridSingletonAbi, logger, accounts, names.execHySiFC, callback);
setTimeout(function() {
  hybridSingleton.testNormal(web3js, hybridSingletonAddress, disputeBoardAddress, hybridSingletonAbi, disputeBoardAbi, logger, accounts, names.execHySi, callback);
}, 5000);

//HalfWallet
halfWallet.testNormal(web3js, halfWalletAddress, channelManagerAddress, libraryAddress, specificSingletonAddress, hybridSingletonAddress, disputeBoardAddress, moneyDispatcherAddress, halfWalletAbi, channelManagerAbi, specificSingletonAbi, hybridSingletonAbi, moneyDispatcherAbi, logger, accounts, names.execHW, callback);

//FullWallet
fullWallet.testNormal(web3js, fullWalletAddress, channelManagerAddress, libraryAddress, specificSingletonAddress, hybridSingletonAddress, disputeBoardAddress, moneyDispatcherAddress, fullWalletAbi, channelManagerAbi, specificSingletonAbi, hybridSingletonAbi, moneyDispatcherAbi, logger, accounts, names.execFW, callback);
