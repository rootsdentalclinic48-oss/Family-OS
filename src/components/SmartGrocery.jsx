import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://ihuuxhvxsbmzydclmbtx.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlodXV4aHZ4c2JtenlkY2xtYnR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzAzNjgsImV4cCI6MjA5NTkwNjM2OH0.RSY5SkQvmQgiz0u62Re1k6-AYYZ16trlFCiDULHsQaw"
);

const PLATFORM_META = {
  blinkit:   { label: 'Blinkit',      color: '#F5D90A', textColor: '#111', link: 'https://blinkit.com/s/?q=' },
  instamart: { label: 'Instamart',    color: '#FF6600', textColor: '#fff', link: 'https://www.swiggy.com/instamart/search?query=' },
  zepto:     { label: 'Zepto',        color: '#9B51E0', textColor: '#fff', link: 'https://www.zeptonow.com/search?query=' },
  bigbasket: { label: 'BigBasket',    color: '#84C225', textColor: '#fff', link: 'https://www.bigbasket.com/ps/?q=' },
  amazon:    { label: 'Amazon Fresh', color: '#FF9900', textColor: '#111', link: 'https://www.amazon.in/s?k=' },
  flipkart:  { label: 'Flipkart',     color: '#2874F0', textColor: '#fff', link: 'https://www.flipkart.com/search?q=' },
};

const T = {
  bg: "#080810", card: "rgba(255,255,255,0.042)", border: "rgba(255,255,255,0.075)",
  text: "#EEECf8", muted: "rgba(238,236,248,0.42)", dim: "rgba(238,236,248,0.2)",
  accent: "#8B7CF8", green: "#34D399", greenSoft: "rgba(52,211,153,0.12)",
  amber: "#FBBF24", amberSoft: "rgba(251,191,36,0.12)",
  red: "#F87171", redSoft: "rgba(248,113,113,0.12)",
};

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

function StockBar({ pct }) {
  const color = pct < 25 ? T.red : pct < 50 ? T.amber : T.green;
  return (
    <div style={{ width: 56, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
    </div>
  );
}

function PlatformBadge({ slug }) {
  const m = PLATFORM_META[slug];
  if (!m) return null;
  return (
    <span style={{ background: m.color, color: m.textColor, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, display: 'inline-block' }}>
      {m.label}
    </span>
  );
}

function buildDeepLinks(itemNames) {
  const query = encodeURIComponent(itemNames.join(' '));
  return Object.entries(PLATFORM_META).map(([slug, m]) => ({ slug, label: m.label, url: m.link + query }));
}

const TABS = ['Shopping List', 'Compare Prices', 'Price History', 'Settings'];

export default function SmartGrocery({ familyId }) {
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [apiConfig, setApiConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [compareResults, setCompareResults] = useState(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemBrand, setNewItemBrand] = useState('');
  const [priceForm, setPriceForm] = useState({ item_id: '', platform: 'blinkit', price: '', delivery_fee: '' });
  const [historyFilter, setHistoryFilter] = useState({ item_id: '', platform: '' });
  const [amazonConfig, setAmazonConfig] = useState({ access_key: '', secret_key: '', partner_tag: '' });
  const [flipkartConfig, setFlipkartConfig] = useState({ app_id: '', app_token: '' });
  const [savingConfig, setSavingConfig] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: itms }, { data: plats }, { data: hist }, { data: cfg }] = await Promise.all([
      supabase.from('grocery_items').select('*').eq('is_active', true).order('name'),
      supabase.from('grocery_platforms').select('*').eq('is_enabled', true).order('display_order'),
      supabase.from('grocery_price_history').select('*').order('logged_at', { ascending: false }).limit(200),
      supabase.from('grocery_api_config').select('*'),
    ]);
    setItems(itms || []);
    setPlatforms(plats || []);
    setPriceHistory(hist || []);
    const cfgMap = {};
    (cfg || []).forEach(c => { cfgMap[c.provider] = c; });
    setApiConfig(cfgMap);
    if (cfgMap.amazon) setAmazonConfig({ access_key: cfgMap.amazon.access_key || '', secret_key: cfgMap.amazon.secret_key || '', partner_tag: cfgMap.amazon.partner_tag || '' });
    if (cfgMap.flipkart) setFlipkartConfig({ app_id: cfgMap.flipkart.access_key || '', app_token: cfgMap.flipkart.app_token || '' });
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addItem = async () => {
    if (!newItemName.trim()) return;
    await supabase.from('grocery_items').insert({ name: newItemName.trim(), brand: newItemBrand.trim() || null, quantity: '1', unit: 'pc', category: 'general', stock_pct: 100, is_active: true });
    setNewItemName(''); setNewItemBrand('');
    fetchAll(); showToast('Item added ✓');
  };

  const removeItem = async (id) => {
    await supabase.from('grocery_items').update({ is_active: false }).eq('id', id);
    fetchAll();
  };

  const updateStock = async (id, pct) => {
    await supabase.from('grocery_items').update({ stock_pct: pct }).eq('id', id);
    setItems(prev => prev.map(it => it.id === id ? { ...it, stock_pct: pct } : it));
  };

  const logPrice = async () => {
    if (!priceForm.item_id || !priceForm.price) { showToast('Select item and enter price'); return; }
    const item = items.find(i => i.id === priceForm.item_id);
    await supabase.from('grocery_price_history').insert({
      item_id: priceForm.item_id, item_name: item?.name || '',
      platform: priceForm.platform, price: parseFloat(priceForm.price),
      delivery_fee: parseFloat(priceForm.delivery_fee) || 0, source: 'manual',
    });
    setPriceForm({ item_id: '', platform: 'blinkit', price: '', delivery_fee: '' });
    fetchAll(); showToast('Price logged ✓');
  };

  const compareAll = async () => {
    setComparing(true); setTab(1);
    const activeItems = items.filter(i => i.stock_pct < 80);
    const itemNames = activeItems.map(i => i.name);
    const results = {};
    Object.keys(PLATFORM_META).forEach(slug => { results[slug] = { slug, totalBasket: 0, deliveryFee: 0, count: 0 }; });
    const seen = {};
    priceHistory.forEach(h => {
      const key = `${h.platform}-${h.item_id}`;
      if (!seen[key] && results[h.platform]) {
        seen[key] = true;
        results[h.platform].totalBasket += parseFloat(h.price);
        results[h.platform].deliveryFee = Math.max(results[h.platform].deliveryFee, h.delivery_fee || 0);
        results[h.platform].count++;
      }
    });
    const deepLinks = buildDeepLinks(itemNames);
    const scored = Object.values(results).filter(r => r.totalBasket > 0)
      .map(r => ({ ...r, total: r.totalBasket + r.deliveryFee }))
      .sort((a, b) => a.total - b.total);
    setCompareResults({ scored, deepLinks, itemNames });
    setComparing(false);
  };

  const saveAmazonConfig = async () => {
    setSavingConfig(true);
    await supabase.from('grocery_api_config').upsert({ provider: 'amazon', access_key: amazonConfig.access_key, secret_key: amazonConfig.secret_key, partner_tag: amazonConfig.partner_tag, is_active: !!(amazonConfig.access_key && amazonConfig.partner_tag), updated_at: new Date().toISOString() }, { onConflict: 'provider' });
    setSavingConfig(false); fetchAll(); showToast('Amazon config saved ✓');
  };

  const saveFlipkartConfig = async () => {
    setSavingConfig(true);
    await supabase.from('grocery_api_config').upsert({ provider: 'flipkart', access_key: flipkartConfig.app_id, app_token: flipkartConfig.app_token, is_active: !!(flipkartConfig.app_id && flipkartConfig.app_token), updated_at: new Date().toISOString() }, { onConflict: 'provider' });
    setSavingConfig(false); fetchAll(); showToast('Flipkart config saved ✓');
  };

  const filteredHistory = priceHistory.filter(h => {
    if (historyFilter.item_id && h.item_id !== historyFilter.item_id) return false;
    if (historyFilter.platform && h.platform !== historyFilter.platform) return false;
    return true;
  });

  const lowStockItems = items.filter(i => i.stock_pct < (i.low_threshold || 25));

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: T.muted, fontSize: 14 }}>
      Loading Smart Grocery...
    </div>
  );

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", color: T.text, paddingBottom: '2rem' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, right: 16, background: '#13131F', border: '1px solid rgba(255,255,255,0.11)', borderRadius: 12, padding: '10px 16px', fontSize: 13, color: T.text, zIndex: 999 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '52px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.4px' }}>🛒 Smart Grocery</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
            {items.length} items · <span style={{ color: lowStockItems.length > 0 ? T.amber : T.green }}>{lowStockItems.length} low stock</span>
          </div>
        </div>
        <button onClick={compareAll} style={{ padding: '8px 16px', borderRadius: 12, border: 'none', background: T.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          ⚡ Compare
        </button>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div style={{ margin: '12px 18px 0', padding: '10px 14px', background: T.amberSoft, border: '1px solid rgba(251,191,36,0.22)', borderRadius: 12, fontSize: 13, color: T.amber }}>
          ⚠️ Low stock: {lowStockItems.map(i => i.name).join(', ')}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '12px 18px 0', gap: 8, overflowX: 'auto' }}>
        {TABS.map((t, i) => (
          <div key={i} onClick={() => setTab(i)} style={{ padding: '7px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', background: tab === i ? T.accent : 'rgba(255,255,255,0.06)', color: tab === i ? '#fff' : T.muted, border: '1px solid ' + (tab === i ? T.accent : T.border) }}>
            {t}
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 18px 0' }}>

        {/* TAB 0: Shopping List */}
        {tab === 0 && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <input value={newItemName} onChange={e => setNewItemName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} placeholder="Item name" style={S.input} />
              <input value={newItemBrand} onChange={e => setNewItemBrand(e.target.value)} placeholder="Brand (optional)" style={{ ...S.input, width: 140 }} />
              <button onClick={addItem} style={S.btnPrimary}>+ Add</button>
            </div>
            {items.length === 0 && <div style={S.empty}>No items yet. Add your first grocery item above.</div>}
            {items.map(item => (
              <div key={item.id} style={S.itemRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#EEECf8' }}>{item.name}
                    {item.auto_added && <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 20, background: T.amberSoft, color: T.amber, fontWeight: 700 }}>auto</span>}
                  </div>
                  {item.brand && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{item.brand}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <StockBar pct={item.stock_pct || 100} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: T.muted }}>{item.stock_pct || 100}%</span>
                    <input type="range" min={0} max={100} step={5} value={item.stock_pct || 100} style={{ width: 60 }} onChange={e => updateStock(item.id, parseInt(e.target.value))} />
                  </div>
                </div>
                <button onClick={() => removeItem(item.id)} style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.3)', background: T.redSoft, color: T.red, cursor: 'pointer', fontSize: 12 }}>✕</button>
              </div>
            ))}
          </>
        )}

        {/* TAB 1: Compare Prices */}
        {tab === 1 && (
          <>
            {comparing && <div style={S.empty}>⚡ Fetching prices across platforms...</div>}
            {!comparing && !compareResults && (
              <div style={S.empty}>
                <div style={{ marginBottom: 12 }}>Add items and tap Compare to check all platforms</div>
                <button onClick={compareAll} style={S.btnPrimary}>⚡ Compare now</button>
              </div>
            )}
            {!comparing && compareResults && (
              <>
                {compareResults.scored.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                    {[
                      { l: 'Cheapest', v: compareResults.scored[0]?.slug },
                      { l: 'Max saving', v: fmt((compareResults.scored[compareResults.scored.length-1]?.total||0) - (compareResults.scored[0]?.total||0)) },
                      { l: 'Items', v: compareResults.itemNames.length },
                    ].map(s => (
                      <div key={s.l} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{s.v}</div>
                        <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                )}
                {compareResults.scored.length > 0 ? compareResults.scored.map((r, i) => (
                  <div key={r.slug} style={{ ...S.card, borderColor: i === 0 ? '#1D9E75' : T.border, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <PlatformBadge slug={r.slug} />
                      {i === 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: T.greenSoft, color: T.green, fontWeight: 700 }}>Best price</span>}
                      <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 15 }}>{fmt(r.total)}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 600 }}>{fmt(r.totalBasket)}</div><div style={{ fontSize: 11, color: T.muted }}>basket</div></div>
                      <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 600 }}>{r.deliveryFee > 0 ? fmt(r.deliveryFee) : 'Free'}</div><div style={{ fontSize: 11, color: T.muted }}>delivery</div></div>
                    </div>
                    <a href={PLATFORM_META[r.slug]?.link + encodeURIComponent(compareResults.itemNames.join(' '))} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 10, border: '1px solid ' + T.border, background: 'rgba(255,255,255,0.03)', color: T.muted, textDecoration: 'none', fontSize: 13 }}>
                      Open {PLATFORM_META[r.slug]?.label} ↗
                    </a>
                  </div>
                )) : (
                  <div style={S.empty}>No price data yet. Log prices in the Price History tab first.</div>
                )}
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Open & shop directly</div>
                  {compareResults.deepLinks.map(dl => (
                    <a key={dl.slug} href={dl.url} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: '1px solid ' + T.border, background: 'rgba(255,255,255,0.03)', textDecoration: 'none', color: T.text, marginBottom: 8, fontSize: 13 }}>
                      <PlatformBadge slug={dl.slug} />
                      <span style={{ marginLeft: 'auto', color: T.muted, fontSize: 12 }}>Open ↗</span>
                    </a>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* TAB 2: Price History */}
        {tab === 2 && (
          <>
            <div style={{ ...S.card, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Log a price</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select style={S.select} value={priceForm.item_id} onChange={e => setPriceForm(p => ({ ...p, item_id: e.target.value }))}>
                  <option value="">Select item</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <select style={S.select} value={priceForm.platform} onChange={e => setPriceForm(p => ({ ...p, platform: e.target.value }))}>
                  {Object.entries(PLATFORM_META).map(([slug, m]) => <option key={slug} value={slug}>{m.label}</option>)}
                </select>
                <input style={{ ...S.input, width: 90 }} type="number" placeholder="₹ price" value={priceForm.price} onChange={e => setPriceForm(p => ({ ...p, price: e.target.value }))} />
                <input style={{ ...S.input, width: 90 }} type="number" placeholder="Delivery ₹" value={priceForm.delivery_fee} onChange={e => setPriceForm(p => ({ ...p, delivery_fee: e.target.value }))} />
                <button onClick={logPrice} style={S.btnPrimary}>Log</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select style={S.select} value={historyFilter.item_id} onChange={e => setHistoryFilter(f => ({ ...f, item_id: e.target.value }))}>
                <option value="">All items</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <select style={S.select} value={historyFilter.platform} onChange={e => setHistoryFilter(f => ({ ...f, platform: e.target.value }))}>
                <option value="">All platforms</option>
                {Object.entries(PLATFORM_META).map(([slug, m]) => <option key={slug} value={slug}>{m.label}</option>)}
              </select>
            </div>
            {filteredHistory.length === 0
              ? <div style={S.empty}>No price logs yet. Start logging above — even once a week builds great history.</div>
              : filteredHistory.slice(0, 50).map(h => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid ' + T.border, fontSize: 13 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{h.item_name}</span>
                    <span style={{ fontSize: 11, color: T.dim, marginLeft: 8 }}>{new Date(h.logged_at).toLocaleDateString('en-IN')}</span>
                  </div>
                  <PlatformBadge slug={h.platform} />
                  <span style={{ fontWeight: 700, marginLeft: 10 }}>{fmt(h.price)}</span>
                </div>
              ))
            }
          </>
        )}

        {/* TAB 3: Settings */}
        {tab === 3 && (
          <>
            <div style={S.card}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Amazon PA API</div>
              <p style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>Real-time prices for packaged goods. Register at affiliate-program.amazon.in</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input style={S.input} placeholder="Access Key" value={amazonConfig.access_key} onChange={e => setAmazonConfig(c => ({ ...c, access_key: e.target.value }))} />
                <input style={S.input} type="password" placeholder="Secret Key" value={amazonConfig.secret_key} onChange={e => setAmazonConfig(c => ({ ...c, secret_key: e.target.value }))} />
                <input style={S.input} placeholder="Partner Tag (e.g. rootsdental-21)" value={amazonConfig.partner_tag} onChange={e => setAmazonConfig(c => ({ ...c, partner_tag: e.target.value }))} />
                <button onClick={saveAmazonConfig} disabled={savingConfig} style={S.btnPrimary}>{savingConfig ? 'Saving...' : 'Save Amazon config'}</button>
              </div>
              {apiConfig.amazon?.is_active && <div style={{ fontSize: 12, color: T.green, marginTop: 8, fontWeight: 600 }}>✓ Amazon API active</div>}
            </div>
            <div style={{ ...S.card, marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Flipkart Affiliate API</div>
              <p style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>Grocery catalogue + pricing. Register at affiliate.flipkart.com</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input style={S.input} placeholder="App ID" value={flipkartConfig.app_id} onChange={e => setFlipkartConfig(c => ({ ...c, app_id: e.target.value }))} />
                <input style={S.input} type="password" placeholder="App Token" value={flipkartConfig.app_token} onChange={e => setFlipkartConfig(c => ({ ...c, app_token: e.target.value }))} />
                <button onClick={saveFlipkartConfig} disabled={savingConfig} style={S.btnPrimary}>{savingConfig ? 'Saving...' : 'Save Flipkart config'}</button>
              </div>
              {apiConfig.flipkart?.is_active && <div style={{ fontSize: 12, color: T.green, marginTop: 8, fontWeight: 600 }}>✓ Flipkart API active</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  input: { background: 'rgba(255,255,255,0.058)', border: '1px solid rgba(255,255,255,0.075)', borderRadius: 12, padding: '8px 12px', color: '#EEECf8', fontSize: 13, fontFamily: 'inherit', flex: 1, minWidth: 100 },
  select: { background: 'rgba(255,255,255,0.058)', border: '1px solid rgba(255,255,255,0.075)', borderRadius: 12, padding: '8px 12px', color: '#EEECf8', fontSize: 13, fontFamily: 'inherit' },
  btnPrimary: { padding: '8px 16px', borderRadius: 12, border: 'none', background: '#8B7CF8', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  card: { background: 'rgba(255,255,255,0.042)', border: '1px solid rgba(255,255,255,0.075)', borderRadius: 16, padding: '14px 16px' },
  itemRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.075)', marginBottom: 8, background: 'rgba(255,255,255,0.06)' },
  empty: { textAlign: 'center', padding: '2rem', color: 'rgba(238,236,248,0.42)', fontSize: 14, lineHeight: 1.7 },
};
