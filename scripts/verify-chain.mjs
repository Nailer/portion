#!/usr/bin/env node
// Checks the deployed Core without trusting this project's app, API or keys. It reads only public endpoints: it
// compares the deployed code with the source compiled here, confirms the recorded transactions succeeded, replays
// the contract's events from them to recompute the accounting, and compares the result with what the contract and
// the token balances report. Read-only: it signs nothing and sends no transaction.
//
// Portion's transactions are native batches calling Revive.call, and the EVM RPC does not index those, so events come
// from the native node. Scanning every block is too slow for the public node's rate limit, so the transactions are
// named. If one were missing from the list, the recomputed totals would no longer match the contract and a check fails.
//
//   npm run verify:chain
//   node scripts/verify-chain.mjs --rpc <url> --ws <url> --address <0x…> --receipts <hash@block,…> [--no-compile] [--write]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Interface, getAddress, keccak256 } from 'ethers';

const SCALE = 10n ** 18n;
const REQUEST_GAP_MS = 250; // The organisers ask for under 5 requests a second on the public RPC.
const root = new URL('../', import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

function option(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}
const flag = (name) => process.argv.includes(`--${name}`);

const deployment = readJson('deployments/portaldot-testnet.json');
const testListing = readJson('deployments/portion-test-listing.json');
const rpcUrl = option('rpc', 'https://test-evm-rpc-v3.portaldot.dev');
const wsUrl = option('ws', 'wss://test-node-v3.portaldot.dev');
const address = getAddress(option('address', deployment.portion));
const expectedChainId = Number(option('chain-id', deployment.chainId));
const deployReceipt = { label: 'deployment', hash: deployment.txs.portion, block: deployment.deployedBlock };
const receipts = option('receipts')
  ? option('receipts').split(',').map((item) => { const [hash, block] = item.split('@'); return { label: 'named', hash, block: Number(block) }; })
  : [
    { label: 'create listing', hash: testListing.creation.hash, block: testListing.creation.block },
    { label: 'buy, deposit, claim, unstake', hash: testListing.journey.hash, block: testListing.journey.block },
  ];

const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

let lastRequest = 0;
let requestId = 0;
async function rpc(method, params) {
  const wait = lastRequest + REQUEST_GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequest = Date.now();
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
  });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

/** Returns the source's runtime code: compiled here when Foundry is available, otherwise the committed artifact. */
function expectedCode() {
  const committed = (note) => ({ code: readJson('packages/sdk/src/artifacts/PortionCore.json').runtimeBytecode, source: `committed artifact, ${note}` });
  if (flag('no-compile')) return committed('compile skipped');
  try {
    execFileSync('forge', ['build', '--root', new URL('contracts', root).pathname], { stdio: 'ignore' });
  } catch (error) {
    if (error.code === 'ENOENT') return committed('forge not found');
    throw error;
  }
  return { code: readJson('contracts/out/PortionCore.sol/PortionCore.json').deployedBytecode.object, source: 'compiled from contracts/src with forge' };
}

/** Confirms a transaction is in its block and succeeded, and returns its events. */
async function readReceipt(api, { hash, block }) {
  const blockHash = await api.rpc.chain.getBlockHash(block);
  const signed = await api.rpc.chain.getBlock(blockHash);
  const index = signed.block.extrinsics.findIndex((extrinsic) => extrinsic.hash.toHex() === hash.toLowerCase());
  if (index === -1) return { found: false, success: false, events: [] };
  const at = await api.at(blockHash);
  const events = (await at.query.system.events()).filter((record) => record.phase.isApplyExtrinsic && record.phase.asApplyExtrinsic.eqn(index));
  return { found: true, success: events.some((record) => record.event.section === 'system' && record.event.method === 'ExtrinsicSuccess'), events };
}

/** The contract's accounting, recomputed from its events alone. */
export function replay(events) {
  const listings = new Map();
  const get = (asset) => {
    if (!listings.has(asset)) listings.set(asset, { sold: 0n, staked: 0n, acc: 0n, revenue: 0n, claimed: 0n, bondChange: 0n, slashed: 0, holders: new Map(), fees: [], purchases: [] });
    return listings.get(asset);
  };
  const holder = (l, account) => {
    if (!l.holders.has(account)) l.holders.set(account, { amount: 0n, debt: 0n, owed: 0n });
    return l.holders.get(account);
  };
  const harvest = (l, s) => {
    const earned = s.amount * l.acc / SCALE;
    s.owed += earned - s.debt;
    s.debt = earned;
  };
  for (const { name, args } of events) {
    const l = get(args.asset);
    switch (name) {
      case 'Bought': l.sold += args.shares; l.purchases.push({ shares: args.shares, cost: args.cost }); break;
      case 'Staked': case 'Unstaked': {
        const s = holder(l, args.account);
        const change = name === 'Staked' ? args.amount : -args.amount;
        harvest(l, s);
        s.amount += change;
        l.staked += change;
        s.debt = s.amount * l.acc / SCALE;
        break;
      }
      case 'Deposited':
        l.acc += args.net * SCALE / l.staked;
        l.revenue += args.net;
        l.fees.push({ net: args.net, fee: args.fee });
        break;
      case 'Claimed': {
        const s = holder(l, args.account);
        harvest(l, s);
        s.owed -= args.amount;
        l.claimed += args.amount;
        break;
      }
      case 'BondAdded': l.bondChange += args.amount; break;
      case 'BondWithdrawn': l.bondChange -= args.amount; break;
      case 'Slashed':
        l.slashed += 1;
        if (args.holders > 0n) {
          l.acc += args.holders * SCALE / l.staked;
          l.revenue += args.holders;
        }
        break;
      default: break;
    }
  }
  for (const l of listings.values()) {
    for (const s of l.holders.values()) harvest(l, s);
  }
  return listings;
}

async function main() {
  const artifact = readJson('packages/sdk/src/artifacts/PortionCore.json');
  const core = new Interface(artifact.abi);
  const token = new Interface(['function balanceOf(address) view returns (uint256)']);
  const call = async (iface, to, fn, args = []) => iface.decodeFunctionResult(fn, await rpc('eth_call', [{ to, data: iface.encodeFunctionData(fn, args) }, 'latest']));

  console.log(`Contract ${address}\nRPC      ${rpcUrl}\n`);
  check('Connected to the expected chain', Number(BigInt(await rpc('eth_chainId', []))) === expectedChainId, `chain ID ${expectedChainId}`);
  const latest = Number(BigInt(await rpc('eth_blockNumber', [])));

  const deployed = (await rpc('eth_getCode', [address, 'latest'])).toLowerCase();
  const { code, source } = expectedCode();
  check('Deployed code is byte-identical to the source', deployed === code.toLowerCase(), `${(deployed.length - 2) / 2} bytes, ${source}`);
  const codeHash = keccak256(deployed);
  console.log(`      code hash ${codeHash}\n`);

  const api = await ApiPromise.create({ provider: new WsProvider(wsUrl), noInitWarn: true });
  const events = [];
  try {
    const creation = await readReceipt(api, deployReceipt);
    const instantiated = creation.events.some((record) => record.event.section === 'revive' && record.event.method === 'Instantiated'
      && record.event.data.contract.toHex().toLowerCase() === address.toLowerCase());
    check(`Deployment ${deployReceipt.hash.slice(0, 14)}… created this contract`, creation.success && instantiated, `block ${deployReceipt.block}`);
    for (const receipt of receipts) {
      const { found, success, events: records } = await readReceipt(api, receipt);
      check(`Transaction ${receipt.hash.slice(0, 14)}… succeeded`, found && success, `${receipt.label}, block ${receipt.block}`);
      for (const { event } of records) {
        if (event.section !== 'revive' || event.method !== 'ContractEmitted' || event.data.contract.toHex().toLowerCase() !== address.toLowerCase()) continue;
        const parsed = core.parseLog({ topics: event.data.topics.map((topic) => topic.toHex()), data: event.data.data.toHex() });
        if (parsed) events.push({ name: parsed.name, args: parsed.args, block: receipt.block, tx: receipt.hash });
        else check('Contract event is one Core emits', false, receipt.hash.slice(0, 14));
      }
    }
  } finally {
    await api.disconnect();
  }
  check('Read the contract events from those transactions', events.length > 0, `${events.length} events`);

  const listings = replay(events);
  const payment = (await call(core, address, 'paymentToken'))[0];
  const held = (await call(token, payment, 'balanceOf', [address]))[0];
  let expectedHeld = 0n;
  const report = [];
  for (const [asset, r] of listings) {
    const live = (await call(core, address, 'listing', [asset]))[0];
    console.log(`Listing ${asset}`);
    check('  sold matches Bought events', live.sold === r.sold, `${r.sold} shares`);
    check('  staked matches Staked and Unstaked events', live.staked === r.staked, `${r.staked} shares`);
    check('  revenue matches Deposited and Slashed events', live.revenue === r.revenue, `${r.revenue} units`);
    check('  accumulator recomputes exactly', live.acc === r.acc);
    check('  every purchase cost shares × price', r.purchases.every((p) => p.cost === p.shares * live.price), `${r.purchases.length} purchases`);
    check('  every deposit fee is exactly 0.5%', r.fees.every((d) => d.fee === (d.net + d.fee) / 200n), `${r.fees.length} deposits`);
    for (const [account, s] of r.holders) {
      const [amount] = await call(core, address, 'stakes', [asset, account]);
      const [pending] = await call(core, address, 'pending', [asset, account]);
      check(`  holder ${account.slice(0, 10)}… stake and pending match`, amount === s.amount && pending === s.owed, `staked ${s.amount}, pending ${s.owed}`);
    }
    const shareToken = (await call(core, address, 'shareToken', [asset]))[0];
    const shares = (await call(token, shareToken, 'balanceOf', [address]))[0];
    check('  shares held equal for-sale plus staked', shares === live.forSale + live.staked, `${shares} shares`);
    expectedHeld += live.bond + live.revenue - r.claimed;
    report.push({
      asset: asset.toString(), sold: r.sold.toString(), staked: r.staked.toString(), revenue: r.revenue.toString(), claimed: r.claimed.toString(),
      bond: live.bond.toString(), holders: r.holders.size, purchases: r.purchases.length, deposits: r.fees.length, slashes: r.slashed,
    });
    console.log('');
  }
  check('Payment token held equals bonds plus unclaimed income', held === expectedHeld, `${held} units`);

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length} of ${checks.length} checks passed at block ${latest}.`);
  console.log('This proves the code and accounting match. It does not prove that equipment exists, that revenue is complete, or that the contract is safe.');
  if (flag('write')) {
    const result = {
      checkedAt: new Date().toISOString(), rpc: rpcUrl, ws: wsUrl, contract: address, chainId: expectedChainId, latestBlock: latest,
      runtimeBytes: (deployed.length - 2) / 2, runtimeCodeHash: codeHash, codeSource: source, events: events.length,
      transactions: [...new Set(events.map((e) => e.tx))], listings: report, checks: checks.map(({ name, pass, detail }) => ({ name: name.trim(), pass, detail })),
      allPassed: failed.length === 0,
    };
    writeFileSync(new URL('deployments/chain-verification.json', root), `${JSON.stringify(result, null, 2)}\n`);
  }
  if (failed.length) process.exit(1);
}

await main().catch((error) => {
  console.error(`Could not finish: ${error.message}`);
  process.exit(2);
});
