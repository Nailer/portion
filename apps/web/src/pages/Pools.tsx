import { Link } from 'react-router-dom';
import { useState } from 'react';
import { parseUnits, type PlanStep } from '@portion/sdk';
import { useApp } from '../state/app';
import { usePassport } from '../state/passport';
import { useRunner } from '../state/runner';
import { LiveBackend } from '../lib/live';
import { Empty, Spinner, useAsync } from '../components/ui';
import { pot, short } from '../lib/format';
import { UserError, type Prepared } from '../lib/backend';

const native = (key: string, method: string, title: string, detail: string): PlanStep => ({ key, lane: 'native', pallet: 'NominationPools', method, title, detail });

export function Pools() {
  const { backend, tick } = useApp();
  const { passport, balances, reloadBalances } = usePassport();
  const { actPrepared, openPassport } = useRunner();
  const live = backend instanceof LiveBackend ? backend : null;
  const [amount, setAmount] = useState('');
  const [joinAmt, setJoinAmt] = useState('');
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const { data, loading } = useAsync(async () => {
    if (!live) return null;
    const api = live.chain;
    const [pools, minJoin, minCreate, validators, last] = await Promise.all([
      api.query.nominationPools.bondedPools.entries(),
      api.query.nominationPools.minJoinBond(),
      api.query.nominationPools.minCreateBond(),
      api.query.session.validators(),
      api.query.nominationPools.lastPoolId(),
    ]);
    const rows = await Promise.all(pools.map(async ([k, v]: any) => {
      const id = k.args[0].toNumber();
      const info: any = v.toJSON();
      const meta = (await api.query.nominationPools.metadata(id)).toU8a();
      return { id, state: String(info.state), members: Number(info.memberCounter), points: BigInt(info.points), root: info.roles?.root as string, name: new TextDecoder().decode(meta) };
    }));
    let mine: any = null;
    let pending = 0n;
    let perm = 'Permissioned';
    if (passport) {
      mine = (await api.query.nominationPools.poolMembers(passport.address)).toJSON();
      if (mine) {
        pending = BigInt(((await (api.call as any).nominationPoolsApi.pendingRewards(passport.address)).toString()) || '0');
        const p: any = (await api.query.nominationPools.claimPermissions(passport.address)).toJSON();
        perm = typeof p === 'string' ? p : Object.keys(p ?? {})[0] ?? 'Permissioned';
      }
    }
    return { rows, minJoin: BigInt(minJoin.toString()), minCreate: BigInt(minCreate.toString()), validators: (validators as any).map((v: any) => v.toString()) as string[], nextId: Number(last.toString()) + 1, mine, pending, perm };
  }, [live, passport?.address, tick]);

  if (!live) return <Empty title="Pool Studio needs the live testnet" action={<Link className="btn primary" to="/network">Network status</Link>}>Pools are native staking, so there is nothing to simulate.</Empty>;
  if (loading && !data) return <div className="empty"><Spinner /></div>;
  if (!data) return <Empty title="Could not read staking pools" />;

  const api = live.chain;
  const chosen = Object.keys(picked).filter((k) => picked[k]);
  const compounding = /PermissionlessCompound|PermissionlessAll/i.test(data.perm);

  const prep = (title: string, steps: PlanStep[], build: () => ReturnType<typeof api.tx.utility.batchAll>, cost?: string): (() => Promise<Prepared>) => async () => {
    if (!passport) throw new Error('Open a Passport first.');
    if ((balances?.pot ?? 0n) < 1n * 10n ** 14n) {
      throw new UserError('You need tPOT to stake and to pay fees.', 'faucet');
    }
    const tx = build();
    return live.prepareNativeTool(title,{tx,steps},passport,cost);
  };

  const create = () => actPrepared(prep(
    'Create a staking pool',
    [native('c', 'create', `Bond ${amount} tPOT and create the pool`, 'You become its root, nominator and bouncer.'), native('m', 'setMetadata', 'Name the pool', name || 'Unnamed pool'), native('n', 'nominate', `Nominate ${chosen.length} validator${chosen.length === 1 ? '' : 's'}`, 'The pool backs these validators with everyone’s combined stake.')],
    () => api.tx.utility.batchAll([
      api.tx.nominationPools.create(parseUnits(amount, 14), passport!.address, passport!.address, passport!.address),
      api.tx.nominationPools.setMetadata(data.nextId, name || `Pool ${data.nextId}`),
      ...(chosen.length ? [api.tx.nominationPools.nominate(data.nextId, chosen)] : []),
    ]),
    'The bond stays yours and can be unbonded later.',
  ));

  const join = (id: number) => actPrepared(prep(
    `Join pool #${id}`,
    [native('j', 'join', `Bond ${joinAmt} tPOT into pool #${id}`, 'Your stake backs the pool’s validators and earns a share of rewards.'), native('p', 'setClaimPermission', 'Allow auto-compounding', 'Grants a keeper permission to reinvest rewards; no keeper service is confirmed running.')],
    () => api.tx.utility.batchAll([api.tx.nominationPools.join(parseUnits(joinAmt, 14), id), api.tx.nominationPools.setClaimPermission('PermissionlessCompound')]),
  ));

  return (
    <div>
      <h1 className="page-title">Pool Studio</h1>
      <p className="page-lede">Staking pools let participants back validators together. Pool records and minimum bonds below come from the connected chain. Automatic reinvestment requires a separately running keeper; granting permission alone does not start one.</p>
      <p className="notice">Advanced native tool, separate from equipment funding. Native stake is locked under the chain’s unbonding rules. No hosted compounding keeper or separate-user browser staking result is claimed.</p>

      {data.mine && (
        <>
          <div className="section-head"><h2>Your pool</h2></div>
          <div className="stat-strip">
            <div className="stat"><small>Pool</small><b>#{data.mine.poolId}</b></div>
            <div className="stat"><small>Rewards waiting</small><b>{pot(data.pending, 3)}</b></div>
            <div className="stat"><small>Keeper permission</small><b>{compounding ? 'Granted' : 'Not granted'}</b></div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <button className="btn primary sm" onClick={() => actPrepared(prep('Reinvest rewards', [native('b', 'bondExtra', 'Reinvest your rewards', 'Adds your pending rewards to your stake.')], () => api.tx.utility.batchAll([api.tx.nominationPools.bondExtra({ Rewards: null })])))}>Reinvest now</button>
            <button className="btn ghost sm" onClick={() => actPrepared(prep('Claim rewards', [native('c', 'claimPayout', 'Claim your rewards', 'Sends pending rewards to your account.')], () => api.tx.utility.batchAll([api.tx.nominationPools.claimPayout()])))}>Claim to my account</button>
            {!compounding && <button className="btn ghost sm" onClick={() => actPrepared(prep('Turn on auto-compound', [native('p', 'setClaimPermission', 'Allow auto-compounding', 'A keeper may reinvest your rewards. It can do nothing else with them.')], () => api.tx.utility.batchAll([api.tx.nominationPools.setClaimPermission('PermissionlessCompound')])))}>Turn on auto-compound</button>}
          </div>
        </>
      )}

      <div className="section-head"><h2>Pools you can join</h2></div>
      {data.rows.length === 0 ? (
        <Empty title="There are no pools yet">Create the first one below. Joining needs at least {pot(data.minJoin, 0)}.</Empty>
      ) : (
        <>
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="ja">Amount to bond</label>
            <div className="input-affix"><input id="ja" type="number" min="0" step="any" value={joinAmt} onChange={(e) => setJoinAmt(e.target.value)} /><span>tPOT</span></div>
          </div>
          <table className="table">
            <thead><tr><th>Pool</th><th>State</th><th className="num">Members</th><th className="num">Bonded</th><th /></tr></thead>
            <tbody>{data.rows.map((p) => (
              <tr key={p.id}><td><b>{p.name || `Pool #${p.id}`}</b><br /><small className="mono" style={{ color: 'var(--ink-3)' }}>#{p.id} · root {short(p.root ?? '', 6, 4)}</small></td><td>{p.state}</td><td className="num">{p.members}</td><td className="num">{pot(p.points, 0)}</td>
                <td className="num"><button className="btn primary sm" disabled={!!data.mine || p.state !== 'Open'} onClick={() => (passport ? join(p.id) : openPassport())}>{data.mine ? 'Already in a pool' : 'Join'}</button></td></tr>
            ))}</tbody>
          </table>
        </>
      )}

      <div className="section-head"><h2>Create a pool</h2><p>You choose which validators it backs. At least {pot(data.minCreate, 0)} to start.</p></div>
      <div className="two-col">
        <div>
          <div className="field"><label htmlFor="pn">Pool name</label><input id="pn" type="text" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} placeholder="Community pool" /></div>
          <div className="field"><label htmlFor="pa">Your starting bond</label><div className="input-affix"><input id="pa" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /><span>tPOT</span></div><p className="hint">Minimum {pot(data.minCreate, 0)}. You can unbond it later.</p></div>
          <button className="btn primary" disabled={Number(amount) * 1e14 < Number(data.minCreate)} onClick={() => (passport ? create() : openPassport())}>Create pool</button>
        </div>
        <div>
          <label>Validators to back</label>
          <ul className="activity">{data.validators.map((v) => (
            <li key={v}><label style={{ display: 'flex', gap: 10, margin: 0, fontWeight: 500, cursor: 'pointer' }}><input type="checkbox" checked={!!picked[v]} onChange={(e) => setPicked({ ...picked, [v]: e.target.checked })} /><span className="mono">{short(v, 10, 8)}</span></label><span /></li>
          ))}</ul>
          <p className="hint" style={{ color: 'var(--ink-3)', marginTop: 8, fontSize: 13 }}>Only validators in the active set are listed. Every nominator makes the network harder to halt.</p>
        </div>
      </div>
    </div>
  );
}
