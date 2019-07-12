const assert = require('assert');
const ethers = require('ethers');

const ganache = require('ganache-cli');
const provider = new ethers.providers.Web3Provider(ganache.provider({ gasLimit: 8000000 }));

const eraSwapTokenJSON = require('../build/Eraswap_0.json');
const nrtManagerJSON = require('../build/NRTManager_0.json');
const timeAllyJSON = require('../build/TimeAlly_0.json');

let accounts
, eraSwapInstance = []
, nrtManagerInstance = []
, timeAllyInstance = [];

describe('Ganache Setup', async() => {
  it('initiates ganache and generates a bunch of demo accounts', async() => {
    accounts = await provider.listAccounts();

    assert.ok(accounts.length >= 2, 'atleast 2 accounts should be present in the array');
  });
});

describe('Era Swap Setup', async() => {
  it('deploys Era Swap token contract from first account', async() => {
    const eraSwapContract = new ethers.ContractFactory(
      eraSwapTokenJSON.abi,
      eraSwapTokenJSON.evm.bytecode.object,
      provider.getSigner(accounts[0])
    );
    eraSwapInstance[0] =  await eraSwapContract.deploy();

    assert.ok(eraSwapInstance[0].address, 'conract address should be present');
  });

  it('gives first account 91,00,00,000 ES balance', async() => {
    const balanceOfDeployer = await eraSwapInstance[0].functions.balanceOf(accounts[0]);

    assert.ok(
      balanceOfDeployer.eq(ethers.utils.parseEther('910000000')),
      'deployer should get 910000000 ES'
    );
  });

  it('mou() time machine is present', async() => {
    try {
      const mou = await eraSwapInstance[0].functions.mou();
      assert.ok(mou.gt(0), 'mou() time machine should give non zero time stamp');
    } catch (e) {
      assert(false, 'mou() method should be present in era swap contract');
    }
  });
});

describe('NRT Manager Setup', async() => {
  it('deploys NRT manager from the first account', async() => {
    const nrtManagerContract = new ethers.ContractFactory(
      nrtManagerJSON.abi,
      nrtManagerJSON.evm.bytecode.object,
      provider.getSigner(accounts[0])
    );
    nrtManagerInstance[0] = await nrtManagerContract.deploy(eraSwapInstance[0].address);

    assert.ok(nrtManagerInstance[0].address, 'conract address should be present');
  });

  it('invokes AddNRTManager method in the Era Swap Instance from first account', async() => {
    // sends from default accounts[0] used during deploying
    await eraSwapInstance[0].functions.AddNRTManager(nrtManagerInstance[0].address);

    // cannot check this as there is no method to get address of NRT in eraswap token
  });
});

describe('TimeAlly Setup', async() => {
  it('deploys TimeAlly from the first account', async() => {
    const timeAllyContract = new ethers.ContractFactory(
      timeAllyJSON.abi,
      timeAllyJSON.evm.bytecode.object,
      provider.getSigner(accounts[0])
    );
    timeAllyInstance[0] = await timeAllyContract.deploy(
      eraSwapInstance[0].address,
      nrtManagerInstance[0].address,
      {gasLimit: 8000000}
    );

    assert.ok(timeAllyInstance[0].address, 'conract address should be present');
  });

  it('invokes Update Addresses in NRT Manager from first account', async() => {
    await nrtManagerInstance[0].UpdateAddresses([
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      timeAllyInstance[0].address
    ]);

    // checking if timeAlly address is set in NRT manager
    const timeAllyAddressInNRTManager = await nrtManagerInstance[0].timeAlly();

    assert.equal(
      timeAllyAddressInNRTManager,
      timeAllyInstance[0].address,
      'timeAllyAddressInNRTManager address should match actual timeAlly address'
    );
  });

  it('creating staking plans of 1 year (with benefit 13 fractionFrom15) and 2 year (15 benefit fractionFrom15)', async() => {
    await Promise.all([
      timeAllyInstance[0].createStakingPlan(12, 13),
      timeAllyInstance[0].createStakingPlan(24, 15)
    ]);

    const firstPlan = await timeAllyInstance[0].stakingPlans(0);
    const secondPlan = await timeAllyInstance[0].stakingPlans(1);

    assert.ok(firstPlan[0].eq(12), 'first plan months should be 12');
    assert.ok(firstPlan[1].eq(13), 'first plan fractionFrom15 should be 13');
    assert.ok(secondPlan[0].eq(24), 'second plan months should be 24');
    assert.ok(secondPlan[1].eq(15), 'second plan fractionFrom15 should be 15');
  });
});

describe('Staking', async() => {
  it('first account sends 10,000 ES to second account and 20,000 ES to third account', async() => {
    await eraSwapInstance[0].functions.transfer(accounts[1], ethers.utils.parseEther('10000'));
    await eraSwapInstance[0].functions.transfer(accounts[2], ethers.utils.parseEther('20000'));

    const balanceOfSecond = await eraSwapInstance[0].functions.balanceOf(accounts[1]);
    const balanceOfThird = await eraSwapInstance[0].functions.balanceOf(accounts[2]);

    assert.ok(balanceOfSecond.eq(ethers.utils.parseEther('10000')), 'second user should get balance');
    assert.ok(balanceOfThird.eq(ethers.utils.parseEther('20000')), 'second user should get balance');
  });

  it('second account gives allowance of 10,000 ES to timeAlly', async() => {
    eraSwapInstance[1] = new ethers.Contract(eraSwapInstance[0].address, eraSwapTokenJSON.abi, provider.getSigner(accounts[1]));
    await eraSwapInstance[1].functions.approve(timeAllyInstance[0].address, ethers.utils.parseEther('10000'));
    const allowance = await eraSwapInstance[0].functions.allowance(accounts[1], timeAllyInstance[0].address);

    assert.ok(allowance.eq(ethers.utils.parseEther('10000')), 'Allowance from second user must be 10,000 ES');
  });

  it('second account stakes 10,000 ES using timeAlly', async() => {
    timeAllyInstance[1] = new ethers.Contract(timeAllyInstance[0].address, timeAllyJSON.abi, provider.getSigner(accounts[1]));

    const userBalanceOld = await eraSwapInstance[0].functions.balanceOf(accounts[1]);
    const timeAllyBalanceOld = await eraSwapInstance[0].functions.balanceOf(timeAllyInstance[0].address);

    await timeAllyInstance[1].functions.newStaking(ethers.utils.parseEther('10000'), 1);

    const userBalanceNew = await eraSwapInstance[0].functions.balanceOf(accounts[1]);
    const timeAllyBalanceNew = await eraSwapInstance[0].functions.balanceOf(timeAllyInstance[0].address);

    assert.ok(
      userBalanceOld.sub(userBalanceNew).eq(ethers.utils.parseEther('10000')),
      '10,000 should decrease from user'
    );

    assert.ok(
      timeAllyBalanceNew.sub(timeAllyBalanceOld).eq(ethers.utils.parseEther('10000')),
      '20,000 should increase in timeally'
    );
  });

  it('second account can easily see his staking details (will be shown on UI)', async() => {
    const staking = await timeAllyInstance[0].functions.viewStaking(accounts[1], 0);
    //console.log(staking);
    assert.ok(staking[0].eq(ethers.utils.parseEther('10000')));
    assert.ok(staking[2].eq(1));
    assert.ok(staking[3].eq(1));
  });

  it('third account gives allowance of 20,000 ES to timeAlly', async() => {
    eraSwapInstance[2] = new ethers.Contract(eraSwapInstance[0].address, eraSwapTokenJSON.abi, provider.getSigner(accounts[2]));
    await eraSwapInstance[2].functions.approve(timeAllyInstance[0].address, ethers.utils.parseEther('20000'));
    const allowance = await eraSwapInstance[0].functions.allowance(accounts[2], timeAllyInstance[0].address);

    assert.ok(allowance.eq(ethers.utils.parseEther('20000')), 'Allowance from third user must be 20,000 ES');
  });

  it('third account stakes 20,000 ES using timeAlly', async() => {
    timeAllyInstance[2] = new ethers.Contract(timeAllyInstance[0].address, timeAllyJSON.abi, provider.getSigner(accounts[2]));

    const userBalanceOld = await eraSwapInstance[0].functions.balanceOf(accounts[2]);
    const timeAllyBalanceOld = await eraSwapInstance[0].functions.balanceOf(timeAllyInstance[0].address);

    await timeAllyInstance[2].functions.newStaking(ethers.utils.parseEther('20000'), 0);

    const userBalanceNew = await eraSwapInstance[0].functions.balanceOf(accounts[2]);
    const timeAllyBalanceNew = await eraSwapInstance[0].functions.balanceOf(timeAllyInstance[0].address);

    // console.log('third account old:', userBalanceOld.toString(), 'timeally old:', timeAllyBalanceOld.toString());
    // console.log('third account new:', userBalanceNew.toString(), 'timeally new:', timeAllyBalanceNew.toString());

    assert.ok(
      userBalanceOld.sub(userBalanceNew).eq(ethers.utils.parseEther('20000')),
      '20,000 ES should decrease from user side'
    );

    assert.ok(
      timeAllyBalanceNew.sub(timeAllyBalanceOld).eq(ethers.utils.parseEther('20000')),
      '20,000 ES should increase in timeally'
    );
  });

  it('third account can easily see his staking details (will be shown on UI)', async() => {
    const staking = await timeAllyInstance[0].functions.viewStaking(accounts[2], 0);

    assert.ok(staking[0].eq(ethers.utils.parseEther('20000')));
    assert.ok(staking[2].eq(0));
    assert.ok(staking[3].eq(1));
  });
});

describe('first month in TimeAlly', async() => {
  it('time travelling to the future by 1 month using mou() time machine', async() => {
    const currentTime = await eraSwapInstance[0].mou();
    const depth = 30 * 24 * 60 * 60;
    await eraSwapInstance[0].goToFuture(depth);
    const currentTimeAfterComingOutFromTimeMachine = await eraSwapInstance[0].mou();

    assert.ok(
      currentTimeAfterComingOutFromTimeMachine.sub(currentTime).gte(depth),
      'time travel should happen successfully'
    );
  });

  it('invoking MonthlyNRTRelease in NRT contract and checking if TimeAlly gets 10237500 ES in first month nrt', async() => {
    const timeAllyBalance = await eraSwapInstance[0].balanceOf(timeAllyInstance[0].address);
    await nrtManagerInstance[0].MonthlyNRTRelease();
    const timeAllyBalanceNew = await eraSwapInstance[0].balanceOf(timeAllyInstance[0].address);

    timeAllyMonthlyNRTfirstMonth = await timeAllyInstance[0].functions.timeAllyMonthlyNRT(1);
    //console.log(timeAllyMonthlyNRTfirstMonth.toString());

    assert.ok(timeAllyBalanceNew.gt(timeAllyBalance), 'TimeAlly should get some NRT');
    assert.ok(timeAllyMonthlyNRTfirstMonth.eq(ethers.utils.parseEther('10237500')), 'NRT should go in the array');
    assert.ok((await timeAllyInstance[0].getCurrentMonth()).eq(1), 'current month should be 1 after NRT release');
  });

  it('first account tries to see his benefit', async() => {
    const benefit = await timeAllyInstance[0].functions.seeShareForCurrentMonth()
  });
});
//
// describe('second month in TimeAlly', async() => {
//   it('time travelling to the future by 1 month using mou() time machine', async() => {
//     const currentTime = await eraSwapInstance[0].mou();
//     const depth = 30 * 24 * 60 * 60;
//     await eraSwapInstance[0].goToFuture(depth);
//     const currentTimeAfterComingOutFromTimeMachine = await eraSwapInstance[0].mou();
//
//     assert.ok(
//       currentTimeAfterComingOutFromTimeMachine.sub(currentTime).gte(depth),
//       'time travel should happen successfully'
//     );
//   });
//
//   it('invoking MonthlyNRTRelease in NRT contract and checking if TimeAlly gets 10237500 ES in second month nrt', async() => {
//     const timeAllyBalance = await eraSwapInstance[0].balanceOf(timeAllyInstance[0].address);
//     await nrtManagerInstance[0].MonthlyNRTRelease();
//     const timeAllyBalanceNew = await eraSwapInstance[0].balanceOf(timeAllyInstance[0].address);
//
//     timeAllyMonthlyNRTsecondMonth = await timeAllyInstance[0].functions.timeAllyMonthlyNRT(2);
//     //console.log(timeAllyMonthlyNRTfirstMonth.toString());
//     console.log((await timeAllyInstance[1].functions.consolelog()).toString());
//
//     assert.ok(timeAllyBalanceNew.gt(timeAllyBalance), 'TimeAlly should get some NRT');
//     assert.ok(timeAllyMonthlyNRTsecondMonth.eq(ethers.utils.parseEther('10237500')), 'NRT should go in the array');
//     assert.ok((await timeAllyInstance[0].getCurrentMonth()).eq(2), 'current month should be 2 after NRT release');
//
//     console.log((await timeAllyInstance[1].functions.seeShareForCurrentMonth()).toString());
//     console.log((await timeAllyInstance[2].functions.seeShareForCurrentMonth()).toString());
//
//   });
// });
