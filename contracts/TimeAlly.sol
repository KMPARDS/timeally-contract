pragma solidity ^0.5.10;

contract TimeAlly {
    struct Stake {
        uint256 amount;
        uint256 time;
        uint256 stakePlan;
        uint256 status;
        uint256 loanId;
    }

    struct Loan {
        uint256 amount;
        uint256 time;
        uint256 loanPlan;
        uint256 status;
        uint256 stakeId;
    }

    // cannot have a struct inside a struct
    // struct User {
    //     Stake[] stakes;
    //     Loan[] loans;
    // }

    address public owner;

    mapping(address => Stake[]) stakes;
    mapping(address => Loan[]) loans;
    mapping(address => bool[]) monthClaim;

    constructor() public {
        owner = msg.sender;
    }
}
