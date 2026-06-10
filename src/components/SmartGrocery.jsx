import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://ihuuxhvxsbmzydclmbtx.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlodXV4aHZ4c2JtenlkY2xtYnR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzAzNjgsImV4cCI6MjA5NTkwNjM2OH0.RSY5SkQvmQgiz0u62Re1k6-AYYZ16trlFCiDULHsQaw"
);

const FAMILY_ID = 'gupta-family-001';

// ── Google Shopping API ───────────────────────────────────────────────────────
const GOOGLE_API_KEY = 'AIzaSyCCPBzkjUGXGDpvQN_EirY4skE63yXR7ds';
const GOOGLE_CX      = '26fbe4c13e6ed4640';

const extractPrice = (text) => {
  if (!text) return null;
  const patterns = [
    /₹\s*(\d+(?:,\d+)?(?:\.\d+)?)/,
    /Rs\.?\s*(\d+(?:,\d+)?(?:\.\d+)?)/i,
    /INR\s*(\d+(?:,\d+)?(?:\.\d+)?)/i,
    /(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:rupees|rs\.?)\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) { const v = parseFloat(m[1].replace(/,/g,'')); if (v > 0 && v < 50000) return v; }
  }
  return null;
};

const extractPlatform = (url='') => {
  if (url.includes('bigbasket'))  return 'bigbasket';
  if (url.includes('amazon'))     return 'amazon';
  if (url.includes('flipkart'))   return 'flipkart';
  if (url.includes('zeptonow') || url.includes('zepto')) return 'zepto';
  if (url.includes('swiggy'))     return 'instamart';
  return null;
};

// Smart query builder — adds context for better results
const buildQuery = (itemName) => {
  const name = itemName.toLowerCase();
  // Map common items to better search queries
  const queryMap = {
    'cream':            'fresh cream 200ml price india',
    'dosa batter':      'dosa batter 1kg price bigbasket',
    'idli batter':      'idli batter 1kg price online india',
    'coriander leaves': 'fresh coriander 100g price india',
    'green chutney':    'green chutney 200g price india',
    'khoya':            'khoya mawa 200g price india',
    'rose water':       'rose water kewra 200ml price india',
    'tamarind chutney': 'tamarind chutney imli 200g price',
    'chana dal':        'chana dal 500g price india online',
    'maggi noodles':    'maggi noodles 560g price india',
    'puri':             'puri ready made frozen price india',
    'sev':              'haldirams sev 200g price india',
    'tamarind':         'imli tamarind 200g price india',
    'amchur':           'amchur powder 100g price india',
    'cardamom powder':  'elaichi cardamom powder 50g price',
    'chole masala':     'chole masala powder 100g price india',
    'kadai masala':     'kadai masala powder 100g price india',
    'saffron':          'kesar saffron 1g price india',
    'sambar powder':    'sambar powder 100g price india',
    'baingan':          'brinjal eggplant 500g price india',
    'cabbage':          'cabbage 1kg price india vegetable',
    'capsicum':         'capsicum shimla mirch 250g price india',
    'carrot':           'carrot gajar 500g price india',
    'karela':           'bitter gourd karela 500g price india',
    'mooli':            'radish mooli 500g price india',
    'mushroom':         'button mushroom 200g price india',
    'spinach':          'palak spinach 250g price india',
    'sweet potato':     'shakarkand sweet potato 500g price india',
    'tomato puree':     'tomato puree 200g price india online',
    'tori':             'ridge gourd tori 500g price india',
    'grapes':           'grapes angoor 500g price india',
    'papaya':           'papaya 1kg price india fresh',
    'daliya':           'daliya broken wheat 500g price india',
    'sooji':            'sooji rava semolina 500g price india',
    'mustard oil':      'mustard oil sarson tel 1L price india',
    'spring roll wrapper': 'spring roll wrapper sheets price india',
  };
  return queryMap[name] || `${itemName} 500g price india buy online grocery`;
};

const fetchGooglePrices = async (itemName) => {
  const query = buildQuery(itemName);
  const q = encodeURIComponent(query);
  // Use num=10 and search across the whole web for price mentions
  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${q}&num=10&gl=in&hl=en`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('Google API error:', res.status, await res.text());
      return [];
    }
    const data = await res.json();
    if (!data.items?.length) return [];

    const seen = {};
    const results = [];

    for (const item of data.items) {
      const platform = extractPlatform(item.link||'');
      // Try multiple price sources
      const textSources = [
        item.snippet,
        item.title,
        item.pagemap?.metatags?.[0]?.['og:description'],
        item.pagemap?.metatags?.[0]?.['og:title'],
        item.pagemap?.product?.[0]?.price,
        item.pagemap?.offer?.[0]?.price,
        item.pagemap?.aggregaterating?.[0]?.ratingvalue,
      ].filter(Boolean).join(' ');

      const price = extractPrice(textSources);

      // Even if no specific platform detected, try to extract price
      if (price && price > 0 && price < 10000) {
        if (platform && !seen[platform]) {
          seen[platform] = true;
          results.push({ platform, price, url: item.link, title: item.title });
        }
        // If no platform detected but price found, assign to 'bigbasket' as fallback
        if (!platform && !seen['_generic']) {
          seen['_generic'] = true;
          // Try URL-based platform detection more broadly
          const url_lower = (item.link||'').toLowerCase();
          const detectedPlat =
            url_lower.includes('grofers') ? 'blinkit' :
            url_lower.includes('jiomart') ? 'bigbasket' :
            url_lower.includes('1mg') || url_lower.includes('pharmeasy') ? 'amazon' :
            null;
          if (detectedPlat && !seen[detectedPlat]) {
            seen[detectedPlat] = true;
            results.push({ platform: detectedPlat, price, url: item.link, title: item.title });
          }
        }
      }
    }

    // If still no results, try a simpler query
    if (results.length === 0) {
      const simpleQ = encodeURIComponent(`"${itemName}" price ₹ india`);
      const simpleUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${simpleQ}&num=5&gl=in`;
      const res2 = await fetch(simpleUrl);
      if (res2.ok) {
        const data2 = await res2.json();
        for (const item of (data2.items||[])) {
          const platform = extractPlatform(item.link||'');
          const price = extractPrice([item.snippet, item.title].join(' '));
          if (platform && price && !seen[platform]) {
            seen[platform] = true;
            results.push({ platform, price, url: item.link, title: item.title });
          }
        }
      }
    }

    return results;
  } catch(e) {
    console.error('Google fetch error:', e);
    return [];
  }
};

// ── Platform config ───────────────────────────────────────────────────────────
const PLATFORMS = {
  blinkit:   { label:'Blinkit',       bg:'#e6ac00', color:'#fff', link:'https://blinkit.com/s/?q=',                       eta:'10 min',      delivery:'Free', deliveryFee:0   },
  instamart: { label:'Instamart',     bg:'#FF6600', color:'#fff', link:'https://www.swiggy.com/instamart/search?query=',  eta:'15 min',      delivery:'₹29',  deliveryFee:29  },
  zepto:     { label:'Zepto',         bg:'#7B2FBE', color:'#fff', link:'https://www.zeptonow.com/search?query=',          eta:'12 min',      delivery:'Free', deliveryFee:0   },
  bigbasket: { label:'BigBasket',     bg:'#4a8c00', color:'#fff', link:'https://www.bigbasket.com/ps/?q=',                eta:'Next morning',delivery:'Free', deliveryFee:0   },
  amazon:    { label:'Amazon Fresh',  bg:'#c45000', color:'#fff', link:'https://www.amazon.in/s?k=',                      eta:'Same day',    delivery:'Free', deliveryFee:0   },
  flipkart:  { label:'Flipkart',      bg:'#1a5ec7', color:'#fff', link:'https://www.flipkart.com/search?q=',              eta:'Next day',    delivery:'Free', deliveryFee:0   },
};

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { id:'all',        label:'All Items',          icon:'📦' },
  { id:'Grains',     label:'Grains & Cereals',   icon:'🌾' },
  { id:'Pulses',     label:'Pulses & Lentils',   icon:'🫘' },
  { id:'Dairy',      label:'Dairy',              icon:'🥛' },
  { id:'Vegetables', label:'Vegetables',         icon:'🥦' },
  { id:'Fruits',     label:'Fruits',             icon:'🍎' },
  { id:'Oils',       label:'Oils & Ghee',        icon:'🫙' },
  { id:'Spices',     label:'Spices',             icon:'🌶️' },
  { id:'Beverages',  label:'Tea & Beverages',    icon:'☕' },
  { id:'Snacks',     label:'Bakery & Snacks',    icon:'🍞' },
  { id:'Frozen',     label:'Frozen Foods',       icon:'🧊' },
  { id:'Child',      label:'Child Essentials',   icon:'👶' },
  { id:'Household',  label:'Household Supplies', icon:'🧹' },
  { id:'Personal',   label:'Personal Care',      icon:'🧴' },
  { id:'Other',      label:'Other',              icon:'🗂️' },
];
const getCatIcon = cat => CATEGORIES.find(c => c.id.toLowerCase()===(cat||'').toLowerCase())?.icon || '📦';

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  pageBg:'#f3f4f6', cardBg:'#ffffff', border:'#e5e7eb',
  text1:'#111827',  text2:'#374151',  text3:'#6b7280',
  accent:'#7c3aed', accentL:'#ede9fe',
  green:'#15803d',  greenL:'#dcfce7',
  amber:'#92400e',  amberL:'#fef3c7',
  red:'#b91c1c',    redL:'#fee2e2',
  blue:'#1d4ed8',   blueL:'#dbeafe',
  google:'#4285F4',
};

const fmt = n => '₹' + Number(n).toLocaleString('en-IN');

// ── Stock helpers ─────────────────────────────────────────────────────────────
const stockPct   = i => i.par_level > 0 ? Math.min(100, Math.round((i.quantity/(i.par_level*3))*100)) : 100;
const isLow      = i => Number(i.quantity) <= Number(i.par_level)*1.5;
const isOut      = i => Number(i.quantity) <= 0;
const daysLeft   = i => { if(!i.expiry_date) return null; return Math.ceil((new Date(i.expiry_date)-new Date())/86400000); };
const suggestQty = i => Math.ceil(Math.max(i.par_level*4, i.par_level-i.quantity+i.par_level*3)*10)/10;

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  inp:  { padding:'10px 13px', borderRadius:10, border:'1px solid #d1d5db', fontSize:14, color:'#111827', background:'#fff', fontFamily:'inherit', outline:'none', width:'100%', boxSizing:'border-box' },
  btn:  { padding:'10px 18px', borderRadius:10, border:'none', background:'#7c3aed', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' },
  btnO: { padding:'9px 16px',  borderRadius:10, border:'1px solid #7c3aed', background:'#fff', color:'#7c3aed', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' },
  btnG: { padding:'9px 16px',  borderRadius:10, border:'none', background:'#15803d', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' },
  btnR: { padding:'8px 14px',  borderRadius:9,  border:'none', background:'#fee2e2', color:'#b91c1c', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  card: { background:'#fff', border:'1px solid #e5e7eb', borderRadius:14, padding:'14px 16px', marginBottom:10 },
  lbl:  { fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8, display:'block' },
  empty:{ textAlign:'center', padding:'3rem 1rem', color:'#9ca3af', fontSize:14, lineHeight:1.8 },
};

const Badge = ({ slug }) => {
  const p = PLATFORMS[slug]; if(!p) return null;
  return <span style={{ background:p.bg, color:'#fff', fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, whiteSpace:'nowrap' }}>{p.label}</span>;
};

const StockBar = ({ item }) => {
  const pct = stockPct(item);
  const col = isOut(item)?'#b91c1c':isLow(item)?'#d97706':'#15803d';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ flex:1, height:5, borderRadius:3, background:'#e5e7eb', overflow:'hidden', minWidth:50 }}>
        <div style={{ width:`${pct}%`, height:'100%', background:col, borderRadius:3, transition:'width .3s' }}/>
      </div>
      <span style={{ fontSize:11, fontWeight:700, color:col, minWidth:28, textAlign:'right' }}>{pct}%</span>
    </div>
  );
};

const useToast = () => {
  const [toast, setToast] = useState('');
  const show = msg => { setToast(msg); setTimeout(()=>setToast(''), 3500); };
  const el = toast ? (
    <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', background:'#1f2937', color:'#fff', borderRadius:10, padding:'10px 20px', fontSize:13, fontWeight:600, zIndex:1000, whiteSpace:'nowrap', boxShadow:'0 4px 16px rgba(0,0,0,0.25)' }}>
      {toast}
    </div>
  ) : null;
  return [show, el];
};

const TABS = [
  { id:'pantry',  label:'🧺 Pantry'  },
  { id:'cart',    label:'🛒 Cart'    },
  { id:'compare', label:'⚡ Compare' },
  { id:'history', label:'📋 History' },
];

// ════════════════════════════════════════════════════════════════════════════
export default function SmartGrocery({ familyId }) {
  const fid = familyId || FAMILY_ID;
  const [tab, setTab]           = useState('pantry');
  const [pantry, setPantry]     = useState([]);
  const [priceLog, setPriceLog] = useState([]);
  const [mealPlan, setMealPlan] = useState([]);
  const [recipeIngr, setRecipeIngr] = useState([]);
  const [cart, setCart]         = useState([]);
  const [compareRes, setCompareRes] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [comparing, setComparing] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ current:0, total:0, item:'' });
  const [search, setSearch]     = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [showToast, toastEl]    = useToast();
  const [plogForm, setPlogForm] = useState({ item_name:'', platform:'blinkit', price:'', delivery_fee:'' });
  const [newCartItem, setNewCartItem] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const weekLater = new Date(Date.now()+7*86400000).toISOString().split('T')[0];
    const [{ data:pan },{ data:plog },{ data:mp },{ data:ri }] = await Promise.all([
      supabase.from('pantry').select('*').eq('family_id',fid).order('category').order('name'),
      supabase.from('grocery_price_history').select('*').order('logged_at',{ascending:false}).limit(1000),
      supabase.from('meal_plan').select('*').eq('family_id',fid).gte('plan_date',today).lte('plan_date',weekLater).eq('cooked',false),
      supabase.from('recipe_ingredients').select('*'),
    ]);
    setPantry(pan||[]);
    setPriceLog(plog||[]);
    setMealPlan(mp||[]);
    setRecipeIngr(ri||[]);
    setLoading(false);
  }, [fid]);

  useEffect(()=>{ load(); },[load]);

  // ── Filtered pantry ─────────────────────────────────────────────────────────
  const filtered = useMemo(()=>{
    let items = [...pantry];
    if (search.trim()) { const q=search.toLowerCase(); items=items.filter(i=>i.name.toLowerCase().includes(q)||(i.category||'').toLowerCase().includes(q)); }
    if (catFilter!=='all') items=items.filter(i=>(i.category||'').toLowerCase()===catFilter.toLowerCase());
    if (stockFilter==='low')      items=items.filter(i=>isLow(i)&&!isOut(i));
    if (stockFilter==='out')      items=items.filter(i=>isOut(i));
    if (stockFilter==='expiring') items=items.filter(i=>{ const d=daysLeft(i); return d!==null&&d<=7; });
    return items;
  },[pantry,search,catFilter,stockFilter]);

  const lowStockItems = useMemo(()=>pantry.filter(i=>isLow(i)),[pantry]);

  const mealMissing = useMemo(()=>{
    const needed=new Set();
    mealPlan.forEach(mp=>{ recipeIngr.filter(ri=>ri.recipe_id===mp.recipe_id).forEach(ri=>{ const p=pantry.find(p=>p.name.toLowerCase()===ri.pantry_item_name.toLowerCase()); if(!p||isLow(p)) needed.add(ri.pantry_item_name); }); });
    return [...needed];
  },[mealPlan,recipeIngr,pantry]);

  // ── Inventory health ────────────────────────────────────────────────────────
  const healthScore = useMemo(()=>{ if(!pantry.length) return 0; return Math.round((pantry.filter(i=>!isLow(i)&&!isOut(i)).length/pantry.length)*100); },[pantry]);
  const coverageDays = useMemo(()=>{
    if(!pantry.length) return 0;
    const well=pantry.filter(i=>Number(i.quantity)>Number(i.par_level)).length;
    const low=pantry.filter(i=>isLow(i)).length;
    const out=pantry.filter(i=>isOut(i)).length;
    return Math.min(30,Math.round((well*14+(pantry.length-well-low-out)*7+low*3)/pantry.length));
  },[pantry]);

  // ── Cart helpers ────────────────────────────────────────────────────────────
  const inCart  = item => cart.some(c=>c.id===item.id||c.name===item.name);
  const addToCart = item => { if(inCart(item)) return; setCart(prev=>[...prev,{ id:item.id||item.name, name:item.name, qty:suggestQty(item)||1, unit:item.unit||'pcs', category:item.category||'general', fromPantry:!!item.id }]); };
  const addManualItem = () => { if(!newCartItem.trim()) return; if(cart.some(c=>c.name.toLowerCase()===newCartItem.toLowerCase())) { showToast('Already in cart'); return; } setCart(prev=>[...prev,{ id:newCartItem, name:newCartItem.trim(), qty:1, unit:'pcs', category:'general', fromPantry:false }]); setNewCartItem(''); };
  const removeFromCart = id => setCart(prev=>prev.filter(c=>c.id!==id));
  const updateCartQty = (id,qty) => setCart(prev=>prev.map(c=>c.id===id?{...c,qty}:c));
  const addAllLowStock = () => { const toAdd=lowStockItems.filter(i=>!inCart(i)); setCart(prev=>[...prev,...toAdd.map(i=>({ id:i.id, name:i.name, qty:suggestQty(i), unit:i.unit, category:i.category, fromPantry:true }))]); showToast(`✓ ${toAdd.length} low stock items added`); setTab('cart'); };

  // ── SMART CART COMPARISON ENGINE ────────────────────────────────────────────
  const compareCart = async () => {
    if(!cart.length) { showToast('Add items to cart first'); return; }
    setComparing(true);
    setCompareRes(null);
    setTab('compare');

    const cartNames = cart.map(c=>c.name);
    const totalItems = cartNames.length;

    // Per-platform result structure
    const platformResults = {};
    Object.keys(PLATFORMS).forEach(slug=>{
      platformResults[slug] = { found:[], missing:[], total:0 };
    });

    // For each item: check price log first, then Google
    for (let i=0; i<cartNames.length; i++) {
      const itemName = cartNames[i];
      setFetchProgress({ current:i+1, total:totalItems, item:itemName });

      // Get best recent price per platform from log (last 7 days)
      const weekAgo = new Date(Date.now()-7*86400000).toISOString();
      const recentPrices = {};
      priceLog.forEach(h=>{
        if (h.item_name?.toLowerCase()===itemName.toLowerCase() && h.logged_at>=weekAgo) {
          if (!recentPrices[h.platform] || parseFloat(h.price)<recentPrices[h.platform]) {
            recentPrices[h.platform] = parseFloat(h.price);
          }
        }
      });

      // If no recent data, fetch from Google
      if (Object.keys(recentPrices).length===0) {
        const googleResults = await fetchGooglePrices(itemName);
        // Log to Supabase for future use
        for (const r of googleResults) {
          recentPrices[r.platform] = r.price;
          await supabase.from('grocery_price_history').insert({
            item_name:itemName, platform:r.platform, price:r.price,
            delivery_fee:0, source:'google_shopping', logged_at:new Date().toISOString(),
          }).then(()=>{}).catch(()=>{});
        }
        await new Promise(r=>setTimeout(r,200)); // rate limit
      }

      // Assign to platforms
      Object.keys(PLATFORMS).forEach(slug=>{
        if (recentPrices[slug]) {
          platformResults[slug].found.push({ name:itemName, price:recentPrices[slug] });
          platformResults[slug].total += recentPrices[slug];
        } else {
          platformResults[slug].missing.push(itemName);
        }
      });
    }

    // Score each platform
    const scored = Object.entries(platformResults)
      .map(([slug,v])=>({
        slug,
        found: v.found,
        missing: v.missing,
        foundCount: v.found.length,
        missingCount: v.missing.length,
        basket: v.total,
        deliveryFee: PLATFORMS[slug].deliveryFee,
        total: v.total + PLATFORMS[slug].deliveryFee,
        coverage: totalItems>0 ? Math.round((v.found.length/totalItems)*100) : 0,
        eta: PLATFORMS[slug].eta,
      }))
      .filter(r=>r.foundCount>0)
      .sort((a,b)=>{ if(b.foundCount!==a.foundCount) return b.foundCount-a.foundCount; return a.total-b.total; });

    // Best single = highest score (items found × weight - price)
    const bestSingle = scored.length>0 ? [...scored].sort((a,b)=>(b.foundCount*500-b.total)-(a.foundCount*500-a.total))[0] : null;

    // Cheapest single (most items found then lowest price)
    const cheapestFull = scored.filter(r=>r.foundCount===Math.max(...scored.map(r=>r.foundCount)))[0];

    // Split buy: cheapest platform per item
    const splitMap = {};
    let splitTotal = 0;
    let splitFoundCount = 0;
    const splitMissing = [];
    cartNames.forEach(name=>{
      let bestSlug=null; let bestPrice=Infinity;
      Object.entries(platformResults).forEach(([slug,v])=>{
        const f=v.found.find(f=>f.name===name);
        if(f && f.price<bestPrice) { bestPrice=f.price; bestSlug=slug; }
      });
      if(bestSlug) {
        if(!splitMap[bestSlug]) splitMap[bestSlug]={ items:[], total:0 };
        splitMap[bestSlug].items.push({ name, price:bestPrice });
        splitMap[bestSlug].total += bestPrice;
        splitTotal += bestPrice;
        splitFoundCount++;
      } else {
        splitMissing.push(name);
      }
    });

    // Not found anywhere
    const notFoundAnywhere = cartNames.filter(name=>Object.values(platformResults).every(v=>!v.found.some(f=>f.name===name)));

    await load();
    setCompareRes({ scored, bestSingle, cheapestFull, splitMap, splitTotal, splitMissing, splitFoundCount, notFoundAnywhere, totalItems, cartNames, platformResults });
    setFetchProgress({ current:0, total:0, item:'' });
    setComparing(false);
  };

  // ── Log price manually ──────────────────────────────────────────────────────
  const logPrice = async () => {
    if(!plogForm.item_name||!plogForm.price) { showToast('Enter item and price'); return; }
    await supabase.from('grocery_price_history').insert({ item_name:plogForm.item_name, platform:plogForm.platform, price:parseFloat(plogForm.price), delivery_fee:parseFloat(plogForm.delivery_fee)||0, source:'manual', logged_at:new Date().toISOString() });
    setPlogForm({ item_name:'', platform:'blinkit', price:'', delivery_fee:'' });
    load(); showToast('Price logged ✓');
  };

  // ── Refresh from pantry ─────────────────────────────────────────────────────
  const refreshFromPantry = async () => {
    const toAdd=lowStockItems.filter(i=>!inCart(i));
    setCart(prev=>[...prev,...toAdd.map(i=>({ id:i.id, name:i.name, qty:suggestQty(i), unit:i.unit, category:i.category, fromPantry:true }))]);
    showToast(`✓ ${toAdd.length} low stock items synced`);
    setTab('cart');
  };

  const filteredHistory = priceLog.filter(h=>(!plogForm._filterItem||h.item_name?.toLowerCase().includes(plogForm._filterItem?.toLowerCase())));

  if (loading) return <div style={{ padding:'4rem', textAlign:'center', color:C.text3, fontSize:14 }}>Loading Smart Grocery...</div>;

  return (
    <div style={{ fontFamily:"'Outfit',sans-serif", background:C.pageBg, minHeight:'100vh', paddingBottom:'6rem' }}>
      {toastEl}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* ── Header ── */}
      <div style={{ background:C.cardBg, borderBottom:`1px solid ${C.border}`, padding:'52px 16px 14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
          <div>
            <div style={{ fontSize:22, fontWeight:800, color:C.text1 }}>🛒 Smart Grocery</div>
            <div style={{ fontSize:13, color:C.text3, marginTop:3 }}>
              {pantry.length} pantry items ·{' '}
              <span style={{ color:lowStockItems.length>0?'#d97706':C.green, fontWeight:600 }}>{lowStockItems.length} low stock</span>
              {cart.length>0 && <> · <span style={{ color:C.accent, fontWeight:600 }}>{cart.length} in cart</span></>}
            </div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={refreshFromPantry} style={{ ...S.btnO, fontSize:12, padding:'8px 10px' }}>🔄 Sync</button>
            <button onClick={addAllLowStock} style={S.btn}>🛒 {lowStockItems.length}</button>
          </div>
        </div>

        {/* Dashboard strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:10 }}>
          {[
            { l:'Health',    v:`${healthScore}%`,    c:healthScore>70?C.green:healthScore>40?'#d97706':C.red },
            { l:'Coverage',  v:`${coverageDays}d`,   c:C.blue },
            { l:'Low stock', v:lowStockItems.length,  c:lowStockItems.length>0?'#d97706':C.green },
            { l:'Cart',      v:cart.length,            c:C.accent },
          ].map(s=>(
            <div key={s.l} style={{ background:C.pageBg, borderRadius:10, padding:'8px', textAlign:'center' }}>
              <div style={{ fontSize:16, fontWeight:800, color:s.c }}>{s.v}</div>
              <div style={{ fontSize:11, color:C.text3, marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Google fetch button */}
        <button
          onClick={()=>{ addAllLowStock(); setTimeout(compareCart, 500); }}
          style={{ width:'100%', padding:'11px', borderRadius:10, border:'none', background:C.google, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          <span style={{ fontSize:16 }}>🔍</span> Compare all {lowStockItems.length} low stock items via Google
        </button>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length>0 && (
        <div style={{ margin:'10px 16px 0', padding:'10px 14px', background:C.amberL, border:`1px solid #fcd34d`, borderRadius:10, fontSize:13, color:C.amber, fontWeight:500 }}>
          ⚠️ <strong>{lowStockItems.length} items low:</strong>{' '}
          {lowStockItems.slice(0,6).map(i=>i.name).join(', ')}{lowStockItems.length>6?` +${lowStockItems.length-6} more`:''}
        </div>
      )}

      {/* Meal plan alert */}
      {mealMissing.length>0 && (
        <div style={{ margin:'8px 16px 0', padding:'10px 14px', background:C.blueL, border:`1px solid #93c5fd`, borderRadius:10, fontSize:13, color:C.blue, fontWeight:500 }}>
          🍽️ <strong>Meals need:</strong> {mealMissing.slice(0,5).join(', ')}{mealMissing.length>5?` +${mealMissing.length-5} more`:''}
          <button onClick={()=>{ const toAdd=pantry.filter(p=>mealMissing.some(m=>m.toLowerCase()===p.name.toLowerCase())&&!inCart(p)); setCart(prev=>[...prev,...toAdd.map(i=>({ id:i.id, name:i.name, qty:suggestQty(i), unit:i.unit, category:i.category, fromPantry:true }))]); showToast(`✓ ${toAdd.length} added`); setTab('cart'); }}
            style={{ marginLeft:10, padding:'3px 10px', borderRadius:8, border:'none', background:C.blue, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            Add to cart
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', padding:'10px 16px', gap:6, background:C.cardBg, borderBottom:`1px solid ${C.border}`, overflowX:'auto', marginTop:10 }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'8px 16px', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', border:'none', background:tab===t.id?C.accent:C.accentL, color:tab===t.id?'#fff':C.accent, fontFamily:'inherit' }}>
            {t.label}{t.id==='cart'&&cart.length>0?` (${cart.length})`:''}
          </button>
        ))}
      </div>

      <div style={{ padding:'14px 16px 0' }}>

        {/* ══ TAB: PANTRY ══ */}
        {tab==='pantry' && (
          <>
            {/* Search */}
            <div style={{ position:'relative', marginBottom:10 }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:16, pointerEvents:'none' }}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search pantry... (Rice, Milk, Paneer)" style={{ ...S.inp, paddingLeft:38 }}/>
            </div>

            {/* Stock filters */}
            <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:10, paddingBottom:2 }}>
              {[
                { id:'all',      label:'All',            count:pantry.length },
                { id:'low',      label:'⚠️ Low Stock',   count:pantry.filter(i=>isLow(i)&&!isOut(i)).length },
                { id:'out',      label:'🔴 Out of Stock', count:pantry.filter(i=>isOut(i)).length },
                { id:'expiring', label:'⏰ Expiring',    count:pantry.filter(i=>{ const d=daysLeft(i); return d!==null&&d<=7; }).length },
              ].map(f=>(
                <button key={f.id} onClick={()=>setStockFilter(f.id)} style={{ padding:'6px 12px', borderRadius:8, border:`1px solid ${stockFilter===f.id?C.accent:C.border}`, background:stockFilter===f.id?C.accentL:C.cardBg, color:stockFilter===f.id?C.accent:C.text2, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                  {f.label} <span style={{ background:stockFilter===f.id?C.accent:C.pageBg, color:stockFilter===f.id?'#fff':C.text3, borderRadius:20, padding:'0 6px', fontSize:10, fontWeight:700 }}>{f.count}</span>
                </button>
              ))}
            </div>

            {/* Category chips */}
            <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:12, paddingBottom:2 }}>
              {CATEGORIES.map(cat=>(
                <button key={cat.id} onClick={()=>setCatFilter(cat.id)} style={{ padding:'6px 12px', borderRadius:20, border:`1px solid ${catFilter===cat.id?C.accent:C.border}`, background:catFilter===cat.id?C.accent:C.cardBg, color:catFilter===cat.id?'#fff':C.text2, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                  {cat.icon} {cat.id==='all'?'All':cat.label}
                </button>
              ))}
            </div>

            {/* Results count */}
            <div style={{ fontSize:12, color:C.text3, marginBottom:8, fontWeight:600 }}>
              Showing {filtered.length} of {pantry.length} items
              {(search||catFilter!=='all'||stockFilter!=='all') && (
                <button onClick={()=>{ setSearch(''); setCatFilter('all'); setStockFilter('all'); }} style={{ marginLeft:8, padding:'2px 8px', borderRadius:6, border:'none', background:C.redL, color:C.red, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>✕ Clear</button>
              )}
            </div>

            {filtered.length===0 && <div style={S.empty}>No items found.<br/>Try a different search or filter.</div>}

            {filtered.map(item=>{
              const low=isLow(item); const out=isOut(item);
              const days=daysLeft(item); const expSoon=days!==null&&days<=7;
              const cartAdded=inCart(item);
              return (
                <div key={item.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, border:`1px solid ${out?'#fca5a5':low?'#fcd34d':C.border}`, marginBottom:8, background:out?'#fff5f5':low?'#fffbeb':C.cardBg, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize:20, flexShrink:0 }}>{getCatIcon(item.category)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      <span style={{ fontSize:15, fontWeight:700, color:C.text1 }}>{item.name}</span>
                      {out  && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:C.redL,   color:C.red,   fontWeight:700 }}>Out of stock</span>}
                      {!out&&low && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:C.amberL, color:C.amber, fontWeight:700 }}>Low</span>}
                      {expSoon && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:C.redL, color:C.red, fontWeight:700 }}>Exp {days}d</span>}
                      {cartAdded && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:C.accentL, color:C.accent, fontWeight:700 }}>In cart</span>}
                    </div>
                    <div style={{ fontSize:12, color:C.text3, marginTop:3 }}>
                      <strong style={{ color:C.text2 }}>{item.quantity} {item.unit}</strong> · par: {item.par_level} {item.unit} · {item.category}
                    </div>
                    <div style={{ marginTop:6 }}><StockBar item={item}/></div>
                  </div>
                  <button onClick={()=>cartAdded?removeFromCart(item.id):addToCart(item)}
                    style={{ padding:'7px 11px', borderRadius:9, border:`1px solid ${cartAdded?'#fca5a5':C.accent}`, background:cartAdded?C.redL:C.accentL, color:cartAdded?C.red:C.accent, fontSize:20, cursor:'pointer', flexShrink:0 }}>
                    {cartAdded?'✕':'+'}
                  </button>
                </div>
              );
            })}
          </>
        )}

        {/* ══ TAB: CART ══ */}
        {tab==='cart' && (
          <>
            {/* Add manual item */}
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              <input value={newCartItem} onChange={e=>setNewCartItem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addManualItem()} placeholder="Add any item (e.g. Maggi, Chips, Coke)" style={{ ...S.inp, flex:1 }}/>
              <button onClick={addManualItem} style={S.btn}>+ Add</button>
            </div>

            <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
              <button onClick={addAllLowStock} style={S.btnG}>+ All {lowStockItems.length} low stock</button>
              {cart.length>0 && <button onClick={()=>setCart([])} style={S.btnR}>Clear cart</button>}
              {cart.length>0 && <button onClick={compareCart} style={S.btn}>⚡ Compare via Google</button>}
            </div>

            {cart.length===0 ? (
              <div style={S.empty}>
                <div style={{ fontSize:40, marginBottom:12 }}>🛒</div>
                Cart is empty.<br/>
                Type any item above or tap <strong>+ All low stock</strong>
              </div>
            ) : (
              <>
                <div style={{ fontSize:12, color:C.text3, marginBottom:10, fontWeight:600 }}>
                  {cart.length} items · Google will search prices from BigBasket, Amazon, Flipkart, Zepto, Instamart
                </div>
                {cart.map(c=>(
                  <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, border:`1px solid ${C.border}`, marginBottom:8, background:C.cardBg }}>
                    <div style={{ fontSize:20 }}>{getCatIcon(c.category)}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:C.text1 }}>{c.name}</div>
                      <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>
                        {c.fromPantry ? `Need: ${c.qty} ${c.unit}` : 'Added manually'}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <input type="number" value={c.qty} min={0} step={0.5}
                        onChange={e=>updateCartQty(c.id,parseFloat(e.target.value))}
                        style={{ width:65, padding:'6px 8px', borderRadius:8, border:`1px solid ${C.border}`, fontSize:13, fontWeight:700, color:C.text1, background:'#fff', fontFamily:'inherit', textAlign:'center' }}/>
                      <span style={{ fontSize:12, color:C.text3 }}>{c.unit}</span>
                    </div>
                    <button onClick={()=>removeFromCart(c.id)} style={{ width:28, height:28, borderRadius:8, border:`1px solid #fca5a5`, background:C.redL, color:C.red, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
                  </div>
                ))}

                <div style={{ ...S.card, marginTop:6, background:C.accentL, borderColor:'#c4b5fd' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.accent, marginBottom:10 }}>Ready to compare {cart.length} items</div>
                  <button onClick={compareCart} style={{ ...S.btn, width:'100%', padding:'13px', fontSize:15 }}>
                    🔍 Compare prices via Google Shopping
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ══ TAB: COMPARE ══ */}
        {tab==='compare' && (
          <>
            {/* Progress */}
            {comparing && (
              <div style={{ ...S.card, textAlign:'center', padding:'2rem' }}>
                <div style={{ fontSize:36, marginBottom:12 }}>🔍</div>
                <div style={{ fontSize:16, fontWeight:700, color:C.text1, marginBottom:6 }}>Searching Google Shopping...</div>
                <div style={{ fontSize:13, color:C.text3, marginBottom:16, minHeight:20 }}>
                  {fetchProgress.item ? `Checking: "${fetchProgress.item}"` : 'Starting search...'}
                </div>
                <div style={{ height:8, borderRadius:4, background:C.border, overflow:'hidden', marginBottom:8 }}>
                  <div style={{ height:'100%', borderRadius:4, background:C.google, width:fetchProgress.total>0?`${(fetchProgress.current/fetchProgress.total)*100}%`:'5%', transition:'width 0.3s' }}/>
                </div>
                <div style={{ fontSize:13, color:C.text3, fontWeight:600 }}>{fetchProgress.current} / {fetchProgress.total} items</div>
                <div style={{ fontSize:12, color:C.text3, marginTop:8 }}>Searching BigBasket · Amazon · Flipkart · Zepto · Instamart</div>
              </div>
            )}

            {/* Empty */}
            {!comparing && !compareRes && (
              <div style={S.empty}>
                <div style={{ fontSize:40, marginBottom:12 }}>⚡</div>
                Add items to cart, then compare.<br/>
                <button onClick={()=>setTab('cart')} style={{ ...S.btn, marginTop:16 }}>Go to Cart →</button>
              </div>
            )}

            {/* Results */}
            {!comparing && compareRes && (
              <>
                {/* Summary */}
                <div style={{ ...S.card, background:'linear-gradient(135deg,#ede9fe,#dbeafe)', borderColor:C.accent, marginBottom:14 }}>
                  <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:4 }}>
                    Results for {compareRes.totalItems} items
                  </div>
                  <div style={{ fontSize:13, color:C.text3 }}>
                    Prices fetched via Google Shopping · {Object.keys(PLATFORMS).length} platforms checked
                  </div>
                  {compareRes.notFoundAnywhere.length>0 && (
                    <div style={{ marginTop:8, fontSize:12, color:C.red }}>
                      ❌ Not found anywhere: {compareRes.notFoundAnywhere.join(', ')}
                    </div>
                  )}
                </div>

                {/* Platform comparison table */}
                <div style={{ marginBottom:14 }}>
                  <span style={S.lbl}>Platform comparison — {compareRes.totalItems} items</span>
                  {compareRes.scored.length===0 ? (
                    <div style={{ ...S.card, background:C.amberL, borderColor:'#fcd34d' }}>
                      <div style={{ fontSize:14, fontWeight:700, color:C.amber, marginBottom:6 }}>No prices found</div>
                      <div style={{ fontSize:13, color:C.text2 }}>Google couldn't find prices for these items. Try searching for branded items like "Amul Milk" instead of just "Milk".</div>
                    </div>
                  ) : compareRes.scored.map((r,i)=>{
                    const isBest = r.slug===compareRes.bestSingle?.slug;
                    return (
                      <div key={r.slug} style={{ ...S.card, borderColor:isBest?'#16a34a':C.border, borderWidth:isBest?2:1, marginBottom:10 }}>
                        {/* Platform header */}
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                          <Badge slug={r.slug}/>
                          {isBest && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:C.greenL, color:C.green, fontWeight:700 }}>⭐ Best choice</span>}
                          <span style={{ marginLeft:'auto', fontWeight:800, fontSize:17, color:C.text1 }}>{fmt(r.total)}</span>
                        </div>

                        {/* Item coverage bar */}
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                          <div style={{ flex:1, height:6, borderRadius:3, background:C.border, overflow:'hidden' }}>
                            <div style={{ width:`${r.coverage}%`, height:'100%', background:r.coverage===100?C.green:r.coverage>60?'#d97706':C.red, borderRadius:3 }}/>
                          </div>
                          <span style={{ fontSize:13, fontWeight:700, color:r.foundCount===compareRes.totalItems?C.green:'#d97706', whiteSpace:'nowrap' }}>
                            {r.foundCount}/{compareRes.totalItems} items
                          </span>
                        </div>

                        {/* Stats row */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:10 }}>
                          {[
                            { l:'Basket',   v:fmt(r.basket) },
                            { l:'Delivery', v:r.deliveryFee>0?fmt(r.deliveryFee):'Free' },
                            { l:'ETA',      v:r.eta },
                          ].map(s=>(
                            <div key={s.l} style={{ background:C.pageBg, borderRadius:8, padding:'7px', textAlign:'center' }}>
                              <div style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{s.v}</div>
                              <div style={{ fontSize:10, color:C.text3 }}>{s.l}</div>
                            </div>
                          ))}
                        </div>

                        {/* Found items */}
                        {r.found.length>0 && (
                          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
                            {r.found.map(f=>(
                              <span key={f.name} style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:C.greenL, color:C.green, fontWeight:600 }}>
                                {f.name} · {fmt(f.price)}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Missing items */}
                        {r.missing.length>0 && (
                          <div style={{ fontSize:12, color:C.red, marginBottom:8 }}>
                            ❌ Not found: {r.missing.join(', ')}
                          </div>
                        )}

                        {/* Open button */}
                        <a href={PLATFORMS[r.slug].link+encodeURIComponent(compareRes.cartNames.join(' '))} target="_blank" rel="noreferrer"
                          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px', borderRadius:10, background:isBest?C.green:C.pageBg, color:isBest?'#fff':C.accent, textDecoration:'none', fontSize:13, fontWeight:700, border:isBest?'none':`1px solid ${C.border}` }}>
                          🛒 Open {PLATFORMS[r.slug].label} ↗
                        </a>
                      </div>
                    );
                  })}
                </div>

                {/* Best single platform */}
                {compareRes.bestSingle && (
                  <div style={{ padding:'14px 16px', background:C.greenL, border:`2px solid #16a34a`, borderRadius:14, marginBottom:14 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.green, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>🏆 Best Single Platform</div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                      <Badge slug={compareRes.bestSingle.slug}/>
                      <span style={{ fontSize:20, fontWeight:900, color:C.text1 }}>{fmt(compareRes.bestSingle.total)}</span>
                      <span style={{ fontSize:13, color:C.green, fontWeight:700, marginLeft:'auto' }}>
                        {compareRes.bestSingle.foundCount}/{compareRes.totalItems} items
                      </span>
                    </div>
                    {compareRes.bestSingle.missing.length>0 && (
                      <div style={{ fontSize:12, color:C.amber, marginBottom:8 }}>⚠️ Missing: {compareRes.bestSingle.missing.join(', ')}</div>
                    )}
                    <a href={PLATFORMS[compareRes.bestSingle.slug].link+encodeURIComponent(compareRes.cartNames.join(' '))} target="_blank" rel="noreferrer"
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'11px', borderRadius:10, background:C.green, color:'#fff', textDecoration:'none', fontSize:14, fontWeight:700 }}>
                      🛒 Buy everything from {PLATFORMS[compareRes.bestSingle.slug].label} ↗
                    </a>
                  </div>
                )}

                {/* Split buy */}
                {Object.keys(compareRes.splitMap).length>1 && compareRes.bestSingle && compareRes.splitTotal<compareRes.bestSingle.total && (
                  <div style={{ padding:'14px 16px', background:C.blueL, border:`1px solid #93c5fd`, borderRadius:14, marginBottom:14 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.blue, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>⚡ Split Buy — Save More</div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                      <span style={{ fontSize:20, fontWeight:900, color:C.text1 }}>{fmt(compareRes.splitTotal)}</span>
                      <span style={{ fontSize:13, color:C.green, fontWeight:700, background:C.greenL, padding:'3px 10px', borderRadius:20 }}>
                        Save {fmt(compareRes.bestSingle.total-compareRes.splitTotal)}
                      </span>
                    </div>
                    {Object.entries(compareRes.splitMap).map(([slug,data])=>(
                      <div key={slug} style={{ marginBottom:10, padding:'10px 12px', background:'#fff', borderRadius:10, border:`1px solid ${C.border}` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                          <Badge slug={slug}/>
                          <span style={{ fontSize:14, fontWeight:700, color:C.text1, marginLeft:'auto' }}>{fmt(data.total)}</span>
                        </div>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8 }}>
                          {data.items.map(item=>(
                            <span key={item.name} style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:C.blueL, color:C.blue, fontWeight:600 }}>
                              {item.name} · {fmt(item.price)}
                            </span>
                          ))}
                        </div>
                        <a href={PLATFORMS[slug].link+encodeURIComponent(data.items.map(i=>i.name).join(' '))} target="_blank" rel="noreferrer"
                          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:9, background:C.blue, color:'#fff', textDecoration:'none', fontSize:13, fontWeight:700 }}>
                          Open {PLATFORMS[slug].label} for {data.items.length} items ↗
                        </a>
                      </div>
                    ))}
                    {compareRes.splitMissing.length>0 && (
                      <div style={{ fontSize:12, color:C.red, marginTop:6 }}>❌ Not found anywhere: {compareRes.splitMissing.join(', ')}</div>
                    )}
                  </div>
                )}

                {/* Re-compare button */}
                <button onClick={compareCart} style={{ ...S.btn, width:'100%', marginTop:8, padding:'12px' }}>
                  🔄 Re-compare cart
                </button>
              </>
            )}
          </>
        )}

        {/* ══ TAB: HISTORY — QUICK LOG UI ══ */}
        {tab==='history' && (
          <QuickLogUI
            pantry={pantry}
            priceLog={priceLog}
            onLog={async (entries) => {
              for (const e of entries) {
                await supabase.from('grocery_price_history').insert({
                  item_name: e.item_name, platform: e.platform,
                  price: parseFloat(e.price), delivery_fee: 0,
                  source: 'manual', logged_at: new Date().toISOString(),
                });
              }
              await load();
              showToast(`✓ ${entries.length} prices logged!`);
            }}
          />
        )}
      {/* Sticky cart bar */}
      {cart.length>0 && tab!=='compare' && (
        <div style={{ position:'fixed', bottom:70, left:'50%', transform:'translateX(-50%)', width:'calc(100% - 32px)', maxWidth:400, background:C.accent, borderRadius:14, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', zIndex:90, boxShadow:'0 4px 20px rgba(124,58,237,0.4)' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>🛒 {cart.length} items in cart</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.85)', marginTop:1 }}>Tap to compare prices via Google</div>
          </div>
          <button onClick={compareCart} style={{ padding:'9px 18px', borderRadius:10, border:'none', background:'#fff', color:C.accent, fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
            ⚡ Compare
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// QUICK LOG UI — 3-second price entry optimised for mobile shopping sessions
// ══════════════════════════════════════════════════════════════════════════════
function QuickLogUI({ pantry, priceLog, onLog }) {
  const [activePlatform, setActivePlatform] = useState('blinkit');
  const [prices, setPrices] = useState({});
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState({});
  const [viewMode, setViewMode] = useState('log');
  const [histFilter, setHistFilter] = useState('all');
  const inputRefs = {};

  const allItems = useMemo(() => {
    const pantryNames = new Set(pantry.map(p => p.name.toLowerCase()));
    const extra = [];
    const seen = new Set();
    priceLog.forEach(h => {
      const key = h.item_name?.toLowerCase();
      if (key && !pantryNames.has(key) && !seen.has(key)) {
        seen.add(key);
        extra.push({ id:key, name:h.item_name, category:'Other', fromLog:true });
      }
    });
    return [...pantry, ...extra];
  }, [pantry, priceLog]);

  const latestPrices = useMemo(() => {
    const map = {};
    [...priceLog].reverse().forEach(h => {
      const key = `${h.item_name?.toLowerCase()}__${h.platform}`;
      if (!map[key]) map[key] = h;
    });
    return map;
  }, [priceLog]);

  const getLatest = (name, platform) => latestPrices[`${name?.toLowerCase()}__${platform}`]?.price || null;

  const filtered = useMemo(() => {
    if (!search.trim()) return allItems;
    const q = search.toLowerCase();
    return allItems.filter(i => i.name.toLowerCase().includes(q) || (i.category||'').toLowerCase().includes(q));
  }, [allItems, search]);

  const enteredCount = Object.values(prices).filter(v => v && String(v).trim() && parseFloat(v) > 0).length;

  const saveAll = async () => {
    const entries = Object.entries(prices)
      .filter(([,v]) => v && parseFloat(v) > 0)
      .map(([item_name, price]) => ({ item_name, platform: activePlatform, price }));
    if (!entries.length) return;
    setSaving(true);
    await onLog(entries);
    const newSaved = {};
    entries.forEach(e => { newSaved[e.item_name] = true; });
    setSaved(newSaved);
    setPrices({});
    setTimeout(() => setSaved({}), 2500);
    setSaving(false);
  };

  const historyItems = useMemo(() => {
    return histFilter === 'all' ? priceLog.slice(0,150) : priceLog.filter(h=>h.platform===histFilter).slice(0,150);
  }, [priceLog, histFilter]);

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {[{id:'log',label:'⚡ Quick Log'},{id:'history',label:'📋 History'}].map(m=>(
          <button key={m.id} onClick={()=>setViewMode(m.id)}
            style={{ flex:1, padding:'11px', borderRadius:10, border:'none', background:viewMode===m.id?C.accent:C.accentL, color:viewMode===m.id?'#fff':C.accent, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            {m.label}{m.id==='log'&&enteredCount>0?` (${enteredCount})`:''}
          </button>
        ))}
      </div>

      {viewMode==='log' && (
        <>
          {/* Tip */}
          <div style={{ padding:'10px 14px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:10, marginBottom:14, fontSize:13, color:'#15803d', lineHeight:1.6 }}>
            📱 Open Blinkit/Zepto on your phone → select platform below → type prices as you browse → Save All
          </div>

          {/* Platform selector */}
          <div style={{ marginBottom:14 }}>
            <span style={{ fontSize:11, fontWeight:700, color:C.text3, textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:8 }}>You are browsing:</span>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {Object.entries(PLATFORMS).map(([slug,p])=>(
                <button key={slug} onClick={()=>setActivePlatform(slug)}
                  style={{ padding:'12px 6px', borderRadius:12, border:`2px solid ${activePlatform===slug?p.bg:'#e5e7eb'}`, background:activePlatform===slug?p.bg:'#fff', color:activePlatform===slug?'#fff':C.text2, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all .15s', lineHeight:1.4 }}>
                  {p.label}
                  {activePlatform===slug && <div style={{ fontSize:10, marginTop:2, opacity:0.85 }}>✓ Active</div>}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div style={{ position:'relative', marginBottom:10 }}>
            <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:16, pointerEvents:'none' }}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search item..." style={{ ...S.inp, paddingLeft:38 }}/>
          </div>

          {/* Sticky save bar */}
          {enteredCount > 0 && (
            <div style={{ position:'sticky', top:0, zIndex:10, background:C.green, borderRadius:12, padding:'12px 16px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 4px 12px rgba(21,128,61,0.35)' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{enteredCount} prices ready</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.85)', marginTop:1 }}>{PLATFORMS[activePlatform].label} · tap to save</div>
              </div>
              <button onClick={saveAll} disabled={saving}
                style={{ padding:'10px 20px', borderRadius:10, border:'none', background:'#fff', color:C.green, fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
                {saving ? '...' : '💾 Save All'}
              </button>
            </div>
          )}

          <div style={{ fontSize:12, color:C.text3, marginBottom:10, fontWeight:600 }}>
            {filtered.length} items · {PLATFORMS[activePlatform].label}
          </div>

          {/* Item rows */}
          {filtered.map(item => {
            const price = prices[item.name] || '';
            const lastPrice = getLatest(item.name, activePlatform);
            const isSaved = saved[item.name];
            const low = isLow(item); const out = isOut(item);
            return (
              <div key={item.id||item.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', borderRadius:12, marginBottom:8, border:`1.5px solid ${isSaved?'#16a34a':price?C.accent:C.border}`, background:isSaved?'#f0fdf4':price?C.accentL:'#fff', transition:'all .2s' }}>
                <div style={{ fontSize:20, flexShrink:0 }}>{getCatIcon(item.category)}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text1 }}>{item.name}</div>
                  <div style={{ fontSize:11, color:C.text3, marginTop:2, display:'flex', gap:6, flexWrap:'wrap' }}>
                    {item.category && <span>{item.category}</span>}
                    {out && <span style={{ color:C.red, fontWeight:600 }}>Out of stock</span>}
                    {!out && low && <span style={{ color:'#d97706', fontWeight:600 }}>Low stock</span>}
                    {lastPrice && <span style={{ background:'#f3f4f6', padding:'1px 6px', borderRadius:20 }}>Last: {fmt(lastPrice)}</span>}
                  </div>
                </div>
                {isSaved ? (
                  <div style={{ fontSize:15, fontWeight:800, color:C.green, minWidth:60, textAlign:'right' }}>✓ Saved</div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontSize:16, fontWeight:700, color:C.text3 }}>₹</span>
                    <input
                      type="number" inputMode="numeric"
                      placeholder={lastPrice ? String(Math.round(lastPrice)) : '—'}
                      value={price}
                      onChange={e => setPrices(prev=>({...prev,[item.name]:e.target.value}))}
                      onKeyDown={e => {
                        if (e.key==='Enter') {
                          const idx = filtered.findIndex(i=>i.name===item.name);
                          const next = filtered[idx+1];
                          if (next && inputRefs[next.name]) inputRefs[next.name].focus();
                        }
                      }}
                      ref={el=>{ if(el) inputRefs[item.name]=el; }}
                      style={{ width:80, padding:'10px 8px', borderRadius:10, border:`2px solid ${price?C.accent:'#d1d5db'}`, fontSize:16, fontWeight:700, color:C.text1, background:'#fff', fontFamily:'inherit', textAlign:'center', outline:'none' }}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {enteredCount > 0 && (
            <button onClick={saveAll} disabled={saving}
              style={{ ...S.btn, width:'100%', padding:'14px', fontSize:15, marginTop:8, background:C.green }}>
              {saving ? 'Saving...' : `💾 Save ${enteredCount} prices from ${PLATFORMS[activePlatform].label}`}
            </button>
          )}

          {filtered.length===0 && (
            <div style={{ textAlign:'center', padding:'2rem', color:C.text3, fontSize:14 }}>No items found.</div>
          )}
        </>
      )}

      {viewMode==='history' && (
        <>
          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
            {[
              { l:'Total logs',     v:priceLog.length },
              { l:'Manual',         v:priceLog.filter(h=>h.source==='manual').length },
              { l:'Items tracked',  v:new Set(priceLog.map(h=>h.item_name?.toLowerCase())).size },
            ].map(s=>(
              <div key={s.l} style={{ background:C.cardBg, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px', textAlign:'center' }}>
                <div style={{ fontSize:18, fontWeight:800, color:C.text1 }}>{s.v}</div>
                <div style={{ fontSize:11, color:C.text3, marginTop:2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Platform filter */}
          <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:12, paddingBottom:2 }}>
            <button onClick={()=>setHistFilter('all')}
              style={{ padding:'6px 14px', borderRadius:20, border:`1px solid ${histFilter==='all'?C.accent:C.border}`, background:histFilter==='all'?C.accent:'#fff', color:histFilter==='all'?'#fff':C.text2, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
              All
            </button>
            {Object.entries(PLATFORMS).map(([slug,p])=>(
              <button key={slug} onClick={()=>setHistFilter(slug)}
                style={{ padding:'6px 14px', borderRadius:20, border:`2px solid ${histFilter===slug?p.bg:C.border}`, background:histFilter===slug?p.bg:'#fff', color:histFilter===slug?'#fff':C.text2, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                {p.label}
              </button>
            ))}
          </div>

          {historyItems.length===0 ? (
            <div style={{ textAlign:'center', padding:'3rem', color:C.text3, fontSize:14, lineHeight:1.8 }}>
              No prices logged yet.<br/>
              Switch to <strong>⚡ Quick Log</strong> and start logging<br/>prices while you browse.
            </div>
          ) : historyItems.map(h => {
            const daysAgo = Math.floor((Date.now()-new Date(h.logged_at))/86400000);
            return (
              <div key={h.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', borderRadius:10, border:`1px solid ${C.border}`, background:C.cardBg, marginBottom:8 }}>
                <div style={{ fontSize:18 }}>{getCatIcon(pantry.find(p=>p.name.toLowerCase()===h.item_name?.toLowerCase())?.category)}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text1 }}>{h.item_name}</div>
                  <div style={{ fontSize:11, color:C.text3, marginTop:2, display:'flex', gap:6, alignItems:'center' }}>
                    <span>{daysAgo===0?'Today':daysAgo===1?'Yesterday':`${daysAgo}d ago`}</span>
                    <span style={{ background:h.source==='manual'?'#f0fdf4':'#e0f2fe', color:h.source==='manual'?C.green:'#0369a1', padding:'0 6px', borderRadius:20, fontSize:10, fontWeight:700 }}>
                      {h.source==='manual'?'Manual':'Google'}
                    </span>
                  </div>
                </div>
                <Badge slug={h.platform}/>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginLeft:6 }}>{fmt(h.price)}</div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
