import { abi as ArbOwner__abi } from '@arbitrum/nitro-contracts/build/contracts/src/precompiles/ArbOwner.sol/ArbOwner.json'
import { abi as ArbGasInfo__abi } from '@arbitrum/nitro-contracts/build/contracts/src/precompiles/ArbGasInfo.sol/ArbGasInfo.json'
import { ethers } from 'ethers'
import { L3Config } from './l3ConfigType'
import fs from 'fs'

import UpgradeExecutor from '@arbitrum/nitro-contracts/build/contracts/src/mocks/UpgradeExecutorMock.sol/UpgradeExecutorMock.json'
import { getSigner } from './erc20TokenBridgeDeployment'
import ArbOwner from '@arbitrum/nitro-contracts/build/contracts/src/precompiles/ArbOwner.sol/ArbOwner.json'
import { TOKEN_BRIDGE_CREATOR_Arb_Sepolia } from './createTokenBridge'
import L1AtomicTokenBridgeCreator from '@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/ethereum/L1AtomicTokenBridgeCreator.sol/L1AtomicTokenBridgeCreator.json'

export async function l3ConfigurationUpdate(
  privateKey: string,
  L2_RPC_URL: string,
  L3_RPC_URL: string
) {
  if (!privateKey || !L2_RPC_URL || !L3_RPC_URL) {
    throw new Error('Required environment variable not found')
  }

  // Generating providers from RPCs
  const L2Provider = new ethers.providers.JsonRpcProvider(L2_RPC_URL)
  const L3Provider = new ethers.providers.JsonRpcProvider(L3_RPC_URL)

  // Creating the wallet and signer
  const l2signer = new ethers.Wallet(privateKey).connect(L2Provider)
  const l3signer = new ethers.Wallet(privateKey).connect(L3Provider)

  // Read the JSON configuration
  const configRaw = fs.readFileSync(
    './config/orbitSetupScriptConfig.json',
    'utf-8'
  )
  const config: L3Config = JSON.parse(configRaw)

  // Reading params for L3 Configuration
  const minL2BaseFee = config.minL2BaseFee
  const networkFeeReceiver = config.networkFeeReceiver
  const infrastructureFeeCollector = config.infrastructureFeeCollector
  const chainOwner = config.chainOwner

  // Check if the Private Key provided is the chain owner:
  if (l3signer.address !== chainOwner) {
    throw new Error('The Private Key you have provided is not the chain owner')
  }

  // ArbOwner precompile setup
  const arbOwnerABI = ArbOwner__abi

  // Arb Owner precompile address
  const arbOwnerAddress = '0x0000000000000000000000000000000000000070'
  const ArbOwner = new ethers.Contract(arbOwnerAddress, arbOwnerABI, l3signer)

  // Call the isChainOwner function and check the response
  // const isSignerChainOwner = await ArbOwner.isChainOwner(l3signer.address)
  // if (!isSignerChainOwner) {
  //   throw new Error('The address you have provided is not the chain owner')
  // }

  // Set the network fee receiver
  console.log('Setting the Minimum Base Fee for the Orbit chain')
  const targetCallData = ArbOwner.interface.encodeFunctionData(
    'setMinimumL2BaseFee',
    [minL2BaseFee]
  )

  console.log('targetCallData', targetCallData)

  // Wait for the transaction to be mined

  const l2ChainId = (await L2Provider.getNetwork()).chainId
  let TOKEN_BRIDGE_CREATOR
  if (l2ChainId === 421614) {
    TOKEN_BRIDGE_CREATOR = TOKEN_BRIDGE_CREATOR_Arb_Sepolia
  } else {
    throw new Error(
      'The Base Chain you have provided is not supported, please put RPC for Arb Sepolia'
    )
  }
  const L1AtomicTokenBridgeCreator__factory = new ethers.Contract(
    TOKEN_BRIDGE_CREATOR,
    L1AtomicTokenBridgeCreator.abi,
    L2Provider
  )
  const l1TokenBridgeCreator =
    L1AtomicTokenBridgeCreator__factory.connect(L2Provider)
  const executorContractAddress = (
    await l1TokenBridgeCreator.inboxToL2Deployment(config.inbox)
  ).upgradeExecutor
  const l3Deployer = getSigner(L3Provider, privateKey)
  const executorContract__factory = new ethers.Contract(
    executorContractAddress,
    UpgradeExecutor.abi,
    l3Deployer
  )
  const upgradeExecutor = executorContract__factory.connect(l3Deployer)
  const receipt = await (
    await upgradeExecutor.executeCall(ARB_OWNER_ADDRESS, targetCallData, {
      maxFeePerGas: 15000000000000,
      gasLimit: 66666,
    })
  ).wait()
  console.log(
    `Minimum Base Fee is set on the block number ${await receipt.blockNumber} on the Orbit chain`
  )

  // Check the status of the transaction: 1 is successful, 0 is failure
  if (receipt.status === 0) {
    throw new Error('Transaction failed, could not set the Minimum base fee')
  }
}

const ARB_OWNER_ADDRESS = '0x0000000000000000000000000000000000000070'
