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
        uint256 accruedExaEsAmount;
        uint256 loanId;
        mapping (uint256 => bool) isMonthClaimed;
    }

    struct StakingPlan {
        uint256 months;
        uint256 fractionFrom15;
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


    address public owner;
    address public nrtAddress;
    Eraswap public token;

    uint256 deployedTimestamp;
    uint256 earthSecondsInMonth = 2629744;

    //uint256 public currentMonth;
    uint256[] public timeAllyMonthlyNRT; //current month is the length of this array

    // if StakePlan has only one member then make it uint256[]
    StakingPlan[] public stakingPlans;
    LoanPlan[] public loanPlans;

    // user activity details:
    mapping(address => Staking[]) stakings;
    mapping(address => Loan[]) loans;
    //mapping(address => mapping (uint256 => bool)) monthClaim;

    mapping (uint256 => uint256) public totalActiveStakings;

    uint256 launchRewardBucket;
    mapping(address => uint256) public launchReward;

    // need stakingid in this
    event NewStaking(
        address indexed _staker,
        uint256 indexed _stakePlanId,
        uint256 _exaEsAmount,
        uint256 _stakingId
    );

    modifier onlyNRTManager() {
        require(msg.sender == nrtAddress, 'only NRT manager can call');
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, 'only deployer can call');
        _;
    }

    constructor(address _tokenAddress, address _nrtAddress) public {
        owner = msg.sender;
        token = Eraswap(_tokenAddress);
        nrtAddress = _nrtAddress;
        deployedTimestamp = token.mou();
        timeAllyMonthlyNRT.push(0);
    }

    function increaseMonth(uint256 _timeAllyNRT) public onlyNRTManager() {
        timeAllyMonthlyNRT.push(_timeAllyNRT);
    }

    function getCurrentMonth() public view returns (uint256) {
        return timeAllyMonthlyNRT.length - 1;
    }

    function createStakingPlan(uint256 _months, uint256 _fractionFrom15) public onlyOwner() {
        stakingPlans.push(StakingPlan({
            months: _months,
            fractionFrom15: _fractionFrom15
        }));
    }

    // takes ES from user and locks it for a time
    function newStaking(uint256 _exaEsAmount, uint256 _stakingPlanId) public {
        require(token.transferFrom(msg.sender, address(this), _exaEsAmount), 'could not transfer tokens');
        uint256 stakeEndMonth = getCurrentMonth() + 1 + stakingPlans[_stakingPlanId].months;

        // update the array so that staking would be automatically inactive after the stakingPlanMonthhs
        for(
          uint256 month = getCurrentMonth() + 1;
          month < stakeEndMonth;
          month++
        ) {
            totalActiveStakings[month] = totalActiveStakings[month] + _exaEsAmount;
        }

        Staking[] storage userStakingsArray = stakings[msg.sender];
        userStakingsArray.push(Staking({
            exaEsAmount: _exaEsAmount,
            timestamp: token.mou(),
            stakingPlanId: _stakingPlanId,
            status: 1,
            accruedExaEsAmount: 0,
            loanId: 0
        }));

        emit NewStaking(msg.sender, _stakingPlanId, _exaEsAmount, userStakingsArray.length - 1);
    }

    function getNumberOfStakingsByUser(address _userAddress) public view returns (uint256) {
        return stakings[_userAddress].length;
    }

    // view stakes of a user
    function viewStaking(
        address _userAddress,
        uint256 _stakingId
    ) public view returns (uint256, uint256, uint256, uint256, uint256, uint256) {
        return (
            stakings[_userAddress][_stakingId].exaEsAmount,
            stakings[_userAddress][_stakingId].timestamp,
            stakings[_userAddress][_stakingId].stakingPlanId,
            stakings[_userAddress][_stakingId].status,
            stakings[_userAddress][_stakingId].accruedExaEsAmount,
            stakings[_userAddress][_stakingId].loanId
        );
    }

    function topupRewardBucket(uint256 _exaEsAmount) public onlyOwner {
        require(token.transferFrom(msg.sender, address(this), _exaEsAmount));
        launchRewardBucket = launchRewardBucket.add(_exaEsAmount);
    }

    function giveLaunchReward(address[] memory _addresses, uint256 _exaEsAmount) public onlyOwner {
        for(uint256 i = 0; i < _addresses.length; i++) {
            launchRewardBucket = launchRewardBucket.sub(_exaEsAmount);
            launchReward[_addresses[i]] = launchReward[_addresses[i]].add(_exaEsAmount);
        }
    }

    function claimLaunchReward(uint256 _stakingPlanId) public {
        require(launchReward[msg.sender] > 0);
        uint256 reward = launchReward[msg.sender];
        launchReward[msg.sender] = 0;

        // create new staking
        uint256 stakeEndMonth = getCurrentMonth() + 1 + stakingPlans[_stakingPlanId].months;

        // update the array so that staking would be automatically inactive after the stakingPlanMonthhs
        for(
          uint256 month = getCurrentMonth() + 1;
          month < stakeEndMonth;
          month++
        ) {
            totalActiveStakings[month] = totalActiveStakings[month] + reward;
        }

        Staking[] storage userStakingsArray = stakings[msg.sender];
        userStakingsArray.push(Staking({
            exaEsAmount: reward,
            timestamp: token.mou(),
            stakingPlanId: _stakingPlanId,
            status: 1,
            accruedExaEsAmount: 0,
            loanId: 0
        }));

        emit NewStaking(msg.sender, _stakingPlanId, reward, userStakingsArray.length - 1);
    }

    function isStakingActive(address _userAddress, uint256 _stakingId, uint256 _currentMonth, uint256 _atMonth) public view returns (bool) {
      uint256 stakingMonth = stakings[_userAddress][_stakingId].timestamp.sub(deployedTimestamp).div(earthSecondsInMonth);

      return (
        stakingMonth + 1 <= _atMonth && stakingMonth + stakingPlans[ stakings[_userAddress][_stakingId].stakingPlanId ].months >= _atMonth
        && stakings[_userAddress][_stakingId].status == 1
        && (
          _currentMonth != _atMonth
          || token.mou() >= stakings[_userAddress][_stakingId].timestamp
                      .add( (_currentMonth - stakingMonth).mul(earthSecondsInMonth) )
          )
        );
    }

    function userActiveStakingByMonth(address _userAddress, uint256 _atMonth) public view returns (uint256) {
        // calculate user's active stakings amount for this month
        // divide by total active stakings to get the fraction.
        // multiply by the total timeally NRT to get the share and send it to user

        uint256 _currentMonth = getCurrentMonth();
        require(_currentMonth >= _atMonth, 'cannot see future stakings');

        if(totalActiveStakings[_atMonth] == 0) {
            return 0;
        }

        uint256 userActiveStakingsExaEsAmount;

        for(uint256 i = 0; i < stakings[_userAddress].length; i++) {
            // StakingPlan memory plan = stakingPlans[ stakings[_userAddress][i].stakingPlanId ];

            // user staking should be active for it to be considered


            if(isStakingActive(_userAddress, i, _currentMonth, _atMonth)
              && !stakings[_userAddress][i].isMonthClaimed[_atMonth]) {
                userActiveStakingsExaEsAmount = userActiveStakingsExaEsAmount
                    .add(stakings[_userAddress][i].exaEsAmount
                    .mul(stakingPlans[ stakings[_userAddress][i].stakingPlanId ].fractionFrom15)
                    .div(15));
            }
        }

        return userActiveStakingsExaEsAmount;//.mul(timeAllyMonthlyNRT[_atMonth]).div(totalActiveStakings[_atMonth]);
    }


    function seeShareForUserByMonth(address _userAddress, uint256 _atMonth) public view returns (uint256) {
        // calculate user's active stakings amount for this month
        // divide by total active stakings to get the fraction.
        // multiply by the total timeally NRT to get the share and send it to user

        uint256 _currentMonth = getCurrentMonth();
        require(_atMonth <= _currentMonth, 'cannot see future stakings');

        if(totalActiveStakings[_atMonth] == 0) {
            return 0;
        }

        uint256 userActiveStakingsExaEsAmount;

        for(uint256 i = 0; i < stakings[_userAddress].length; i++) {
            StakingPlan memory plan = stakingPlans[ stakings[_userAddress][i].stakingPlanId ];

            // user staking should be active for it to be considered
            if(isStakingActive(_userAddress, i, _currentMonth, _atMonth)
              && !stakings[_userAddress][i].isMonthClaimed[_atMonth]) {
                userActiveStakingsExaEsAmount = userActiveStakingsExaEsAmount.add(stakings[_userAddress][i].exaEsAmount.mul(plan.fractionFrom15).div(15));
            }
        }

        return userActiveStakingsExaEsAmount.mul(timeAllyMonthlyNRT[_atMonth]).div(totalActiveStakings[_atMonth]);
    }

    function withdrawShareForUserByMonth(uint256 _atMonth, uint256 _accruedPercentage) public {
        uint256 _currentMonth = getCurrentMonth();

        require(_currentMonth >= _atMonth, 'cannot withdraw future stakings');

        //require(!monthClaim[msg.sender][_currentMonth], 'cannot claim again');
        //monthClaim[msg.sender][_currentMonth] = true;

        if(totalActiveStakings[_currentMonth] == 0) {
            require(false, 'total active stakings should be non zero');
        }

        require(_accruedPercentage >= 50, 'accruedPercentage should be at least 50');

        uint256 userActiveStakingsExaEsAmount;
        uint256 accruedPercentage = _accruedPercentage;

        for(uint256 i = 0; i < stakings[msg.sender].length; i++) {
            StakingPlan memory plan = stakingPlans[ stakings[msg.sender][i].stakingPlanId ];

            // user staking should be active for it to be considered
            if(isStakingActive(msg.sender, i, _currentMonth, _atMonth)
              && !stakings[msg.sender][i].isMonthClaimed[_atMonth]) {
                stakings[msg.sender][i].isMonthClaimed[_atMonth] = true;

                // for every staking, incrementing its accrued amount
                uint256 effectiveAmount = stakings[msg.sender][i].exaEsAmount.mul(plan.fractionFrom15).div(15);
                uint256 accruedShare = effectiveAmount.mul(accruedPercentage).div(100);
                stakings[msg.sender][i].accruedExaEsAmount = stakings[msg.sender][i].accruedExaEsAmount.add(accruedShare);

                userActiveStakingsExaEsAmount = userActiveStakingsExaEsAmount.add(effectiveAmount);
            }
        }

        uint256 liquidShare = userActiveStakingsExaEsAmount
                                .mul(timeAllyMonthlyNRT[_currentMonth])
                                .div(totalActiveStakings[_currentMonth])
                                .mul(100 - accruedPercentage).div(100);

        if(liquidShare > 0) {
            token.transfer(msg.sender, liquidShare);
        }
    }

    function restakeAccrued(uint256 _stakingId, uint256 _stakingPlanId) public {
        require(stakings[msg.sender][_stakingId].accruedExaEsAmount > 0);

        uint256 accruedExaEsAmount = stakings[msg.sender][_stakingId].accruedExaEsAmount;
        stakings[msg.sender][_stakingId].accruedExaEsAmount = 0;
        newStaking(
          accruedExaEsAmount,
          _stakingPlanId
        );
    }

    // give in input which which stakings to withdeaw
    function withdrawExpiredStakings(uint256[] memory _stakings) public {
        for(uint256 i = 0; i < _stakings.length; i++) {
            stakings[msg.sender][_stakings[i]].status = 3;

            if(stakings[msg.sender][_stakings[i]].accruedExaEsAmount > 0) {
              uint256 accruedExaEsAmount = stakings[msg.sender][_stakings[i]].accruedExaEsAmount;
              stakings[msg.sender][_stakings[i]].accruedExaEsAmount = 0;
              newStaking(
                accruedExaEsAmount,
                stakings[msg.sender][_stakings[i]].stakingPlanId
              );
            }

            token.transfer(msg.sender, stakings[msg.sender][_stakings[i]].exaEsAmount);
        }
    }

    function timeAllyMonthlyNRTArray() public view returns (uint256[] memory) {
        return timeAllyMonthlyNRT;
    }
}
