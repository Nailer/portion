import Portion from './artifacts/Portion.json';
import Teleport from './artifacts/Teleport.json';
import WrappedToken from './artifacts/WrappedToken.json';

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
