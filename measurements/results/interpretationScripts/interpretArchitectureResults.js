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
var generateInstallationStructure = function(tests, stepsO, stepsPA, stepsPI){
  return {
    once: search(allConsumptions, tests, stepsO),
    perApplication: search(allConsumptions, tests, stepsPA),
    perInstance: search(allConsumptions, tests, stepsPI)
  }
}

var generateCloseStructure = function(tests){
  return {
    normalCloseWhenOnchain: search(allConsumptions, tests, [names.close]),
    fastClose: search(allConsumptions, tests, [names.fastClose])
  }
}

var generateExecution = function(tests){
  return {
    guess: search(allConsumptions, tests, [names.guessA, names.guessS, names.guessN, names.guessT]),
    correct: search(allConsumptions, tests, [names.correctS, names.correctT]),
    wrong: search(allConsumptions, tests, [names.wrongA, names.wrongN]),
  }
}

var generateDispute = function(tests, finalizationSteps){
  return {
    firstDispute: search(allConsumptions, tests, [names.startDispute]),
    provideMoreCurrentEvidence: search(allConsumptions, tests, [names.updateDispute]),
    finalizeDispute: search(allConsumptions, tests, finalizationSteps)
  }
}

//Define array wtih the names of the relevant tests per architecture type
var tests = {}
tests[names.architectureA] = [names.execD, names.execA, names.execAFC]
tests[names.architectureSp] = [names.execD, names.execSp, names.execSpFC]
tests[names.architectureSpSi] = [names.execD, names.execSpSi, names.execSpSiFC]
tests[names.architectureHy] = [names.execD, names.execHy, names.execHyFC]
tests[names.architectureHySi] = [names.execD, names.execHySi, names.execHySiFC]

//Installations
var instanceInstallation = {};
instanceInstallation[names.architectureA] = generateInstallationStructure(tests[names.architectureA], ["AgnosticChannelManager"], ["HangmanLib"], [names.initializeChannel]);
instanceInstallation[names.architectureSp] = generateInstallationStructure(tests[names.architectureSp], [], [], ["SpecificHangmanChannel"]);
instanceInstallation[names.architectureSpSi] = generateInstallationStructure(tests[names.architectureSpSi], [], ["SpecificHangmanSingleton"], [names.initializeChannel]);
instanceInstallation[names.architectureHy] = generateInstallationStructure(tests[names.architectureHy], ["HybridDisputeBoard"], [], ["HybridHangmanChannel"]);
instanceInstallation[names.architectureHySi] = generateInstallationStructure(tests[names.architectureHySi], ["HybridDisputeBoard"], ["HybridHangmanSingleton"], [names.initializeChannel]);

//Dispute
var dispute = {};
dispute[names.architectureA] = generateDispute(tests[names.architectureA], [names.finalizeDispute]);
dispute[names.architectureSp] = generateDispute(tests[names.architectureSp], [names.finalizeDispute]);
dispute[names.architectureSpSi] = generateDispute(tests[names.architectureSpSi], [names.finalizeDispute]);
dispute[names.architectureHy] = generateDispute( tests[names.architectureHy], [names.unlock]);
dispute[names.architectureHySi] = generateDispute(tests[names.architectureHySi], [names.unlock]);

//Execution
var execution = {};
execution[names.architectureA] = generateExecution(tests[names.architectureA]);
execution[names.architectureSp] = generateExecution(tests[names.architectureSp]);
execution[names.architectureSpSi] = generateExecution(tests[names.architectureSpSi]);
execution[names.architectureHy] = generateExecution( tests[names.architectureHy]);
execution[names.architectureHySi] = generateExecution(tests[names.architectureHySi]);

//Close
var close = {};
close[names.architectureA] = generateCloseStructure(tests[names.architectureA]);
close[names.architectureSp] = generateCloseStructure(tests[names.architectureSp]);
close[names.architectureSpSi] = generateCloseStructure(tests[names.architectureSpSi]);
close[names.architectureHy] = generateCloseStructure( tests[names.architectureHy]);
close[names.architectureHySi] = generateCloseStructure(tests[names.architectureHySi]);

//Detailled structure
// - Function (install, dispute ...)
//    - Architecture
//      - Sub functionality (start dispute, ...) - Mostly there is just one steps per sub functionality
//        - Steps: [costs]

var detailled = {
  installation: instanceInstallation,
  dispute: dispute,
  execution: execution,
  close: close
}

fs.writeFileSync("../aggregatedData/detailledArchitectureMeasurements.json", JSON.stringify(detailled));

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

fs.writeFileSync("../aggregatedData/midLevelArchitectureMeasurements.json", JSON.stringify(detailled));

var texString = "";
for(var i in texVariables){
  texString = texString + "\\newcommand\\value" + texVariables[i].name + "{" +  texVariables[i].value + "}\n";
}

fs.writeFileSync("../texOutput/architectureVariables.tex",texString);
