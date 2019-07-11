pragma solidity ^0.5.10;

import './SafeMath.sol';
import './Eraswap.sol';

contract TimeAlly {

    using SafeMath for uint256;

    struct Staking {
        uint256 exaEsAmount;
        uint256 timestamp;
        uint256 stakingPlanId;
        uint256 status;
        uint256 loanId;
    }

    struct StakingPlan {
        uint256 planPeriod;
    }

    struct Loan {
        uint256 exaEsAmount;
        uint256 timestamp;
        uint256 loanPlanId;
        uint256 status;
        uint256 stakingId;
    }

    struct LoanPlan {
        uint256 loanPeriod;
        uint256 loanRate;
    }

    // cannot have a struct inside a struct
    // struct User {
    //     Stake[] stakes;
    //     Loan[] loans;
    //     bool[] monthClaim;
    // }



    address public owner;
    ERC20 token;

    // if StakePlan has only one member then make it uint256[]
    StakePlan[] stakePlans;
    LoanPlan[] loanPlans;

    mapping(address => Stake[]) stakings;
    mapping(address => Loan[]) loans;
    mapping(address => bool[]) monthClaim;

    event NewStake(
        address indexed _staker,
        uint256 indexed _stakePlanId,
        uint256 _exaEsAmount
    );

    constructor(address _tokenAddress) public {
        owner = msg.sender;
        token = ERC20(_tokenAddress);
    }

    // takes ES from user and locks it for a time
    function newStaking(uint256 _exaEsAmount, uint256 _stakingPlanId) public {
        require(token.transferFrom(msg.sender, address(this), _exaEsAmount));

        Staking[] storage userStakingsArray = stakings[msg.sender];
        userStakingsArray.push(Staking({
            exaEsAmount: _exaEsAmount,
            timestamp: now,
            stakingPlanId: _stakePlanId,
            status: 1,
            loanId: 0
        }));

        emit NewStaking(msg.sender, _stakingPlanId, _exaEsAmount);
    }

    // view stakes of a user
    function viewStaking(
        address _userAddress,
        uint256 _stakingId
    ) public view returns (uint256, uint256, uint256, uint256, uint256) {
        return (
            stakings[_userAddress][_stakeId].exaEsAmount,
            stakings[_userAddress][_stakeId].timestamp,
            stakings[_userAddress][_stakeId].stakingPlanId,
            stakings[_userAddress][_stakeId].status,
            stakings[_userAddress][_stakeId].loanId
        );
    }
}
