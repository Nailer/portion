import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BrowserProvider, Contract, parseUnits, isAddress } from 'ethers';
import { FALLBACK_LIMITS, ReviveContract, TeleportArtifact, ERC20_ABI, h160ToFallbackSs58, submit, type PlanStep } from '@portion/sdk';
import { useApp } from '../state/app';
import { usePassport } from '../state/passport';
import { useRunner } from '../state/runner';
import { LiveBackend } from '../lib/live';
import { api, UserError, type Prepared } from '../lib/backend';
import { Empty, Spinner, useAsync } from '../components/ui';
import { ago, usd, short, explorerBlock } from '../lib/format';

interface Cfg { enabled: boolean; relayerRunning?: boolean; home?: { chainId: number; teleport: string; token: string }; bnb?: { chainId: number; teleport: string; wpusd: string }; threshold?: number; relayers?: number }
interface Transfer { id: number; src_chain: number; nonce: string; dst_chain: number; sender: string; recipient: string; amount: string; src_tx: string | null; status: 'seen' | 'relayed' | 'failed'; dst_tx: string | null; error: string | null; ts: number }

const BNB_PARAMS = { chainId: '0x61', chainName: 'BNB Smart Chain Testnet', nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 }, rpcUrls: ['https://data-seed-prebsc-1-s1.bnbchain.org:8545'], blockExplorerUrls: ['https://testnet.bscscan.com'] };

export function Teleport() {
  const { backend, tick, refresh } = useApp();
  const { passport, balances } = usePassport();
  const { actPrepared, openPassport } = useRunner();
  const live = backend instanceof LiveBackend ? backend : null;
  const [dir, setDir] = useState<'out' | 'in'>('out');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [mm, setMm] = useState<string>();
  const [note, setNote] = useState<string>();

  const { data: cfg, error: configError, loading: configLoading } = useAsync(() => api<Cfg>('/api/teleport/config'), [backend]);
  const { data: transfers } = useAsync(async () => (passport ? api<Transfer[]>(`/api/teleport/transfers?address=${passport.h160}`) : []), [passport?.h160, tick]);
  const { data: mapped } = useAsync(async () => {
    if (!live || !passport) return true;
    const acc = (await (live.chain.call as any).reviveApi.accountId(passport.h160)).toString();
    return acc === passport.address;
  }, [live, passport?.address, tick]);

  useEffect(() => { const t = setInterval(refresh, 9000); return () => clearInterval(t); }, [refresh]);

  if (!live) return <Empty title="Teleport needs the live networks" action={<Link className="btn primary" to="/network">Network status</Link>}>It moves real testnet tokens between Portaldot and BNB Chain, so there is nothing to simulate.</Empty>;
  if (configLoading) return <div className="empty"><Spinner /></div>;
  if (configError || !cfg) return <Empty title="Bridge status unavailable">The bridge service could not be reached. No transfer status is inferred.</Empty>;
  if (!cfg.enabled || !cfg.home || !cfg.bnb) return <Empty title="Teleport is not deployed yet">The bridge contracts have not been deployed on both chains. Run <code>npm run deploy</code> and <code>npm run deploy:bnb</code>.</Empty>;

  const home = cfg.home; const bnb = cfg.bnb;
  const amt = Number(amount) > 0 ? parseUnits(amount, 6) : 0n;
  const teleAccount = h160ToFallbackSs58(home.teleport);

  const connectMm = async () => {
    const eth = (window as any).ethereum;
    if (!eth) { setNote('MetaMask was not found. You can still paste any 0x address as the recipient.'); return; }
    const [a] = await eth.request({ method: 'eth_requestAccounts' });
    setMm(a); if (dir === 'out') setRecipient(a);
  };

  const needAccount = () => {
    if (!passport) { openPassport(); return false; }
    return true;
  };

  const send = () => {
    if (!needAccount()) return;
    if (!isAddress(recipient)) { setNote('Enter a valid 0x recipient address.'); return; }
    if (amt <= 0n) { setNote('Enter an amount.'); return; }
    setNote(undefined);
    actPrepared(async (): Promise<Prepared> => {
      if (!balances || balances.pusd === null) throw new UserError('Your payment-token balance is unavailable.');
      if (balances.pusd < amt) throw new UserError('You do not have enough pUSD on Portaldot. Get some from the faucet.', 'faucet');
      if ((balances?.pot ?? 0n) < 10n ** 14n) throw new UserError('You need a little tPOT for fees.', 'faucet');
      const c = new ReviveContract(live.chain, home.teleport, TeleportArtifact.abi);
      const data = c.encode('bridgeOut', [bnb.chainId, recipient, amt]);
      const tx = live.chain.tx.utility.batchAll([
        live.chain.tx.assets.approveTransfer(live.deployment!.pusdAssetId, teleAccount, amt),
        live.chain.tx.revive.call(home.teleport, 0n, FALLBACK_LIMITS.weight, FALLBACK_LIMITS.deposit, data),
      ]);
      const steps: PlanStep[] = [
        { key: 'ap', lane: 'native', pallet: 'Assets', method: 'approveTransfer', title: 'Approve the bridge to take your pUSD', detail: 'A native approval, which the bridge contract uses through its ERC-20 view.' },
        { key: 'out', lane: 'evm', pallet: 'Revive', method: 'call', title: `Lock ${amount} pUSD in Teleport`, detail: `Teleport.bridgeOut(${bnb.chainId}, ${short(recipient)}, …). Two of three relayers will then mint wpUSD on BNB Chain.` },
      ];
      return { title: `Teleport ${amount} pUSD to BNB Chain`, steps, cost: 'The recipient does not need any BNB: a relayer pays the gas on the other side.', run: async (onStage) => {
        const out = await submit(live.chain, tx, passport!.pair, (s, d) => onStage(s === 'finalized' ? 'done' : (s as any), d));
        return { ok: out.ok, txHash: out.txHash, blockNumber: out.blockNumber, error: out.error };
      } };
    });
  };

  const activate = () => {
    if (!needAccount()) return;
    actPrepared(async () => {
      const c = new ReviveContract(live.chain, home.teleport, TeleportArtifact.abi);
      const tx = live.chain.tx.revive.call(home.teleport, 0n, FALLBACK_LIMITS.weight, FALLBACK_LIMITS.deposit, c.encode('nonce'));
      return { title: 'Activate your account for contracts', steps: [{ key: 'a', lane: 'evm', pallet: 'Revive', method: 'call', title: 'Make one harmless contract call', detail: 'The first contract call links your Passport to its contract address, so funds sent to that address reach you and not an unowned account.' }],
        run: async (onStage) => { const o = await submit(live.chain, tx, passport!.pair, (s, d) => onStage(s === 'finalized' ? 'done' : (s as any), d)); return { ok: o.ok, txHash: o.txHash, blockNumber: o.blockNumber, error: o.error }; } };
    });
  };

  const bridgeBack = async () => {
    if (!needAccount()) return;
    const eth = (window as any).ethereum;
    if (!eth) { setNote('Bridging from BNB Chain needs MetaMask with a little tBNB for gas.'); return; }
    if (!mapped) { setNote('Activate your Portaldot account first (button above), or the pUSD would land in an unowned account.'); return; }
    try {
      setNote('Switching MetaMask to BNB Chain testnet…');
      try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x61' }] }); }
      catch { await eth.request({ method: 'wallet_addEthereumChain', params: [BNB_PARAMS] }); }
      const signer = await new BrowserProvider(eth).getSigner();
      const wp = new Contract(bnb.wpusd, ERC20_ABI, signer);
      const t = new Contract(bnb.teleport, TeleportArtifact.abi, signer);
      setNote('Approve wpUSD in MetaMask…');
      await (await wp.approve(bnb.teleport, amt)).wait();
      setNote('Confirm the teleport in MetaMask…');
      const tx = await t.bridgeOut(home.chainId, passport!.h160, amt);
      await tx.wait();
      setNote(`Sent on BNB Chain (${tx.hash.slice(0, 12)}…). The relayers will release pUSD to your Passport in about a minute.`);
      refresh();
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <div>
      <h1 className="page-title">Teleport</h1>
      <p className="page-lede">Hold pUSD on Portaldot, or wpUSD on BNB Chain, and move it across. A 2-of-3 relayer committee watches both chains and signs each transfer; the contracts check the signatures, block replays and cap how much can move per day.</p>

      <div className="two-col" style={{ marginTop: 28, alignItems: 'start' }}>
        <div className="panel" style={{ position: 'static' }}>
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={dir === 'out'} onClick={() => { setDir('out'); setNote(undefined); }}>Portaldot → BNB Chain</button>
            <button role="tab" aria-selected={dir === 'in'} onClick={() => { setDir('in'); setNote(undefined); }}>BNB Chain → Portaldot</button>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="tamt">Amount</label>
            <div className="input-affix"><input id="tamt" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /><span>{dir === 'out' ? 'pUSD' : 'wpUSD'}</span></div>
            {dir === 'out' && balances && <p className="hint">You have {usd(balances.pusd)} on Portaldot.</p>}
          </div>
          {dir === 'out' ? (
            <>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="trec">Recipient on BNB Chain</label>
                <input id="trec" type="text" value={recipient} onChange={(e) => setRecipient(e.target.value.trim())} placeholder="0x…" spellCheck={false} />
                <p className="hint"><button className="link-btn" onClick={connectMm}>{mm ? `Using ${short(mm)}` : 'Use my MetaMask address'}</button></p>
              </div>
              <button className="btn primary" onClick={send}>Teleport to BNB Chain</button>
            </>
          ) : (
            <>
              <p className="notice">Recipient: your Passport ({short(passport?.address ?? '', 6, 4)}). This direction burns wpUSD on BNB Chain from MetaMask, so MetaMask needs a little tBNB for gas.</p>
              {passport && mapped === false && (
                <div className="sheet-error">Your Portaldot account has not made a contract call yet, so its contract address is not linked to it. <button className="link-btn" onClick={activate}>Activate it first</button> or the pUSD would arrive in an account nobody controls.</div>
              )}
              <button className="btn primary" onClick={bridgeBack} disabled={!passport}>{passport ? 'Teleport to Portaldot with MetaMask' : 'Open a Passport first'}</button>
            </>
          )}
          {note && <p className="notice">{note}</p>}
        </div>

        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>How it is secured</h2>
          <dl className="kv" style={{ marginTop: 12 }}>
            <dt>Committee</dt><dd>{cfg.threshold} of {cfg.relayers} relayers</dd>
            <dt>Relayer status</dt><dd>{cfg.relayerRunning ? 'Running' : 'Stopped'}</dd>
            <dt>Per-transfer cap</dt><dd>10,000 pUSD</dd>
            <dt>Daily cap</dt><dd>50,000 pUSD</dd>
            <dt>Replay protection</dt><dd>per (chain, nonce)</dd>
            <dt>Portaldot contract</dt><dd className="mono">{short(home.teleport, 8, 6)}</dd>
            <dt>BNB contract</dt><dd className="mono">{short(bnb.teleport, 8, 6)}</dd>
          </dl>
          <p className="notice" style={{ marginTop: 14 }}>v0 trusts a relayer committee. Portaldot already produces BEEFY and MMR commitments, which is the path to replacing the committee with a light client.</p>
        </div>
      </div>

      <div className="section-head"><h2>Your transfers</h2></div>
      {!passport ? <p className="notice">Open a Passport to see your transfers.</p> : (
        <ul className="activity">
          {(transfers ?? []).map((t) => {
            const toBnb = t.dst_chain === bnb.chainId;
            return (
              <li key={t.id}>
                <span><b>{usd(t.amount, 2)}</b> {toBnb ? 'Portaldot → BNB Chain' : 'BNB Chain → Portaldot'} · {t.status === 'relayed' ? 'delivered' : t.status === 'failed' ? `failed: ${t.error ?? ''}` : 'waiting for confirmations and relayers'}
                  {t.dst_tx && toBnb && <> · <a href={`https://testnet.bscscan.com/tx/${t.dst_tx}`} target="_blank" rel="noreferrer">view on BscScan</a></>}
                  {t.dst_tx && !toBnb && <> · <a href={explorerBlock()} target="_blank" rel="noreferrer">view on Portaldot</a></>}
                </span>
                <time>{ago(t.ts)}</time>
              </li>
            );
          })}
          {transfers && !transfers.length && <li><span>No transfers yet.</span></li>}
        </ul>
      )}
    </div>
  );
}
