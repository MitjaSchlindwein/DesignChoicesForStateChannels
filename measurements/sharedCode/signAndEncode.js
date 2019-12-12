const privateKeys = require('./privateKeys');
const ethers = require('ethers');

module.exports = {
  seed: 0,
  getRandomNonce: function() {
    return web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["uint256"],[this.seed++]));
  },
  getSignatureArrayEncoding: function() {
    return `tuple(uint8 v,bytes32 r,bytes32 s)[]`;
  },
  getApplicationStateTupleEncoding: function() {
    return `tuple(bytes32 hashedWord, bool[26] guessed, bytes word, uint8 currentGuess, uint wordLength, uint missingLetters, uint tries, uint8 stage, uint challenge)`;
  },
  encodeSignatureArray: function(_signatureArray) {
    return ethers.utils.defaultAbiCoder.encode([this.getSignatureArrayEncoding()], [_signatureArray]);
  },
  encodeApplicationStateTuple: function(_state) {
    return ethers.utils.defaultAbiCoder.encode([this.getApplicationStateTupleEncoding()], [_state]);
  },
  stripSignatureObject: function(_signatureObject) {
    return {
      v: _signatureObject.v,
      r: _signatureObject.r,
      s: _signatureObject.s
    };
  },
  getEncodedSignaturesFromPlayer1And2: function(_hash) {
    return this.encodeSignatureArray([this.stripSignatureObject(web3js.eth.accounts.sign(_hash, privateKeys.getPlayer1PrivateKey())), this.stripSignatureObject(web3js.eth.accounts.sign(_hash, privateKeys.getPlayer2PrivateKey()))]);
  },
  hashInstanceState: function(_address, _state) {
    return web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "uint256", "bytes32", "bool[26]", "bytes", "uint8", "uint256", "uint256", "uint256", "uint8"],
      [_address, _state.version, _state.hashedWord, _state.guessed, _state.word, _state.currentGuess, _state.wordLength, _state.missingLetters, _state.tries, _state.stage]));
  },
  getChannelManagerStateInfo: function(_address, _id, _state) {
    var _encodedState = this.encodeApplicationStateTuple(_state);
    var _hash = web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "bytes32", "uint256", "bytes"],
      [_address, _id, _state.version, _encodedState]));
    return {
      id: _id,
      version: _state.version,
      encodedState: _encodedState,
      signatures: this.getEncodedSignaturesFromPlayer1And2(_hash)
    }
  },
  getHybridDisputeboardSingletonInfo: function(_boardAddress, _singletonAddress, _foreignId, _state ) {
    var _encodedState = this.encodeApplicationStateTuple(_state)
    var _stateHash = web3js.utils.keccak256(_encodedState);
    var _dbId = web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "bytes32"], [_singletonAddress, _foreignId]));
    var _signedHash = web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "uint256", "uint256","bytes32"],
      [_boardAddress, _dbId, _state.version, _stateHash]));
    return {
      id: _dbId,
      version: _state.version,
      stateHash: _stateHash,
      state: _encodedState,
      signatures: this.getEncodedSignaturesFromPlayer1And2(_signedHash),
      fastCloseStage: 5,
      fastClosedSignatures: this.getEncodedSignaturesFromPlayer1And2(web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "uint256", "uint8"], [_singletonAddress, _foreignId, 5])))
    }
  },
  getHybridDisputeboardChannelInfo: function(_boardAddress, _channelAddress, _state ) {
    var _stateHash = web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["bytes32", "bool[26]", "bytes", "uint8", "uint256", "uint256", "uint256", "uint8"],
      [_state.hashedWord, _state.guessed, _state.word, _state.currentGuess, _state.wordLength, _state.missingLetters, _state.tries, _state.stage]));
    var _dbId = web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "bytes32"], [_channelAddress, "0x0000000000000000000000000000000000000000000000000000000000000000"]));
    var _signedHash = web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "bytes32", "uint256","bytes32"],
      [_boardAddress, _dbId, _state.version, _stateHash]));
    return {
      id: _dbId,
      version: _state.version,
      stateHash: _stateHash,
      state: _state,
      signatures: this.getEncodedSignaturesFromPlayer1And2(_signedHash),
      fastCloseStage: 5,
      fastClosedSignatures: this.getEncodedSignaturesFromPlayer1And2(web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "uint8"], [_channelAddress, 5])))
    }
  },
  getHalfWalletTxInfo: function(_seed, _wallet, _to, _value, _callEncoding, _payout){
    var _rand = web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["string"], [_seed]));
    var _txHash = web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["bytes32", "address", "address", "uint256", "bytes"], [_rand, _wallet, _to, _value, _callEncoding]));
    var _revokeHash = web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["string", "bytes32", "uint[]"], ["REVOCATION", _txHash, _payout]));
    return {
      payout: _payout,
      hash: _txHash,
      rand: _rand,
      installSig: this.getEncodedSignaturesFromPlayer1And2(_txHash),
      revokeSig: this.getEncodedSignaturesFromPlayer1And2(_revokeHash)
    }
  },
  getFullWalletTxInfo: function(_seed, _nonce, _wallet, _to, _value, _callEncoding){
    var _rand = web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["string"], [_seed]));
    var _txHash = web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["bytes32", "address", "address", "uint256", "bytes"], [_rand, _wallet, _to, _value, _callEncoding]));
    return {
      hash: _txHash,
      nonce: _nonce,
      rand: _rand,
      to: _to,
      value: _value,
      data: _callEncoding,
      signatures: this.getEncodedSignaturesFromPlayer1And2(web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["uint","bytes32"], [_nonce, _txHash])))
    }
  },
  getFullWalletNonceUpdateSignatures: function(_wallet, _newNonce){
    return this.getEncodedSignaturesFromPlayer1And2(web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "uint"], [_wallet, _newNonce])))
  },

  // Not used anymore -> Relock is an additional feature that makes the execution more expensive and thus harms the comparability
  getHybridDisputeboardWithRelockSingletonInfo: function(_boardAddress, _singletonAddress, _foreignId, _lockCount, _state ) {
    var _encodedState = this.encodeApplicationStateTuple(_state)
    var _stateHash = web3js.utils.keccak256(_encodedState);
    var _dbId = web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "bytes32"], [_singletonAddress, _foreignId]));
    var _signedHash = web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "uint256", "uint256", "uint256","bytes32"],
      [_boardAddress, _dbId, _lockCount, _state.version, _stateHash]));
    return {
      id: _dbId,
      lockCount: _lockCount,
      version: _state.version,
      stateHash: _stateHash,
      state: _encodedState,
      signatures: this.getEncodedSignaturesFromPlayer1And2(_signedHash),
      fastCloseStage: 5,
      fastClosedSignatures: this.getEncodedSignaturesFromPlayer1And2(web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "uint256", "uint8"], [_singletonAddress, _foreignId, 5])))
    }
  },
  getHybridSingletonWithRelockLockSignatures: function(_channelAddress, _id, _lockCount) {
    return this.getEncodedSignaturesFromPlayer1And2(web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "bytes32", "uint256"], [_channelAddress, _id, _lockCount])));
  },
  getHybridDisputeboardWithRelockChannelInfo: function(_boardAddress, _channelAddress, _lockCount, _state ) {
    var _stateHash = web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["bytes32", "bool[26]", "bytes", "uint8", "uint256", "uint256", "uint256", "uint8"],
      [_state.hashedWord, _state.guessed, _state.word, _state.currentGuess, _state.wordLength, _state.missingLetters, _state.tries, _state.stage]));
    var _dbId = web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "bytes32"], [_channelAddress, "0x0000000000000000000000000000000000000000000000000000000000000000"]));
    var _signedHash = web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "bytes32", "uint256", "uint256","bytes32"],
      [_boardAddress, _dbId, _lockCount, _state.version, _stateHash]));
    return {
      id: _dbId,
      lockCount: _lockCount,
      version: _state.version,
      stateHash: _stateHash,
      state: _state,
      signatures: this.getEncodedSignaturesFromPlayer1And2(_signedHash),
      fastCloseStage: 5,
      fastClosedSignatures: this.getEncodedSignaturesFromPlayer1And2(web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "uint8"], [_channelAddress, 5])))
    }
  },
  getHybridChannelWithRelockLockSignatures: function(_channelAddress, _lockCount) {
    return this.getEncodedSignaturesFromPlayer1And2(web3js.utils.keccak256(web3js.eth.abi.encodeParameters(["address", "uint256"], [_channelAddress, _lockCount])));
  }
}
