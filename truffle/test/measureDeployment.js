//Names
const names = require('./../../measurements/sharedCode/names');

//Continuation
const OffchainRecovery = artifacts.require("OffchainRecovery");
const OnchainRecovery = artifacts.require("SpecificHangmanChannel");  //We can reuse this one here
//Hybrid Approach + Extension
const HybridHangmanSingleton = artifacts.require("HybridHangmanSingleton");
const HybridHangmanChannel = artifacts.require("HybridHangmanChannel");
const HybridDisputeBoard = artifacts.require("HybridDisputeBoard");
//Deploy Approach + Extension
const SpecificHangmanSingleton = artifacts.require("SpecificHangmanSingleton");
const SpecificHangmanChannel = artifacts.require("SpecificHangmanChannel");
//Library Approach
const HangmanLib = artifacts.require("HangmanLib");
const AgnosticChannelManager = artifacts.require("AgnosticChannelManager");
//Multi Apparchitecture
const HalfOffchainMultiAppWallet = artifacts.require("HalfOffchainMultiAppWallet");
const FullOffchainMultiAppWallet = artifacts.require("FullOffchainMultiAppWallet");
const MoneyDispatcher = artifacts.require("MoneyDispatcher");

const fs = require('fs');

contract('Test', function(accounts){
  it("Test gas", async () => {
    let instances = {};
    let receipts = {};

    instances["OffchainRecovery"] = await OffchainRecovery.new(7, 10, 10, accounts.slice(0,2));
    receipts["OffchainRecovery"] = await web3.eth.getTransactionReceipt(instances["OffchainRecovery"].transactionHash);

    instances["AgnosticChannelManager"] = await AgnosticChannelManager.new(10, 10);
    receipts["AgnosticChannelManager"] = await web3.eth.getTransactionReceipt(instances["AgnosticChannelManager"].transactionHash);

    instances["HangmanLib"] = await HangmanLib.new();
    receipts["HangmanLib"] = await web3.eth.getTransactionReceipt(instances["HangmanLib"].transactionHash);

    instances["SpecificHangmanChannel"] = await SpecificHangmanChannel.new(7, 10, 10, accounts.slice(0,2));
    receipts["SpecificHangmanChannel"] = await web3.eth.getTransactionReceipt(instances["SpecificHangmanChannel"].transactionHash);

    instances["SpecificHangmanSingleton"] = await SpecificHangmanSingleton.new(7, 10, 10, 10);
    receipts["SpecificHangmanSingleton"] = await web3.eth.getTransactionReceipt(instances["SpecificHangmanSingleton"].transactionHash);

    instances["HybridDisputeBoard"] = await HybridDisputeBoard.new(10);
    receipts["HybridDisputeBoard"] = await web3.eth.getTransactionReceipt(instances["HybridDisputeBoard"].transactionHash);

    instances["HybridHangmanChannel"] = await HybridHangmanChannel.new(7, 10, accounts.slice(0,2), receipts["HybridDisputeBoard"].contractAddress); //Just some random address, doesnt matter here
    receipts["HybridHangmanChannel"] = await web3.eth.getTransactionReceipt(instances["HybridHangmanChannel"].transactionHash);

    instances["HybridHangmanSingleton"] = await HybridHangmanSingleton.new(7, 10, 10, receipts["HybridDisputeBoard"].contractAddress);
    receipts["HybridHangmanSingleton"] = await web3.eth.getTransactionReceipt(instances["HybridHangmanSingleton"].transactionHash);

    instances["HalfOffchainMultiAppWallet"] = await HalfOffchainMultiAppWallet.new(accounts.slice(0,2));
    receipts["HalfOffchainMultiAppWallet"] = await web3.eth.getTransactionReceipt(instances["HalfOffchainMultiAppWallet"].transactionHash);

    instances["FullOffchainMultiAppWallet"] = await FullOffchainMultiAppWallet.new(accounts.slice(0,2), 10);
    receipts["FullOffchainMultiAppWallet"] = await web3.eth.getTransactionReceipt(instances["FullOffchainMultiAppWallet"].transactionHash);

    let log = [];

    for(var index in receipts){
      console.log(index + ": " + receipts[index].gasUsed);
      assert.isBelow(receipts[index].gasUsed, 5000000000);
      log.push({
        test: names.execD,
        step: index,
        gas: receipts[index].gasUsed
      });
    }

    fs.writeFileSync("./../measurements/results/rawData/allDeployments.json", JSON.stringify(log));

  });
});
