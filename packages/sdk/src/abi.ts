import PortionCore from './artifacts/PortionCore.json';
import PortionCoreV2 from './artifacts/PortionCoreV2.json';
import Portion from './artifacts/Portion.json';
import Teleport from './artifacts/Teleport.json';
import WrappedToken from './artifacts/WrappedToken.json';

export const PortionCoreArtifact = PortionCore as { contractName: string; abi: any[]; bytecode: string; runtimeBytecode: string };
export const PortionCoreV2Artifact = PortionCoreV2 as { contractName: string; abi: any[]; bytecode: string; runtimeBytecode: string };
/** ABI and bytecode for a versioned Core deployment. v2 is a local candidate until a deployment file names it. */
export const coreArtifact = (version: 'core-v1' | 'core-v2') => version === 'core-v2' ? PortionCoreV2Artifact : PortionCoreArtifact;
export const PortionArtifact = Portion as { contractName: string; abi: any[]; bytecode: string };
export const TeleportArtifact = Teleport as { contractName: string; abi: any[]; bytecode: string };
export const WrappedTokenArtifact = WrappedToken as { contractName: string; abi: any[]; bytecode: string };

export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function transfer(address,uint256) returns (bool)',
  'function transferFrom(address,address,uint256) returns (bool)',
];
