const startTimestamp = Date.now();
const ethers = require('ethers');
const provider = ethers.getDefaultProvider('kovan');

//24C4FE6063E62710EAD956611B71825B778B041B18ED53118CE5DA5F02E494BA
if(!process.argv[2]) {
  throw '\nNOTE: Please pass your private key as comand line argument.\neg => node deploy.js 0x24C4FE063E...\n'
}

console.log('\nPlease wait loading wallet...');
const wallet = new ethers.Wallet(process.argv[2], provider);
console.log(`Loaded wallet @ ${wallet.address}`);

const eraSwapTokenJSON = require('./build/Eraswap_0.json');
const nrtManagerJSON = require('./build/NRTManager_0.json');
const timeAllyJSON = require('./build/TimeAlly_0.json');

let tx
, eraSwapInstance
, nrtManagerInstance
, timeAllyInstance;

//console.log(process.argv);


(async() => {
  console.log('\nDeploying EraSwap Contract...');
  const eraSwapContract = new ethers.ContractFactory(
    eraSwapTokenJSON.abi,
    eraSwapTokenJSON.evm.bytecode.object,
    wallet
  );

  eraSwapInstance =  await eraSwapContract.deploy();
  await eraSwapInstance.deployTransaction.wait();
  console.log(`Deployed at ${eraSwapInstance.address}`);


  console.log('\nDeploying NRT Manager Contract...');
  const nrtManagerContract = new ethers.ContractFactory(
      nrtManagerJSON.abi,
      nrtManagerJSON.evm.bytecode.object,
      wallet
    );

  nrtManagerInstance = await nrtManagerContract.deploy(eraSwapInstance.address);
  await nrtManagerInstance.deployTransaction.wait();
  console.log(`Deployed at ${nrtManagerInstance.address}`);


  console.log('\nLinking NRT Manager Contract to EraSwap Contract...');
  tx = await eraSwapInstance.functions.AddNRTManager(nrtManagerInstance.address);
  await tx.wait();
  console.log(`Linked successfully! Hash: ${tx.hash}`);


  console.log('\nDeploying TimeAlly Contract...');
  const timeAllyContract = new ethers.ContractFactory(
    timeAllyJSON.abi,
    timeAllyJSON.evm.bytecode.object,
    wallet
  );
  timeAllyInstance = await timeAllyContract.deploy(
    eraSwapInstance.address,
    nrtManagerInstance.address,
    {gasLimit: 8000000}
  );
  await timeAllyInstance.deployTransaction.wait();
  console.log(`Deployed at ${timeAllyInstance.address}`);

  console.log('\nLinking TimeAlly Contract to NRT Manager Contract...');
  tx = await nrtManagerInstance.UpdateAddresses([
    "0x1000000000000000000000000000000000000000",
    "0x2000000000000000000000000000000000000000",
    "0x3000000000000000000000000000000000000000",
    "0x4000000000000000000000000000000000000000",
    "0x5000000000000000000000000000000000000000",
    "0x6000000000000000000000000000000000000000",
    "0x7000000000000000000000000000000000000000",
    "0x8000000000000000000000000000000000000000",
    timeAllyInstance.address
  ]);
  await tx.wait();
  console.log(`Linked successfully! Hash: ${tx.hash}`);


  console.log('\nCreating Staking Plan of 1 year / 13%...');
  tx = await timeAllyInstance.createStakingPlan(12, 13, false),
  await tx.wait();
  console.log(`Done! Hash: ${tx.hash}`);

  console.log('\nCreating Staking Plan of 2 year / 15%...');
  tx = await timeAllyInstance.createStakingPlan(24, 15, false);
  await tx.wait();
  console.log(`Done! Hash: ${tx.hash}`);

  console.log('\nCreating Loan Plan of 2 months / 1%...');
  tx = await timeAllyInstance.functions.createLoanPlan(2, 1, 50);
  await tx.wait();
  console.log(`Done! Hash: ${tx.hash}`);


  const endTimestamp = Date.now();
  console.log(`\nDone in ${(endTimestamp - startTimestamp) / 1000} secs`);
})();
