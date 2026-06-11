import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://ihuuxhvxsbmzydclmbtx.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlodXV4aHZ4c2JtenlkY2xtYnR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzAzNjgsImV4cCI6MjA5NTkwNjM2OH0.RSY5SkQvmQgiz0u62Re1k6-AYYZ16trlFCiDULHsQaw"
);

const FAMILY_ID = 'gupta-family-001';

// ── Platform config ───────────────────────────────────────────────────────────
const PLATFORMS = {
  blinkit:   { label: 'Blinkit',      bg: '#e6ac00', link: 'https://blinkit.com/s/?q=',                        eta: '10 min',     delivery: 'Free' },
  instamart: { label: 'Instamart',    bg: '#FF6600', link: 'https://www.swiggy.com/instamart/search?query=',   eta: '15 min',     delivery: '₹29'  },
  zepto:     { label: 'Zepto',        bg: '#7B2FBE', link: 'https://www.zeptonow.com/search?query=',           eta: '12 min',     delivery: 'Free' },
  bigbasket: { label: 'BigBasket',    bg: '#4a8c00', link: 'https://www.bigbasket.com/ps/?q=',                 eta: 'Next morning',delivery: 'Free' },
  amazon:    { label: 'Amazon Fresh', bg: '#c45000', link: 'https://www.amazon.in/s?k=',                       eta: 'Same day',   delivery: 'Free' },
  flipkart:  { label: 'Flipkart',     bg: '#1a5ec7', link: 'https://www.flipkart.com/search?q=',               eta: 'Next day',   delivery: 'Free' },
};

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',        label: 'All Items',         icon: '📦' },
  { id: 'Grains',     label: 'Grains & Cereals',  icon: '🌾' },
  { id: 'Pulses',     label: 'Pulses & Lentils',  icon: '🫘' },
  { id: 'Dairy',      label: 'Dairy',             icon: '🥛' },
  { id: 'Vegetables', label: 'Vegetables',        icon: '🥦' },
  { id: 'Fruits',     label: 'Fruits',            icon: '🍎' },
  { id: 'Oils',       label: 'Oils & Ghee',       icon: '🫙' },
  { id: 'Spices',     label: 'Spices',            icon: '🌶️' },
  { id: 'Beverages',  label: 'Tea & Beverages',   icon: '☕' },
  { id: 'Snacks',     label: 'Bakery & Snacks',   icon: '🍞' },
  { id: 'Frozen',     label: 'Frozen Foods',      icon: '🧊' },
  { id: 'Child',      label: 'Child Essentials',  icon: '👶' },
  { id: 'Household',  label: 'Household Supplies',icon: '🧹' },
  { id: 'Personal',   label: 'Personal Care',     icon: '🧴' },
  { id: 'Other',      label: 'Other',             icon: '🗂️' },
];

const CAT_MAP = {};
CATEGORIES.forEach(c => { CAT_MAP[c.id] = c; });

const getCatIcon = cat => {
  const found = CATEGORIES.find(c => c.id.toLowerCase() === (cat||'').toLowerCase());
  return found ? found.icon : '📦';
};

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  pageBg:   '#f3f4f6', cardBg:  '#ffffff', border:  '#e5e7eb',
  text1:    '#111827', text2:   '#374151', text3:   '#6b7280',
  accent:   '#7c3aed', accentL: '#ede9fe',
  green:    '#15803d', greenL:  '#dcfce7',
  amber:    '#92400e', amberL:  '#fef3c7',
  red:      '#b91c1c', redL:    '#fee2e2',
  blue:     '#1d4ed8', blueL:   '#dbeafe',
};

const fmt = n => '₹' + Number(n).toLocaleString('en-IN');

// ── Stock helpers ─────────────────────────────────────────────────────────────
const stockPct   = item => item.par_level > 0 ? Math.min(100, Math.round((item.quantity / (item.par_level * 3)) * 100)) : 100;
const isLow      = item => item.quantity <= item.par_level * 1.5;
const isOut      = item => item.quantity <= 0;
const daysLeft   = item => {
  if (!item.expiry_date) return null;
  return Math.ceil((new Date(item.expiry_date) - new Date()) / 86400000);
};
const suggestQty = item => {
  const need = Math.max(item.par_level * 4, item.par_level - item.quantity + item.par_level * 3);
  return Math.ceil(need * 10) / 10;
};

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  inp:  { padding: '10px 13px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, color: '#111827', background: '#fff', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' },
  btn:  { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnO: { padding: '9px 16px', borderRadius: 10, border: '1px solid #7c3aed', background: '#fff', color: '#7c3aed', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnG: { padding: '9px 16px', borderRadius: 10, border: 'none', background: '#15803d', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnR: { padding: '8px 14px', borderRadius: 9,  border: 'none', background: '#fee2e2', color: '#b91c1c', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '14px 16px', marginBottom: 10 },
  lbl:  { fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, display: 'block' },
  empty:{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af', fontSize: 14, lineHeight: 1.8 },
};

// ── Badge ─────────────────────────────────────────────────────────────────────
const Badge = ({ slug }) => {
  const p = PLATFORMS[slug]; if (!p) return null;
  return <span style={{ background: p.bg, color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>{p.label}</span>;
};

// ── Stock bar ─────────────────────────────────────────────────────────────────
const StockBar = ({ item }) => {
  const pct = stockPct(item);
  const col = isOut(item) ? '#b91c1c' : isLow(item) ? '#d97706' : '#15803d';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden', minWidth: 50 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 3, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: col, minWidth: 28, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
};

// ── Toast ─────────────────────────────────────────────────────────────────────
const useToast = () => {
  const [toast, setToast] = useState('');
  const show = msg => { setToast(msg); setTimeout(() => setToast(''), 3500); };
  const el = toast ? (
    <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: '#1f2937', color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, zIndex: 1000, whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
      {toast}
    </div>
  ) : null;
  return [show, el];
};

const TABS = [
  { id: 'pantry',  label: '🧺 Pantry'   },
  { id: 'cart',    label: '🛒 Cart'     },
  { id: 'compare', label: '⚡ Compare'  },
  { id: 'history', label: '📋 History'  },
];

// ════════════════════════════════════════════════════════════════════════════
export default function SmartGrocery({ familyId }) {
  const fid = familyId || FAMILY_ID;
  const [tab, setTab]             = useState('pantry');
  const [pantry, setPantry]       = useState([]);
  const [priceLog, setPriceLog]   = useState([]);
  const [mealPlan, setMealPlan]   = useState([]);
  const [recipes, setRecipes]     = useState([]);
  const [recipeIngr, setRecipeIngr] = useState([]);
  const [cart, setCart]           = useState([]);            // [{item, suggestedQty}]
  const [compareRes, setCompareRes] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all'); // all|low|out|expiring
  const [showToast, toastEl]      = useToast();
  const [plogForm, setPlogForm]   = useState({ item_name: '', platform: 'blinkit', price: '', delivery_fee: '' });

  // ── Load all data ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const threeDaysAgo = new Date(Date.now() - 3*86400000).toISOString().split('T')[0];
    const weekLater = new Date(Date.now() + 7*86400000).toISOString().split('T')[0];
    const [{ data: pan }, { data: plog }, { data: mp }, { data: rec }, { data: ri }] = await Promise.all([
      supabase.from('pantry').select('*').eq('family_id', fid).order('category').order('name'),
      supabase.from('grocery_price_history').select('*').order('logged_at', { ascending: false }).limit(500),
      supabase.from('meal_plan').select('*').eq('family_id', fid).gte('plan_date', threeDaysAgo).lte('plan_date', weekLater).eq('cooked', false),
      supabase.from('recipes').select('id,name').eq('family_id', fid),
      supabase.from('recipe_ingredients').select('*'),
    ]);
    setPantry(pan || []);
    setPriceLog(plog || []);
    setMealPlan(mp || []);
    setRecipes(rec || []);
    setRecipeIngr(ri || []);
    setLoading(false);
  }, [fid]);

  useEffect(() => { load(); }, [load]);

  // ── Filtered pantry ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let items = [...pantry];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || (i.category||'').toLowerCase().includes(q));
    }
    if (catFilter !== 'all') items = items.filter(i => (i.category||'').toLowerCase() === catFilter.toLowerCase());
    if (stockFilter === 'low')      items = items.filter(i => isLow(i) && !isOut(i));
    if (stockFilter === 'out')      items = items.filter(i => isOut(i));
    if (stockFilter === 'expiring') items = items.filter(i => { const d = daysLeft(i); return d !== null && d <= 7; });
    return items;
  }, [pantry, search, catFilter, stockFilter]);

  // ── Low stock items ─────────────────────────────────────────────────────────
  const lowStockItems = useMemo(() => pantry.filter(i => isLow(i)), [pantry]);

  // ── Meal plan missing ingredients ───────────────────────────────────────────
  const mealMissing = useMemo(() => {
    const needed = new Set();
    mealPlan.forEach(mp => {
      const ingrs = recipeIngr.filter(ri => ri.recipe_id === mp.recipe_id);
      ingrs.forEach(ri => {
        const pantryItem = pantry.find(p => p.name.toLowerCase() === ri.pantry_item_name.toLowerCase());
        if (!pantryItem || isLow(pantryItem)) needed.add(ri.pantry_item_name);
      });
    });
    return [...needed];
  }, [mealPlan, recipeIngr, pantry]);

  // ── Cart helpers ────────────────────────────────────────────────────────────
  const inCart = item => cart.some(c => c.item.id === item.id);

  const addToCart = item => {
    if (inCart(item)) return;
    setCart(prev => [...prev, { item, qty: suggestQty(item), unit: item.unit }]);
  };

  const removeFromCart = id => setCart(prev => prev.filter(c => c.item.id !== id));

  const addAllLowStock = () => {
    const toAdd = lowStockItems.filter(i => !inCart(i));
    setCart(prev => [...prev, ...toAdd.map(i => ({ item: i, qty: suggestQty(i), unit: i.unit }))]);
    showToast(`✓ ${toAdd.length} low stock items added to cart`);
    setTab('cart');
  };

  const updateCartQty = (id, qty) => setCart(prev => prev.map(c => c.item.id === id ? { ...c, qty } : c));

  // ── Compare prices ──────────────────────────────────────────────────────────
  const compareAll = () => {
    if (!cart.length) { showToast('Add items to cart first'); return; }
    setComparing(true); setTab('compare');
    const cartNames = cart.map(c => c.item.name);
    // Build per-platform totals from price log
    const totals = {};
    Object.keys(PLATFORMS).forEach(slug => { totals[slug] = { basket: 0, count: 0 }; });
    const seen = {};
    priceLog.forEach(h => {
      const key = h.platform + '-' + h.item_name;
      if (!seen[key] && totals[h.platform] && cartNames.some(n => n.toLowerCase() === h.item_name.toLowerCase())) {
        seen[key] = true;
        totals[h.platform].basket += parseFloat(h.price);
        totals[h.platform].count++;
      }
    });
    const scored = Object.entries(totals)
      .filter(([,v]) => v.basket > 0)
      .map(([slug, v]) => ({ slug, basket: v.basket, count: v.count, total: v.basket }))
      .sort((a, b) => a.total - b.total);
    const deepLinks = Object.entries(PLATFORMS).map(([slug, p]) => ({
      slug, label: p.label, eta: p.eta, delivery: p.delivery,
      url: p.link + encodeURIComponent(cartNames.join(' ')),
    }));
    setCompareRes({ scored, deepLinks, cartNames });
    setComparing(false);
  };

  // ── Log price ───────────────────────────────────────────────────────────────
  const logPrice = async () => {
    if (!plogForm.item_name || !plogForm.price) { showToast('Enter item name and price'); return; }
    await supabase.from('grocery_price_history').insert({
      item_name: plogForm.item_name, platform: plogForm.platform,
      price: parseFloat(plogForm.price), delivery_fee: parseFloat(plogForm.delivery_fee) || 0,
      source: 'manual', logged_at: new Date().toISOString(),
    });
    setPlogForm({ item_name: '', platform: 'blinkit', price: '', delivery_fee: '' });
    load(); showToast('Price logged ✓');
  };

  // ── Refresh from pantry ─────────────────────────────────────────────────────
  const refreshLowStock = async () => {
    setRefreshing(true);
    const low = pantry.filter(i => isLow(i));
    const toAdd = low.filter(i => !inCart(i));
    setCart(prev => [...prev, ...toAdd.map(i => ({ item: i, qty: suggestQty(i), unit: i.unit }))]);
    showToast(`✓ ${toAdd.length} low stock items synced to cart`);
    setRefreshing(false);
    setTab('cart');
  };

  // ── Inventory health score ──────────────────────────────────────────────────
  const healthScore = useMemo(() => {
    if (!pantry.length) return 0;
    const ok = pantry.filter(i => !isLow(i) && !isOut(i)).length;
    return Math.round((ok / pantry.length) * 100);
  }, [pantry]);

  const coverageDays = useMemo(() => {
    if (!pantry.length) return 0;
    const well = pantry.filter(i => Number(i.quantity) > Number(i.par_level)).length;
    const low  = pantry.filter(i => isLow(i)).length;
    const out  = pantry.filter(i => isOut(i)).length;
    return Math.min(30, Math.round((well*14 + (pantry.length-well-low-out)*7 + low*3) / pantry.length));
  }, [pantry]);

  if (loading) return (
    <div style={{ padding: '4rem 1rem', textAlign: 'center', color: C.text3, fontSize: 14 }}>
      Loading Smart Grocery...
    </div>
  );

  return (
    <div style={{ fontFamily: "'Outfit',sans-serif", background: C.pageBg, minHeight: '100vh', paddingBottom: '6rem' }}>
      {toastEl}

      {/* ── Header ── */}
      <div style={{ background: C.cardBg, borderBottom: `1px solid ${C.border}`, padding: '52px 16px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text1 }}>🛒 Smart Grocery</div>
            <div style={{ fontSize: 13, color: C.text3, marginTop: 3 }}>
              {pantry.length} pantry items ·{' '}
              <span style={{ color: lowStockItems.length > 0 ? '#d97706' : C.green, fontWeight: 600 }}>
                {lowStockItems.length} low stock
              </span>
              {cart.length > 0 && <> · <span style={{ color: C.accent, fontWeight: 600 }}>{cart.length} in cart</span></>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={refreshLowStock} disabled={refreshing} style={{ ...S.btnO, fontSize: 12, padding: '8px 12px' }}>
              {refreshing ? '⟳' : '🔄'} Sync
            </button>
            <button onClick={() => { addAllLowStock(); }} style={S.btn}>
              🛒 {lowStockItems.length} to cart
            </button>
          </div>
        </div>

        {/* Dashboard strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {[
            { l: 'Health',    v: `${healthScore}%`,       c: healthScore > 70 ? C.green : healthScore > 40 ? '#d97706' : C.red },
            { l: 'Coverage',  v: `${coverageDays}d`,      c: C.blue },
            { l: 'Low stock', v: lowStockItems.length,    c: lowStockItems.length > 0 ? '#d97706' : C.green },
            { l: 'Cart',      v: cart.length,             c: C.accent },
          ].map(s => (
            <div key={s.l} style={{ background: C.pageBg, borderRadius: 10, padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Low stock alert ── */}
      {lowStockItems.length > 0 && (
        <div style={{ margin: '10px 16px 0', padding: '10px 14px', background: C.amberL, border: `1px solid #fcd34d`, borderRadius: 10, fontSize: 13, color: C.amber, fontWeight: 500 }}>
          ⚠️ <strong>{lowStockItems.length} items low:</strong>{' '}
          {lowStockItems.slice(0, 6).map(i => i.name).join(', ')}
          {lowStockItems.length > 6 && ` +${lowStockItems.length - 6} more`}
        </div>
      )}

      {/* ── Meal plan alert ── */}
      {mealMissing.length > 0 && (
        <div style={{ margin: '8px 16px 0', padding: '10px 14px', background: C.blueL, border: `1px solid #93c5fd`, borderRadius: 10, fontSize: 13, color: C.blue, fontWeight: 500 }}>
          🍽️ <strong>This week's meals need:</strong> {mealMissing.slice(0, 5).join(', ')}
          {mealMissing.length > 5 && ` +${mealMissing.length - 5} more`}
          <button onClick={() => {
            const toAdd = pantry.filter(p => mealMissing.some(m => m.toLowerCase() === p.name.toLowerCase()) && !inCart(p));
            setCart(prev => [...prev, ...toAdd.map(i => ({ item: i, qty: suggestQty(i), unit: i.unit }))]);
            showToast(`✓ ${toAdd.length} meal ingredients added to cart`);
            setTab('cart');
          }} style={{ marginLeft: 10, padding: '3px 10px', borderRadius: 8, border: 'none', background: C.blue, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Add all to cart
          </button>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', padding: '10px 16px', gap: 6, background: C.cardBg, borderBottom: `1px solid ${C.border}`, overflowX: 'auto', marginTop: 10 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', border: 'none', background: tab === t.id ? C.accent : C.accentL, color: tab === t.id ? '#fff' : C.accent, fontFamily: 'inherit' }}>
            {t.label}{t.id === 'cart' && cart.length > 0 ? ` (${cart.length})` : ''}
          </button>
        ))}
      </div>

      <div style={{ padding: '14px 16px 0' }}>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: PANTRY
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'pantry' && (
          <>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none' }}>🔍</span>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search pantry... (Rice, Milk, Paneer)"
                style={{ ...S.inp, paddingLeft: 38 }}
              />
            </div>

            {/* Stock filters */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10, paddingBottom: 2 }}>
              {[
                { id: 'all',      label: 'All',           count: pantry.length },
                { id: 'low',      label: '⚠️ Low Stock',   count: pantry.filter(i => isLow(i) && !isOut(i)).length },
                { id: 'out',      label: '🔴 Out of Stock', count: pantry.filter(i => isOut(i)).length },
                { id: 'expiring', label: '⏰ Expiring',    count: pantry.filter(i => { const d = daysLeft(i); return d !== null && d <= 7; }).length },
              ].map(f => (
                <button key={f.id} onClick={() => setStockFilter(f.id)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${stockFilter === f.id ? C.accent : C.border}`, background: stockFilter === f.id ? C.accentL : C.cardBg, color: stockFilter === f.id ? C.accent : C.text2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  {f.label} <span style={{ background: stockFilter === f.id ? C.accent : C.pageBg, color: stockFilter === f.id ? '#fff' : C.text3, borderRadius: 20, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>{f.count}</span>
                </button>
              ))}
            </div>

            {/* Category chips */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 2 }}>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setCatFilter(cat.id)} style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${catFilter === cat.id ? C.accent : C.border}`, background: catFilter === cat.id ? C.accent : C.cardBg, color: catFilter === cat.id ? '#fff' : C.text2, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  {cat.icon} {cat.id === 'all' ? 'All' : cat.label}
                </button>
              ))}
            </div>

            {/* Results count */}
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 8, fontWeight: 600 }}>
              Showing {filtered.length} of {pantry.length} items
              {(search || catFilter !== 'all' || stockFilter !== 'all') && (
                <button onClick={() => { setSearch(''); setCatFilter('all'); setStockFilter('all'); }} style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, border: 'none', background: C.redL, color: C.red, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Clear filters</button>
              )}
            </div>

            {filtered.length === 0 && <div style={S.empty}>No items found.<br />Try a different search or filter.</div>}

            {/* Item list */}
            {filtered.map(item => {
              const low  = isLow(item);
              const out  = isOut(item);
              const days = daysLeft(item);
              const expSoon = days !== null && days <= 7;
              const cartAdded = inCart(item);
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `1px solid ${out ? '#fca5a5' : low ? '#fcd34d' : C.border}`, marginBottom: 8, background: out ? '#fff5f5' : low ? '#fffbeb' : C.cardBg, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: 20, flexShrink: 0 }}>{getCatIcon(item.category)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.text1 }}>{item.name}</span>
                      {out  && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: C.redL,   color: C.red,   fontWeight: 700 }}>Out of stock</span>}
                      {!out && low  && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: C.amberL, color: C.amber, fontWeight: 700 }}>Low stock</span>}
                      {expSoon && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: C.redL, color: C.red, fontWeight: 700 }}>Exp {days}d</span>}
                      {cartAdded && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: C.accentL, color: C.accent, fontWeight: 700 }}>In cart</span>}
                    </div>
                    <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>
                      <strong style={{ color: C.text2 }}>{item.quantity} {item.unit}</strong> · par: {item.par_level} {item.unit} · {item.category}
                    </div>
                    <div style={{ marginTop: 6 }}><StockBar item={item} /></div>
                  </div>
                  <button
                    onClick={() => cartAdded ? removeFromCart(item.id) : addToCart(item)}
                    style={{ padding: '7px 11px', borderRadius: 9, border: `1px solid ${cartAdded ? '#fca5a5' : C.accent}`, background: cartAdded ? C.redL : C.accentL, color: cartAdded ? C.red : C.accent, fontSize: 20, cursor: 'pointer', flexShrink: 0 }}>
                    {cartAdded ? '✕' : '+'}
                  </button>
                </div>
              );
            })}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: CART
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'cart' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <button onClick={addAllLowStock} style={S.btnG}>+ Add all {lowStockItems.length} low stock</button>
              {cart.length > 0 && <button onClick={() => setCart([])} style={S.btnR}>Clear cart</button>}
              {cart.length > 0 && <button onClick={compareAll} style={S.btn}>⚡ Compare prices</button>}
            </div>

            {cart.length === 0 ? (
              <div style={S.empty}>
                Cart is empty.<br />
                Tap <strong>+ Add all low stock</strong> to auto-fill,<br />
                or add items from the Pantry tab.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: C.text3, marginBottom: 10, fontWeight: 600 }}>{cart.length} items · Suggested quantities based on usage</div>
                {cart.map(c => (
                  <div key={c.item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 8, background: C.cardBg }}>
                    <div style={{ fontSize: 20 }}>{getCatIcon(c.item.category)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.text1 }}>{c.item.name}</div>
                      <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>
                        Have: {c.item.quantity} {c.item.unit} · Par: {c.item.par_level} {c.item.unit}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number" value={c.qty} min={0} step={0.5}
                        onChange={e => updateCartQty(c.item.id, parseFloat(e.target.value))}
                        style={{ width: 65, padding: '6px 8px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.text1, background: '#fff', fontFamily: 'inherit', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: 12, color: C.text3 }}>{c.unit}</span>
                    </div>
                    <button onClick={() => removeFromCart(c.item.id)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid #fca5a5`, background: C.redL, color: C.red, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
                  </div>
                ))}

                {/* Cart summary */}
                <div style={{ ...S.card, marginTop: 6, background: C.accentL, borderColor: '#c4b5fd' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>Cart Summary</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.text1 }}>{cart.length}</div>
                      <div style={{ fontSize: 11, color: C.text3 }}>items</div>
                    </div>
                    <div style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>Ready</div>
                      <div style={{ fontSize: 11, color: C.text3 }}>to compare</div>
                    </div>
                  </div>
                  <button onClick={compareAll} style={{ ...S.btn, width: '100%', marginTop: 10, padding: '12px' }}>
                    ⚡ Compare prices across all platforms
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: COMPARE
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'compare' && (
          <>
            {comparing && <div style={S.empty}>⚡ Checking prices across all platforms...</div>}

            {!comparing && !compareRes && (
              <div style={S.empty}>
                Add items to cart, then tap Compare.<br />
                <button onClick={() => setTab('cart')} style={{ ...S.btn, marginTop: 12 }}>Go to Cart</button>
              </div>
            )}

            {!comparing && compareRes && (
              <>
                {/* Recommendation cards */}
                {compareRes.scored.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                    {[
                      { l: '🏆 Cheapest',   v: PLATFORMS[compareRes.scored[0]?.slug]?.label || '—',              bg: C.greenL, c: C.green },
                      { l: '⚡ Fastest',    v: PLATFORMS['blinkit'].label,                                        bg: C.amberL, c: C.amber },
                      { l: '⭐ Best value', v: PLATFORMS[compareRes.scored[Math.floor(compareRes.scored.length/2)]?.slug]?.label || '—', bg: C.blueL, c: C.blue },
                    ].map(s => (
                      <div key={s.l} style={{ background: s.bg, borderRadius: 10, padding: '10px 8px', textAlign: 'center', border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: s.c }}>{s.v}</div>
                        <div style={{ fontSize: 10, color: C.text3, marginTop: 3 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Savings alert */}
                {compareRes.scored.length >= 2 && (
                  <div style={{ padding: '10px 14px', background: C.greenL, border: `1px solid #86efac`, borderRadius: 10, fontSize: 13, color: C.green, fontWeight: 600, marginBottom: 12 }}>
                    💰 Buy from <strong>{PLATFORMS[compareRes.scored[0].slug]?.label}</strong> and save{' '}
                    <strong>{fmt(compareRes.scored[compareRes.scored.length-1].total - compareRes.scored[0].total)}</strong>{' '}
                    vs {PLATFORMS[compareRes.scored[compareRes.scored.length-1].slug]?.label}
                  </div>
                )}

                {/* Platform cards from price log */}
                {compareRes.scored.length > 0 ? (
                  compareRes.scored.map((r, i) => (
                    <div key={r.slug} style={{ ...S.card, borderColor: i === 0 ? '#16a34a' : C.border, borderWidth: i === 0 ? 2 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <Badge slug={r.slug} />
                        {i === 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: C.greenL, color: C.green, fontWeight: 700 }}>Best price</span>}
                        <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 16, color: C.text1 }}>{fmt(r.total)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.text3, marginBottom: 10 }}>{r.count} of {compareRes.cartNames.length} items have logged prices</div>
                      <a href={PLATFORMS[r.slug]?.link + encodeURIComponent(compareRes.cartNames.join(' '))} target="_blank" rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.pageBg, color: C.accent, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                        Open {PLATFORMS[r.slug]?.label} ↗
                      </a>
                    </div>
                  ))
                ) : (
                  <div style={{ ...S.card, background: C.amberL, borderColor: '#fcd34d' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.amber, marginBottom: 6 }}>No price data yet</div>
                    <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>
                      You haven't logged prices for these items yet. Use the <strong>History</strong> tab to log prices manually. Even one week of logging gives great comparisons.
                    </div>
                  </div>
                )}

                {/* Deep links — always show */}
                <div style={{ marginTop: 14 }}>
                  <span style={S.lbl}>Open &amp; shop directly — all platforms</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {compareRes.deepLinks.map(dl => (
                      <a key={dl.slug} href={dl.url} target="_blank" rel="noreferrer"
                        style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.cardBg, textDecoration: 'none' }}>
                        <Badge slug={dl.slug} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ fontSize: 11, color: C.text3 }}>⏱ {dl.eta}</span>
                          <span style={{ fontSize: 11, color: C.text3 }}>🚚 {dl.delivery}</span>
                        </div>
                        <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>Open ↗</span>
                      </a>
                    ))}
                  </div>
                </div>

                {/* Price log status + refresh */}
                {(()=>{
                  const logged = compareRes.cartNames.filter(name => priceLog.some(h => h.item_name?.toLowerCase() === name.toLowerCase()));
                  const missing = compareRes.cartNames.filter(name => !priceLog.some(h => h.item_name?.toLowerCase() === name.toLowerCase()));
                  return (
                    <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:12, padding:'12px 14px', marginTop:14, marginBottom:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#0369a1', marginBottom:8 }}>📊 Price Log Status</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                        <div style={{ background:'#dcfce7', borderRadius:8, padding:'8px', textAlign:'center' }}>
                          <div style={{ fontSize:18, fontWeight:800, color:'#15803d' }}>{logged.length}</div>
                          <div style={{ fontSize:11, color:'#6b7280' }}>prices logged</div>
                        </div>
                        <div style={{ background:'#fee2e2', borderRadius:8, padding:'8px', textAlign:'center' }}>
                          <div style={{ fontSize:18, fontWeight:800, color:'#b91c1c' }}>{missing.length}</div>
                          <div style={{ fontSize:11, color:'#6b7280' }}>no price data</div>
                        </div>
                      </div>
                      {missing.length > 0 && (
                        <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.7, marginBottom:10 }}>
                          <strong style={{ color:'#b91c1c' }}>Missing:</strong> {missing.slice(0,6).join(', ')}{missing.length>6 ? ` +${missing.length-6} more` : ''}
                          <div style={{ fontSize:11, marginTop:4 }}>💡 AI tab → Import Bill → Log Prices Only</div>
                        </div>
                      )}
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={async()=>{ await load(); showToast('Refreshed ✓'); }}
                          style={{ flex:1, padding:'9px', borderRadius:9, border:'1px solid #7c3aed', background:'#fff', color:'#7c3aed', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                          🔄 Refresh
                        </button>
                        <button onClick={compareAll}
                          style={{ flex:2, padding:'9px', borderRadius:9, border:'none', background:'#7c3aed', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                          ⚡ Re-compare
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {/* Log price form */}
                <div style={{ ...S.card, marginTop: 16 }}>
                  <span style={S.lbl}>Log a price to improve comparisons</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input style={{ ...S.inp, flex: 1, minWidth: 120 }} placeholder="Item name" value={plogForm.item_name} onChange={e => setPlogForm(p => ({ ...p, item_name: e.target.value }))} />
                    <select style={{ ...S.inp, width: 130 }} value={plogForm.platform} onChange={e => setPlogForm(p => ({ ...p, platform: e.target.value }))}>
                      {Object.entries(PLATFORMS).map(([slug, p]) => <option key={slug} value={slug}>{p.label}</option>)}
                    </select>
                    <input style={{ ...S.inp, width: 80 }} type="number" placeholder="₹" value={plogForm.price} onChange={e => setPlogForm(p => ({ ...p, price: e.target.value }))} />
                    <input style={{ ...S.inp, width: 80 }} type="number" placeholder="Del ₹" value={plogForm.delivery_fee} onChange={e => setPlogForm(p => ({ ...p, delivery_fee: e.target.value }))} />
                    <button onClick={logPrice} style={S.btn}>Log</button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: HISTORY
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'history' && (
          <>
            <div style={S.card}>
              <span style={S.lbl}>Log a price</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input style={{ ...S.inp, flex: 1, minWidth: 120 }} placeholder="Item name (e.g. Amul Milk)" value={plogForm.item_name} onChange={e => setPlogForm(p => ({ ...p, item_name: e.target.value }))} />
                <select style={{ ...S.inp, width: 130 }} value={plogForm.platform} onChange={e => setPlogForm(p => ({ ...p, platform: e.target.value }))}>
                  {Object.entries(PLATFORMS).map(([slug, p]) => <option key={slug} value={slug}>{p.label}</option>)}
                </select>
                <input style={{ ...S.inp, width: 80 }} type="number" placeholder="₹ price" value={plogForm.price} onChange={e => setPlogForm(p => ({ ...p, price: e.target.value }))} />
                <input style={{ ...S.inp, width: 80 }} type="number" placeholder="Del ₹" value={plogForm.delivery_fee} onChange={e => setPlogForm(p => ({ ...p, delivery_fee: e.target.value }))} />
                <button onClick={logPrice} style={S.btn}>Log</button>
              </div>
            </div>

            {priceLog.length === 0 ? (
              <div style={S.empty}>No price logs yet.<br />Start logging above — even once a week builds powerful comparisons.</div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: C.text3, marginBottom: 10, fontWeight: 600 }}>{priceLog.length} price logs</div>
                 {priceLog.slice(0, 100).map(h => (
                   <PriceLogRow key={h.id} h={h}
                     onDelete={async(id)=>{ await supabase.from('grocery_price_history').delete().eq('id',id); load(); showToast('Deleted ✓'); }}
                     onEdit={async(id,newPrice)=>{ await supabase.from('grocery_price_history').update({price:parseFloat(newPrice)}).eq('id',id); load(); showToast('Updated ✓'); }}
                   />
                 ))}
              </>
            )}
          </>
        )}

      </div>

      {/* ── Sticky bottom bar when cart has items ── */}
      {cart.length > 0 && tab !== 'compare' && (
        <div style={{ position: 'fixed', bottom: 70, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: 400, background: C.accent, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 90, boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>🛒 {cart.length} items in cart</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>Tap to compare prices</div>
          </div>
          <button onClick={compareAll} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: '#fff', color: C.accent, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            ⚡ Compare
          </button>
        </div>
      )}
    </div>
  );
}
// cache bust Wed Jun 10 09:24:28 UTC 2026

// ── PriceLogRow — editable price log entry ────────────────────────────────────
function PriceLogRow({ h, onDelete, onEdit }) {
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(h.price);
  const fmt2 = n => '₹' + Number(n).toLocaleString('en-IN');
  const PLAT = { blinkit:'Blinkit', instamart:'Instamart', zepto:'Zepto', bigbasket:'BigBasket', amazon:'Amazon', flipkart:'Flipkart', local:'Local' };
  const PLAT_COLOR = { blinkit:'#e6ac00', instamart:'#FF6600', zepto:'#7B2FBE', bigbasket:'#4a8c00', amazon:'#c45000', flipkart:'#1a5ec7', local:'#6b7280' };

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', borderRadius:10, border:'1px solid #e5e7eb', background:'#fff', marginBottom:8 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>{h.item_name}</div>
        <div style={{ fontSize:11, color:'#6b7280', marginTop:2, display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          <span>{new Date(h.logged_at).toLocaleDateString('en-IN')}</span>
          {h.platform && <span style={{ background: PLAT_COLOR[h.platform]||'#6b7280', color:'#fff', padding:'1px 7px', borderRadius:20, fontSize:10, fontWeight:700 }}>{PLAT[h.platform]||h.platform}</span>}
          <span style={{ background: h.source==='manual'?'#f0fdf4':'#e0f2fe', color: h.source==='manual'?'#15803d':'#0369a1', padding:'1px 6px', borderRadius:20, fontSize:10, fontWeight:700 }}>
            {h.source==='bill_import'?'Bill':h.source==='manual'?'Manual':'Google'}
          </span>
        </div>
      </div>
      {editing ? (
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:14, color:'#6b7280' }}>₹</span>
          <input
            type="number" value={val} onChange={e=>setVal(e.target.value)}
            autoFocus
            style={{ width:80, padding:'6px 8px', borderRadius:8, border:'2px solid #7c3aed', fontSize:15, fontWeight:700, color:'#111827', textAlign:'center', fontFamily:'inherit', outline:'none' }}
            onKeyDown={e=>{ if(e.key==='Enter'){onEdit(h.id,val);setEditing(false);} if(e.key==='Escape')setEditing(false); }}
          />
          <button onClick={()=>{onEdit(h.id,val);setEditing(false);}}
            style={{ padding:'6px 10px', borderRadius:8, border:'none', background:'#15803d', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>✓</button>
          <button onClick={()=>setEditing(false)}
            style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#6b7280', fontSize:12, cursor:'pointer' }}>✕</button>
        </div>
      ) : (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ fontSize:15, fontWeight:800, color: parseFloat(h.price)<1?'#b91c1c':'#111827', cursor:'pointer' }}
            onClick={()=>setEditing(true)}>
            {fmt2(h.price)}
            {parseFloat(h.price)<1 && <span style={{ fontSize:10, color:'#b91c1c', marginLeft:4 }}>⚠️ wrong?</span>}
          </div>
          <button onClick={()=>setEditing(true)}
            style={{ padding:'5px 8px', borderRadius:7, border:'1px solid #e5e7eb', background:'#f9fafb', color:'#6b7280', fontSize:11, cursor:'pointer' }}>✏️</button>
          <button onClick={()=>{ if(window.confirm('Delete this price log?')) onDelete(h.id); }}
            style={{ padding:'5px 8px', borderRadius:7, border:'1px solid #fca5a5', background:'#fee2e2', color:'#b91c1c', fontSize:11, cursor:'pointer' }}>🗑</button>
        </div>
      )}
    </div>
  );
}
