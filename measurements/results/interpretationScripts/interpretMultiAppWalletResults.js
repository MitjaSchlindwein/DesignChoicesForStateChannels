const fs = require('fs');
const names = require('./../../sharedCode/names');

var transactions = JSON.parse(fs.readFileSync('./../rawData/allTransactions.json'));
var deployment = JSON.parse(fs.readFileSync('./../rawData/allDeployments.json'));
var allConsumptions = transactions.concat(deployment);

var search = function(logs, tests, steps){
  //Initialize return object
  var _return = {};
  //If nothing to serach: return empty
  if(tests.length == 0 || steps.length == 0){
    return _return;
  }
  //Loop through all logs
  for(log in logs){
    for(test in tests){
      //Consider only the specified tests
      if(logs[log].test == tests[test]){
        for(step in steps){
          if(logs[log].step == steps[step]){
            if(_return[logs[log].step] == undefined){
              _return[logs[log].step] = [logs[log].gas];
            } else {
              _return[logs[log].step].push(logs[log].gas);
            }
          }
        }
      }
    }
  }
  return _return;
}

//Beautifiers
var numberWithCommas = function(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

var beautifyName = function(_functionality, _architecture, _subFunctionality) {
  _functionality = (_functionality[0].toUpperCase() + _functionality.slice(1)).replace(" ", "");
  _architecture = (_architecture[0].toUpperCase() + _architecture.slice(1)).replace(" ", "");
  _subFunctionality = (_subFunctionality[0].toUpperCase() + _subFunctionality.slice(1)).replace(" ", "");
  return (_architecture + _functionality + _subFunctionality);
}

//Functions to generate sub-structures
var generateExecution = function(tests){
  return {
    submitTx: search(allConsumptions, tests, [names.submitTx]),
    executeTx: search(allConsumptions, tests, [names.executeTx]),
    executepayout: search(allConsumptions, tests, [names.executePayout]),
  }
}

var generateRevocation = function(tests){
  return {
    revoke: search(allConsumptions, tests, [names.revokeTxWithoutPayout, names.updateNonce]),
    revokeWithWithdrawal: search(allConsumptions, tests, [names.revokeTxWithPayout])
  }
}

//Define array wtih the names of the relevant tests per architecture type
var tests = {}
tests[names.walletHW] = [names.execHW, names.execD]
tests[names.walletFW] = [names.execFW, names.execD]

//Installation
var instanceInstallation = {};
instanceInstallation[names.walletHW] = { deploy: search(allConsumptions, tests[names.walletHW], ["HalfOffchainMultiAppWallet"])};
instanceInstallation[names.walletFW] = { deploy: search(allConsumptions, tests[names.walletFW], ["FullOffchainMultiAppWallet"])};

//Execution
var execution = {};
execution[names.walletHW] = generateExecution(tests[names.walletHW]);
execution[names.walletFW] = generateExecution(tests[names.walletFW]);

//Revocation
var revocation = {};
revocation[names.walletHW] = generateRevocation(tests[names.walletHW]);
revocation[names.walletFW] = generateRevocation(tests[names.walletFW]);

var detailled = {
  installation: instanceInstallation,
  execution: execution,
  revocation: revocation
}

fs.writeFileSync("../aggregatedData/detailledMultiAppMeasurements.json", JSON.stringify(detailled));

var texVariables = [];
//Aggregate the information of the lowest levels
for(functionality in detailled){
  for(architecture in detailled[functionality]){
    for(subFunctionality in detailled[functionality][architecture]){
      var _max = 0;
      var _min = 0;
      var _sum = 0;
      var _values = 0;
      for(step in detailled[functionality][architecture][subFunctionality]){
        for(index in detailled[functionality][architecture][subFunctionality][step]){
          if(_max < detailled[functionality][architecture][subFunctionality][step][index]){
            _max = detailled[functionality][architecture][subFunctionality][step][index]
          }
          if(_min == 0 || _min > detailled[functionality][architecture][subFunctionality][step][index]){
            _min = detailled[functionality][architecture][subFunctionality][step][index]
          }
          _sum = _sum + detailled[functionality][architecture][subFunctionality][step][index];
          _values = _values + 1;
        }
      }
      if(_min == _max && _min == 0){
        detailled[functionality][architecture][subFunctionality] = "-";
        texVariables.push({
          name: beautifyName(functionality, architecture, subFunctionality),
          value:0
        });
      } else  if(_min == _max ) {
        detailled[functionality][architecture][subFunctionality] = numberWithCommas(_min);
        texVariables.push({
          name: beautifyName(functionality, architecture, subFunctionality),
          value:_min
        });
      } else {
        detailled[functionality][architecture][subFunctionality] = "" + numberWithCommas(_min) + " - " + numberWithCommas(_max);
        texVariables.push({
          name: beautifyName(functionality, architecture, subFunctionality),
          value: Math.round((_sum / _values))
        });
      }
    }
  }
}

fs.writeFileSync("../aggregatedData/midLevelMultiAppMeasurements.json", JSON.stringify(detailled));

var texString = "";
for(var i in texVariables){
  texString = texString + "\\newcommand\\value" + texVariables[i].name + "{" +  texVariables[i].value + "}\n";
}

fs.writeFileSync("../texOutput/multiappChannelVariables.tex",texString);
