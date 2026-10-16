// End-to-end test of Teleport and its relayer on two local EVM chains (anvil), no network needed.
//   npm run teleport:local
// Chain A stands in for Portaldot (id 420420777, lock/release), chain B for BNB testnet (id 97, mint/burn).
import { spawn, type ChildProcess } from 'node:child_process';
import { ContractFactory, JsonRpcProvider, Wallet, Contract, parseUnits, formatUnits } from 'ethers';
import { DatabaseSync } from 'node:sqlite';
import { TeleportArtifact, WrappedTokenArtifact } from '@portion/sdk';
import { openDb } from '../packages/server/src/db';
import { Relayer, evmSide } from '../packages/server/src/relayer';

const A = { id: 420420777, port: 18545 };
const B = { id: 97, port: 18546 };
const PK0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // anvil's public dev key #0
const USER_PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // anvil dev key #1
const U = (n: string) => parseUnits(n, 6);

const procs: ChildProcess[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function startAnvil(chainId: number, port: number) {
  const p = spawn('anvil', ['--chain-id', String(chainId), '--port', String(port), '--silent'], { stdio: 'ignore' });
  procs.push(p);
  const provider = new JsonRpcProvider(`http://127.0.0.1:${port}`, chainId, { staticNetwork: true, cacheTimeout: -1 });
  for (let i = 0; i < 50; i++) { try { await provider.getBlockNumber(); return provider; } catch { await sleep(100); } }
  throw new Error('anvil did not start');
}
let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` ${extra}` : ''}`); if (!ok) failed++; };
const cleanup = () => procs.forEach((p) => p.kill());
process.on('exit', cleanup);

try {
  const pa = await startAnvil(A.id, A.port);
  const pb = await startAnvil(B.id, B.port);
  const wa = new Wallet(PK0, pa), wb = new Wallet(PK0, pb);
  const ua = new Wallet(USER_PK, pa), ub = new Wallet(USER_PK, pb);

  const deploy = async (art: { abi: any[]; bytecode: string }, signer: Wallet, ...args: unknown[]) => {
    const c = await new ContractFactory(art.abi, art.bytecode, signer).deploy(...args);
    await c.waitForDeployment();
    return c;
  };
  const relayerWallets = [1, 2, 3].map(() => Wallet.createRandom());

  // chain A: a stand-in for pUSD (we can mint it) and the HOME teleport
  const pusd = await deploy(WrappedTokenArtifact, wa, 'Portion Dollar', 'pUSD', 6);
  await (await (pusd as any).setBridge(wa.address)).wait();
  const teleA = await deploy(TeleportArtifact, wa, await pusd.getAddress(), false, U('10000'), U('50000'));
  // chain B: wrapped token + REMOTE teleport
  const wpusd = await deploy(WrappedTokenArtifact, wb, 'Wrapped Portion Dollar', 'wpUSD', 6);
  const teleB = await deploy(TeleportArtifact, wb, await wpusd.getAddress(), true, U('10000'), U('50000'));
  await (await (wpusd as any).setBridge(await teleB.getAddress())).wait();

  const addrs = relayerWallets.map((w) => w.address);
  for (const [t, other] of [[teleA, B.id], [teleB, A.id]] as const) {
    await (await (t as any).setRelayers(addrs, 2)).wait();
    await (await (t as any).setSupportedChain(other, true)).wait();
  }
  await (await (pusd as any).mint(wa.address, U('100000'))).wait();
  await (await (pusd as any).approve(await teleA.getAddress(), U('100000'))).wait();
  await (await (teleA as any).addLiquidity(U('50000'))).wait();
  await (await (pusd as any).mint(ua.address, U('1000'))).wait();

  const db: DatabaseSync = openDb(':memory:');
  const relayer = new Relayer(
    db,
    [
      evmSide({ name: 'Portaldot (local stand-in)', rpc: `http://127.0.0.1:${A.port}`, chainId: A.id, gasKey: PK0, teleport: await teleA.getAddress(), confirmations: 0 }),
      evmSide({ name: 'BNB testnet (local stand-in)', rpc: `http://127.0.0.1:${B.port}`, chainId: B.id, gasKey: PK0, teleport: await teleB.getAddress(), confirmations: 0 }),
    ],
    relayerWallets.map((w) => w.privateKey),
    () => undefined,
  );
  // start scanning from the beginning of both chains
  db.prepare("INSERT INTO kv(k,v) VALUES (?,?),(?,?)").run(`teleport_cursor_${A.id}`, '0', `teleport_cursor_${B.id}`, '0');

  console.log('Teleport local end-to-end');
  const friend = Wallet.createRandom().address;

  // A → B: lock on Portaldot, mint on BNB
  await (await (pusd.connect(ua) as any).approve(await teleA.getAddress(), U('250'))).wait();
  await (await (teleA.connect(ua) as any).bridgeOut(B.id, friend, U('250'))).wait();
  check('lock: pUSD left the user and sits in the home pool', (await (pusd as any).balanceOf(ua.address)) === U('750'));
  await relayer.tick();
  check('mint: recipient received wpUSD on the other chain', (await (wpusd as any).balanceOf(friend)) === U('250'), `(${formatUnits(await (wpusd as any).balanceOf(friend), 6)})`);
  check('wpUSD supply equals what was locked', (await (wpusd as any).totalSupply()) === U('250'));

  // B → A: burn on BNB, release on Portaldot
  await (await (wpusd as any).transfer(ub.address, 0)).wait().catch(() => undefined);
  const fw = new Wallet(Wallet.createRandom().privateKey, pb);
  await (await wb.sendTransaction({ to: fw.address, value: parseUnits('1', 18) })).wait();
  // give `fw` the wrapped tokens by relaying a second transfer to it
  await (await (pusd.connect(ua) as any).approve(await teleA.getAddress(), U('100'))).wait();
  await (await (teleA.connect(ua) as any).bridgeOut(B.id, fw.address, U('100'))).wait();
  await relayer.tick();
  check('second transfer minted to the burner account', (await (wpusd as any).balanceOf(fw.address)) === U('100'));
  await (await (wpusd.connect(fw) as any).approve(await teleB.getAddress(), U('60'))).wait();
  const back = Wallet.createRandom().address;
  await (await (teleB.connect(fw) as any).bridgeOut(A.id, back, U('60'))).wait();
  check('burn: wpUSD supply dropped', (await (wpusd as any).totalSupply()) === U('290'));
  await relayer.tick();
  check('release: pUSD arrived on the home chain', (await (pusd as any).balanceOf(back)) === U('60'));

  // replay protection: re-submitting an already-processed message must fail
  const row = db.prepare("SELECT * FROM transfers WHERE src_chain = ? AND nonce = '0'").get(B.id) as any;
  const domain = { name: 'PortionTeleport', version: '1', chainId: A.id, verifyingContract: await teleA.getAddress() };
  const types = { Message: [{ name: 'srcChainId', type: 'uint256' }, { name: 'dstChainId', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' }] };
  const msg = { srcChainId: B.id, dstChainId: A.id, nonce: row.nonce, recipient: row.recipient, amount: row.amount };
  const sorted = [...relayerWallets].sort((x, y) => (BigInt(x.address) < BigInt(y.address) ? -1 : 1)).slice(0, 2);
  const sigs = await Promise.all(sorted.map((w) => w.signTypedData(domain, types, msg)));
  let replayRejected = false;
  try { await (await (teleA as any).bridgeIn(msg, sigs)).wait(); } catch { replayRejected = true; }
  check('replay of a finished transfer is rejected on-chain', replayRejected);

  // a forged message signed by a non-relayer must be rejected
  const rogue = Wallet.createRandom();
  const forged = { ...msg, nonce: '999', amount: U('5000').toString() };
  const rogueSigs = await Promise.all([rogue, Wallet.createRandom()].sort((x, y) => (BigInt(x.address) < BigInt(y.address) ? -1 : 1)).map((w) => w.signTypedData(domain, types, forged)));
  let forgedRejected = false;
  try { await (await (teleA as any).bridgeIn(forged, rogueSigs)).wait(); } catch { forgedRejected = true; }
  check('a message signed by non-relayers is rejected', forgedRejected);

  console.log(failed ? `\n${failed} check(s) failed` : '\nAll Teleport checks passed');
} catch (e) {
  console.error('✗ aborted:', e);
  failed++;
} finally {
  cleanup();
  process.exit(failed ? 1 : 0);
}
