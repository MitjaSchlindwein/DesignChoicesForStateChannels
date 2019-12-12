pragma solidity 0.5.10;
pragma experimental ABIEncoderV2;

//Contract to send money to multiple addresses
contract MoneyDispatcher {
    
    //pays each party the specified funds
    function dispatch(address[] calldata _parties, uint[] calldata _balances) external payable {
        for(uint i = 0; i <_balances.length; i++){
            address(uint160(_parties[i])).transfer(_balances[i]);
        }
    }
}
