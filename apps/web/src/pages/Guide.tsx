import { Link } from 'react-router-dom';

const MODULES = [
  ['Nfts', 'The deed. One shared collection, minted publicly by any operator.'],
  ['NftFractionalization', 'Disables transfers of the deed and mints a fixed supply of shares that only the pallet administers. Re-collect 100% to unify the deed back.'],
  ['Assets + AssetsPrecompiles', 'Shares and pUSD are native assets. Solidity sees them as ordinary ERC-20 tokens, with no token contract to deploy or audit.'],
  ['TransactionStorage', 'Terms and photos live on the chain itself, content-addressed, renewed by a keeper.'],
  ['Utility.batchAll', 'One signature, many modules, all or nothing, including the call into Solidity.'],
  ['Revive', 'The Solidity contracts: listings, sale, revenue vault, bond slashing, Teleport.'],
  ['AssetConversion', 'The built-in AMM, used for secondary trading of shares.'],
  ['NominationPools', 'Pool Studio: create pools, nominate validators, auto-compound.'],
] as const;

export function Guide() {
  return (
    <div>
      <h1 className="page-title">How Portion works</h1>
      <p className="page-lede">Portion helps asset operators manage funding and share deposited income with funders. The chain records listings, shares and payments; verification of physical equipment and legal rights requires checks outside the chain.</p>

      <div className="section-head"><h2>What you can check</h2></div>
      <div className="findings">
        <div className="finding good"><i className="sev" /><div><h3>The listing has an onchain record</h3><p>The deed is a native NFT whose transfers the fractionalization pallet has switched off. Its terms and photo are stored with the chain’s own storage module and hashed into the deed. This does not independently verify physical equipment or establish legal ownership.</p></div></div>
        <div className="finding good"><i className="sev" /><div><h3>The shares are real and fixed</h3><p>Shares are minted by the protocol, not by a contract the operator wrote. Nobody can print more.</p></div></div>
        <div className="finding good"><i className="sev" /><div><h3>The operator is accountable</h3><p>Each listing carries a bond. Miss payments for two periods and anyone can slash it to holders. An operator cannot wind down while earning shares remain staked, or use closing to avoid an overdue bond penalty. This bond is limited compensation, not repayment of the initial investment.</p></div></div>
      </div>

      <p className="notice" style={{ marginTop: 24 }}>Where does the money come from? Paying customers of the operator’s business. <Link to="/business">Explore the money flow and business calculator →</Link></p>
      <div className="section-head"><h2>What it uses on Portaldot V3</h2><p>Most of this is not reachable from a plain EVM chain. Portion composes it in one transaction.</p></div>
      <table className="table"><tbody>{MODULES.map(([m, d]) => <tr key={m}><td style={{ width: 240 }}><code>{m}</code></td><td>{d}</td></tr>)}</tbody></table>

      <div className="section-head"><h2>Where each hackathon track lives</h2></div>
      <table className="table"><tbody>
        <tr><td style={{ width: 240 }}><b>Ecosystem DApps</b></td><td>The market, tokenize wizard, portfolio and bond enforcement. <Link to="/">Open the market</Link>, then <Link to="/create">tokenize something</Link>.</td></tr>
        <tr><td><b>Modular Cloud and Middleware</b></td><td>The <code>@portion/sdk</code> package (dual-VM client, address mapping, atomic batch planners), the on-chain document gateway with auto-renewal, and the open faucet. <Link to="/faucet">Try the faucet</Link>.</td></tr>
        <tr><td><b>Node Operations and Tooling</b></td><td>Live validator analysis with a decentralization score, native staking pools, and a permissionless auto-compound keeper. <Link to="/network">Network console</Link> and <Link to="/pools">Pool Studio</Link>.</td></tr>
        <tr><td><b>Multi-Chain and Cross-Chain</b></td><td>Teleport moves pUSD between BNB Chain testnet and Portaldot with a relayer quorum, so investors can fund listings from where they already hold money. <Link to="/teleport">Open Teleport</Link>.</td></tr>
      </tbody></table>

      <div className="section-head"><h2>Honest limits</h2></div>
      <div className="findings">
        <div className="finding warning"><i className="sev" /><div><h3>Revenue is reported, not proven</h3><p>The chain cannot see a kiosk's takings. The bond and cadence rules make non-payment expensive and visible; they do not make it impossible. A real deployment would add payment-rail attestations.</p></div></div>
        <div className="finding warning"><i className="sev" /><div><h3>Teleport trusts a relayer quorum</h3><p>The v0 bridge needs two of three relayers to agree. Portaldot already produces BEEFY/MMR commitments, which is the planned path to a light-client bridge.</p></div></div>
        <div className="finding info"><i className="sev" /><div><h3>This is a testnet</h3><p>Tokens have no value and the network is being upgraded during the hackathon. If it is unreachable, the app falls back to a clearly labelled simulation.</p></div></div>
      </div>
    </div>
  );
}
