/** Starting the API must not implicitly authorise on-chain spending. */
export function spendingPolicy(env: Record<string, string | undefined>) {
  return {
    faucet: { enabled: env.FAUCET === 'on', mnemonic: env.FAUCET_MNEMONIC ?? '' },
    keepers: { enabled: env.KEEPERS === 'on', mnemonic: env.KEEPER_MNEMONIC ?? '' },
    relayer: { enabled: env.RELAYER === 'on' },
  };
}
