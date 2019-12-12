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

//Functions to generate sub-structures
var generateExecution = function(tests){
  return {
    guess: search(allConsumptions, tests, [names.guessA, names.guessS, names.guessN, names.guessT]),
    correct: search(allConsumptions, tests, [names.correctS, names.correctT]),
    wrong: search(allConsumptions, tests, [names.wrongA, names.wrongN]),
  }
}

var generateCloseStructure = function(tests){
  return {
    normalCloseWhenOnchain: search(allConsumptions, tests, [names.close]),
    fastClose: search(allConsumptions, tests, [names.fastClose])
  }
}

var generateDisputeStructure = function(tests){
  return {
    startDispute: search(allConsumptions, tests, [names.startDispute]),
    moreCurrentEvidence: search(allConsumptions, tests, [names.updateDispute, names.submitEvidence]),
    finalizeDispute: search(allConsumptions, tests, [names.finalizeDispute])
  }
}

//Define array wtih the names of the relevant tests per architecture type
var tests = {}
tests[names.recoveryOnchain] = [names.execSp, names.execSpFC, names.execD];
tests[names.recoveryOffchain] = [names.execOR, names.execORFC,names.execD];

//Deployment
var deploy = {};
deploy[names.recoveryOnchain] = { deploy: search(allConsumptions, tests[names.recoveryOnchain], ["SpecificHangmanChannel"])};
deploy[names.recoveryOffchain] = { deploy: search(allConsumptions, tests[names.recoveryOffchain], ["OffchainRecovery"])};

//Dispute
var dispute = {};
dispute[names.recoveryOnchain] = generateDisputeStructure(tests[names.recoveryOnchain]);
dispute[names.recoveryOffchain] = generateDisputeStructure(tests[names.recoveryOffchain]);

//Execution
var forcefullyExecution = {};
forcefullyExecution[names.recoveryOnchain] = generateExecution(tests[names.recoveryOnchain]);
forcefullyExecution[names.recoveryOffchain] = generateExecution(tests[names.recoveryOffchain]);

//Close
var close = {};
close[names.recoveryOnchain] = generateCloseStructure(tests[names.recoveryOnchain]);
close[names.recoveryOffchain] = generateCloseStructure(tests[names.recoveryOffchain]);

var detailled = {
  deployment: deploy,
  dispute: dispute,
  execution: forcefullyExecution,
  close: close
}

fs.writeFileSync("../aggregatedData/detailledRecoveryMeasurements.json", JSON.stringify(detailled));

//Aggregate the information of the lowest levels
for(functionality in detailled){
  for(architecture in detailled[functionality]){
    for(subFunctionality in detailled[functionality][architecture]){
      var _max = 0;
      var _min = 0;
      for(step in detailled[functionality][architecture][subFunctionality]){
        for(index in detailled[functionality][architecture][subFunctionality][step]){
          if(_max < detailled[functionality][architecture][subFunctionality][step][index]){
            _max = detailled[functionality][architecture][subFunctionality][step][index]
          }
          if(_min == 0 || _min > detailled[functionality][architecture][subFunctionality][step][index]){
            _min = detailled[functionality][architecture][subFunctionality][step][index]
          }
        }
      }
      if(_min == _max && _min == 0){
        detailled[functionality][architecture][subFunctionality] = "-";
      } else  if(_min == _max ) {
        detailled[functionality][architecture][subFunctionality] = numberWithCommas(_min);
      } else {
        detailled[functionality][architecture][subFunctionality] = "" + numberWithCommas(_min) + " - " + numberWithCommas(_max);
      }
    }
  }
}

fs.writeFileSync("../aggregatedData/midLevelRecoveryMeasurements.json", JSON.stringify(detailled));
