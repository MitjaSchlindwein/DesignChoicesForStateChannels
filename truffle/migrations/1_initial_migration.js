//Standard
const Migrations = artifacts.require("Migrations");
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

module.exports = function(deployer, network, accounts) {
  //Standard
  deployer.deploy(Migrations);

  //Continuation
  deployer.deploy(OffchainRecovery, 7, 10, 10, accounts.slice(0,2), {from:accounts[3], value:4200000000000000});
  deployer.deploy(OffchainRecovery, 7, 10, 10, accounts.slice(0,2), {from:accounts[3], value:4200000000000000000});

  //Deploy Approach + Extension
  deployer.deploy(SpecificHangmanChannel, 7, 10, 10, accounts.slice(0,2), {from:accounts[3], value:4200000000000000});
  deployer.deploy(SpecificHangmanChannel, 7, 10, 10, accounts.slice(0,2), {from:accounts[3], value:4200000000000000});
  deployer.deploy(SpecificHangmanChannel, 7, 10, 10, accounts.slice(0,2), {from:accounts[3], value:4200000000000000});
  deployer.deploy(SpecificHangmanSingleton, 7, 10, 10, 10);

  //Library Approach
  deployer.deploy(HangmanLib);
  deployer.deploy(AgnosticChannelManager, 10, 10);

  //Hybrid Approach + Extension
  deployer.deploy(HybridDisputeBoard, 10).then(function(){
    return deployer.deploy(HybridHangmanChannel, 7, 10, accounts.slice(0,2), HybridDisputeBoard.address, {from:accounts[3], value:4200000000000000}).then(function(){
      return deployer.deploy(HybridHangmanChannel, 7, 10, accounts.slice(0,2), HybridDisputeBoard.address, {from:accounts[3], value:4200000000000000}).then(function(){
        return deployer.deploy(HybridHangmanChannel, 7, 10, accounts.slice(0,2), HybridDisputeBoard.address, {from:accounts[3], value:4200000000000000}).then(function(){
          return deployer.deploy(HybridHangmanSingleton, 7, 10, 10, HybridDisputeBoard.address);
        });
      });
    });
  });

  //Wallets
  deployer.deploy(HalfOffchainMultiAppWallet, accounts.slice(0,2));
  deployer.deploy(FullOffchainMultiAppWallet, accounts.slice(0,2), 10);
  deployer.deploy(MoneyDispatcher);
};
