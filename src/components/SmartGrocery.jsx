import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://ihuuxhvxsbmzydclmbtx.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlodXV4aHZ4c2JtenlkY2xtYnR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzAzNjgsImV4cCI6MjA5NTkwNjM2OH0.RSY5SkQvmQgiz0u62Re1k6-AYYZ16trlFCiDULHsQaw"
);

const PLATFORMS = {
  blinkit:   { label: 'Blinkit',      bg: '#F5D90A', color: '#111', link: 'https://blinkit.com/s/?q=' },
  instamart: { label: 'Instamart',    bg: '#FF6600', color: '#fff', link: 'https://www.swiggy.com/instamart/search?query=' },
  zepto:     { label: 'Zepto',        bg: '#7B2FBE', color: '#fff', link: 'https://www.zeptonow.com/search?query=' },
  bigbasket: { label: 'BigBasket',    bg: '#4a8c00', color: '#fff', link: 'https://www.bigbasket.com/ps/?q=' },
  amazon:    { label: 'Amazon Fresh', bg: '#c45000', color: '#fff', link: 'https://www.amazon.in/s?k=' },
  flipkart:  { label: 'Flipkart',     bg: '#1a5ec7', color: '#fff', link: 'https://www.flipkart.com/search?q=' },
};

const C = {
  pageBg:    '#f3f4f6',
  cardBg:    '#ffffff',
  border:    '#e5e7eb',
  text1:     '#111827',
  text2:     '#374151',
  text3:     '#6b7280',
  accent:    '#7c3aed',
  accentBg:  '#ede9fe',
  green:     '#15803d',
  greenBg:   '#dcfce7',
  amber:     '#92400e',
  amberBg:   '#fef3c7',
  red:       '#b91c1c',
  redBg:     '#fee2e2',
  inputBg:   '#ffffff',
  inputBdr:  '#d1d5db',
};

const fmt = n => '₹' + Number(n).toLocaleString('en-IN');

const Badge = ({ slug }) => {
  const p = PLATFORMS[slug];
  if (!p) return null;
  return <span style={{ background: p.bg, color: p.color, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>{p.label}</span>;
};

const StockDot = ({ pct }) => {
  const color = pct < 25 ? C.red : pct < 50 ? '#d97706' : C.green;
  return <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />;
};

const inp = { padding: '10px 13px', borderRadius: 10, border: `1px solid ${C.inputBdr}`, fontSize: 14, color: C.text1, background: C.inputBg, fontFamily: 'inherit', outline: 'none', width: '100%' };
const sel = { ...inp, cursor: 'pointer' };
const btn = { padding: '10px 18px', borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const card = { background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px', marginBottom: 10 };
const label = { fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 };
const emptyBox = { textAlign: 'center', padding: '3rem 1rem', color: C.text3, fontSize: 14, lineHeight: 1.7 };

const TABS = ['Shopping List', 'Compare Prices', 'Price History', 'Settings'];

export default function SmartGrocery({ familyId }) {
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [apiCfg, setApiCfg] = useState({});
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [results, setResults] = useState(null);
  const [newName, setNewName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [pf, setPf] = useState({ item_id: '', platform: 'blinkit', price: '', delivery_fee: '' });
  const [hf, setHf] = useState({ item_id: '', platform: '' });
  const [amz, setAmz] = useState({ access_key: '', secret_key: '', partner_tag: '' });
  const [fk, setFk] = useState({ app_id: '', app_token: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: itms }, { data: hist }, { data: cfg }] = await Promise.all([
      supabase.from('grocery_items').select('*').eq('is_active', true).order('name').limit(500),
      supabase.from('grocery_price_history').select('*').order('logged_at', { ascending: false }).limit(200),
      supabase.from('grocery_api_config').select('*'),
    ]);
    setItems(itms || []);
    setHistory(hist || []);
    const m = {};
    (cfg || []).forEach(c => { m[c.provider] = c; });
    setApiCfg(m);
    if (m.amazon) setAmz({ access_key: m.amazon.access_key || '', secret_key: m.amazon.secret_key || '', partner_tag: m.amazon.partner_tag || '' });
    if (m.flipkart) setFk({ app_id: m.flipkart.access_key || '', app_token: m.flipkart.app_token || '' });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addItem = async () => {
    if (!newName.trim()) return;
    await supabase.from('grocery_items').insert({ name: newName.trim(), brand: newBrand.trim() || null, quantity: '1', unit: 'pc', category: 'general', stock_pct: 100, is_active: true });
    setNewName(''); setNewBrand(''); load(); showToast('Item added ✓');
  };

  const removeItem = async id => {
    await supabase.from('grocery_items').update({ is_active: false }).eq('id', id);
    load();
  };

  const updateStock = async (id, pct) => {
    await supabase.from('grocery_items').update({ stock_pct: pct }).eq('id', id);
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
  const saveFk = async () => { setSaving(true); await supabase.from('grocery_api_config').upsert({ provider: 'flipkart', access_key: fk.app_id, app_token: fk.app_token, is_active: !!(fk.app_id && fk.app_token), updated_at: new Date().toISOString() }, { onConflict: 'provider' }); setSaving(false); load(); showToast('Flipkart config saved ✓'); };

  const filteredHist = history.filter(h => (!hf.item_id || h.item_id === hf.item_id) && (!hf.platform || h.platform === hf.platform));
  const lowStock = items.filter(i => (i.stock_pct ?? 100) < (i.low_threshold ?? 25));

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: C.text3, fontSize: 14 }}>Loading Smart Grocery...</div>;

  return (
    <div style={{ fontFamily: "'Outfit',sans-serif", background: C.pageBg, minHeight: '100vh', paddingBottom: '5rem' }}>

      {toast && <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: '#1f2937', color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, zIndex: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>{toast}</div>}

      {/* Header */}
      <div style={{ background: C.cardBg, borderBottom: `1px solid ${C.border}`, padding: '52px 18px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text1 }}>🛒 Smart Grocery</div>
          <div style={{ fontSize: 13, color: C.text3, marginTop: 3 }}>
            {items.length} items · <span style={{ color: lowStock.length > 0 ? '#d97706' : C.green, fontWeight: 600 }}>{lowStock.length} low stock</span>
          </div>
        </div>
        <button onClick={compareAll} style={btn}>⚡ Compare</button>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div style={{ margin: '12px 16px 0', padding: '10px 14px', background: C.amberBg, border: `1px solid #fcd34d`, borderRadius: 10, fontSize: 13, color: C.amber, fontWeight: 500 }}>
          ⚠️ Low stock: {lowStock.map(i => i.name).join(', ')}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '10px 16px', gap: 6, background: C.cardBg, borderBottom: `1px solid ${C.border}`, overflowX: 'auto' }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', border: 'none', background: tab === i ? C.accent : C.accentBg, color: tab === i ? '#fff' : C.accent, fontFamily: 'inherit' }}>
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
              <input value={newBrand} onChange={e => setNewBrand(e.target.value)} placeholder="Brand" style={{ ...inp, width: 110 }} />
              <button onClick={addItem} style={btn}>+ Add</button>
            </div>

            {items.length === 0 && <div style={emptyBox}>No items yet.<br />Add your first grocery item above.</div>}

            {items.map(item => {
              const pct = item.stock_pct ?? 100;
              const lt = item.low_threshold ?? 25; const stockColor = pct < lt ? C.red : pct < lt * 2 ? '#d97706' : C.green;
              const stockBg = pct < lt ? C.redBg : pct < lt * 2 ? C.amberBg : C.greenBg;
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 8, background: C.cardBg, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <StockDot pct={pct} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text1 }}>
                      {item.name}
                      {item.auto_added && <span style={{ marginLeft: 6, fontSize: 10, padding: '2px 7px', borderRadius: 20, background: C.amberBg, color: C.amber, fontWeight: 700 }}>auto</span>}
                    </div>
                    {item.brand && item.brand !== 'Any' && <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>{item.brand}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: stockColor, background: stockBg, padding: '2px 8px', borderRadius: 20 }}>{pct}%</span>
                    <input type="range" min={0} max={100} step={5} value={pct} onChange={e => updateStock(item.id, parseInt(e.target.value))} style={{ width: 80, accentColor: C.accent, cursor: 'pointer' }} />
                  </div>
                  <button onClick={() => removeItem(item.id)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid #fca5a5`, background: C.redBg, color: C.red, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
                </div>
              );
            })}
          </>
        )}

        {/* ── TAB 1: Compare Prices ── */}
        {tab === 1 && (
          <>
            {comparing && <div style={emptyBox}>⚡ Checking prices across all platforms...</div>}

            {!comparing && !results && (
              <div style={emptyBox}>
                <div style={{ marginBottom: 14 }}>Add items and tap Compare to check all platforms</div>
                <button onClick={compareAll} style={btn}>⚡ Compare now</button>
              </div>
            )}

            {!comparing && results && (
              <>
                {results.scored.length > 0 ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                      {[
                        { l: 'Cheapest', v: PLATFORMS[results.scored[0]?.slug]?.label || '—' },
                        { l: 'Max saving', v: fmt((results.scored[results.scored.length-1]?.total||0) - (results.scored[0]?.total||0)) },
                        { l: 'Items', v: results.itemNames.length },
                      ].map(s => (
                        <div key={s.l} style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>{s.v}</div>
                          <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>{s.l}</div>
                        </div>
                      ))}
                    </div>

                    {results.scored.map((r, i) => (
                      <div key={r.slug} style={{ ...card, borderColor: i === 0 ? '#16a34a' : C.border, borderWidth: i === 0 ? 2 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <Badge slug={r.slug} />
                          {i === 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: C.greenBg, color: C.green, fontWeight: 700 }}>Best price</span>}
                          <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 16, color: C.text1 }}>{fmt(r.total)}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                          <div style={{ background: C.pageBg, borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>{fmt(r.basket)}</div>
                            <div style={{ fontSize: 11, color: C.text3 }}>basket</div>
                          </div>
                          <div style={{ background: C.pageBg, borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>{r.delivery > 0 ? fmt(r.delivery) : 'Free'}</div>
                            <div style={{ fontSize: 11, color: C.text3 }}>delivery</div>
                          </div>
                        </div>
                        <a href={PLATFORMS[r.slug]?.link + encodeURIComponent(results.itemNames.join(' '))} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.pageBg, color: C.accent, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                          Open {PLATFORMS[r.slug]?.label} ↗
                        </a>
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={emptyBox}>No price data yet.<br />Log prices in the <strong>Price History</strong> tab first.</div>
                )}

                <div style={{ marginTop: 16 }}>
                  <div style={label}>Open & shop directly</div>
                  {results.deepLinks.map(dl => (
                    <a key={dl.slug} href={dl.url} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.cardBg, textDecoration: 'none', marginBottom: 8 }}>
                      <Badge slug={dl.slug} />
                      <span style={{ marginLeft: 'auto', color: C.accent, fontSize: 13, fontWeight: 600 }}>Open ↗</span>
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
              <div style={label}>Log a price</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select style={{ ...sel, flex: 1, minWidth: 120 }} value={pf.item_id} onChange={e => setPf(p => ({ ...p, item_id: e.target.value }))}>
                  <option value="">Select item</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <select style={{ ...sel, minWidth: 110 }} value={pf.platform} onChange={e => setPf(p => ({ ...p, platform: e.target.value }))}>
                  {Object.entries(PLATFORMS).map(([slug, p]) => <option key={slug} value={slug}>{p.label}</option>)}
                </select>
                <input style={{ ...inp, width: 90 }} type="number" placeholder="₹ price" value={pf.price} onChange={e => setPf(p => ({ ...p, price: e.target.value }))} />
                <input style={{ ...inp, width: 90 }} type="number" placeholder="Delivery ₹" value={pf.delivery_fee} onChange={e => setPf(p => ({ ...p, delivery_fee: e.target.value }))} />
                <button onClick={logPrice} style={btn}>Log</button>
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
              ? <div style={emptyBox}>No price logs yet.<br />Log prices above — even once a week builds great history.</div>
              : filteredHist.slice(0, 50).map(h => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.cardBg, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>{h.item_name}</div>
                    <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{new Date(h.logged_at).toLocaleDateString('en-IN')}</div>
                  </div>
                  <Badge slug={h.platform} />
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginLeft: 8 }}>{fmt(h.price)}</div>
                </div>
              ))
            }
          </>
        )}

        {/* ── TAB 3: Settings ── */}
        {tab === 3 && (
          <>
            <div style={card}>
              <div style={label}>Amazon PA API</div>
              <p style={{ fontSize: 13, color: C.text2, marginBottom: 12, lineHeight: 1.5 }}>Real-time prices for packaged goods. Register at <a href="https://affiliate-program.amazon.in" target="_blank" rel="noreferrer" style={{ color: C.accent }}>affiliate-program.amazon.in</a></p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input style={inp} placeholder="Access Key" value={amz.access_key} onChange={e => setAmz(c => ({ ...c, access_key: e.target.value }))} />
                <input style={inp} type="password" placeholder="Secret Key" value={amz.secret_key} onChange={e => setAmz(c => ({ ...c, secret_key: e.target.value }))} />
                <input style={inp} placeholder="Partner Tag (e.g. rootsdental-21)" value={amz.partner_tag} onChange={e => setAmz(c => ({ ...c, partner_tag: e.target.value }))} />
                <button onClick={saveAmz} disabled={saving} style={btn}>{saving ? 'Saving...' : 'Save Amazon config'}</button>
              </div>
              {apiCfg.amazon?.is_active && <div style={{ fontSize: 13, color: C.green, marginTop: 10, fontWeight: 700 }}>✓ Amazon API active</div>}
            </div>

            <div style={{ ...card, marginTop: 12 }}>
              <div style={label}>Flipkart Affiliate API</div>
              <p style={{ fontSize: 13, color: C.text2, marginBottom: 12, lineHeight: 1.5 }}>Grocery catalogue + pricing. Register at <a href="https://affiliate.flipkart.com" target="_blank" rel="noreferrer" style={{ color: C.accent }}>affiliate.flipkart.com</a></p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input style={inp} placeholder="App ID" value={fk.app_id} onChange={e => setFk(c => ({ ...c, app_id: e.target.value }))} />
                <input style={inp} type="password" placeholder="App Token" value={fk.app_token} onChange={e => setFk(c => ({ ...c, app_token: e.target.value }))} />
                <button onClick={saveFk} disabled={saving} style={btn}>{saving ? 'Saving...' : 'Save Flipkart config'}</button>
              </div>
              {apiCfg.flipkart?.is_active && <div style={{ fontSize: 13, color: C.green, marginTop: 10, fontWeight: 700 }}>✓ Flipkart API active</div>}
            </div>

            <div style={{ marginTop: 12, padding: '12px 14px', background: C.accentBg, borderRadius: 10, border: `1px solid #c4b5fd` }}>
              <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>
                💡 API keys are stored securely in Supabase. Price fetching uses serverless functions at <code style={{ background: '#e5e7eb', padding: '1px 5px', borderRadius: 4, fontSize: 12, color: C.text1 }}>/api/amazon-price</code> and <code style={{ background: '#e5e7eb', padding: '1px 5px', borderRadius: 4, fontSize: 12, color: C.text1 }}>/api/flipkart-price</code>.
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
