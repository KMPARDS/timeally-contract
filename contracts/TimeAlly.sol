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

    struct User {
        Stake[] stakes;
        Loan[] loans;
        mapping(uint256 => bool) monthClaim;
    }
}
