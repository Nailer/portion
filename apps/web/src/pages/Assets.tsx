import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ListingView } from '@portion/sdk';
import { useApp } from '../state/app';
import { NetworkState } from '../components/NetworkState';
import { Spinner, useAsync } from '../components/ui';
import { ListingRow } from './Home';
import { offerStatus } from '../lib/offer-status';

type Filter = 'all' | 'open' | 'other';

export function Assets() {
  const { backend, status, tick, sandbox } = useApp();
  const ready = status === 'ready' && !!backend?.deployed;
  const { data, loading, error } = useAsync(async () => ready ? backend!.listings() : ([] as ListingView[]), [backend, ready, tick]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const listings = data ?? [];
  const open = useMemo(() => listings.filter(l => offerStatus(l).canBuy), [listings]);
  const shown = listings.filter(l => (filter === 'all' || (filter === 'open') === offerStatus(l).canBuy) && `${l.name} ${l.summary}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="assets-page">
    <header className="assets-head">
      <span className="pv-eyebrow">{sandbox ? 'Sandbox · fictional assets' : 'Portaldot test network'}</span>
      <h1>Explore assets</h1>
      <p>Each asset is equipment or a business an operator describes. Open one to see its price, where your money goes, what has actually been paid, and the risks. {sandbox ? 'These assets are fictional and simulated in your browser.' : 'Everything here uses test tokens with no monetary value. No wallet is needed to browse.'}</p>
    </header>
    <NetworkState what="published assets"/>
    {ready && loading && !data && <div className="pv-state"><Spinner label="Loading assets"/></div>}
    {ready && error && <div className="pv-state" role="alert"><h3>We couldn’t load the assets.</h3><p>{error.message}</p></div>}
    {ready && data && !listings.length && <div className="pv-state"><h3>No assets are published yet.</h3><p>Assets appear here after an operator publishes them on-chain.</p><Link className="btn primary" to="/create">Create an offer</Link></div>}
    {ready && !!listings.length && <>
      <div className="assets-tools">
        <div className="workspace-filters" role="group" aria-label="Filter assets">
          <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All ({listings.length})</button>
          <button aria-pressed={filter === 'open'} onClick={() => setFilter('open')}>Open to buy ({open.length})</button>
          <button aria-pressed={filter === 'other'} onClick={() => setFilter('other')}>Not open ({listings.length - open.length})</button>
        </div>
        <label className="workspace-search assets-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search by name" aria-label="Search assets by name" value={search} onChange={e => setSearch(e.target.value)}/></label>
      </div>
      {!shown.length
        ? <div className="pv-state"><h3>No matching offers.</h3><p>{filter === 'open' && !search.trim() ? 'No offer is open for purchase right now. You can still read every published asset.' : 'Nothing matches this filter or search.'}</p><button className="btn ghost" onClick={() => { setFilter('all'); setSearch(''); }}>Show all assets</button></div>
        : <div className="pv-assets">{shown.map(l => <ListingRow key={l.id} l={l}/>)}</div>}
      {!open.length && filter === 'all' && !search.trim() && <p className="assets-note"><b>No offer is open for purchase right now.</b> Read the record below, or <Link to="/create">create an offer</Link> for your own asset.</p>}
    </>}
  </div>;
}
