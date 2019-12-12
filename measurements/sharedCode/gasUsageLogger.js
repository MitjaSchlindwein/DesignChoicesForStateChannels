const fs = require('fs');

module.exports = {
  getGasLogger: function(testRunName){
    return {
      testRunName: testRunName,
      log: [],
      counter: 0,
      addLog: function(test, step, gas){
        this.log.push({
          counter: this.counter,
          test: test,
          step: step,
          gas: gas
        });
        this.counter++;
      },
      getFinalLog: function(){
        return {
          name: this.testRunName,
          log: this.log
        }
      }
    }
  }
}
