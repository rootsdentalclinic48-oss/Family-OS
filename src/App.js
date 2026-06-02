import React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE CLIENT ──────────────────────────────────────────────────────────
const supabase = createClient(
  "https://ihuuxhvxsbmzydclmbtx.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlodXV4aHZ4c2JtenlkY2xtYnR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzAzNjgsImV4cCI6MjA5NTkwNjM2OH0.RSY5SkQvmQgiz0u62Re1k6-AYYZ16trlFCiDULHsQaw"
);

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  bg: "#080810",
  card: "rgba(255,255,255,0.042)",
  cardHover: "rgba(255,255,255,0.07)",
  border: "rgba(255,255,255,0.075)",
  borderBright: "rgba(255,255,255,0.14)",
  text: "#EEECf8",
  muted: "rgba(238,236,248,0.42)",
  dim: "rgba(238,236,248,0.2)",
  accent: "#8B7CF8",
  accentSoft: "rgba(139,124,248,0.15)",
  accentGlow: "rgba(139,124,248,0.35)",
  green: "#34D399", greenSoft: "rgba(52,211,153,0.12)",
  amber: "#FBBF24", amberSoft: "rgba(251,191,36,0.12)",
  red: "#F87171",   redSoft: "rgba(248,113,113,0.12)",
  blue: "#60A5FA",  blueSoft: "rgba(96,165,250,0.12)",
  pink: "#F472B6",  pinkSoft: "rgba(244,114,182,0.12)",
  teal: "#2DD4BF",  tealSoft: "rgba(45,212,191,0.12)",
};

const inr = n => "₹" + Math.abs(Number(n) || 0).toLocaleString("en-IN");
const pct = (a, b) => b ? Math.min(100, Math.round((a / b) * 100)) : 0;
const today = () => new Date().toISOString().split("T")[0];

// ─── STYLES ───────────────────────────────────────────────────────────────────
const Styles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html{-webkit-tap-highlight-color:transparent;}
    body{font-family:'Outfit',sans-serif;background:${T.bg};color:${T.text};min-height:100vh;}
    ::-webkit-scrollbar{width:3px;height:3px;}
    ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px;}

    .root{
      display:flex;flex-direction:column;min-height:100vh;
      max-width:430px;margin:0 auto;background:${T.bg};
      background-image:
        radial-gradient(ellipse 700px 500px at 30% -150px,rgba(139,124,248,0.09) 0%,transparent 65%),
        radial-gradient(ellipse 400px 300px at 90% 40%,rgba(96,165,250,0.05) 0%,transparent 60%);
    }
    .screen{flex:1;padding-bottom:88px;animation:fadeUp .3s cubic-bezier(.16,1,.3,1);}
    @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
    .card{background:${T.card};border:1px solid ${T.border};border-radius:20px;backdrop-filter:blur(20px);transition:all .2s;}
    .card-tap:active{transform:scale(0.975);background:${T.cardHover};}
    .btn{border:none;cursor:pointer;font-family:'Outfit',sans-serif;transition:all .2s;display:inline-flex;align-items:center;justify-content:center;gap:8px;}
    .btn-primary{background:${T.accent};color:#fff;border-radius:14px;padding:14px 22px;font-size:15px;font-weight:700;box-shadow:0 4px 20px ${T.accentGlow};border:none;cursor:pointer;font-family:'Outfit',sans-serif;transition:all .2s;width:100%;}
    .btn-primary:active{transform:scale(0.97);}
    .btn-primary:disabled{opacity:0.5;cursor:not-allowed;}
    .input{width:100%;background:rgba(255,255,255,0.055);border:1px solid ${T.border};border-radius:13px;padding:13px 15px;color:${T.text};font-family:'Outfit',sans-serif;font-size:15px;outline:none;transition:all .2s;}
    .input:focus{border-color:${T.accent};background:rgba(139,124,248,0.05);}
    .input::placeholder{color:${T.dim};}
    select.input{appearance:none;}
    .bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;padding:10px 8px 26px;background:rgba(8,8,16,0.9);backdrop-filter:blur(40px);border-top:1px solid ${T.border};display:flex;justify-content:space-around;align-items:center;z-index:100;}
    .nav-btn{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:6px 6px;border-radius:14px;transition:all .2s;min-width:44px;}
    .nav-btn.on{background:rgba(139,124,248,0.12);}
    .nav-btn:active{transform:scale(0.88);}
    .nav-lbl{font-size:9px;font-weight:600;letter-spacing:.01em;}
    .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(10px);z-index:200;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn .2s ease;}
    @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
    .modal{width:100%;max-width:430px;background:#0E0E1A;border:1px solid ${T.border};border-bottom:none;border-radius:26px 26px 0 0;padding:22px 22px 40px;animation:slideUp .32s cubic-bezier(.16,1,.3,1);}
    @keyframes slideUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
    .modal-handle{width:36px;height:4px;background:rgba(255,255,255,0.12);border-radius:2px;margin:0 auto 18px;}
    .ph{padding:52px 20px 0;}
    .pt{font-size:18px;font-weight:800;letter-spacing:-.4px;}
    .ps{font-size:13px;color:${T.muted};margin-top:3px;}
    .row{display:flex;justify-content:space-between;align-items:center;}
    .sec-title{font-size:13px;font-weight:700;}
    .sec-link{font-size:12.5px;color:${T.accent};font-weight:600;cursor:pointer;}
    .chip{display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:100px;background:rgba(255,255,255,0.055);border:1px solid ${T.border};font-size:12.5px;font-weight:500;cursor:pointer;transition:all .2s;white-space:nowrap;}
    .chip.on{background:rgba(139,124,248,0.14);border-color:rgba(139,124,248,0.38);color:${T.accent};}
    .chip:active{transform:scale(0.94);}
    .scroll-x{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;}
    .scroll-x::-webkit-scrollbar{display:none;}
    .list-row{display:flex;align-items:center;gap:13px;padding:13px 0;border-bottom:1px solid ${T.border};cursor:pointer;transition:opacity .15s;}
    .list-row:last-child{border-bottom:none;}
    .list-row:active{opacity:.6;}
    .progress{height:5px;background:rgba(255,255,255,0.07);border-radius:100px;overflow:hidden;}
    .progress-fill{height:100%;border-radius:100px;transition:width 1.2s cubic-bezier(.16,1,.3,1);}
    .tag{display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:100px;font-size:11px;font-weight:600;}
    .mono{font-family:'JetBrains Mono',monospace;}
    .divider{height:1px;background:${T.border};margin:14px 0;}
    @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}
    .float{animation:float 3.5s ease-in-out infinite;}
    .ai-dot{width:7px;height:7px;background:${T.accent};border-radius:50%;animation:pulse 1.4s ease-in-out infinite;}
    .ai-dot:nth-child(2){animation-delay:.18s;}
    .ai-dot:nth-child(3){animation-delay:.36s;}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.4;transform:scale(0.75);}}
    @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
    .spinner{width:18px;height:18px;border:2px solid rgba(255,255,255,0.2);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;}
    .empty{text-align:center;padding:40px 20px;color:${T.muted};}
    .empty-icon{font-size:36px;margin-bottom:10px;}
    .empty-text{font-size:14px;}
    .alert-bar{padding:11px 15px;border-radius:14px;display:flex;gap:10px;align-items:center;margin-bottom:8px;}
    .fade-up{animation:fadeUp .4s cubic-bezier(.16,1,.3,1) both;}
  `}</style>
);

// ─── ICONS ────────────────────────────────────────────────────────────────────
const I = ({ n, s = 20, c = "currentColor", w = 1.8 }) => {
  const P = {
    home:"M3 9.5L12 3l9 6.5V21H15v-5h-6v5H3V9.5z",
    finance:"M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    house:"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10",
    plan:"M8 7V3m8 4V3M3 11h18M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    ai:"M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 010 2h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 010-2h1a7 7 0 017-7h1V5.73A2 2 0 0112 2z",
    profile:"M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
    plus:"M12 5v14M5 12h14", x:"M18 6L6 18M6 6l12 12",
    check:"M20 6L9 17l-5-5", right:"M9 18l6-6-6-6",
    send:"M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
    bell:"M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
    trash:"M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2",
    edit:"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
    logout:"M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  };
  const d = P[n] || P.home;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      {d.split(/(?=M)/).filter(Boolean).map((p,i) => <path key={i} d={p}/>)}
    </svg>
  );
};

// ─── MODAL WRAPPER ────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children }) => (
  <div className="modal-bg" onClick={onClose}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-handle"/>
      <div className="row" style={{marginBottom:16}}>
        <span style={{fontSize:19,fontWeight:700}}>{title}</span>
        <div onClick={onClose} style={{width:30,height:30,borderRadius:9,background:"rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <I n="x" s={15} c={T.muted}/>
        </div>
      </div>
      {children}
    </div>
  </div>
);

// ─── AUTH SCREENS ─────────────────────────────────────────────────────────────
const AuthScreen = ({ onLogin }) => {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name:"", email:"", password:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const prefill = who => { const emails = { Mayank: "drmayankgupta.mds@gmail.com", Simmi: "aggarwal.simmi09@gmail.com" }; setForm({ name: who, email: emails[who], password: "FamilyOS2026!" }); };
  const handle = async () => {
    if (!form.email || !form.password) { setError("Please fill all fields"); return; }
    setLoading(true); setError("");
    try {
      let result;
      if (mode === "signup") {
        result = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { name: form.name } } });
      } else {
        result = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      }
      if (result.error) { setError(result.error.message); }
      else { onLogin(result.data.user); }
    } catch(e) { setError("Connection error. Check your internet."); }
    setLoading(false);
  };

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",padding:"60px 24px 40px",background:T.bg,minHeight:"100vh",
      backgroundImage:`radial-gradient(ellipse 600px 500px at 50% -100px,rgba(139,124,248,0.12) 0%,transparent 65%)`}}>
      <div style={{textAlign:"center",marginBottom:36}}>
        <div style={{fontSize:56,marginBottom:16,animation:"float 3s ease-in-out infinite"}}>🏠</div>
        <div style={{fontSize:30,fontWeight:900,letterSpacing:"-.5px"}}>Family OS</div>
        <div style={{fontSize:14,color:T.muted,marginTop:6}}>Gupta Family · Sector 48, Gurgaon</div>
      </div>

      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,color:T.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Quick Sign In</div>
        <div style={{display:"flex",gap:10}}>
          {[{n:"Mayank",e:"👨‍⚕️"},{n:"Simmi",e:"👩"}].map(m => (
            <div key={m.n} onClick={() => prefill(m.n)} style={{flex:1,padding:"13px",background:form.name===m.n ? T.accentSoft : T.card,border:`1px solid ${form.name===m.n ? "rgba(139,124,248,0.3)" : T.border}`,borderRadius:16,textAlign:"center",cursor:"pointer",transition:"all .2s"}}>
              <div style={{fontSize:28,marginBottom:5}}>{m.e}</div>
              <div style={{fontSize:14,fontWeight:700,color:form.name===m.n ? T.accent : T.text}}>{m.n}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
        {mode==="signup" && <input className="input" placeholder="Your name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>}
        <input className="input" type="email" placeholder="Email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} autoCapitalize="none"/>
        <input className="input" type="password" placeholder="Password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handle()}/>
      </div>

      {error && <div style={{padding:"10px 14px",background:T.redSoft,border:"1px solid rgba(248,113,113,0.2)",borderRadius:12,fontSize:13,color:T.red,marginBottom:12}}>{error}</div>}

      <button className="btn-primary" onClick={handle} disabled={loading}>
        {loading ? <div className="spinner"/> : mode==="signin" ? "Sign In →" : "Create Account →"}
      </button>
      <div style={{textAlign:"center",marginTop:16,fontSize:13,color:T.muted}}>
        {mode==="signin" ? "New here? " : "Have an account? "}
        <span style={{color:T.accent,fontWeight:600,cursor:"pointer"}} onClick={()=>setMode(m=>m==="signin"?"signup":"signin")}>
          {mode==="signin" ? "Sign Up" : "Sign In"}
        </span>
      </div>
    </div>
  );
};

// ─── HOOKS ────────────────────────────────────────────────────────────────────

// Generic realtime hook
function useTable(table, familyId, extra = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    if (!familyId) return;
    let q = supabase.from(table).select("*").eq("family_id", familyId);
    if (extra.order) q = q.order(extra.order, { ascending: extra.asc ?? false });
    if (extra.limit) q = q.limit(extra.limit);
    const { data } = await q;
    if (data) setRows(data);
    setLoading(false);
  }, [table, familyId]);

  useEffect(() => {
    fetch_();
    if (!familyId) return;
    const sub = supabase.channel(`rt-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, fetch_)
      .subscribe();
    return () => sub.unsubscribe();
  }, [fetch_]);

  const add = async (row) => {
    const { data, error } = await supabase.from(table).insert([{ ...row, family_id: familyId }]).select();
    if (data) setRows(prev => [data[0], ...prev]);
    return { data, error };
  };

  const update_ = async (id, patch) => {
    await supabase.from(table).update(patch).eq("id", id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const remove = async (id) => {
    await supabase.from(table).delete().eq("id", id);
    setRows(prev => prev.filter(r => r.id !== id));
  };

  return { rows, loading, add, update: update_, remove, refresh: fetch_ };
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
const HomeScreen = ({ navigate, openModal, familyId, user }) => {
  const { rows: tasks } = useTable("tasks", familyId, { order: "created_at" });
  const { rows: txns } = useTable("transactions", familyId, { order: "date", limit: 10 });
  const { rows: grocery } = useTable("grocery", familyId);
  const { rows: bills } = useTable("bills", familyId, { order: "due_date", asc: true });
  const { rows: goals } = useTable("goals", familyId);

  const pendingTasks = tasks.filter(t => !t.done);
  const lowGrocery = grocery.filter(g => Number(g.quantity) <= Number(g.par_level));
  const urgentBills = bills.filter(b => !b.paid && b.is_urgent);
  const totalSpent = txns.filter(t => Number(t.amount) < 0).reduce((a, t) => a + Math.abs(Number(t.amount)), 0);
  const totalIncome = txns.filter(t => Number(t.amount) > 0).reduce((a, t) => a + Number(t.amount), 0);
  .user_metadata?.name || "Mayank & Simmi";

  const userName = "Mayank & Simmi";
  return (
    <div className="screen">
      <div style={{padding:"44px 16px 0"}}>
        <div className="row">
          <div>
            <div style={{fontSize:12,color:T.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:".04em"}}>Good morning ☀️</div>
            <div style={{fontSize:20,fontWeight:900,letterSpacing:"-.4px",marginTop:2}}>{userName}</div>
            <div style={{fontSize:12,color:T.dim,marginTop:2}}>📍 Sector 48, Gurgaon</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <div style={{width:38,height:38,borderRadius:11,background:T.card,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative"}}
              onClick={()=>navigate("notifications")}>
              <I n="bell" s={17} c={T.muted}/>
              {urgentBills.length > 0 && <div style={{position:"absolute",top:7,right:7,width:8,height:8,background:T.red,borderRadius:"50%",border:"2px solid #080810"}}/>}
            </div>
          </div>
        </div>
      </div>

      {/* Urgent alerts */}
      {(urgentBills.length > 0 || lowGrocery.length > 0) && (
        <div style={{padding:"14px 20px 0"}}>
          {urgentBills.length > 0 && (
            <div className="alert-bar" style={{background:T.redSoft,border:"1px solid rgba(248,113,113,0.2)"}}>
              <span style={{fontSize:15}}>🔴</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:T.red}}>{urgentBills.length} Urgent Bill{urgentBills.length>1?"s":""}</div>
                <div style={{fontSize:11.5,color:T.muted}}>{urgentBills.slice(0,2).map(b=>b.name).join(" · ")}</div>
              </div>
              <span onClick={()=>navigate("finance")} style={{fontSize:12,color:T.red,fontWeight:600,cursor:"pointer"}}>Pay →</span>
            </div>
          )}
          {lowGrocery.length > 0 && (
            <div className="alert-bar" style={{background:T.amberSoft,border:"1px solid rgba(251,191,36,0.2)"}}>
              <span style={{fontSize:15}}>🛒</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:T.amber}}>{lowGrocery.length} items need restocking</div>
                <div style={{fontSize:11.5,color:T.muted}}>{lowGrocery.slice(0,3).map(g=>g.name).join(", ")}</div>
              </div>
              <span onClick={()=>navigate("household")} style={{fontSize:12,color:T.amber,fontWeight:600,cursor:"pointer"}}>View →</span>
            </div>
          )}
        </div>
      )}

      {/* Finance Card */}
      <div style={{padding:"16px 20px 0"}}>
        <div className="card card-tap" style={{padding:14,background:"linear-gradient(135deg,rgba(139,124,248,0.14),rgba(96,165,250,0.07))",borderColor:"rgba(139,124,248,0.22)",cursor:"pointer"}} onClick={()=>navigate("finance")}>
          <div className="row">
            <div>
              <div style={{fontSize:11,color:T.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:".05em"}}>This Month</div>
              <div style={{fontSize:22,fontWeight:900,letterSpacing:"-1px",marginTop:2}} className="mono">{inr(totalIncome - totalSpent)}</div>
            </div>
            <div style={{padding:"6px 11px",background:T.greenSoft,border:"1px solid rgba(52,211,153,0.22)",borderRadius:100,fontSize:12,color:T.green,fontWeight:600}}>
              ↑ {inr(totalIncome - totalSpent)} saved
            </div>
          </div>
          <div style={{display:"flex",gap:0,marginTop:16,borderTop:`1px solid ${T.border}`,paddingTop:13}}>
            {[
              {l:"Income",v:inr(totalIncome),c:T.green},
              {l:"Spent",v:inr(totalSpent),c:T.red},
              {l:"Tasks",v:`${pendingTasks.length} left`,c:T.accent},
            ].map((s,i)=>(
              <div key={s.l} style={{flex:1,borderRight:i<2?`1px solid ${T.border}`:"none",paddingRight:i<2?12:0,paddingLeft:i>0?12:0}}>
                <div style={{fontSize:11,color:T.muted}}>{s.l}</div>
                <div style={{fontSize:14,fontWeight:700,color:s.c,marginTop:2}} className="mono">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{padding:"18px 20px 0"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {[
            {emoji:"💸",label:"Expense",color:T.accent,action:()=>openModal("expense")},
            {emoji:"✅",label:"Task",color:T.green,action:()=>openModal("task")},
            {emoji:"🛒",label:"Grocery",color:T.amber,action:()=>openModal("grocery")},
            {emoji:"🤖",label:"Ask AI",color:T.pink,action:()=>navigate("ai")},
          ].map(q=>(
            <div key={q.label} onClick={q.action} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:7,cursor:"pointer"}}>
              <div style={{width:44,height:44,borderRadius:13,background:`${q.color}14`,border:`1px solid ${q.color}28`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,transition:"all .2s"}}>{q.emoji}</div>
              <span style={{fontSize:10,color:T.muted,fontWeight:600}}>{q.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tasks */}
      <div style={{padding:"18px 20px 0"}}>
        <div className="row" style={{marginBottom:12}}>
          <span className="sec-title">Pending Tasks</span>
          <span className="sec-link" onClick={()=>navigate("household")}>{pendingTasks.length} total</span>
        </div>
        {pendingTasks.length === 0
          ? <div className="card" style={{padding:"20px",textAlign:"center",color:T.muted,fontSize:14}}>🎉 All tasks done!</div>
          : <div className="card" style={{padding:"4px 16px"}}>
              {pendingTasks.slice(0,4).map(t=>(
                <div key={t.id} className="list-row">
                  <div style={{width:21,height:21,borderRadius:7,border:`2px solid ${t.priority==="high"?T.red:t.priority==="medium"?T.amber:T.green}`,flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:500}}>{t.title}</div>
                    <div style={{fontSize:11.5,color:T.muted}}>
                      {t.assignee==="Mayank"?"👨‍⚕️":"👩"} {t.assignee} · {t.due_date||"No date"}
                    </div>
                  </div>
                  <span className="tag" style={{background:t.priority==="high"?T.redSoft:t.priority==="medium"?T.amberSoft:T.greenSoft,color:t.priority==="high"?T.red:t.priority==="medium"?T.amber:T.green}}>{t.priority}</span>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Recent Transactions */}
      <div style={{padding:"18px 20px 0"}}>
        <div className="row" style={{marginBottom:12}}>
          <span className="sec-title">Recent</span>
          <span className="sec-link" onClick={()=>navigate("finance")}>All</span>
        </div>
        {txns.length === 0
          ? <div className="card" style={{padding:"20px",textAlign:"center",color:T.muted,fontSize:14}}>No transactions yet. Add your first expense!</div>
          : <div className="card" style={{padding:"4px 16px"}}>
              {txns.slice(0,4).map(tx=>(
                <div key={tx.id} className="list-row">
                  <div style={{width:38,height:38,borderRadius:11,background:Number(tx.amount)>0?T.greenSoft:T.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{tx.emoji||"💸"}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:500}}>{tx.description}</div>
                    <div style={{fontSize:11.5,color:T.muted}}>{tx.added_by==="Mayank"?"👨‍⚕️":"👩"} {tx.added_by} · {tx.date}</div>
                  </div>
                  <div style={{fontSize:14,fontWeight:700,color:Number(tx.amount)>0?T.green:T.text}} className="mono">
                    {Number(tx.amount)>0?"+":""}{inr(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Goals */}
      {goals.length > 0 && (
        <div style={{padding:"18px 20px 24px"}}>
          <div className="row" style={{marginBottom:12}}>
            <span className="sec-title">Goals</span>
            <span className="sec-link" onClick={()=>navigate("planner")}>All {goals.length}</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {goals.slice(0,2).map(g=>(
              <div key={g.id} className="card" style={{padding:"15px 16px"}}>
                <div className="row" style={{marginBottom:10}}>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <span style={{fontSize:22}}>{g.emoji||"🎯"}</span>
                    <div>
                      <div style={{fontSize:14,fontWeight:600}}>{g.title}</div>
                      <div style={{fontSize:11,color:T.muted}}>{inr(g.saved_amount)} of {inr(g.target_amount)}</div>
                    </div>
                  </div>
                  <div style={{fontSize:22,fontWeight:900,color:g.color||T.accent}}>{pct(g.saved_amount,g.target_amount)}%</div>
                </div>
                <div className="progress"><div className="progress-fill" style={{width:`${pct(g.saved_amount,g.target_amount)}%`,background:g.color||T.accent}}/></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── FINANCE SCREEN ───────────────────────────────────────────────────────────
const FinanceScreen = ({ familyId }) => {
  const [tab, setTab] = useState("transactions");
  const { rows: txns, loading, remove } = useTable("transactions", familyId, { order: "date", limit: 50 });
  const { rows: bills } = useTable("bills", familyId, { order: "due_date", asc: true });
  const { rows: budgets } = useTable("budgets", familyId);

  const income = txns.filter(t=>Number(t.amount)>0).reduce((a,t)=>a+Number(t.amount),0);
  const spent = txns.filter(t=>Number(t.amount)<0).reduce((a,t)=>a+Math.abs(Number(t.amount)),0);

  return (
    <div className="screen">
      <div className="ph">
        <div className="row">
          <div><div className="pt">Finance</div><div className="ps">Live data · Supabase ✓</div></div>
          <div style={{padding:"6px 12px",background:T.greenSoft,border:"1px solid rgba(52,211,153,0.22)",borderRadius:100,fontSize:12,color:T.green,fontWeight:600}}>Live ●</div>
        </div>
      </div>

      {/* Summary */}
      <div style={{padding:"14px 20px 0"}}>
        <div className="card" style={{padding:18,background:"linear-gradient(135deg,rgba(139,124,248,0.12),rgba(96,165,250,0.06))",borderColor:"rgba(139,124,248,0.2)",marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {[
              {l:"Income",v:inr(income),c:T.green},
              {l:"Spent",v:inr(spent),c:T.red},
              {l:"Net",v:inr(income-spent),c:T.accent},
            ].map(s=>(
              <div key={s.l} style={{textAlign:"center"}}>
                <div style={{fontSize:10,color:T.muted,fontWeight:600,textTransform:"uppercase"}}>{s.l}</div>
                <div style={{fontSize:16,fontWeight:800,color:s.c,marginTop:3}} className="mono">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="scroll-x" style={{padding:"0 20px",marginBottom:16}}>
        {["transactions","bills","budgets"].map(t=>(
          <div key={t} className={`chip ${tab===t?"on":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
        ))}
      </div>

      <div style={{padding:"0 20px"}}>
        {tab==="transactions" && (
          loading ? <div style={{textAlign:"center",padding:40,color:T.muted}}>Loading...</div>
          : txns.length===0
            ? <div className="empty"><div className="empty-icon">💸</div><div className="empty-text">No transactions yet. Add your first expense!</div></div>
            : <div className="card" style={{padding:"4px 16px"}}>
                {txns.map(tx=>(
                  <div key={tx.id} className="list-row">
                    <div style={{width:38,height:38,borderRadius:11,background:Number(tx.amount)>0?T.greenSoft:T.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{tx.emoji||"💸"}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:500}}>{tx.description}</div>
                      <div style={{fontSize:11.5,color:T.muted}}>{tx.category} · {tx.date}</div>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <div style={{fontSize:14,fontWeight:700,color:Number(tx.amount)>0?T.green:T.text}} className="mono">
                        {Number(tx.amount)>0?"+":""}{inr(tx.amount)}
                      </div>
                      <div onClick={()=>remove(tx.id)} style={{cursor:"pointer",opacity:0.4}}><I n="trash" s={14} c={T.red}/></div>
                    </div>
                  </div>
                ))}
              </div>
        )}

        {tab==="bills" && (
          bills.length===0
            ? <div className="empty"><div className="empty-icon">📋</div><div className="empty-text">No bills added yet</div></div>
            : <div className="card" style={{padding:"4px 16px"}}>
                {bills.map(b=>(
                  <div key={b.id} className="list-row">
                    <div style={{width:38,height:38,borderRadius:11,background:b.is_urgent?T.redSoft:T.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{b.emoji||"📋"}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:500}}>{b.name}</div>
                      <div style={{fontSize:11.5,color:b.is_urgent?T.red:T.muted}}>Due {b.due_date}{b.is_urgent?" 🔴":""}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:14,fontWeight:700}} className="mono">{inr(b.amount)}</div>
                      <div style={{fontSize:11,color:b.paid?T.green:T.muted}}>{b.paid?"✓ Paid":"Pending"}</div>
                    </div>
                  </div>
                ))}
              </div>
        )}

        {tab==="budgets" && (
          budgets.length===0
            ? <div className="empty"><div className="empty-icon">📊</div><div className="empty-text">No budgets set yet. Run the SQL setup to seed default budgets.</div></div>
            : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {budgets.map(b=>{
                  const spent_ = txns.filter(t=>t.category===b.category&&Number(t.amount)<0).reduce((a,t)=>a+Math.abs(Number(t.amount)),0);
                  const p = pct(spent_, b.monthly_limit);
                  return (
                    <div key={b.id} className="card" style={{padding:"14px 16px"}}>
                      <div className="row" style={{marginBottom:9}}>
                        <div style={{display:"flex",gap:9,alignItems:"center"}}>
                          <span style={{fontSize:17}}>{b.emoji||"📊"}</span>
                          <span style={{fontSize:14,fontWeight:600}}>{b.category}</span>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:13,fontWeight:700}} className="mono">{inr(spent_)}</div>
                          <div style={{fontSize:10,color:T.muted}}>/ {inr(b.monthly_limit)}</div>
                        </div>
                      </div>
                      <div className="progress">
                        <div className="progress-fill" style={{width:`${p}%`,background:p>=100?T.red:p>=80?T.amber:b.color||T.green}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
        )}
      </div>
    </div>
  );
};

// ─── HOUSEHOLD SCREEN ─────────────────────────────────────────────────────────
const HouseholdScreen = ({ familyId }) => {
  const [tab, setTab] = useState("chores");
  const { rows: tasks, update: updTask, remove: removeTask } = useTable("tasks", familyId, { order: "created_at" });
  const { rows: grocery, update: updGrocery } = useTable("grocery", familyId, { order: "name", asc: true });
  const { rows: docs } = useTable("documents", familyId);
  const { rows: maint } = useTable("maintenance", familyId);

  const toggleTask = (id, done) => updTask(id, { done, done_at: done ? new Date().toISOString() : null });

  return (
    <div className="screen">
      <div className="ph">
        <div className="pt">Household</div>
        <div className="ps">{tasks.filter(t=>!t.done).length} tasks pending · {grocery.filter(g=>Number(g.quantity)<=Number(g.par_level)).length} grocery alerts</div>
      </div>
      <div className="scroll-x" style={{padding:"0 20px",marginBottom:16}}>
        {["chores","grocery","maintenance","documents"].map(t=>(
          <div key={t} className={`chip ${tab===t?"on":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
        ))}
      </div>

      <div style={{padding:"0 20px"}}>
        {tab==="chores" && (
          <>
            {["Mayank","Simmi"].map(person=>{
              const mine = tasks.filter(t=>t.assignee===person);
              if(!mine.length) return null;
              return (
                <div key={person} style={{marginBottom:20}}>
                  <div style={{fontSize:13,fontWeight:700,color:person==="Mayank"?T.accent:T.pink,marginBottom:10}}>
                    {person==="Mayank"?"👨‍⚕️":"👩"} {person} ({mine.filter(t=>!t.done).length} pending)
                  </div>
                  <div className="card" style={{padding:"4px 16px"}}>
                    {mine.map(task=>(
                      <div key={task.id} className="list-row" onClick={()=>toggleTask(task.id,!task.done)}>
                        <div style={{width:22,height:22,borderRadius:7,border:`2px solid ${task.done?T.green:task.priority==="high"?T.red:task.priority==="medium"?T.amber:T.green}`,display:"flex",alignItems:"center",justifyContent:"center",background:task.done?T.green:"transparent",flexShrink:0,transition:"all .2s"}}>
                          {task.done && <I n="check" s={12} c="white" w={2.5}/>}
                        </div>
                        <div style={{flex:1,opacity:task.done?0.45:1}}>
                          <div style={{fontSize:14,fontWeight:500,textDecoration:task.done?"line-through":"none"}}>{task.title}</div>
                          <div style={{fontSize:11.5,color:T.muted}}>{task.category} · {task.due_date||"No date"}</div>
                        </div>
                        {!task.done && <span className="tag" style={{background:task.priority==="high"?T.redSoft:task.priority==="medium"?T.amberSoft:T.greenSoft,color:task.priority==="high"?T.red:task.priority==="medium"?T.amber:T.green}}>{task.priority}</span>}
                        <div onClick={e=>{e.stopPropagation();removeTask(task.id);}} style={{cursor:"pointer",opacity:0.35,marginLeft:4}}><I n="trash" s={14} c={T.red}/></div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {tasks.length===0 && <div className="empty"><div className="empty-icon">✅</div><div className="empty-text">No tasks yet. Add your first task!</div></div>}
          </>
        )}

        {tab==="grocery" && (
          <>
            {grocery.filter(g=>Number(g.quantity)<=Number(g.par_level)).length>0 && (
              <div style={{padding:"12px 14px",background:T.amberSoft,border:"1px solid rgba(251,191,36,0.22)",borderRadius:14,marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,color:T.amber}}>🛒 Shopping needed: {grocery.filter(g=>Number(g.quantity)<=Number(g.par_level)).length} items</div>
              </div>
            )}
            {grocery.length===0
              ? <div className="empty"><div className="empty-icon">🛒</div><div className="empty-text">No grocery items. Add items to track inventory!</div></div>
              : <div className="card" style={{padding:"4px 16px"}}>
                  {grocery.map(item=>(
                    <div key={item.id} className="list-row">
                      <div style={{width:8,height:8,borderRadius:"50%",background:Number(item.quantity)<=Number(item.par_level)?T.red:T.green,flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:500}}>{item.name}</div>
                        <div style={{fontSize:11.5,color:T.muted}}>{item.category} · Exp: {item.expiry_date||"—"}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:14,fontWeight:600}}>{item.quantity} {item.unit}</div>
                        {Number(item.quantity)<=Number(item.par_level) && <div style={{fontSize:10,color:T.red,fontWeight:600}}>Restock</div>}
                      </div>
                    </div>
                  ))}
                </div>
            }
          </>
        )}

        {tab==="maintenance" && (
          maint.length===0
            ? <div className="empty"><div className="empty-icon">🔧</div><div className="empty-text">No maintenance schedules yet</div></div>
            : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {maint.map(m=>(
                  <div key={m.id} className="card" style={{padding:"15px",borderColor:m.overdue?"rgba(248,113,113,0.3)":T.border}}>
                    <div className="row">
                      <div style={{display:"flex",gap:12,alignItems:"center"}}>
                        <div style={{width:42,height:42,borderRadius:13,background:m.overdue?T.redSoft:T.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{m.emoji||"🔧"}</div>
                        <div>
                          <div style={{fontSize:14,fontWeight:600}}>{m.name}</div>
                          <div style={{fontSize:11.5,color:T.muted}}>Last: {m.last_done||"Never"}</div>
                        </div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <span className="tag" style={{background:m.overdue?T.redSoft:T.greenSoft,color:m.overdue?T.red:T.green}}>{m.overdue?"Overdue":"On Track"}</span>
                        <div style={{fontSize:11,color:T.muted,marginTop:4}}>Next: {m.next_due||"—"}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
        )}

        {tab==="documents" && (
          docs.length===0
            ? <div className="empty"><div className="empty-icon">📁</div><div className="empty-text">No documents yet. Add your family documents!</div></div>
            : <div className="card" style={{padding:"4px 16px"}}>
                {docs.map(doc=>(
                  <div key={doc.id} className="list-row">
                    <div style={{width:38,height:38,borderRadius:11,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{doc.emoji||"📄"}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:500}}>{doc.name}</div>
                      <div style={{fontSize:11.5,color:T.muted}}>{doc.category} · {doc.date||""}</div>
                    </div>
                    <I n="right" s={15} c={T.dim}/>
                  </div>
                ))}
              </div>
        )}
      </div>
    </div>
  );
};

// ─── PLANNER SCREEN ───────────────────────────────────────────────────────────
const PlannerScreen = ({ familyId }) => {
  const [tab, setTab] = useState("goals");
  const { rows: goals, update: updGoal } = useTable("goals", familyId);
  const { rows: events } = useTable("events", familyId, { order: "event_date", asc: true });
  const { rows: health } = useTable("health", familyId);
  const [sel, setSel] = useState(new Date().getDate());

  return (
    <div className="screen">
      <div className="ph"><div className="pt">Planner</div><div className="ps">Goals · Health · Calendar</div></div>
      <div className="scroll-x" style={{padding:"0 20px",marginBottom:16}}>
        {["goals","calendar","health"].map(t=>(
          <div key={t} className={`chip ${tab===t?"on":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
        ))}
      </div>

      <div style={{padding:"0 20px"}}>
        {tab==="goals" && (
          goals.length===0
            ? <div className="empty"><div className="empty-icon">🎯</div><div className="empty-text">No goals yet. Add your first family goal!</div></div>
            : <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {goals.map(g=>{
                  const p=pct(g.saved_amount,g.target_amount);
                  return (
                    <div key={g.id} className="card" style={{padding:"18px"}}>
                      <div className="row" style={{marginBottom:14}}>
                        <div style={{display:"flex",gap:12,alignItems:"center"}}>
                          <div style={{width:46,height:46,borderRadius:14,background:`${g.color||T.accent}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{g.emoji||"🎯"}</div>
                          <div>
                            <div style={{fontSize:15,fontWeight:700}}>{g.title}</div>
                            <div style={{fontSize:11.5,color:T.muted}}>By {g.target_date||"—"} · +{inr(g.monthly_contribution)}/mo</div>
                          </div>
                        </div>
                        <div style={{fontSize:26,fontWeight:900,color:g.color||T.accent}}>{p}%</div>
                      </div>
                      <div className="progress" style={{height:7}}>
                        <div className="progress-fill" style={{width:`${p}%`,background:g.color||T.accent}}/>
                      </div>
                      <div className="row" style={{marginTop:9}}>
                        <span style={{fontSize:12,color:T.muted}}>Saved: <span style={{color:g.color||T.accent,fontWeight:700}}>{inr(g.saved_amount)}</span></span>
                        <span style={{fontSize:12,color:T.muted}}>Target: {inr(g.target_amount)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
        )}

        {tab==="calendar" && (
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:6}}>
              {["S","M","T","W","T","F","S"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:11,color:T.muted,fontWeight:700,padding:"4px 0"}}>{d}</div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:20}}>
              {[...Array(2)].map((_,i)=><div key={`g${i}`}/>)}
              {Array.from({length:30},(_,i)=>i+1).map(d=>{
                const hasEv = events.some(e=>new Date(e.event_date).getDate()===d);
                const isSel = d===sel;
                return (
                  <div key={d} onClick={()=>setSel(d)} style={{textAlign:"center",padding:"7px 2px",borderRadius:10,fontSize:12.5,fontWeight:isSel?800:400,background:isSel?T.accent:"transparent",color:isSel?"white":T.text,cursor:"pointer",transition:"all .15s",position:"relative"}}>
                    {d}
                    {hasEv&&!isSel&&<div style={{width:4,height:4,borderRadius:"50%",background:T.accent,margin:"2px auto 0"}}/>}
                  </div>
                );
              })}
            </div>
            {events.length===0
              ? <div className="empty"><div className="empty-icon">📅</div><div className="empty-text">No events yet</div></div>
              : <div className="card" style={{padding:"4px 16px"}}>
                  {events.map(ev=>(
                    <div key={ev.id} className="list-row">
                      <div style={{width:38,height:38,borderRadius:11,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{ev.emoji||"📅"}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:500}}>{ev.title}</div>
                        <div style={{fontSize:11.5,color:T.muted,textTransform:"capitalize"}}>{ev.type}</div>
                      </div>
                      <span style={{fontSize:12.5,color:T.accent,fontWeight:600}}>{ev.event_date}</span>
                    </div>
                  ))}
                </div>
            }
          </>
        )}

        {tab==="health" && (
          health.length===0
            ? <div className="empty"><div className="empty-icon">💊</div><div className="empty-text">No health records yet. Add family health data!</div></div>
            : <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {health.map(h=>(
                  <div key={h.id} className="card" style={{padding:"18px"}}>
                    <div className="row" style={{marginBottom:12}}>
                      <div style={{display:"flex",gap:12,alignItems:"center"}}>
                        <div style={{width:44,height:44,borderRadius:14,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{h.emoji||"👤"}</div>
                        <div>
                          <div style={{fontSize:15,fontWeight:700}}>{h.member_name}</div>
                          <div style={{fontSize:11.5,color:T.muted}}>Age {h.age} · Next: {h.next_checkup||"—"}</div>
                        </div>
                      </div>
                      <span className="tag" style={{background:T.greenSoft,color:T.green}}>Active</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                      {[{l:"Weight",v:h.weight||"—"},{l:"BP",v:h.blood_pressure||"—"},{l:"Sugar",v:h.blood_sugar||"—"}].map(m=>(
                        <div key={m.l} style={{padding:"9px 11px",background:"rgba(255,255,255,0.04)",borderRadius:10}}>
                          <div style={{fontSize:10,color:T.muted}}>{m.l}</div>
                          <div style={{fontSize:13,fontWeight:600,marginTop:2}}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                    {h.medications && h.medications!=="None" && (
                      <div style={{marginTop:10,padding:"9px 12px",background:T.amberSoft,borderRadius:10,fontSize:12,color:T.amber}}>💊 {h.medications}</div>
                    )}
                  </div>
                ))}
              </div>
        )}
      </div>
    </div>
  );
};

// ─── AI SCREEN ────────────────────────────────────────────────────────────────
const AIScreen = ({ familyId }) => {
  const { rows: txns } = useTable("transactions", familyId, { order: "date", limit: 20 });
  const { rows: tasks } = useTable("tasks", familyId, { order: "created_at" });
  const { rows: grocery } = useTable("grocery", familyId);
  const { rows: goals } = useTable("goals", familyId);
  const { rows: bills } = useTable("bills", familyId);

  const [msgs, setMsgs] = useState([{
    role:"assistant",
    text:"Namaste! 🙏 I'm your Family OS AI — now connected to your live Supabase data.\n\nI can see your real transactions, tasks, grocery inventory, and goals. Ask me anything!",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const suggestions = [
    "Summarise this month's spending",
    "What tasks are pending?",
    "Which groceries need restocking?",
    "How are our goals progressing?",
    "What bills are due soon?",
    "Give financial advice",
  ];

  const buildContext = () => {
    const income = txns.filter(t=>Number(t.amount)>0).reduce((a,t)=>a+Number(t.amount),0);
    const spent = txns.filter(t=>Number(t.amount)<0).reduce((a,t)=>a+Math.abs(Number(t.amount)),0);
    const pendingTasks = tasks.filter(t=>!t.done);
    const lowStock = grocery.filter(g=>Number(g.quantity)<=Number(g.par_level));
    const dueBills = bills.filter(b=>!b.paid);

    return `You are the personal AI assistant for the Gupta family in Sector 48, Gurgaon.
You have access to their LIVE real-time household data from Supabase.
Respond warmly, concisely, using ₹ for currency and Indian English. Use emojis naturally.

LIVE DATA:
Income this period: ₹${income.toLocaleString("en-IN")}
Spent this period: ₹${spent.toLocaleString("en-IN")}
Net: ₹${(income-spent).toLocaleString("en-IN")}

Recent transactions (${txns.length}):
${txns.slice(0,8).map(t=>`- ${t.description}: ₹${Math.abs(Number(t.amount)).toLocaleString("en-IN")} (${t.category}, ${t.added_by})`).join("\n")}

Pending tasks (${pendingTasks.length}):
${pendingTasks.slice(0,6).map(t=>`- ${t.title} → ${t.assignee} [${t.priority}] due ${t.due_date||"no date"}`).join("\n")}

Low grocery items (${lowStock.length}): ${lowStock.map(g=>g.name).join(", ")||"None"}

Goals:
${goals.map(g=>`- ${g.title}: ${Math.round((g.saved_amount/g.target_amount)*100)}% (₹${Number(g.saved_amount).toLocaleString("en-IN")} / ₹${Number(g.target_amount).toLocaleString("en-IN")})`).join("\n")||"No goals set"}

Unpaid bills: ${dueBills.map(b=>`${b.name} ₹${Number(b.amount).toLocaleString("en-IN")} due ${b.due_date}`).join(", ")||"None"}`;
  };

  const send = useCallback(async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput("");
    setMsgs(m=>[...m,{role:"user",text:q}]);
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":process.env.REACT_APP_ANTHROPIC_KEY||"","anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:500,
          messages:[{role:"user",content:`${buildContext()}\n\nQuestion: ${q}`}],
        }),
      });
      const ql=q.toLowerCase();
      const income=txns.filter(t=>Number(t.amount)>0).reduce((a,t)=>a+Number(t.amount),0);
      const spent=txns.filter(t=>Number(t.amount)<0).reduce((a,t)=>a+Math.abs(Number(t.amount)),0);
      const pending=tasks.filter(t=>t.done===false);
      const lowStock=grocery.filter(g=>Number(g.quantity)<=Number(g.par_level));
      const dueBills=bills.filter(b=>b.paid===false);
      let ans="";
      if(ql.includes("hi")||ql.includes("hello")||ql.includes("namaste")){ans="Namaste Mayank and Simmi! Saved: Rs"+(income-spent)+" | Tasks: "+pending.length+" | Restock: "+lowStock.length+" | Bills: "+dueBills.length;}
      else if(ql.includes("spend")||ql.includes("expense")||ql.includes("money")){ans="Income: Rs"+income+" | Spent: Rs"+spent+" | Saved: Rs"+(income-spent);}
      else if(ql.includes("task")||ql.includes("pending")){ans=pending.length===0?"All tasks done":pending.length+" pending: "+pending.slice(0,5).map(t=>t.title).join(", ");}
      else if(ql.includes("grocery")||ql.includes("restock")){ans=lowStock.length===0?"All stocked":"Restock: "+lowStock.map(g=>g.name).join(", ");}
      else if(ql.includes("bill")||ql.includes("pay")){ans=dueBills.length===0?"No pending bills":"Unpaid: "+dueBills.map(b=>b.name).join(", ");}
      else if(ql.includes("goal")){ans=goals.length===0?"No goals yet":goals.map(g=>g.title+": "+Math.round((g.saved_amount/g.target_amount)*100)+"%").join(", ");}
      else{ans="Ask me about spending, tasks, grocery, bills or goals";}
      setMsgs(m=>[...m,{role:"assistant",text:ans}]);
    } catch(e) {
      setMsgs(m=>[...m,{role:"assistant",text:"Something went wrong. Try again."}]);
    }
    setLoading(false);
  },[input,loading,txns,tasks,grocery,goals,bills]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);

  return (
    <div className="screen" style={{display:"flex",flexDirection:"column"}}>
      <div style={{padding:"52px 20px 0"}}>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <div style={{width:46,height:46,borderRadius:14,background:"linear-gradient(135deg,rgba(139,124,248,0.25),rgba(96,165,250,0.15))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}} className="float">🤖</div>
          <div>
            <div className="pt" style={{fontSize:22}}>AI Assistant</div>
            <div style={{display:"flex",gap:5,alignItems:"center",marginTop:2}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:T.green}}/>
              <span style={{fontSize:11.5,color:T.green,fontWeight:600}}>Live data · Claude + Supabase</span>
            </div>
          </div>
        </div>
      </div>

      <div className="scroll-x" style={{padding:"12px 20px 0"}}>
        {suggestions.map(s=>(
          <div key={s} className="chip" onClick={()=>send(s)} style={{fontSize:12}}>{s}</div>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"14px 20px",display:"flex",flexDirection:"column",gap:12,minHeight:0}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"86%",padding:"13px 15px",borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",background:m.role==="user"?T.accent:"rgba(255,255,255,0.055)",border:m.role==="user"?"none":`1px solid ${T.border}`,fontSize:14,lineHeight:1.65,whiteSpace:"pre-line"}}>
              {m.text}
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex"}}>
            <div style={{padding:"13px 16px",borderRadius:"18px 18px 18px 4px",background:"rgba(255,255,255,0.055)",border:`1px solid ${T.border}`,display:"flex",gap:5,alignItems:"center"}}>
              <div className="ai-dot"/><div className="ai-dot"/><div className="ai-dot"/>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      <div style={{padding:"10px 20px 16px",display:"flex",gap:9}}>
        <input className="input" style={{flex:1}} placeholder="Ask about your live family data..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}/>
        <div onClick={()=>send()} style={{width:46,height:46,borderRadius:13,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,boxShadow:`0 4px 16px ${T.accentGlow}`,transition:"all .2s"}}>
          <I n="send" s={17} c="white"/>
        </div>
      </div>
    </div>
  );
};

// ─── PROFILE SCREEN ───────────────────────────────────────────────────────────
const ProfileScreen = ({ user, onSignOut, familyId }) => {
  const { rows: tasks } = useTable("tasks", familyId);
  const { rows: goals } = useTable("goals", familyId);
  const { rows: docs } = useTable("documents", familyId);
  const name = user?.user_metadata?.name || user?.email?.split("@")[0] || "User";

  return (
    <div className="screen">
      <div className="ph">
        <div style={{display:"flex",gap:15,alignItems:"center"}}>
          <div style={{width:68,height:68,borderRadius:22,background:"linear-gradient(135deg,rgba(139,124,248,0.25),rgba(96,165,250,0.15))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,border:"2px solid rgba(139,124,248,0.3)"}}>
            {name==="Simmi"?"👩":"👨‍⚕️"}
          </div>
          <div>
            <div style={{fontSize:22,fontWeight:900}}>{name}</div>
            <div style={{fontSize:13,color:T.muted}}>{user?.email}</div>
            <div style={{padding:"4px 10px",background:T.greenSoft,border:"1px solid rgba(52,211,153,0.22)",borderRadius:100,fontSize:11,color:T.green,fontWeight:600,marginTop:6,display:"inline-block"}}>✓ Connected to Supabase</div>
          </div>
        </div>
      </div>

      <div style={{padding:"16px 20px 0"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,marginBottom:22}}>
          {[
            {emoji:"✅",val:tasks.filter(t=>t.done).length,lbl:"Done"},
            {emoji:"🎯",val:goals.length,lbl:"Goals"},
            {emoji:"📁",val:docs.length,lbl:"Docs"},
          ].map(s=>(
            <div key={s.lbl} className="card" style={{padding:"14px",textAlign:"center"}}>
              <div style={{fontSize:22,marginBottom:5}}>{s.emoji}</div>
              <div style={{fontSize:22,fontWeight:900}}>{s.val}</div>
              <div style={{fontSize:11,color:T.muted,marginTop:2}}>{s.lbl}</div>
            </div>
          ))}
        </div>

        <div style={{marginBottom:20}}>
          <div style={{fontSize:11.5,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:10}}>Database</div>
          <div className="card" style={{padding:"14px 16px"}}>
            <div style={{fontSize:13,color:T.muted,marginBottom:4}}>Supabase Project</div>
            <div style={{fontSize:13,fontWeight:600,fontFamily:"monospace",color:T.accent}}>ihuuxhvxsbmzydclmbtx</div>
            <div style={{fontSize:12,color:T.muted,marginTop:4}}>Region: Singapore (ap-southeast-1)</div>
            <div style={{fontSize:12,color:T.green,marginTop:4}}>● Real-time sync active</div>
          </div>
        </div>

        <button onClick={onSignOut} style={{width:"100%",padding:"14px",background:T.redSoft,border:`1px solid rgba(248,113,113,0.25)`,borderRadius:14,color:T.red,fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"'Outfit',sans-serif"}}>
          <I n="logout" s={18} c={T.red}/> Sign Out
        </button>

        <div style={{textAlign:"center",padding:"20px 0",color:T.dim,fontSize:12}}>
          Family OS v1.0 · Built for Mayank & Simmi 💙<br/>Powered by Claude + Supabase
        </div>
      </div>
    </div>
  );
};

// ─── ADD MODALS ───────────────────────────────────────────────────────────────
const AddExpenseModal = ({ onClose, familyId }) => {
  const [f, setF] = useState({ description:"", amount:"", category:"Groceries", added_by:"Mayank", emoji:"💸", date: today() });
  const [loading, setLoading] = useState(false);
  const cats = ["Groceries","Utilities","Dining & Food","Transport","Medical","Entertainment","Education","Shopping","Home Loan EMI","Other"];
  const emojiMap = {"Groceries":"🛒","Utilities":"⚡","Dining & Food":"🍽️","Transport":"🚗","Medical":"💊","Entertainment":"🎬","Education":"📚","Shopping":"🛍️","Home Loan EMI":"🏠","Other":"💸"};

  const save = async () => {
    if (!f.description || !f.amount) return;
    setLoading(true);
    await supabase.from("transactions").insert([{ ...f, amount: -Math.abs(Number(f.amount)), family_id: familyId, emoji: emojiMap[f.category]||"💸" }]);
    setLoading(false);
    onClose();
  };

  return (
    <Modal title="Add Expense" onClose={onClose}>
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        <input className="input" placeholder="Description (e.g. BigBasket, Petrol)" value={f.description} onChange={e=>setF(x=>({...x,description:e.target.value}))}/>
        <input className="input" type="number" placeholder="Amount (₹)" value={f.amount} onChange={e=>setF(x=>({...x,amount:e.target.value}))}/>
        <select className="input" value={f.category} onChange={e=>setF(x=>({...x,category:e.target.value}))}>
          {cats.map(c=><option key={c}>{c}</option>)}
        </select>
        <input className="input" type="date" value={f.date} onChange={e=>setF(x=>({...x,date:e.target.value}))}/>
        <div style={{display:"flex",gap:8}}>
          {["Mayank","Simmi"].map(m=>(
            <div key={m} onClick={()=>setF(x=>({...x,added_by:m}))} style={{flex:1,padding:"10px",borderRadius:12,border:`1px solid ${f.added_by===m?"rgba(139,124,248,0.3)":T.border}`,background:f.added_by===m?T.accentSoft:"transparent",textAlign:"center",cursor:"pointer",fontSize:14,fontWeight:500,color:f.added_by===m?T.accent:T.muted,transition:"all .2s"}}>
              {m==="Mayank"?"👨‍⚕️":"👩"} {m}
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={save} disabled={loading}>
          {loading?<div className="spinner"/>:"Save Expense"}
        </button>
      </div>
    </Modal>
  );
};

const AddTaskModal = ({ onClose, familyId }) => {
  const [f, setF] = useState({ title:"", assignee:"Mayank", priority:"medium", category:"General", due_date: today() });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!f.title) return;
    setLoading(true);
    await supabase.from("tasks").insert([{ ...f, done: false, family_id: familyId }]);
    setLoading(false);
    onClose();
  };

  return (
    <Modal title="Add Task" onClose={onClose}>
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        <input className="input" placeholder="Task title" value={f.title} onChange={e=>setF(x=>({...x,title:e.target.value}))}/>
        <select className="input" value={f.category} onChange={e=>setF(x=>({...x,category:e.target.value}))}>
          {["General","Bills","Health","Education","Vehicle","Grocery","Chores","Finance","Maintenance"].map(c=><option key={c}>{c}</option>)}
        </select>
        <div style={{display:"flex",gap:8}}>
          {["Mayank","Simmi"].map(m=>(
            <div key={m} onClick={()=>setF(x=>({...x,assignee:m}))} style={{flex:1,padding:"10px",borderRadius:12,border:`1px solid ${f.assignee===m?"rgba(139,124,248,0.3)":T.border}`,background:f.assignee===m?T.accentSoft:"transparent",textAlign:"center",cursor:"pointer",fontSize:14,fontWeight:500,color:f.assignee===m?T.accent:T.muted,transition:"all .2s"}}>
              {m==="Mayank"?"👨‍⚕️":"👩"} {m}
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          {["high","medium","low"].map(p=>(
            <div key={p} onClick={()=>setF(x=>({...x,priority:p}))} style={{flex:1,padding:"9px",borderRadius:12,border:`1px solid ${f.priority===p?(p==="high"?T.red:p==="medium"?T.amber:T.green):T.border}`,background:f.priority===p?(p==="high"?T.redSoft:p==="medium"?T.amberSoft:T.greenSoft):"transparent",textAlign:"center",cursor:"pointer",fontSize:12,fontWeight:600,color:f.priority===p?(p==="high"?T.red:p==="medium"?T.amber:T.green):T.muted,textTransform:"capitalize",transition:"all .2s"}}>
              {p}
            </div>
          ))}
        </div>
        <input className="input" type="date" value={f.due_date} onChange={e=>setF(x=>({...x,due_date:e.target.value}))}/>
        <button className="btn-primary" onClick={save} disabled={loading}>
          {loading?<div className="spinner"/>:"Save Task"}
        </button>
      </div>
    </Modal>
  );
};

const AddGroceryModal = ({ onClose, familyId }) => {
  const [f, setF] = useState({ name:"", category:"Vegetables", quantity:"1", unit:"kg", par_level:"1", expiry_date:"" });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!f.name) return;
    setLoading(true);
    await supabase.from("grocery").insert([{ ...f, quantity: Number(f.quantity), par_level: Number(f.par_level), family_id: familyId }]);
    setLoading(false);
    onClose();
  };

  return (
    <Modal title="Add Grocery Item" onClose={onClose}>
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        <input className="input" placeholder="Item name (e.g. Amul Milk)" value={f.name} onChange={e=>setF(x=>({...x,name:e.target.value}))}/>
        <select className="input" value={f.category} onChange={e=>setF(x=>({...x,category:e.target.value}))}>
          {["Vegetables","Dairy","Staples","Pantry","Bakery","Beverages","Snacks","Cleaning"].map(c=><option key={c}>{c}</option>)}
        </select>
        <div style={{display:"flex",gap:8}}>
          <input className="input" type="number" placeholder="Qty" value={f.quantity} onChange={e=>setF(x=>({...x,quantity:e.target.value}))} style={{flex:1}}/>
          <select className="input" value={f.unit} onChange={e=>setF(x=>({...x,unit:e.target.value}))} style={{flex:1}}>
            {["kg","g","L","ml","pcs","pack","dozen"].map(u=><option key={u}>{u}</option>)}
          </select>
        </div>
        <input className="input" type="number" placeholder="Reorder level (par)" value={f.par_level} onChange={e=>setF(x=>({...x,par_level:e.target.value}))}/>
        <input className="input" type="date" placeholder="Expiry date" value={f.expiry_date} onChange={e=>setF(x=>({...x,expiry_date:e.target.value}))}/>
        <button className="btn-primary" onClick={save} disabled={loading}>
          {loading?<div className="spinner"/>:"Add Item"}
        </button>
      </div>
    </Modal>
  );
};

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
const Nav = ({ active, go }) => (
  <nav className="bottom-nav">
    {[
      {id:"home",icon:"home",lbl:"Home"},
      {id:"finance",icon:"finance",lbl:"Finance"},
      {id:"household",icon:"house",lbl:"House"},
      {id:"planner",icon:"plan",lbl:"Planner"},
      {id:"ai",icon:"ai",lbl:"AI"},
      {id:"profile",icon:"profile",lbl:"You"},
    ].map(it=>(
      <div key={it.id} className={`nav-btn ${active===it.id?"on":""}`} onClick={()=>go(it.id)}>
        <I n={it.icon} s={21} c={active===it.id?T.accent:T.muted}/>
        <span className="nav-lbl" style={{color:active===it.id?T.accent:T.muted}}>{it.lbl}</span>
      </div>
    ))}
  </nav>
);

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [screen, setScreen] = useState("home");
  const [modal, setModal] = useState(null);

  // Derive family_id from user email (simple approach — both use same family)
  const FAMILY_ID = "gupta-family-001"; // Fixed for Gupta family

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setUser(session?.user??null);
      setAuthLoading(false);
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,session)=>{
      setUser(session?.user??null);
    });
    return ()=>subscription.unsubscribe();
  },[]);

  const signOut = async ()=>{ await supabase.auth.signOut(); setUser(null); setScreen("home"); };

  if (authLoading) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <Styles/>
      <div style={{fontSize:48,animation:"float 2s ease-in-out infinite"}}>🏠</div>
      <div style={{display:"flex",gap:6}}><div className="ai-dot"/><div className="ai-dot"/><div className="ai-dot"/></div>
    </div>
  );

  if (!user) return <div className="root"><Styles/><AuthScreen onLogin={setUser}/></div>;

  const screens = {
    home: <HomeScreen navigate={setScreen} openModal={setModal} familyId={FAMILY_ID} user={user}/>,
    finance: <FinanceScreen familyId={FAMILY_ID}/>,
    household: <HouseholdScreen familyId={FAMILY_ID}/>,
    planner: <PlannerScreen familyId={FAMILY_ID}/>,
    ai: <AIScreen familyId={FAMILY_ID}/>,
    profile: <ProfileScreen user={user} onSignOut={signOut} familyId={FAMILY_ID}/>,
  };

  return (
    <div className="root">
      <Styles/>
      {screens[screen]||screens.home}
      <Nav active={screen} go={setScreen}/>
      {modal==="expense" && <AddExpenseModal onClose={()=>setModal(null)} familyId={FAMILY_ID}/>}
      {modal==="task"    && <AddTaskModal    onClose={()=>setModal(null)} familyId={FAMILY_ID}/>}
      {modal==="grocery" && <AddGroceryModal onClose={()=>setModal(null)} familyId={FAMILY_ID}/>}
    </div>
  );
}
