// const {dai, link, usdc, weth} = require('./DeployTokens');
const {BN} = require('ethereumjs-util');
const {callContract, deployContract, linkContract} = require('./ContractUtils');

global.interestRateImplV1 = null;
global.chainlinkCollateralValuator = null;
global.underlyingTokenValuatorImplV1 = null;
global.delayedOwner = null;
global.dmmEtherFactory = null;
global.dmmTokenFactory = null;
global.dmmBlacklist = null;
global.dmmController = null;

const _0_1 = new BN('100000000000000000'); // 0.1
const _05 = new BN('500000000000000000'); // 0.5
const _1 = new BN('1000000000000000000'); // 1.0

const deployEcosystem = async (loader, environment, deployer) => {
  const ChainlinkCollateralValuator = loader.truffle.fromArtifact('ChainlinkCollateralValuator');
  const DmmBlacklistable = loader.truffle.fromArtifact('DmmBlacklistable');
  const InterestRateImplV1 = loader.truffle.fromArtifact('InterestRateImplV1');
  const DmmController = loader.truffle.fromArtifact('DmmController');
  const DmmEtherFactory = loader.truffle.fromArtifact('DmmEtherFactory');
  const DmmTokenFactory = loader.truffle.fromArtifact('DmmTokenFactory');
  const UnderlyingTokenValuatorImplV1 = loader.truffle.fromArtifact('UnderlyingTokenValuatorImplV1');

  let oracleAddress;
  let chainlinkJobId;

  if (environment === 'LOCAL') {
    oracleAddress = '0x0000000000000000000000000000000000000000';
    chainlinkJobId = '0x0000000000000000000000000000000000000000000000000000000000000000';
  } else if (environment === 'TESTNET') {
    oracleAddress = '0x7AFe1118Ea78C1eae84ca8feE5C65Bc76CcF879e';
    chainlinkJobId = '0x00000000000000000000000000000000d4b380b30cb64722b8843ead232985c3';
  } else if (environment === 'PRODUCTION') {
    oracleAddress = '0x0000000000000000000000000000000000000000';
    chainlinkJobId = '0x0000000000000000000000000000000000000000000000000000000000000000';
  } else {
    new Error('Invalid environment, found ' + environment);
  }

  await DmmEtherFactory.detectNetwork();
  await DmmTokenFactory.detectNetwork();
  await UnderlyingTokenValuatorImplV1.detectNetwork();

  await DmmEtherFactory.link('DmmTokenLibrary', dmmTokenLibrary.address);
  await DmmTokenFactory.link('DmmTokenLibrary', dmmTokenLibrary.address);

  linkContract(UnderlyingTokenValuatorImplV1, 'StringHelpers', stringHelpers.address);

  console.log("Deploying InterestRateImplV1...");
  interestRateImplV1 = await deployContract(InterestRateImplV1, [], deployer, 4e6);

  console.log("Deploying ChainlinkCollateralValuator...");
  chainlinkCollateralValuator = await deployContract(ChainlinkCollateralValuator, [link.address, _0_1, chainlinkJobId], deployer, 4e6);

  console.log("Deploying UnderlyingTokenValuatorImplV1... ");
  underlyingTokenValuatorImplV1 = await deployContract(UnderlyingTokenValuatorImplV1, [dai.address, usdc.address], deployer, 4e6);

  console.log("Deploying DmmEtherFactory...");
  dmmEtherFactory = await deployContract(DmmEtherFactory, [weth.address], deployer, 6e6);

  console.log("Deploying DmmTokenFactory...");
  dmmTokenFactory = await deployContract(DmmTokenFactory, [], deployer, 6e6);

  console.log("Deploying DmmBlacklistable...");
  dmmBlacklist = await deployContract(DmmBlacklistable, [], deployer, 4e6);

  if (environment === 'TESTNET' || environment === 'PRODUCTION') {
    console.log("Sending 10 LINK to collateral valuator");
    const _10 = _1.mul(new BN('10'));
    await callContract(link, 'transfer', [chainlinkCollateralValuator.address, _10], deployer, 3e5);

    console.log("Sending chainlinkRequest using oracle ", oracleAddress);
    await callContract(
      chainlinkCollateralValuator,
      'getCollateralValue',
      [oracleAddress],
      deployer,
      1e6,
    )
  }

  console.log("Deploying DmmController...");
  dmmController = await deployContract(
    DmmController,
    [
      interestRateImplV1.address,
      chainlinkCollateralValuator.address,
      underlyingTokenValuatorImplV1.address,
      dmmEtherFactory.address,
      dmmTokenFactory.address,
      dmmBlacklist.address,
      /* minCollateralization */ _1,
      /* minReserveRatio */ _05,
      weth.address,
    ],
    deployer,
    4e6,
  );

  await addMarketsIfLocal(environment, deployer);

  console.log('InterestRateImplV1: ', interestRateImplV1.address);
  console.log('ChainlinkCollateralValuator: ', chainlinkCollateralValuator.address);
  console.log('UnderlyingTokenValuatorImplV1: ', underlyingTokenValuatorImplV1.address);
  console.log('DmmTokenFactory: ', dmmTokenFactory.address);
  console.log('DmmBlacklistable: ', dmmBlacklist.address);
  console.log('DmmController: ', dmmController.address);
};

const addMarketsIfLocal = async (environment, deployer) => {
  if (environment !== 'LOCAL') {
    return;
  }

  await callContract(dmmTokenFactory, 'transferOwnership', [dmmController.address], deployer, 3e5);

  await callContract(
    dmmController,
    'addMarket',
    [
      dai.address,
      "mDAI",
      "DMM: DAI",
      18,
      _0_1,
      _0_1,
      _1.mul(new BN(100)),
    ],
    deployer,
    6e6,
  );

  await callContract(
    dmmController,
    'addMarket',
    [
      usdc.address,
      "mUSDC",
      "DMM: USDC",
      6,
      new BN('100000'),
      new BN('100000'),
      new BN('100000000'),
    ],
    deployer,
    6e6,
  );
};

module.exports = {
  interestRateImplV1,
  chainlinkCollateralValuator,
  underlyingTokenValuatorImplV1,
  dmmTokenFactory,
  dmmBlacklist,
  dmmController,
  deployEcosystem,
};