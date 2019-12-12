pragma solidity 0.5.10;
pragma experimental ABIEncoderV2;

import "contracts/sharedCode/SigVerifier.sol";

//Multiapp-wallet that enables to install and uninstall application instances completely offchain (Can be used with the agnostic architecture and both singleton extensions)
// Current restrictions
    // - No fair money deposition as part of this wallet (needs to be achieved with another contract or something like that)
    // - Single nonce -> Before a nonce update parties need to resign each tx that should not get devalidated

//A very simple approach: Lifecycle looks typically like this
    // - Before creation parties sign payout-tx dependent on nonce = 0
    // - Parties then sign an updated payout-tx and an installation-tx dependent on nonce = 1
    // - Parties then update the nonce to devalidate the first payout-tx and validate the second
    // - Parties execute till termination by signing states that can be interpreted by the used dispute handler (singleton or channel manager)
    // - To terminate the instance parties sign an updated payout-tx dependent on nonce = 2
    // - Parties then update the nonce to devalidate the previos payouts and installations
    // ...
        // As all transactions depend on a single nonce, parties need to resign (with new nonce) each tx that should not be revoked before they can update the nonce -> This should be easily be solvable by using multi-dimensional nonces
    
contract FullOffchainMultiAppWallet is SigVerifier {
    
    //Constant after creation
    uint revocationPeriod;
    address[] parties;

    //States of submitted transactions
    mapping(bytes32 => TxState) transactions;
    uint nonce;

    //Possible status
    enum TxStatus { NONE, SUBMITTED, EXECUTED}
    
    //Structure of states
    struct TxState {
        TxStatus status;
        uint submissionTime;
        uint nonce;
    }
    
    //Constructor storing the set of owners and the revocation period
    constructor(address[] memory _parties, uint _revocationPeriod) public {
        parties = _parties;
        revocationPeriod = _revocationPeriod;
        nonce = 0;
    }
    
    //Function to deposit coins
    function () external payable {}

    //function to submit a transaction for execution
    function submitTx(uint256 _nonce, bytes32 _txHash, bytes memory _signatures) public {
        
        //Check that this tx has not been executed before
        require(transactions[_txHash].status != TxStatus.EXECUTED, "Already executed");
        //If a transaction has already been submitted the new submission needs a higher nonce
        require(transactions[_txHash].status != TxStatus.SUBMITTED || transactions[_txHash].nonce < _nonce, "Already submitted with a equal or higher none");
        
        //Check signatures
        verifySignatures(parties, calcPrefixedHash(abi.encode(_nonce, _txHash)), _signatures);
        
        //Set tx-hash as submitted
        transactions[_txHash].status = TxStatus.SUBMITTED;
        transactions[_txHash].submissionTime = now;
        transactions[_txHash].nonce = _nonce;
    }
    
    //Function to execute a submitted transaction if no revocation has been submitted || we add a random value to enable parties to execute the same transaction multiple times
    function executeTx(bytes32 _random, address _to, uint256 _value, bytes memory _data) public {
        
        //Calculate the hash of the data 
        bytes32 _txHash = keccak256(abi.encode(_random, address(this), _to, _value, _data));
        
        //No transactions that have not been submitted or have already been executed, nonce need to fit (is revocation), timeout needs to be over
        require(transactions[_txHash].status == TxStatus.SUBMITTED, "Wrong status, not submitted");
	require(transactions[_txHash].nonce == nonce, "Wrong nonce");
	require(transactions[_txHash].submissionTime + revocationPeriod < now, "timeout not elapsed");
        
        //Execute transaction - We chose to transfer coins to the deployed contract that is then responsible for the handling
        bool _success;
        assembly {
            _success := call(not(0), _to, _value, add(_data, 0x20), mload(_data), 0, 0)
        }
        require(_success, "Call has not been successful");
        
        //Set status as executed
        transactions[_txHash].status = TxStatus.EXECUTED;
    }
    
    //Increment nonce to devalidate all transactions that depend on previous nonces and validate all that depend on the current nonce
    function updateNonce(uint _newNonce, bytes memory _signatures) public {
        
        //Check signatures and nonce
        require(_newNonce > nonce, "New nonce is not larger than the current one");
        verifySignatures(parties, abi.encode(address(this), _newNonce), _signatures);
        
        //Update nonce
        nonce = _newNonce;
    } 
    
    //****************
    //Getters
    function getWalletState() internal returns (address[] memory, uint, uint){
        return (parties, address(this).balance, revocationPeriod);
    }
    
    function getTxState(bytes32 _txHash) external view returns (TxState memory){
        return transactions[_txHash];
    }
}
