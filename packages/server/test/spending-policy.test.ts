import { describe, expect, it } from 'vitest';
import { spendingPolicy } from '../src/spending-policy';

describe('server spending opt-in', () => {
  it('never turns a deployment key into a faucet or keeper signer', () => {
    const policy = spendingPolicy({ DEPLOYER_MNEMONIC: 'deployment-test-value' });
    expect(policy.faucet).toEqual({ enabled: false, mnemonic: '' });
    expect(policy.keepers).toEqual({ enabled: false, mnemonic: '' });
    expect(policy.relayer.enabled).toBe(false);
  });

  it('requires explicit enablement even when operational keys exist', () => {
    const policy = spendingPolicy({ FAUCET_MNEMONIC: 'faucet-test-value', KEEPER_MNEMONIC: 'keeper-test-value', EVM_OPS_KEY: 'test-value' });
    expect(policy.faucet.enabled).toBe(false);
    expect(policy.keepers.enabled).toBe(false);
    expect(policy.relayer.enabled).toBe(false);
  });

  it('keeps enabled services independent and does not fall back to the deployer', () => {
    const policy = spendingPolicy({ FAUCET: 'on', KEEPERS: 'on', DEPLOYER_MNEMONIC: 'deployment-test-value' });
    expect(policy.faucet).toEqual({ enabled: true, mnemonic: '' });
    expect(policy.keepers).toEqual({ enabled: true, mnemonic: '' });
    expect(policy.relayer.enabled).toBe(false);
    const enabled = spendingPolicy({ FAUCET: 'on', FAUCET_MNEMONIC: 'faucet-test-value', RELAYER: 'on' });
    expect(enabled.faucet).toEqual({ enabled: true, mnemonic: 'faucet-test-value' });
    expect(enabled.relayer.enabled).toBe(true);
    expect(spendingPolicy({ FAUCET: 'true', KEEPERS: 'off', RELAYER: '1' }).faucet.enabled).toBe(false);
  });
});
