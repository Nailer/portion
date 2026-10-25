import { get, put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';

export interface CreditState {
  v: 2; day: string; accounts: string[]; attempts: number;
  pending?: { id: string; address: string; startedAt: string; phase?: 'reserved' | 'signing'; nonce?: string; callHash?: string };
}
export interface CreditStore {
  load(): Promise<{ state: CreditState; etag: string } | null>;
  save(state: CreditState, etag?: string): Promise<string>;
}
export function blobCreditStore(path: string): CreditStore {
  return {
    load: async () => {
      const result = await get(path, { access: 'public', headers: { 'Cache-Control': 'no-cache' } });
      if (!result) return null;
      if (result.statusCode !== 200) throw new Error('Credit control state could not be read.');
      const state = await new Response(result.stream).json() as CreditState;
      if (state.v !== 2 || !/^\d{4}-\d{2}-\d{2}$/.test(state.day) || !Array.isArray(state.accounts) || state.accounts.some(a => typeof a !== 'string') || state.accounts.length > 20 || !Number.isInteger(state.attempts) || state.attempts < 0 || state.attempts > 20 || (state.pending && (typeof state.pending.id !== 'string' || typeof state.pending.address !== 'string' || typeof state.pending.startedAt !== 'string'))) throw new Error('Credit control state is invalid.');
      return { state, etag: result.blob.etag };
    },
    save: async (state, etag) => {
      const result = await put(path, JSON.stringify(state), { access: 'public', contentType: 'application/json', addRandomSuffix: false,
        allowOverwrite: !!etag, ...(etag ? { ifMatch: etag } : {}), cacheControlMaxAge: 60 });
      if (!result.etag) throw new Error('Conditional reservation metadata is unavailable.');
      return result.etag;
    },
  };
}

/** One durable in-flight request across all serverless instances; no expiring lease. */
export async function reserveCredits(store: CreditStore, address: string, day: string, legacyAccounts: string[] = []) {
  const previous = await store.load();
  if (previous && previous.state.day > day) throw new Error('This request crossed a daily reset. Start a fresh request; no mint was submitted.');
  if (previous?.state.pending) throw new Error('Another credit request is pending or unconfirmed. The issuer is paused until its outcome is reconciled.');
  const sameDay = previous?.state.day === day;
  const accounts = [...new Set([...(sameDay ? previous.state.accounts : []), ...legacyAccounts])];
  const attempts = Math.max(sameDay ? previous.state.attempts : 0, accounts.length);
  if (accounts.includes(address)) throw new Error('This account already reserved credits today. Check its balance; requests reset at UTC midnight.');
  if (attempts >= 20) throw new Error('Daily test-credit attempt limit reached. Requests reset at UTC midnight.');
  const state: CreditState = { v: 2, day, accounts: [...accounts, address], attempts: attempts + 1,
    pending: { id: randomUUID(), address, startedAt: new Date().toISOString(), phase:'reserved' } };
  // A stale read or simultaneous initial create fails at the conditional write.
  let etag = await store.save(state, previous?.etag);
  return {
    state,
    markSubmission: async (nonce: string, callHash: string) => {
      if (!/^\d+$/.test(nonce) || !/^0x[0-9a-f]{64}$/i.test(callHash)) throw new Error('Submission identity is invalid.');
      state.pending = {...state.pending!,phase:'signing',nonce,callHash};
      etag = await store.save(state,etag);
    },
    finish: async () => { const { pending: _, ...settled } = state; await store.save(settled, etag); },
  };
}

export function creditOutcomeMatches(state: CreditState, evidence: { signer: string; nonce: string; callHash: string }, issuer: string) {
  return !!state.pending && state.pending.phase==='signing' && state.pending.nonce===evidence.nonce && state.pending.callHash?.toLowerCase()===evidence.callHash.toLowerCase() && evidence.signer===issuer;
}
