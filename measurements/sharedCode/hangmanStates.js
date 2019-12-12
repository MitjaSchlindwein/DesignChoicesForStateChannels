module.exports = {
  getStateAfterCommit: function() {
    return {
      version: 1,
  		hashedWord: "0x852daa74cc3c31fe64542bb9b8764cfb91cc30f9acf9389071ffb44a9eefde46",
  		guessed: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
  		word: "0x00000000",
  		currentGuess: 0,
      wordLength: 4,
      missingLetters: 4,
      tries: 0,
      stage: 1,
      challenge:0
    }
  },
  getStateAfterGuessE: function() {
    return {
      version: 2,
      hashedWord: '0x852daa74cc3c31fe64542bb9b8764cfb91cc30f9acf9389071ffb44a9eefde46',
      guessed: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      word: '0x00000000',
      currentGuess: 69,
      wordLength: 4,
      missingLetters: 4,
      tries: 0,
      stage: 2,
      challenge:0
      }
  },
  getStateAfterRightE: function() {
    return {
      version: 3,
      hashedWord: '0x852daa74cc3c31fe64542bb9b8764cfb91cc30f9acf9389071ffb44a9eefde46',
      guessed: [false, false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      word: '0x00450000',
      currentGuess: 69,
      wordLength: 4,
      missingLetters: 3,
      tries: 0,
      stage: 1,
      challenge:0
      }
  },
  getStateAfterGuessN: function() {
    return {
      version: 4,
      hashedWord: '0x852daa74cc3c31fe64542bb9b8764cfb91cc30f9acf9389071ffb44a9eefde46',
      guessed: [false, false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      word: '0x00450000',
      currentGuess: 78,
      wordLength: 4,
      missingLetters: 3,
      tries: 0,
      stage: 2,
      challenge:0
      }
  },
  getStateAfterWrongN: function() {
    return {
      version: 5,
      hashedWord: '0x852daa74cc3c31fe64542bb9b8764cfb91cc30f9acf9389071ffb44a9eefde46',
      guessed: [false, false, false, false, true, false, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false],
      word: '0x00450000',
      currentGuess: 78,
      wordLength: 4,
      missingLetters: 3,
      tries: 1,
      stage: 1,
      challenge:0
      }
  },
  getStateAfterGuessS: function() {
    return {
      version: 6,
      hashedWord: '0x852daa74cc3c31fe64542bb9b8764cfb91cc30f9acf9389071ffb44a9eefde46',
      guessed: [false, false, false, false, true, false, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false],
      word: '0x00450000',
      currentGuess: 83,
      wordLength: 4,
      missingLetters: 3,
      tries: 1,
      stage: 2,
      challenge:0
      }
  },
  getStateAfterRightS: function() {
    return {
      version: 7,
      hashedWord: '0x852daa74cc3c31fe64542bb9b8764cfb91cc30f9acf9389071ffb44a9eefde46',
      guessed: [false, false, false, false, true, false, false, false, false, false, false, false, false, true, false, false, false, false, true, false, false, false, false, false, false, false],
      word: '0x00455300',
      currentGuess: 83,
      wordLength: 4,
      missingLetters: 2,
      tries: 1,
      stage: 1,
      challenge:0
      }
  },
  getStateAfterGuessA: function() {
    return {
      version: 8,
      hashedWord: '0x852daa74cc3c31fe64542bb9b8764cfb91cc30f9acf9389071ffb44a9eefde46',
      guessed: [false, false, false, false, true, false, false, false, false, false, false, false, false, true, false, false, false, false, true, false, false, false, false, false, false, false],
      word: '0x00455300',
      currentGuess: 65,
      wordLength: 4,
      missingLetters: 2,
      tries: 1,
      stage: 2,
      challenge:0
      }
  },
  getStateAfterWrongA: function() {
    return {
      version:9,
      hashedWord: '0x852daa74cc3c31fe64542bb9b8764cfb91cc30f9acf9389071ffb44a9eefde46',
      guessed: [true, false, false, false, true, false, false, false, false, false, false, false, false, true, false, false, false, false, true, false, false, false, false, false, false, false],
      word: '0x00455300',
      currentGuess: 65,
      wordLength: 4,
      missingLetters: 2,
      tries: 2,
      stage: 1,
      challenge:0
      }
  },
  getStateAfterGuessT: function() {
    return {
      version: 10,
      hashedWord: '0x852daa74cc3c31fe64542bb9b8764cfb91cc30f9acf9389071ffb44a9eefde46',
      guessed: [true, false, false, false, true, false, false, false, false, false, false, false, false, true, false, false, false, false, true, false, false, false, false, false, false, false],
      word: '0x00455300',
      currentGuess: 84,
      wordLength: 4,
      missingLetters: 2,
      tries: 2,
      stage: 2,
      challenge:0
      }
  },
  getStateAfterRightT: function() {
    return {
      version: 11,
      hashedWord: '0x852daa74cc3c31fe64542bb9b8764cfb91cc30f9acf9389071ffb44a9eefde46',
      guessed: [true, false, false, false, true, false, false, false, false, false, false, false, false, true, false, false, false, false, true, true, false, false, false, false, false, false],
      word: '0x54455354',
      currentGuess: 84,
      wordLength: 4,
      missingLetters: 0,
      tries: 2,
      stage: 5,
      challenge:0
      }
  },
}
