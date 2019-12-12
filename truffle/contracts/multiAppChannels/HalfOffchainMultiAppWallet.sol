pragma solidity 0.5.10;
pragma experimental ABIEncoderV2;

import "contracts/sharedCode/SigVerifier.sol";

//Multiapp-wallet that enables to install application instances offchain. However, the closing needs to be performed on-chain (Can be used with the agnostic architecture and both singleton extensions)
// Current restrictions
    // - No fair money deposition as part of this wallet (needs to be achieved with another contract or something like that)
    
contract HalfOffchainMultiAppWallet is SigVerifier {

    //List of already executed transactions (prevent replay)
    mapping(bytes32 => bool) executed;

    //List of participants
    address[] parties;
    
    //Constructor storing the set of owners
    constructor(address[] memory _parties) public {
        parties = _parties;
    }
    
    //Function to deposit coins
    function () external payable {}
    
    //Function to call a transaction of an arbitrary contract
    function executeTx(bytes32 _rand, address _to, uint256 _value, bytes memory _data, bytes memory _signatures) public {
        
        //Calculate the hash that is signed by web3
        bytes32 _txHash = keccak256(abi.encode(_rand, address(this), _to, _value, _data));
        
        //Check that transaction has not been executed before
        require(executed[_txHash] == false, "Transaction hash already been executed");
        
        //Check signatures
        verifySignatures(parties, calcPrefixedHash(_txHash), _signatures);
        
        //Execute transaction - We chose to transfer coins to the deployed contract that is then responsible for the handling
        bool _success;
        assembly {
            _success := call(not(0), _to, _value, add(_data, 0x20), mload(_data), 0, 0)
        }
        require(_success, "Call has not been successful");
        
        //Remember that transaction has been executed
        executed[_txHash] = true;
    }
    
    //Devalidates a transaction and directly pays out the specified coins
    function devalidateTx(bytes32 _hash, uint[] memory _payout, bytes memory _signatures) public {
        
        //Check that transaction has not been executed before
        require(executed[_hash] == false, "Transaction hash has already been executed or revoked");
        
        //Check that each party signed the revocation (including the payout balances )
        verifySignatures(parties, abi.encode("REVOCATION", _hash, _payout), _signatures);
        
        //Set hash as executed -> Cannot be executed again
        executed[_hash] = true;
        
        //Payout specified balances (we loop through the payout not the parties, so we can allow to leave parties at the back of the array out if they do not receive any payout)
        for(uint i = 0; i < _payout.length; i++){
            address(uint160(parties[i])).transfer(_payout[i]); //We can directly call the transfer because the previous check reverts this call as well
        }
    }
    
    //****************
    //Getters
    function getInfo() internal returns (address[] memory, uint){
        return (parties, address(this).balance);
    }
}
