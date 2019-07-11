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

    assert.ok(accounts.length >= 2, 'could not see 2 accounts in the array');
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

    assert.ok(eraSwapInstance[0].address, 'conract address not present');
  });

  it('gives first account 91,00,00,000 ES balance', async() => {
    const balanceOfDeployer = await eraSwapInstance[0].functions.balanceOf(accounts[0]);

    assert.ok(
      balanceOfDeployer.eq(ethers.utils.parseEther('910000000')),
      'deployer did not get 910000000 ES'
    );
  });

  it('mou() time machine is present', async() => {
    try {
      const mou = await eraSwapInstance[0].functions.mou();
      assert.ok(mou.gt(0), 'mou() time machine not giving non zero time stamp');
    } catch (e) {
      assert(false, 'mou() method is not present in era swap contract');
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

    assert.ok(nrtManagerInstance[0].address, 'conract address not present');
  });

  it('invokes AddNRTManager method in the Era Swap Instance from first account', async() => {
    // sends from default accounts[0] used during deploying
    await eraSwapInstance[0].functions.AddNRTManager(nrtManagerInstance[0].address);
  });
});

describe('TimeAlly Setup', async() => {
  it('deploys TimeAlly from the first account', async() => {
    const timeAllyContract = new ethers.ContractFactory(
      timeAllyJSON.abi,
      timeAllyJSON.evm.bytecode.object,
      provider.getSigner(accounts[0])
    );
    timeAllyInstance[0] = await timeAllyContract.deploy(eraSwapInstance[0].address, {gasLimit: 8000000});

    assert.ok(timeAllyInstance[0].address, 'conract address not present');
  });
});

describe('Staking', async() => {
  it('first account sends 10000 ES to second account', async() => {
    await eraSwapInstance[0].functions.transfer(accounts[1], ethers.utils.parseEther('10000'));

    const balanceOfSecond = await eraSwapInstance[0].functions.balanceOf(accounts[1]);

    assert.ok(balanceOfSecond.eq(ethers.utils.parseEther('10000')), 'second user not got balance');
  });

  it('second account gives allowance of 10000 ES to timeAlly', async() => {
    eraSwapInstance[1] = new ethers.Contract(eraSwapInstance[0].address, eraSwapTokenJSON.abi, provider.getSigner(accounts[1]));
    await eraSwapInstance[1].functions.approve(timeAllyInstance[0].address, ethers.utils.parseEther('10000'));
    const allowance = await eraSwapInstance[0].functions.allowance(accounts[1], timeAllyInstance[0].address);

    assert.ok(allowance.eq(ethers.utils.parseEther('10000')));
  });

  it('second account stakes 10000 ES using timeAlly', async() => {
    timeAllyInstance[1] = new ethers.Contract(timeAllyInstance[0].address, timeAllyJSON.abi, provider.getSigner(accounts[1]));
    await timeAllyInstance[1].functions.newStaking(ethers.utils.parseEther('10000'), 0);

    const staking = await timeAllyInstance[0].functions.viewStaking(accounts[1], 0);

  });
});
