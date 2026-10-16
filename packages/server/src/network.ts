import type { ApiPromise } from '@polkadot/api';
import type { DatabaseSync } from 'node:sqlite';

export interface ValidatorView {
  address: string;
  total: string;
  own: string;
  commissionPct: number;
  points: number;
  stakeShare: number; // 0..1
  pointsShare: number; // 0..1
  nominators: number;
}

export interface Finding {
  severity: 'critical' | 'warning' | 'info' | 'good';
  title: string;
  detail: string;
  action?: string;
}

export interface NetworkSnapshot {
  ts: number;
  chain: string;
  specVersion: number;
  best: number;
  finalized: number;
  finalityLag: number;
  blockTimeSec: number;
  peers: number;
  era: number;
  sessionsPerEra: number;
  validators: ValidatorView[];
  nominatorCount: number;
  decentralization: {
    validatorCount: number;
    /** smallest set of validators whose stake exceeds 1/3 — enough to halt GRANDPA finality */
    haltSet: number;
    /** smallest set whose stake reaches 2/3 — enough to finalise whatever they like */
    controlSet: number;
    topShare: number;
    score: number; // 0..100
  };
  modules: { dexPools: number; nominationPools: number; assets: number; nftCollections: number; beefyAuthorities: number; mmrLeaves: number };
  findings: Finding[];
}

const num = (x: any) => Number(x?.toString?.().replace(/,/g, '') ?? 0);

function setSize(sorted: bigint[], total: bigint, threshold: 'third' | 'twoThirds'): number {
  let acc = 0n;
  for (let i = 0; i < sorted.length; i++) {
    acc += sorted[i];
    if (threshold === 'third' ? acc * 3n > total : acc * 3n >= total * 2n) return i + 1;
  }
  return sorted.length;
}

export async function snapshot(api: ApiPromise): Promise<NetworkSnapshot> {
  const [chain, health, bestHeader, finHash] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.health(),
    api.rpc.chain.getHeader(),
    api.rpc.chain.getFinalizedHead(),
  ]);
  const finHeader = await api.rpc.chain.getHeader(finHash);
  const best = bestHeader.number.toNumber();
  const finalized = finHeader.number.toNumber();

  // average block time over the last 20 blocks
  let blockTimeSec = 6;
  try {
    const back = Math.min(20, best);
    const oldHash = await api.rpc.chain.getBlockHash(best - back);
    const [nowT, oldT] = await Promise.all([api.query.timestamp.now(), (await api.at(oldHash)).query.timestamp.now()]);
    blockTimeSec = (num(nowT) - num(oldT)) / 1000 / back;
  } catch {
    /* keep default */
  }

  const era = ((await api.query.staking.currentEra()) as any).unwrapOr(0).toNumber();
  const [overview, prefs, points, nominators] = await Promise.all([
    api.query.staking.erasStakersOverview.entries(era),
    api.query.staking.erasValidatorPrefs.entries(era),
    api.query.staking.erasRewardPoints(era),
    api.query.staking.nominators.entries(),
  ]);
  const prefMap = new Map(prefs.map(([k, v]: any) => [k.args[1].toString(), v]));
  const pts: any = points.toJSON();
  const totalPoints = Number(pts.total ?? 0) || 1;

  const rows = overview.map(([k, v]: any) => {
    const address = k.args[1].toString();
    const o: any = v.toJSON();
    const pref: any = prefMap.get(address)?.toJSON();
    const individual = Number(pts.individual?.[address] ?? 0);
    return { address, total: BigInt(o.total), own: BigInt(o.own), commission: Number(pref?.commission ?? 0) / 1e7, points: individual, nominators: Number(o.nominatorCount ?? 0) };
  });
  const grandTotal = rows.reduce((a, r) => a + r.total, 0n) || 1n;
  const validators: ValidatorView[] = rows
    .map((r) => ({
      address: r.address,
      total: r.total.toString(),
      own: r.own.toString(),
      commissionPct: r.commission,
      points: r.points,
      stakeShare: Number((r.total * 10_000n) / grandTotal) / 10_000,
      pointsShare: r.points / totalPoints,
      nominators: r.nominators,
    }))
    .sort((a, b) => b.stakeShare - a.stakeShare);

  const sortedStake = rows.map((r) => r.total).sort((a, b) => (a < b ? 1 : -1));
  const haltSet = setSize(sortedStake, grandTotal, 'third');
  const controlSet = setSize(sortedStake, grandTotal, 'twoThirds');
  const topShare = validators[0]?.stakeShare ?? 1;
  // 100 = a long tail of equal validators; 0 = a single validator
  const score = Math.max(0, Math.min(100, Math.round(((haltSet - 1) / Math.max(1, validators.length)) * 60 + Math.min(validators.length, 20) * 2)));

  const [dex, pools, assets, collections, beefy, mmr] = await Promise.all([
    api.query.assetConversion.pools.keys(),
    api.query.nominationPools.counterForBondedPools(),
    api.query.assets.asset.keys(),
    api.query.nfts.collection.keys(),
    api.query.beefy.authorities(),
    api.query.mmr.numberOfLeaves(),
  ]);

  const snap: NetworkSnapshot = {
    ts: Math.floor(Date.now() / 1000),
    chain: chain.toString(),
    specVersion: api.runtimeVersion.specVersion.toNumber(),
    best,
    finalized,
    finalityLag: best - finalized,
    blockTimeSec,
    peers: health.peers.toNumber(),
    era,
    sessionsPerEra: (api.consts.staking.sessionsPerEra as any).toNumber(),
    validators,
    nominatorCount: nominators.length,
    decentralization: { validatorCount: validators.length, haltSet, controlSet, topShare, score },
    modules: {
      dexPools: dex.length,
      nominationPools: Number(pools.toString()),
      assets: assets.length,
      nftCollections: collections.length,
      beefyAuthorities: (beefy as any).length,
      mmrLeaves: Number(mmr.toString()),
    },
    findings: [],
  };
  snap.findings = analyse(snap);
  return snap;
}

export function analyse(s: NetworkSnapshot): Finding[] {
  const f: Finding[] = [];
  const d = s.decentralization;
  if (d.validatorCount < 4) {
    f.push({
      severity: 'critical',
      title: `Only ${d.validatorCount} validators secure this chain`,
      detail: `GRANDPA needs more than 2/3 of stake to finalise. With ${d.validatorCount} validators, any ${d.controlSet} of them can finalise anything and ${d.haltSet} can halt the chain.`,
      action: 'Create or join a nomination pool and nominate new validators. Every additional independent validator moves the halt threshold.',
    });
  } else if (d.validatorCount < 20) {
    f.push({ severity: 'warning', title: `${d.validatorCount} validators`, detail: 'Finality is usable but a small colluding set could still stall it.', action: 'Recruit validators.' });
  } else {
    f.push({ severity: 'good', title: `${d.validatorCount} validators`, detail: 'A healthy set size for a young chain.' });
  }
  if (d.topShare > 0.4) f.push({ severity: 'warning', title: `Top validator holds ${(d.topShare * 100).toFixed(0)}% of stake`, detail: 'Stake is concentrated.', action: 'Nominate smaller validators.' });
  if (s.nominatorCount === 0) {
    f.push({ severity: 'warning', title: 'No nominators', detail: 'Nobody outside the validators has staked. Staking rewards are not reaching the community.', action: 'Open a Pool Studio pool and invite holders.' });
  }
  if (s.finalityLag > 8) f.push({ severity: 'critical', title: `Finality is ${s.finalityLag} blocks behind`, detail: 'Finalised head is lagging the best head.', action: 'Check validator connectivity.' });
  else f.push({ severity: 'good', title: `Finality lag ${s.finalityLag} blocks`, detail: 'GRANDPA is keeping up.' });
  if (s.peers <= 1) f.push({ severity: 'info', title: `${s.peers} peer on the RPC node`, detail: 'Public RPC is served by a single node: a single point of failure for every app.', action: 'Run your own RPC node and point your app at it.' });
  if (s.modules.dexPools === 0) f.push({ severity: 'info', title: 'The native DEX has no pools', detail: 'AssetConversion is live but empty. Portion seeds a pool for every listing that wants secondary trading.' });
  if (s.modules.nominationPools === 0) f.push({ severity: 'info', title: 'No nomination pools exist', detail: 'Native pooled staking is unused.' });
  return f;
}

export function recordSample(db: DatabaseSync, s: NetworkSnapshot) {
  db.prepare(
    'INSERT OR REPLACE INTO samples(ts,best,finalized,validators,era,block_time,peers,mmr_leaves,beefy_authorities) VALUES (?,?,?,?,?,?,?,?,?)',
  ).run(s.ts, s.best, s.finalized, s.decentralization.validatorCount, s.era, s.blockTimeSec, s.peers, s.modules.mmrLeaves, s.modules.beefyAuthorities);
}
