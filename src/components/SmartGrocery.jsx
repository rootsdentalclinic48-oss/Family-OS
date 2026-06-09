import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://ihuuxhvxsbmzydclmbtx.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlodXV4aHZ4c2JtenlkY2xtYnR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzAzNjgsImV4cCI6MjA5NTkwNjM2OH0.RSY5SkQvmQgiz0u62Re1k6-AYYZ16trlFCiDULHsQaw"
);

const PLATFORMS = {
  blinkit:   { label: 'Blinkit',      bg: '#e6ac00', color: '#fff', link: 'https://blinkit.com/s/?q=' },
  instamart: { label: 'Instamart',    bg: '#FF6600', color: '#fff', link: 'https://www.swiggy.com/instamart/search?query=' },
  zepto:     { label: 'Zepto',        bg: '#7B2FBE', color: '#fff', link: 'https://www.zeptonow.com/search?query=' },
  bigbasket: { label: 'BigBasket',    bg: '#4a8c00', color: '#fff', link: 'https://www.bigbasket.com/ps/?q=' },
  amazon:    { label: 'Amazon Fresh', bg: '#c45000', color: '#fff', link: 'https://www.amazon.in/s?k=' },
  flipkart:  { label: 'Flipkart',     bg: '#1a5ec7', color: '#fff', link: 'https://www.flipkart.com/search?q=' },
};

const C = {
  pageBg:   '#f3f4f6',
  cardBg:   '#ffffff',
  border:   '#e5e7eb',
  text1:    '#111827',
  text2:    '#374151',
  text3:    '#6b7280',
  accent:   '#7c3aed',
  accentBg: '#ede9fe',
  green:    '#15803d',
  greenBg:  '#dcfce7',
  amber:    '#92400e',
  amberBg:  '#fef3c7',
  red:      '#b91c1c',
  redBg:    '#fee2e2',
};

const fmt = n => '₹' + Number(n).toLocaleString('en-IN');

const Badge = ({ slug }) => {
  const p = PLATFORMS[slug];
  if (!p) return null;
  return <span style={{ background: p.bg, color: p.color, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>{p.label}</span>;
};

const inp  = { padding: '10px 13px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, color: '#111827', background: '#fff', fontFamily: 'inherit', outline: 'none' };
const sel  = { ...inp, cursor: 'pointer' };
const btnS = { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '14px 16px', marginBottom: 10 };
const lbl  = { fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, display: 'block' };
const empty= { textAlign: 'center', padding: '3rem 1rem', color: '#6b7280', fontSize: 14, lineHeight: 1.7 };

const TABS = ['Shopping List', 'Compare Prices', 'Price History', 'Settings'];

export default function SmartGrocery({ familyId }) {
  const [tab, setTab]             = useState(0);
  const [items, setItems]         = useState([]);
  const [history, setHistory]     = useState([]);
  const [apiCfg, setApiCfg]       = useState({});
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [results, setResults]     = useState(null);
  const [newName, setNewName]     = useState('');
  const [newBrand, setNewBrand]   = useState('');
  const [pf, setPf]               = useState({ item_id: '', platform: 'blinkit', price: '', delivery_fee: '' });
  const [hf, setHf]               = useState({ item_id: '', platform: '' });
  const [amz, setAmz]             = useState({ access_key: '', secret_key: '', partner_tag: '' });
  const [fk,  setFk]              = useState({ app_id: '', app_token: '' });
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState('');

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: itms }, { data: hist }, { data: cfg }] = await Promise.all([
      supabase.from('grocery_items').select('*').eq('is_active', true).order('name').limit(500),
      supabase.from('grocery_price_history').select('*').order('logged_at', { ascending: false }).limit(500),
      supabase.from('grocery_api_config').select('*'),
    ]);
    setItems(itms || []);
    setHistory(hist || []);
    const m = {};
    (cfg || []).forEach(c => { m[c.provider] = c; });
    setApiCfg(m);
    if (m.amazon)  setAmz({ access_key: m.amazon.access_key || '', secret_key: m.amazon.secret_key || '', partner_tag: m.amazon.partner_tag || '' });
    if (m.flipkart) setFk({ app_id: m.flipkart.access_key || '', app_token: m.flipkart.app_token || '' });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── REFRESH: pull low-stock from pantry → upsert into grocery_items ──────
  const refreshFromPantry = async () => {
    setRefreshing(true);
    try {
      const { data: pantryItems } = await supabase
        .from('pantry')
        .select('*')
        .eq('family_id', familyId || 'gupta-family-001');

      if (!pantryItems?.length) { showToast('No pantry items found'); setRefreshing(false); return; }

      const lowStockPantry = pantryItems.filter(p => Number(p.quantity) <= Number(p.par_level) * 2);

      let added = 0, updated = 0;
      for (const p of lowStockPantry) {
        const stockPct = p.par_level > 0
          ? Math.min(100, Math.round((Number(p.quantity) / (Number(p.par_level) * 3)) * 100))
          : 50;

        const { data: existing } = await supabase
          .from('grocery_items')
          .select('id, stock_pct')
          .ilike('name', p.name)
          .eq('is_active', true)
          .single();

        if (existing) {
          await supabase.from('grocery_items').update({ stock_pct: stockPct, updated_at: new Date().toISOString() }).eq('id', existing.id);
          updated++;
        } else {
          await supabase.from('grocery_items').insert({
            name: p.name,
            brand: null,
            quantity: String(p.quantity),
            unit: p.unit,
            category: (p.category || 'general').toLowerCase(),
            is_active: true,
            auto_added: true,
            stock_pct: stockPct,
            low_threshold: 33,
          });
          added++;
        }
      }
      await load();
      showToast(`✓ Synced from pantry — ${added} added, ${updated} updated`);
    } catch (e) {
      console.error(e);
      showToast('Sync failed — check console');
    }
    setRefreshing(false);
  };

  const addItem = async () => {
    if (!newName.trim()) return;
    await supabase.from('grocery_items').insert({ name: newName.trim(), brand: newBrand.trim() || null, quantity: '1', unit: 'pc', category: 'general', stock_pct: 100, low_threshold: 25, is_active: true });
    setNewName(''); setNewBrand(''); load(); showToast('Item added ✓');
  };

  const removeItem = async id => {
    await supabase.from('grocery_items').update({ is_active: false }).eq('id', id);
    load();
  };

  const updateStock = async (id, pct) => {
    await supabase.from('grocery_items').update({ stock_pct: pct, updated_at: new Date().toISOString() }).eq('id', id);
    setItems(prev => prev.map(it => it.id === id ? { ...it, stock_pct: pct } : it));
  };

  const logPrice = async () => {
    if (!pf.item_id || !pf.price) { showToast('Select item and enter price'); return; }
    const item = items.find(i => i.id === pf.item_id);
    await supabase.from('grocery_price_history').insert({ item_id: pf.item_id, item_name: item?.name || '', platform: pf.platform, price: parseFloat(pf.price), delivery_fee: parseFloat(pf.delivery_fee) || 0, source: 'manual' });
    setPf({ item_id: '', platform: 'blinkit', price: '', delivery_fee: '' });
    load(); showToast('Price logged ✓');
  };

  const compareAll = async () => {
    setComparing(true); setTab(1);
    const itemNames = items.map(i => i.name);
    const res = {};
    Object.keys(PLATFORMS).forEach(slug => { res[slug] = { slug, basket: 0, delivery: 0 }; });
    const seen = {};
    history.forEach(h => {
      const key = h.platform + '-' + h.item_id;
      if (!seen[key] && res[h.platform]) { seen[key] = true; res[h.platform].basket += parseFloat(h.price); res[h.platform].delivery = Math.max(res[h.platform].delivery, h.delivery_fee || 0); }
    });
    const scored = Object.values(res).filter(r => r.basket > 0).map(r => ({ ...r, total: r.basket + r.delivery })).sort((a, b) => a.total - b.total);
    setResults({ scored, deepLinks: Object.entries(PLATFORMS).map(([slug, p]) => ({ slug, label: p.label, url: p.link + encodeURIComponent(itemNames.join(' ')) })), itemNames });
    setComparing(false);
  };

  const saveAmz = async () => { setSaving(true); await supabase.from('grocery_api_config').upsert({ provider: 'amazon', access_key: amz.access_key, secret_key: amz.secret_key, partner_tag: amz.partner_tag, is_active: !!(amz.access_key && amz.partner_tag), updated_at: new Date().toISOString() }, { onConflict: 'provider' }); setSaving(false); load(); showToast('Amazon config saved ✓'); };
  const saveFk  = async () => { setSaving(true); await supabase.from('grocery_api_config').upsert({ provider: 'flipkart', access_key: fk.app_id, app_token: fk.app_token, is_active: !!(fk.app_id && fk.app_token), updated_at: new Date().toISOString() }, { onConflict: 'provider' }); setSaving(false); load(); showToast('Flipkart config saved ✓'); };

  const filteredHist = history.filter(h => (!hf.item_id || h.item_id === hf.item_id) && (!hf.platform || h.platform === hf.platform));
  const lowStock     = items.filter(i => (i.stock_pct ?? 100) < (i.low_threshold ?? 33));

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280', fontSize: 14 }}>Loading Smart Grocery...</div>;

  return (
    <div style={{ fontFamily: "'Outfit',sans-serif", background: '#f3f4f6', minHeight: '100vh', paddingBottom: '5rem' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: '#1f2937', color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, zIndex: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '52px 16px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>🛒 Smart Grocery</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>
              {items.length} items ·{' '}
              <span style={{ color: lowStock.length > 0 ? '#d97706' : '#15803d', fontWeight: 600 }}>
                {lowStock.length} low stock
              </span>
            </div>
          </div>
          <button onClick={compareAll} style={btnS}>⚡ Compare</button>
        </div>

        {/* Refresh button */}
        <button
          onClick={refreshFromPantry}
          disabled={refreshing}
          style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #d1d5db', background: refreshing ? '#f3f4f6' : '#fff', color: refreshing ? '#9ca3af' : '#374151', fontSize: 13, fontWeight: 600, cursor: refreshing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
          {refreshing ? 'Syncing from Pantry...' : 'Refresh from Pantry — pull low stock items'}
        </button>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div style={{ margin: '12px 16px 0', padding: '12px 14px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, fontSize: 13, color: '#92400e', fontWeight: 500 }}>
          ⚠️ <strong>{lowStock.length} items low:</strong> {lowStock.map(i => i.name).join(', ')}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '10px 16px', gap: 6, background: '#fff', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', border: 'none', background: tab === i ? '#7c3aed' : '#ede9fe', color: tab === i ? '#fff' : '#7c3aed', fontFamily: 'inherit' }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: '14px 16px 0' }}>

        {/* ── TAB 0: Shopping List ── */}
        {tab === 0 && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} placeholder="Item name (e.g. Amul Milk)" style={{ ...inp, flex: 1, minWidth: 140 }} />
              <input value={newBrand} onChange={e => setNewBrand(e.target.value)} placeholder="Brand" style={{ ...inp, width: 100 }} />
              <button onClick={addItem} style={btnS}>+ Add</button>
            </div>

            {items.length === 0 && (
              <div style={empty}>
                No items yet.<br />
                Tap <strong>Refresh from Pantry</strong> to auto-import low stock items,<br />or add items manually above.
              </div>
            )}

            {/* Low stock section */}
            {lowStock.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <span style={lbl}>🔴 Needs restocking ({lowStock.length})</span>
                {lowStock.map(item => <ItemRow key={item.id} item={item} onRemove={removeItem} onStock={updateStock} />)}
              </div>
            )}

            {/* Rest of items */}
            {items.filter(i => (i.stock_pct ?? 100) >= (i.low_threshold ?? 33)).length > 0 && (
              <div>
                <span style={lbl}>✅ Well stocked ({items.filter(i => (i.stock_pct ?? 100) >= (i.low_threshold ?? 33)).length})</span>
                {items.filter(i => (i.stock_pct ?? 100) >= (i.low_threshold ?? 33)).map(item => <ItemRow key={item.id} item={item} onRemove={removeItem} onStock={updateStock} />)}
              </div>
            )}
          </>
        )}

        {/* ── TAB 1: Compare Prices ── */}
        {tab === 1 && (
          <>
            {comparing && <div style={empty}>⚡ Checking prices across all platforms...</div>}
            {!comparing && !results && (
              <div style={empty}>
                <div style={{ marginBottom: 14 }}>Tap Compare to check prices across all platforms</div>
                <button onClick={compareAll} style={btnS}>⚡ Compare now</button>
              </div>
            )}
            {!comparing && results && (
              <>
                {results.scored.length > 0 ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                      {[
                        { l: 'Cheapest',   v: PLATFORMS[results.scored[0]?.slug]?.label || '—' },
                        { l: 'Max saving', v: fmt((results.scored[results.scored.length-1]?.total||0) - (results.scored[0]?.total||0)) },
                        { l: 'Items',      v: results.itemNames.length },
                      ].map(s => (
                        <div key={s.l} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{s.v}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                    {results.scored.map((r, i) => (
                      <div key={r.slug} style={{ ...card, borderColor: i === 0 ? '#16a34a' : '#e5e7eb', borderWidth: i === 0 ? 2 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <Badge slug={r.slug} />
                          {i === 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>Best price</span>}
                          <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 16, color: '#111827' }}>{fmt(r.total)}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                          {[{ l: 'basket', v: fmt(r.basket) }, { l: 'delivery', v: r.delivery > 0 ? fmt(r.delivery) : 'Free' }].map(s => (
                            <div key={s.l} style={{ background: '#f3f4f6', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.v}</div>
                              <div style={{ fontSize: 11, color: '#6b7280' }}>{s.l}</div>
                            </div>
                          ))}
                        </div>
                        <a href={PLATFORMS[r.slug]?.link + encodeURIComponent(results.itemNames.join(' '))} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 9, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#7c3aed', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                          Open {PLATFORMS[r.slug]?.label} ↗
                        </a>
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={empty}>No price data yet.<br />Log prices in the <strong>Price History</strong> tab first.</div>
                )}
                <div style={{ marginTop: 16 }}>
                  <span style={lbl}>Open &amp; shop directly</span>
                  {results.deepLinks.map(dl => (
                    <a key={dl.slug} href={dl.url} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', textDecoration: 'none', marginBottom: 8 }}>
                      <Badge slug={dl.slug} />
                      <span style={{ marginLeft: 'auto', color: '#7c3aed', fontSize: 13, fontWeight: 600 }}>Open ↗</span>
                    </a>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── TAB 2: Price History ── */}
        {tab === 2 && (
          <>
            <div style={card}>
              <span style={lbl}>Log a price</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select style={{ ...sel, flex: 1, minWidth: 120 }} value={pf.item_id} onChange={e => setPf(p => ({ ...p, item_id: e.target.value }))}>
                  <option value="">Select item</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <select style={{ ...sel, minWidth: 110 }} value={pf.platform} onChange={e => setPf(p => ({ ...p, platform: e.target.value }))}>
                  {Object.entries(PLATFORMS).map(([slug, p]) => <option key={slug} value={slug}>{p.label}</option>)}
                </select>
                <input style={{ ...inp, width: 85 }} type="number" placeholder="₹ price" value={pf.price} onChange={e => setPf(p => ({ ...p, price: e.target.value }))} />
                <input style={{ ...inp, width: 85 }} type="number" placeholder="Del ₹" value={pf.delivery_fee} onChange={e => setPf(p => ({ ...p, delivery_fee: e.target.value }))} />
                <button onClick={logPrice} style={btnS}>Log</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select style={{ ...sel, flex: 1 }} value={hf.item_id} onChange={e => setHf(f => ({ ...f, item_id: e.target.value }))}>
                <option value="">All items</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <select style={{ ...sel, flex: 1 }} value={hf.platform} onChange={e => setHf(f => ({ ...f, platform: e.target.value }))}>
                <option value="">All platforms</option>
                {Object.entries(PLATFORMS).map(([slug, p]) => <option key={slug} value={slug}>{p.label}</option>)}
              </select>
            </div>
            {filteredHist.length === 0
              ? <div style={empty}>No price logs yet.<br />Log prices above — even once a week builds great history.</div>
              : filteredHist.slice(0, 100).map(h => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{h.item_name}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{new Date(h.logged_at).toLocaleDateString('en-IN')}</div>
                  </div>
                  <Badge slug={h.platform} />
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginLeft: 8 }}>{fmt(h.price)}</div>
                </div>
              ))
            }
          </>
        )}

        {/* ── TAB 3: Settings ── */}
        {tab === 3 && (
          <>
            <div style={card}>
              <span style={lbl}>Amazon PA API</span>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 12, lineHeight: 1.5 }}>
                Real-time prices for packaged goods. Register at{' '}
                <a href="https://affiliate-program.amazon.in" target="_blank" rel="noreferrer" style={{ color: '#7c3aed' }}>affiliate-program.amazon.in</a>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input style={inp} placeholder="Access Key" value={amz.access_key} onChange={e => setAmz(c => ({ ...c, access_key: e.target.value }))} />
                <input style={inp} type="password" placeholder="Secret Key" value={amz.secret_key} onChange={e => setAmz(c => ({ ...c, secret_key: e.target.value }))} />
                <input style={inp} placeholder="Partner Tag (e.g. rootsdental-21)" value={amz.partner_tag} onChange={e => setAmz(c => ({ ...c, partner_tag: e.target.value }))} />
                <button onClick={saveAmz} disabled={saving} style={btnS}>{saving ? 'Saving...' : 'Save Amazon config'}</button>
              </div>
              {apiCfg.amazon?.is_active && <div style={{ fontSize: 13, color: '#15803d', marginTop: 10, fontWeight: 700 }}>✓ Amazon API active</div>}
            </div>
            <div style={{ ...card, marginTop: 12 }}>
              <span style={lbl}>Flipkart Affiliate API</span>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 12, lineHeight: 1.5 }}>
                Grocery catalogue + pricing. Register at{' '}
                <a href="https://affiliate.flipkart.com" target="_blank" rel="noreferrer" style={{ color: '#7c3aed' }}>affiliate.flipkart.com</a>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input style={inp} placeholder="App ID" value={fk.app_id} onChange={e => setFk(c => ({ ...c, app_id: e.target.value }))} />
                <input style={inp} type="password" placeholder="App Token" value={fk.app_token} onChange={e => setFk(c => ({ ...c, app_token: e.target.value }))} />
                <button onClick={saveFk} disabled={saving} style={btnS}>{saving ? 'Saving...' : 'Save Flipkart config'}</button>
              </div>
              {apiCfg.flipkart?.is_active && <div style={{ fontSize: 13, color: '#15803d', marginTop: 10, fontWeight: 700 }}>✓ Flipkart API active</div>}
            </div>
            <div style={{ marginTop: 12, padding: '12px 14px', background: '#ede9fe', borderRadius: 10, border: '1px solid #c4b5fd' }}>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                💡 API keys stored in Supabase. Price fetching via serverless functions at{' '}
                <code style={{ background: '#e5e7eb', padding: '1px 5px', borderRadius: 4, fontSize: 12, color: '#111827' }}>/api/amazon-price</code> and{' '}
                <code style={{ background: '#e5e7eb', padding: '1px 5px', borderRadius: 4, fontSize: 12, color: '#111827' }}>/api/flipkart-price</code>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ── Item Row Component ────────────────────────────────────────────────────────
function ItemRow({ item, onRemove, onStock }) {
  const pct = item.stock_pct ?? 100;
  const lt  = item.low_threshold ?? 33;
  const stockColor = pct < lt ? '#b91c1c' : pct < lt * 2 ? '#d97706' : '#15803d';
  const stockBg    = pct < lt ? '#fee2e2' : pct < lt * 2 ? '#fef3c7' : '#dcfce7';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 8, background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: stockColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
          {item.name}
          {item.auto_added && <span style={{ marginLeft: 6, fontSize: 10, padding: '2px 7px', borderRadius: 20, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>pantry</span>}
        </div>
        {item.brand && item.brand !== 'Any' && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{item.brand}</div>}
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{item.quantity} {item.unit} · {item.category}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: stockColor, background: stockBg, padding: '2px 9px', borderRadius: 20 }}>{pct}%</span>
        <input type="range" min={0} max={100} step={5} value={pct} onChange={e => onStock(item.id, parseInt(e.target.value))} style={{ width: 80, accentColor: '#7c3aed', cursor: 'pointer' }} />
      </div>
      <button onClick={() => onRemove(item.id)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #fca5a5', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
    </div>
  );
}
