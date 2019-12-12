pragma solidity 0.5.10;
pragma experimental "ABIEncoderV2";


contract OffchainLibrary {

  function callAction(bytes calldata, uint, bytes calldata, address[] calldata, address)
    external
    view
    returns (bytes memory)
  {
    revert("The action method has no implementation for this App");
  }
  
  function getOutcome(bytes calldata, uint)
    external
    pure
    returns (uint[] memory)
  {
    revert("The getOutcome method has no implementation for this App");
  }

}
