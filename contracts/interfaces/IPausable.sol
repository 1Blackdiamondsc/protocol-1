pragma solidity ^0.5.0;

interface IPausable {

    function isPaused() external view returns (bool);

}
