pragma solidity 0.5.10;
pragma experimental ABIEncoderV2;

contract SigVerifier {

    //Structure for signatures
    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }
    
    //Function to check signatures
    function verifySignatures(address[] memory _parties, bytes memory _encodedInput, bytes memory _signatures) internal {
        verifySignatures(_parties, calcPrefixedHash(_encodedInput), _signatures);
    }
    
    //Function to check signatures
    function verifySignatures(address[] memory _parties, bytes32 _hash, bytes memory _signatures) internal {
        
        //Convert signatures
        Signature[] memory _decodedSignatures = abi.decode(_signatures, (Signature[]));
        
        //Check that there are enough signatures
        require(_decodedSignatures.length == _parties.length, "There are less/more signatures then parties");

        //Check signatures
        for(uint i = 0; i < _parties.length; i++){
            require(_parties[i] == ecrecover(_hash, _decodedSignatures[i].v, _decodedSignatures[i].r, _decodedSignatures[i].s), "Wrong signature");
        }
    }
    
    //Calculate hash for signature verification (Web3js adds some text in front)
    function calcPrefixedHash(bytes memory _encodedInput) internal pure returns (bytes32){
        return calcPrefixedHash(keccak256(_encodedInput));
    }
    
    function calcPrefixedHash(bytes32 _hashedInput) internal pure returns (bytes32){
        string memory _mes = "\x19Ethereum Signed Message:\n32";
        bytes32 _hash2 = keccak256(abi.encodePacked(_mes,_hashedInput));
        return _hash2;
    }
}
