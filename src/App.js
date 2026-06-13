import React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import SmartGrocery from "./components/SmartGrocery";

// ─── SUPABASE CLIENT ──────────────────────────────────────────────────────────
const supabase = createClient(
  "https://ihuuxhvxsbmzydclmbtx.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlodXV4aHZ4c2JtenlkY2xtYnR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzAzNjgsImV4cCI6MjA5NTkwNjM2OH0.RSY5SkQvmQgiz0u62Re1k6-AYYZ16trlFCiDULHsQaw"
);

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  bg: "#F8F7F4",
  card: "#FFFFFF",
  cardHover: "#FAFAF8",
  border: "#E8E4DE",
  borderBright: "#D5D0C8",
  text: "#2D2721",
  muted: "#9E9488",
  dim: "#C4BDB4",
  accent: "#7D9D7C",
  accentSoft: "rgba(125,157,124,0.12)",
  accentGlow: "rgba(125,157,124,0.3)",
  green: "#6D9B6B",   greenSoft: "rgba(109,155,107,0.12)",
  amber: "#C4883A",   amberSoft: "rgba(196,136,58,0.12)",
  red: "#C4603A",     redSoft: "rgba(196,96,58,0.12)",
  blue: "#5B8DB8",    blueSoft: "rgba(91,141,184,0.12)",
  pink: "#C4728A",    pinkSoft: "rgba(196,114,138,0.12)",
  teal: "#4A9B8E",    tealSoft: "rgba(74,155,142,0.12)",
};

// ─── NUTRITION TARGETS ────────────────────────────────────────────────────────
const NUTRITION_TARGETS = {
  Mayank: { calories: 2000, protein: 100, carbs: 250, fat: 65, fiber: 30 },
  Simmi:  { calories: 1600, protein: 70,  carbs: 200, fat: 55, fiber: 25 },
  Veda:   { calories: 1200, protein: 40,  carbs: 150, fat: 40, fiber: 15 },
};
const MEMBERS = ["Mayank", "Simmi", "Veda"];
const MEMBER_EMOJI = { Mayank: "👨‍⚕️", Simmi: "👩", Veda: "👶" };

const inr = n => "₹" + Math.abs(Number(n) || 0).toLocaleString("en-IN");
const pct = (a, b) => b ? Math.min(100, Math.round((a / b) * 100)) : 0;
const today = () => new Date().toISOString().split("T")[0];
const calcDaysRemaining = (quantity, unit, itemName) => {
  const dailyUsage = {
    'rice':{g:300,kg:0.3},'wheat flour':{g:200,kg:0.2},'oats':{g:150,kg:0.15},
    'poha':{g:150,kg:0.15},'toor dal':{g:150,kg:0.15},'moong dal':{g:100,kg:0.1},
    'rajma':{g:200,kg:0.2},'milk':{ml:500,l:0.5},'paneer':{g:200,kg:0.2},
    'curd':{g:200,kg:0.2},'butter':{g:25,kg:0.025},'onion':{g:100,kg:0.1},
    'tomato':{g:150,kg:0.15},'potato':{g:200,kg:0.2},'oil':{ml:30,l:0.03},
    'ghee':{ml:20,l:0.02},'banana':{pcs:2},'apple':{pcs:1},
  };
  const key = itemName.toLowerCase();
  const usage = dailyUsage[key];
  if (!usage) return null;
  const dailyAmt = usage[unit.toLowerCase()];
  if (!dailyAmt) return null;
  return Math.floor(Number(quantity) / dailyAmt);
};

// ─── BALANCE CALCULATOR ───────────────────────────────────────────────────────
const calcBalance = (transactions) => {
  const clinicIncome = transactions
    .filter(t => t.category === "Clinic Income" && Number(t.amount) > 0)
    .reduce((a, t) => a + Number(t.amount), 0);
  const simmiIncome = transactions
    .filter(t => t.category === "Simmi Income" && Number(t.amount) > 0)
    .reduce((a, t) => a + Number(t.amount), 0);
  const otherIncome = transactions
    .filter(t => !["Clinic Income","Simmi Income"].includes(t.category) && Number(t.amount) > 0)
    .reduce((a, t) => a + Number(t.amount), 0);
  const totalIncome = clinicIncome + simmiIncome + otherIncome;
  const totalExpenses = transactions
    .filter(t => Number(t.amount) < 0)
    .reduce((a, t) => a + Math.abs(Number(t.amount)), 0);
  const available = totalIncome - totalExpenses;
  return { clinicIncome, simmiIncome, otherIncome, totalIncome, totalExpenses, available };
};

// ─── NOTIFICATION SYSTEM ──────────────────────────────────────────────────────
const saveNotif = async (familyId, { title, body, type, icon, color }) => {
  try {
    await supabase.from("notifications").insert([{
      family_id: familyId, title, body, type, icon, color,
      read: false, created_at: new Date().toISOString(),
    }]);
  } catch(e) { console.error("Notif save failed", e); }
};

let _toastFn = null;
const registerToast = fn => { _toastFn = fn; };
const showToast = (notif) => { if (_toastFn) _toastFn(notif); };

// ─── EMAIL SENDER ─────────────────────────────────────────────────────────────
const sendEmail = async (event_type, data, recipients = "both") => {
  try {
    await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type, data, recipients }),
    });
  } catch(e) { console.error("Email send failed", e); }
};

// ─── NOTIFICATION HELPERS (in-app toast + DB + email) ────────────────────────
const notifyIncomeAdded = (familyId, { amount, category, balance }) => {
  const n = {
    title: `${category === "Clinic Income" ? "🏥" : "👩"} ${category} Added`,
    body: `₹${Number(amount).toLocaleString("en-IN")} added. Balance: ₹${Number(balance).toLocaleString("en-IN")}`,
    icon: category === "Clinic Income" ? "🏥" : "👩",
    color: "#6D9B6B", type: "income",
  };
  showToast(n); saveNotif(familyId, n);
  sendEmail("income", {
    category,
    amount: Number(amount).toLocaleString("en-IN"),
    balance: Number(balance).toLocaleString("en-IN"),
    date: new Date().toLocaleDateString("en-IN"),
  });
};
const notifyExpenseAdded = (familyId, { amount, category, balance, added_by }) => {
  const n = {
    title: "💸 Expense Recorded",
    body: `₹${Math.abs(Number(amount)).toLocaleString("en-IN")} on ${category}. Balance: ₹${Number(balance).toLocaleString("en-IN")}`,
    icon: "💸", color: "#C4603A", type: "expense",
  };
  showToast(n); saveNotif(familyId, n);
  sendEmail("expense", {
    category,
    amount: Math.abs(Number(amount)).toLocaleString("en-IN"),
    balance: Number(balance).toLocaleString("en-IN"),
    added_by: added_by || "Family",
  });
};
const notifyTaskAdded = (familyId, { title, assignee, priority, due_date }) => {
  const n = { title: "✅ New Task Added", body: title, icon: "✅", color: "#6D9B6B", type: "task" };
  showToast(n); saveNotif(familyId, n);
  sendEmail("task", { title, assignee: assignee || "Unassigned", priority: priority || "medium", due_date });
};
const notifyEventAdded = (familyId, { title, date, type }) => {
  const n = {
    title: "📅 Event Scheduled",
    body: `${title}${date ? " on " + date : ""}`,
    icon: "📅", color: "#5B8DB8", type: "event",
  };
  showToast(n); saveNotif(familyId, n);
  sendEmail("event", { title, event_date: date, type: type || "personal" });
};
const notifyGroceryAdded = (familyId, { name }) => {
  const n = { title: "🛒 Shopping Item Added", body: `${name} added to shopping list.`, icon: "🛒", color: "#C4883A", type: "grocery" };
  showToast(n); saveNotif(familyId, n);
};
const notifyNoteAdded = (familyId) => {
  const n = { title: "📝 Note Saved", body: "Note saved successfully.", icon: "📝", color: "#5B8DB8", type: "note" };
  showToast(n); saveNotif(familyId, n);
};
const notifyReminderAdded = (familyId, { content, due_date }) => {
  const n = { title: "⏰ Reminder Set", body: content, icon: "⏰", color: "#C4728A", type: "reminder" };
  showToast(n); saveNotif(familyId, n);
  sendEmail("reminder", { content, due_date: due_date || "Today" });
};
const notifyGoalAdded = (familyId, { title }) => {
  const n = { title: "🎯 Goal Created", body: title, icon: "🎯", color: "#7D9D7C", type: "goal" };
  showToast(n); saveNotif(familyId, n);
};
const notifyPantryLow = (familyId, { name, quantity, unit }) => {
  const n = { title: "📦 Pantry Low", body: `${name}: ${quantity} ${unit} remaining`, icon: "📦", color: "#C4883A", type: "pantry" };
  showToast(n); saveNotif(familyId, n);
  sendEmail("pantry_low", { name, quantity, unit });
};

// ─── TOAST RENDERER ───────────────────────────────────────────────────────────
const ToastRenderer = () => {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    registerToast((notif) => {
      const id = Date.now();
      setToasts(t => [...t, { ...notif, id, out: false }]);
      setTimeout(() => {
        setToasts(t => t.map(x => x.id === id ? { ...x, out: true } : x));
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 320);
      }, 3500);
    });
  }, []);
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.out ? "out" : ""}`}
          onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
          <div className="toast-icon" style={{ background: t.color + "18", border: `1px solid ${t.color}33` }}>{t.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="toast-title">{t.title}</div>
            <div className="toast-body">{t.body}</div>
          </div>
          <div style={{ fontSize: 16, color: "rgba(45,39,33,0.25)", marginLeft: 4 }}>×</div>
        </div>
      ))}
    </div>
  );
};

// ─── NOTIFICATION CENTER ──────────────────────────────────────────────────────
const NotificationsScreen = ({ familyId, onClose }) => {
  const { rows: notifs, update: updNotif, remove: removeNotif } = useTable(
    "notifications", familyId, { order: "created_at", asc: false, limit: 50 }
  );
  const unread = notifs.filter(n => !n.read);
  const markAll = async () => { await Promise.all(unread.map(n => updNotif(n.id, { read: true }))); };
  const markRead = (id) => updNotif(id, { read: true });
  const timeAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxHeight: "80vh", overflowY: "auto", paddingBottom: 24 }}
        onClick={e => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 700 }}>Notifications</span>
            {unread.length > 0 && (
              <span style={{ marginLeft: 8, background: "rgba(125,157,124,0.12)", color: "#7D9D7C", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100 }}>
                {unread.length} unread
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {unread.length > 0 && (
              <span onClick={markAll} style={{ fontSize: 12, color: "#7D9D7C", fontWeight: 600, cursor: "pointer" }}>Mark all read</span>
            )}
            <div onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(125,157,124,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9E9488" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </div>
          </div>
        </div>
        {notifs.length === 0 ? (
          <div className="empty"><div className="empty-icon">🔔</div><div className="empty-text">No notifications yet.<br/><span style={{fontSize:12,color:"rgba(238,236,248,0.4)"}}>Alerts for expenses, tasks & low stock appear here.</span></div></div>
        ) : (
          <div className="card" style={{ padding: "0 0" }}>
            {notifs.map(n => (
              <div key={n.id} className={`notif-item ${!n.read ? "unread" : ""}`} onClick={() => !n.read && markRead(n.id)}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: (n.color || "#7D9D7C") + "18", border: `1px solid ${n.color || "#7D9D7C"}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{n.icon || "🔔"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: n.read ? T.muted : "#2D2721" }}>{n.title}</div>
                  <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>
                  <div style={{ fontSize: 10.5, color: "rgba(45,39,33,0.25)", marginTop: 3 }}>{timeAgo(n.created_at)}</div>
                </div>
                <div onClick={e => { e.stopPropagation(); removeNotif(n.id); }} style={{ opacity: 0.3, cursor: "pointer", padding: "4px", flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C4603A" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── QUICK ADD CONFIG ─────────────────────────────────────────────────────────
const QUICK_ADD_TYPES = [
  { id:"expense",  emoji:"💸", label:"Expense",  color:T.accent, table:"transactions" },
  { id:"task",     emoji:"✅", label:"Task",      color:T.green,  table:"tasks" },
  { id:"grocery",  emoji:"🛒", label:"Shopping",  color:T.amber,  table:"grocery" },
  { id:"note",     emoji:"📝", label:"Note",      color:T.blue,   table:"notes" },
  { id:"event",    emoji:"📅", label:"Event",     color:T.pink,   table:"events" },
  { id:"memory",   emoji:"🧡", label:"Memory",    color:T.teal,   table:"memories" },
  { id:"reminder", emoji:"⏰", label:"Reminder",  color:T.red,    table:"reminders" },
  { id:"goal",     emoji:"🎯", label:"Goal",      color:"#7D9D7C", table:"goals" },
];

// ─── STYLES ───────────────────────────────────────────────────────────────────
const Styles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html{-webkit-tap-highlight-color:transparent;-webkit-text-size-adjust:100%;touch-action:manipulation;}
    body{font-family:'Plus Jakarta Sans',sans-serif;background:${T.bg};color:${T.text};min-height:100vh;overscroll-behavior:none;-webkit-font-smoothing:antialiased;}
    ::-webkit-scrollbar{display:none;}
    *{scrollbar-width:none;}
    .root{display:flex;flex-direction:column;min-height:100vh;min-height:100dvh;max-width:430px;margin:0 auto;background:${T.bg};position:relative;}
    .screen{flex:1;padding-bottom:calc(72px + env(safe-area-inset-bottom, 16px));overflow-y:auto;-webkit-overflow-scrolling:touch;animation:fadeUp .25s cubic-bezier(.16,1,.3,1);}
    @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
    @keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
    .stagger-1{animation:fadeIn .3s cubic-bezier(.16,1,.3,1) .05s both;}
    .stagger-2{animation:fadeIn .3s cubic-bezier(.16,1,.3,1) .12s both;}
    .stagger-3{animation:fadeIn .3s cubic-bezier(.16,1,.3,1) .19s both;}
    .stagger-4{animation:fadeIn .3s cubic-bezier(.16,1,.3,1) .26s both;}
    .stagger-5{animation:fadeIn .3s cubic-bezier(.16,1,.3,1) .33s both;}
    @media(prefers-reduced-motion:reduce){.stagger-1,.stagger-2,.stagger-3,.stagger-4,.stagger-5{animation:none;}}
    .card{background:${T.card};border:1px solid ${T.border};border-radius:18px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);transition:transform .15s cubic-bezier(.34,1.56,.64,1),background .18s,box-shadow .18s;box-shadow:0 1px 4px rgba(0,0,0,0.12);}
    .card-tap{cursor:pointer;will-change:transform;}
    .card-tap:active{transform:scale(0.97);background:${T.cardHover};box-shadow:0 1px 2px rgba(0,0,0,0.08);}
    .btn{border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .18s;display:inline-flex;align-items:center;justify-content:center;gap:8px;}
    .btn-primary{background:${T.accent};color:#fff !important;border-radius:14px;padding:0 22px;height:52px;font-size:15px;font-weight:700;box-shadow:0 4px 20px ${T.accentGlow};border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .18s;width:100%;-webkit-tap-highlight-color:transparent;touch-action:manipulation;min-height:52px;}
    .btn-primary:active{transform:scale(0.96);opacity:0.92;box-shadow:0 2px 8px ${T.accentGlow};}
    .btn-primary:disabled{opacity:0.45;cursor:not-allowed;}
    .input{width:100%;background:#FAFAF8;border:0.5px solid ${T.border};border-radius:14px;padding:0 16px;height:52px;color:${T.text};font-family:'Plus Jakarta Sans',sans-serif;font-size:16px;outline:none;transition:all .18s;-webkit-appearance:none;appearance:none;}
    .input:focus{border-color:${T.accent};background:#FFFFFF;}
    .input::placeholder{color:${T.dim};}
    textarea.input{height:auto;padding:14px 16px;resize:none;line-height:1.5;}
    select.input{appearance:none;-webkit-appearance:none;} select.input option{background:#2D2721;color:#EEECf8;}
    .bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;padding:8px 2px calc(8px + env(safe-area-inset-bottom, 0px));background:rgba(8,8,16,0.92);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);border-top:1px solid ${T.border};display:flex;justify-content:space-around;align-items:center;z-index:100;}
    .nav-btn{display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;padding:6px 8px;border-radius:12px;transition:all .18s;flex:1;min-height:44px;justify-content:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
    .nav-btn.on{background:rgba(125,157,124,0.12);}
    .nav-btn:active{transform:scale(0.86);transition:transform .1s cubic-bezier(.34,1.56,.64,1);}
    .nav-lbl{font-size:11px;font-weight:700;letter-spacing:.01em;margin-top:2px;}
    .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .2s ease;}
    @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
    .modal{width:100%;max-width:400px;background:#1C1C2E;border:1px solid ${T.borderBright};border-radius:24px;padding:24px 20px;animation:popIn .25s cubic-bezier(.16,1,.3,1);max-height:85dvh;overflow-y:auto;}
    @keyframes slideUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
    @keyframes popIn{from{opacity:0;transform:scale(0.94);}to{opacity:1;transform:scale(1);}}
    .modal-handle{width:40px;height:4px;background:#DDD9D2;border-radius:2px;margin:0 auto 18px;}
    .ph{padding:calc(52px + env(safe-area-inset-top, 0px)) 18px 0;}
    .pt{font-size:22px;font-weight:800;letter-spacing:-.3px;}
    .ps{font-size:12.5px;color:${T.muted};margin-top:3px;}
    .row{display:flex;justify-content:space-between;align-items:center;}
    .sec-title{font-size:15px;font-weight:700;}
    .sec-link{font-size:12.5px;color:${T.accent};font-weight:600;cursor:pointer;padding:4px 0;min-height:44px;display:flex;align-items:center;}
    .chip{display:inline-flex;align-items:center;gap:5px;padding:8px 14px;border-radius:100px;background:#FAFAF8;border:0.5px solid ${T.border};font-size:13px;font-weight:500;cursor:pointer;transition:all .18s;white-space:nowrap;min-height:36px;-webkit-tap-highlight-color:transparent;}
    .chip.on{background:#7D9D7C;border-color:#7D9D7C;color:white;}
    .chip:active{transform:scale(0.93);transition:transform .1s cubic-bezier(.34,1.56,.64,1);}
    .scroll-x{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
    .scroll-x::-webkit-scrollbar{display:none;}
    .list-row{display:flex;align-items:center;gap:13px;padding:16px 0;border-bottom:1px solid ${T.border};cursor:pointer;transition:opacity .15s;min-height:60px;}
    .list-row:last-child{border-bottom:none;}
    .list-row:active{opacity:.6;}
    .progress{height:5px;background:rgba(125,157,124,0.08);border-radius:100px;overflow:hidden;}
    .progress-fill{height:100%;border-radius:100px;transition:width 1s cubic-bezier(.16,1,.3,1);}
    .tag{display:inline-flex;align-items:center;gap:3px;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:600;}
    .mono{font-family:'JetBrains Mono',monospace;}
    .divider{height:1px;background:${T.border};margin:14px 0;}
    @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}
    .float{animation:float 3.5s ease-in-out infinite;}
    .ai-dot{width:7px;height:7px;background:${T.accent};border-radius:50%;animation:pulse 1.4s ease-in-out infinite;}
    .ai-dot:nth-child(2){animation-delay:.18s;}
    .ai-dot:nth-child(3){animation-delay:.36s;}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.4;transform:scale(0.75);}}
    @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
    .spinner{width:20px;height:20px;border:2px solid rgba(125,157,124,0.2);border-top-color:#7D9D7C;border-radius:50%;animation:spin .7s linear infinite;}
    .empty{text-align:center;padding:56px 24px;color:${T.muted};}
    .empty-icon{font-size:48px;margin-bottom:16px;}
    .empty-text{font-size:15px;line-height:1.7;}
    .alert-bar{padding:12px 15px;border-radius:14px;display:flex;gap:10px;align-items:center;margin-bottom:8px;}
    .fade-up{animation:fadeUp .4s cubic-bezier(.16,1,.3,1) both;}
    .fab{position:fixed;bottom:calc(80px + env(safe-area-inset-bottom, 0px));right:max(16px, calc(50vw - 199px));width:54px;height:54px;border-radius:17px;background:linear-gradient(135deg,${T.accent},#6D5CE8);box-shadow:0 4px 24px ${T.accentGlow},0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:150;transition:all .25s cubic-bezier(.16,1,.3,1);border:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
    .fab:active{transform:scale(0.89);transition:transform .12s cubic-bezier(.34,1.56,.64,1);}
    .fab.open{transform:rotate(45deg);background:linear-gradient(135deg,#C4603A,#E55);}
    .fab-menu{position:fixed;bottom:calc(148px + env(safe-area-inset-bottom, 0px));right:max(16px, calc(50vw - 206px));z-index:149;display:flex;flex-direction:column;gap:8px;align-items:flex-end;animation:fabMenuIn .25s cubic-bezier(.16,1,.3,1);}
    @keyframes fabMenuIn{from{opacity:0;transform:translateY(16px) scale(0.94);}to{opacity:1;transform:translateY(0) scale(1);}}
    .fab-item{display:flex;align-items:center;gap:10px;cursor:pointer;animation:fabItemIn .22s cubic-bezier(.16,1,.3,1) both;}
    @keyframes fabItemIn{from{opacity:0;transform:translateX(10px);}to{opacity:1;transform:translateX(0);}}
    .fab-item-btn{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:21px;border:1px solid rgba(125,157,124,0.08);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);transition:transform .15s;-webkit-tap-highlight-color:transparent;}
    .fab-item-btn:active{transform:scale(0.88);}
    .fab-item-label{background:rgba(255,255,255,0.96);border:1px solid rgba(0,0,0,0.08);border-radius:10px;padding:7px 14px;font-size:13px;font-weight:700;color:#111827;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15);}
    .fab-overlay{position:fixed;inset:0;z-index:148;background:rgba(0,0,0,0.35);backdrop-filter:blur(2px);animation:fadeIn .2s ease;}
    .type-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;}
    .type-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;border-radius:14px;cursor:pointer;transition:all .18s;border:1px solid transparent;min-height:68px;justify-content:center;-webkit-tap-highlight-color:transparent;}
    .type-btn.active{border-color:rgba(125,157,124,0.35);background:rgba(125,157,124,0.1);}
    .type-btn:active{transform:scale(0.93);}
    .toast-container{position:fixed;top:calc(16px + env(safe-area-inset-top, 0px));left:50%;transform:translateX(-50%);z-index:500;display:flex;flex-direction:column;gap:8px;width:calc(100% - 28px);max-width:402px;pointer-events:none;}
    .toast{background:#2D2721;border:1px solid rgba(255,255,255,0.11);border-radius:16px;padding:12px 14px;display:flex;gap:11px;align-items:flex-start;pointer-events:all;box-shadow:0 8px 32px rgba(0,0,0,0.55),0 2px 8px rgba(0,0,0,0.3);animation:toastIn .3s cubic-bezier(.16,1,.3,1);}
    @keyframes toastIn{from{opacity:0;transform:translateY(-14px) scale(0.96);}to{opacity:1;transform:translateY(0) scale(1);}}
    .toast.out{animation:toastOut .32s cubic-bezier(.4,0,1,1) forwards;}
    @keyframes toastOut{to{opacity:0;transform:translateY(-16px) scale(0.94);}}
    .toast-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;}
    .toast-title{font-size:14px;font-weight:700;color:#EEECf8;line-height:1.3;}
    .toast-body{font-size:11.5px;color:rgba(238,236,248,0.5);margin-top:2px;line-height:1.4;}
    .notif-badge{position:absolute;top:-5px;right:-5px;background:#C4603A;color:white;border-radius:100px;font-size:11px;font-weight:800;min-width:17px;height:17px;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #F8F7F4;}
    .notif-item{display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid #FFFFFF;cursor:pointer;transition:background .15s;position:relative;min-height:60px;align-items:center;}
    .notif-item:last-child{border-bottom:none;}
    .notif-item:active{background:#F8F7F4;}
    .notif-item.unread::before{content:'';position:absolute;left:5px;top:50%;transform:translateY(-50%);width:5px;height:5px;border-radius:50%;background:#7D9D7C;}
    .person-sel{display:flex;gap:8px;}
    .person-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border-radius:13px;border:1px solid ${T.border};background:transparent;cursor:pointer;transition:all .18s;font-size:14px;font-weight:600;color:${T.muted};-webkit-tap-highlight-color:transparent;}
    .person-btn.on{border-color:rgba(125,157,124,0.35);background:rgba(125,157,124,0.1);color:${T.accent};}
    .person-btn:active{transform:scale(0.96);}
    .priority-sel{display:flex;gap:8px;}
    .priority-btn{flex:1;height:44px;border-radius:12px;border:1px solid ${T.border};background:transparent;cursor:pointer;transition:all .18s;font-size:12px;font-weight:700;text-transform:capitalize;-webkit-tap-highlight-color:transparent;}
    .priority-btn:active{transform:scale(0.95);}
    .sec-header{display:flex;justify-content:space-between;align-items:center;padding:0 18px;margin-bottom:10px;}
    .icon-btn{width:44px;height:44px;border-radius:12px;background:${T.card};border:1px solid ${T.border};display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;-webkit-tap-highlight-color:transparent;touch-action:manipulation;flex-shrink:0;}
    .icon-btn:active{transform:scale(0.9);}
    .balance-card{margin:12px 18px 0;background:linear-gradient(135deg,rgba(125,157,124,0.08),rgba(125,157,124,0.04));border:1px solid rgba(109,155,107,0.2);border-radius:20px;padding:18px;cursor:pointer;transition:all .18s;}
    .balance-card:active{transform:scale(0.985);}
    .quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px 18px 0;}
    .quick-action{display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
    .quick-action-icon{width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:22px;transition:all .18s;}
    .quick-action-icon:active{transform:scale(0.88);}
    .quick-action-label{font-size:12px;font-weight:600;color:${T.muted};}
  `}</style>
);

// ─── ICONS ────────────────────────────────────────────────────────────────────
const I = ({ n, s = 20, c = "currentColor", w = 1.8 }) => {
  const P = {
    home:"M3 9.5L12 3l9 6.5V21H15v-5h-6v5H3V9.5z",
    finance:"M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    house:"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10",
    plan:"M8 7V3m8 4V3M3 11h18M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    kitchen:"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8 17v-2h8v2H8zM8 13V7l4 3 4-3v6H8z",
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
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-box" onClick={e => e.stopPropagation()}>
      <div className="modal-handle"/>
      <div className="row" style={{marginBottom:16}}>
        <span style={{fontSize:19,fontWeight:700,color:T.text}}>{title}</span>
        <div onClick={onClose} style={{width:44,height:44,borderRadius:12,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <I n="x" s={15} c={T.muted}/>
        </div>
      </div>
      {children}
    </div>
  </div>
);

// ─── GLOBAL QUICK ADD MODAL ───────────────────────────────────────────────────
const QuickAddModal = ({ onClose, familyId, defaultType = "expense" }) => {
  const [type, setType] = useState(defaultType);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState({
    description:"", amount:"", category:"Groceries", added_by:"Mayank", date: today(),
    title:"", assignee:"Mayank", priority:"medium", taskCategory:"General", due_date: today(),
    groceryName:"", groceryCategory:"Vegetables", quantity:"1", unit:"kg", par_level:"1",
    noteText:"",
    eventTitle:"", eventDate: today(), eventType:"personal",
    memoryTitle:"", memoryText:"",
    reminderText:"", reminderDate: today(),
    goalTitle:"", targetAmount:"", savedAmount:"0",
  });
  const set = (k,v) => setF(x=>({...x,[k]:v}));
  const expenseCats = ["Groceries","Utilities","Dining & Food","Transport","Medical","Entertainment","Education","Shopping","Clinic","Subscriptions","HRA","Home Loan","Investments","Housekeeping","House Interiors","Maintenance","Travel","Staff Salary","Veda","Gifts","Loan Back","Axis Bank EMI","HDFC Loan EMI","Other"];
  const emojiMap = {"Groceries":"🛒","Utilities":"⚡","Dining & Food":"🍽️","Transport":"🚗","Medical":"💊","Entertainment":"🎬","Education":"📚","Shopping":"🛍️","Clinic":"🏥","Subscriptions":"📱","HRA":"🏠","Home Loan":"🏦","Investments":"📈","Housekeeping":"🧹","House Interiors":"🛋️","Maintenance":"🔧","Travel":"✈️","Staff Salary":"👷","Veda":"👶","Gifts":"🎁","Loan Back":"💳","Axis Bank EMI":"🏦","HDFC Loan EMI":"🏦","Other":"💸"};

  const save = async () => {
    setLoading(true);
    try {
      if (type === "expense") {
        if (!f.description || !f.amount) { setLoading(false); return; }
        const allTxns3 = await supabase.from("transactions").select("amount").eq("family_id", familyId);
        const bal3 = calcBalance(allTxns3.data || []);
        await supabase.from("transactions").insert([{ description:f.description, amount:-Math.abs(Number(f.amount)), category:f.category, added_by:f.added_by, date:f.date, emoji:emojiMap[f.category]||"💸", family_id:familyId }]);
        notifyExpenseAdded(familyId, { amount: f.amount, category: f.category, balance: bal3.available - Math.abs(Number(f.amount)), added_by: f.added_by });
      } else if (type === "task") {
        if (!f.title) { setLoading(false); return; }
        await supabase.from("tasks").insert([{ title:f.title, assignee:f.assignee, priority:f.priority, category:f.taskCategory, due_date:f.due_date, done:false, family_id:familyId }]);
        notifyTaskAdded(familyId, { title: f.title });
      } else if (type === "grocery") {
        if (!f.groceryName) { setLoading(false); return; }
        await supabase.from("grocery").insert([{ name:f.groceryName, category:f.groceryCategory, quantity:Number(f.quantity), unit:f.unit, par_level:Number(f.par_level), family_id:familyId }]);
        notifyGroceryAdded(familyId, { name: f.groceryName });
      } else if (type === "note") {
        if (!f.noteText) { setLoading(false); return; }
        await supabase.from("notes").insert([{ content:f.noteText, added_by:f.added_by, date:today(), family_id:familyId }]);
        notifyNoteAdded(familyId);
      } else if (type === "event") {
        if (!f.eventTitle) { setLoading(false); return; }
        await supabase.from("events").insert([{ title:f.eventTitle, event_date:f.eventDate, type:f.eventType, emoji:"📅", family_id:familyId }]);
        notifyEventAdded(familyId, { title: f.eventTitle, date: f.eventDate });
      } else if (type === "memory") {
        if (!f.memoryTitle) { setLoading(false); return; }
        await supabase.from("memories").insert([{ title:f.memoryTitle, content:f.memoryText, date:today(), family_id:familyId }]);
      } else if (type === "reminder") {
        if (!f.reminderText) { setLoading(false); return; }
        await supabase.from("reminders").insert([{ content:f.reminderText, due_date:f.reminderDate, done:false, family_id:familyId }]);
        notifyReminderAdded(familyId, { content: f.reminderText });
      } else if (type === "goal") {
        if (!f.goalTitle || !f.targetAmount) { setLoading(false); return; }
        await supabase.from("goals").insert([{ title:f.goalTitle, target_amount:Number(f.targetAmount), saved_amount:Number(f.savedAmount), emoji:"🎯", family_id:familyId }]);
        notifyGoalAdded(familyId, { title: f.goalTitle });
      }
      setSaved(true);
      setTimeout(() => onClose(), 700);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const currentType = QUICK_ADD_TYPES.find(t=>t.id===type);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"85vh",overflowY:"auto"}}>
        <div className="row" style={{marginBottom:14}}>
          <span style={{fontSize:19,fontWeight:700}}>Quick Add</span>
          <div onClick={onClose} style={{width:30,height:30,borderRadius:10,background:"rgba(125,157,124,0.08)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <I n="x" s={15} c={T.muted}/>
          </div>
        </div>
        <div className="type-grid">
          {QUICK_ADD_TYPES.map((t,i)=>(
            <div key={t.id} className={`type-btn ${type===t.id?"active":""}`} onClick={()=>setType(t.id)}>
              <div style={{width:38,height:38,borderRadius:12,background:type===t.id?`${t.color}22`:"#FAFAF8",border:`1px solid ${type===t.id?t.color+"44":T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,transition:"all .18s"}}>{t.emoji}</div>
              <span style={{fontSize:9.5,color:type===t.id?t.color:T.muted,fontWeight:600}}>{t.label}</span>
            </div>
          ))}
        </div>
        <div style={{height:1,background:T.border,marginBottom:14}}/>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {type==="expense" && <>
            <input className="input" placeholder="What did you spend on?" value={f.description} onChange={e=>set("description",e.target.value)} autoFocus/>
            <input className="input" type="number" placeholder="Amount (₹)" value={f.amount} onChange={e=>set("amount",e.target.value)}/>
            <select className="input" value={f.category} onChange={e=>set("category",e.target.value)}>
              {expenseCats.map(c=><option key={c}>{c}</option>)}
            </select>
            <div style={{display:"flex",gap:8}}>
              {["Mayank","Simmi"].map(m=>(
                <div key={m} onClick={()=>set("added_by",m)} style={{flex:1,padding:"9px",borderRadius:12,border:`1px solid ${f.added_by===m?"rgba(125,157,124,0.3)":T.border}`,background:f.added_by===m?T.accentSoft:"transparent",textAlign:"center",cursor:"pointer",fontSize:13,fontWeight:600,color:f.added_by===m?T.accent:T.muted,transition:"all .2s"}}>
                  {m==="Mayank"?"👨‍⚕️":"👩"} {m}
                </div>
              ))}
            </div>
          </>}
          {type==="task" && <>
            <input className="input" placeholder="What needs to be done?" value={f.title} onChange={e=>set("title",e.target.value)} autoFocus/>
            <div style={{display:"flex",gap:8}}>
              {["Mayank","Simmi"].map(m=>(
                <div key={m} onClick={()=>set("assignee",m)} style={{flex:1,padding:"9px",borderRadius:12,border:`1px solid ${f.assignee===m?"rgba(125,157,124,0.3)":T.border}`,background:f.assignee===m?T.accentSoft:"transparent",textAlign:"center",cursor:"pointer",fontSize:13,fontWeight:600,color:f.assignee===m?T.accent:T.muted,transition:"all .2s"}}>
                  {m==="Mayank"?"👨‍⚕️":"👩"} {m}
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              {["high","medium","low"].map(p=>(
                <div key={p} onClick={()=>set("priority",p)} style={{flex:1,padding:"8px",borderRadius:12,border:`1px solid ${f.priority===p?(p==="high"?T.red:p==="medium"?T.amber:T.green):T.border}`,background:f.priority===p?(p==="high"?T.redSoft:p==="medium"?T.amberSoft:T.greenSoft):"transparent",textAlign:"center",cursor:"pointer",fontSize:12,fontWeight:600,color:f.priority===p?(p==="high"?T.red:p==="medium"?T.amber:T.green):T.muted,textTransform:"capitalize",transition:"all .2s"}}>
                  {p}
                </div>
              ))}
            </div>
            <input className="input" type="date" value={f.due_date} onChange={e=>set("due_date",e.target.value)}/>
          </>}
          {type==="grocery" && <>
            <input className="input" placeholder="Item name (e.g. Amul Milk)" value={f.groceryName} onChange={e=>set("groceryName",e.target.value)} autoFocus/>
            <div style={{display:"flex",gap:8}}>
              <input className="input" type="number" placeholder="Qty" value={f.quantity} onChange={e=>set("quantity",e.target.value)} style={{flex:1}}/>
              <select className="input" value={f.unit} onChange={e=>set("unit",e.target.value)} style={{flex:1}}>
                {["kg","g","L","ml","pcs","pack","dozen"].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
          </>}
          {type==="note" && <>
            <textarea className="input" placeholder="Write your note..." value={f.noteText} onChange={e=>set("noteText",e.target.value)} rows={4} style={{resize:"none"}} autoFocus/>
            <div style={{display:"flex",gap:8}}>
              {["Mayank","Simmi"].map(m=>(
                <div key={m} onClick={()=>set("added_by",m)} style={{flex:1,padding:"9px",borderRadius:12,border:`1px solid ${f.added_by===m?"rgba(125,157,124,0.3)":T.border}`,background:f.added_by===m?T.accentSoft:"transparent",textAlign:"center",cursor:"pointer",fontSize:13,fontWeight:600,color:f.added_by===m?T.accent:T.muted,transition:"all .2s"}}>
                  {m==="Mayank"?"👨‍⚕️":"👩"} {m}
                </div>
              ))}
            </div>
          </>}
          {type==="event" && <>
            <input className="input" placeholder="Event name" value={f.eventTitle} onChange={e=>set("eventTitle",e.target.value)} autoFocus/>
            <input className="input" type="date" value={f.eventDate} onChange={e=>set("eventDate",e.target.value)}/>
            <select className="input" value={f.eventType} onChange={e=>set("eventType",e.target.value)}>
              {["personal","medical","school","family","holiday","anniversary","birthday","other"].map(t=><option key={t} style={{textTransform:"capitalize"}}>{t}</option>)}
            </select>
          </>}
          {type==="memory" && <>
            <input className="input" placeholder="Memory title" value={f.memoryTitle} onChange={e=>set("memoryTitle",e.target.value)} autoFocus/>
            <textarea className="input" placeholder="Describe the memory..." value={f.memoryText} onChange={e=>set("memoryText",e.target.value)} rows={3} style={{resize:"none"}}/>
          </>}
          {type==="reminder" && <>
            <input className="input" placeholder="What to remind?" value={f.reminderText} onChange={e=>set("reminderText",e.target.value)} autoFocus/>
            <input className="input" type="date" value={f.reminderDate} onChange={e=>set("reminderDate",e.target.value)}/>
          </>}
          {type==="goal" && <>
            <input className="input" placeholder="Goal name (e.g. New Car)" value={f.goalTitle} onChange={e=>set("goalTitle",e.target.value)} autoFocus/>
            <input className="input" type="number" placeholder="Target amount (₹)" value={f.targetAmount} onChange={e=>set("targetAmount",e.target.value)}/>
            <input className="input" type="number" placeholder="Already saved (₹)" value={f.savedAmount} onChange={e=>set("savedAmount",e.target.value)}/>
          </>}
        </div>
        <button className="btn-primary" onClick={save} disabled={loading||saved} style={{marginTop:14,background:saved?"rgba(109,155,107,0.3)":undefined,borderColor:saved?T.green:undefined}}>
          {saved ? "✓ Saved!" : loading ? <div className="spinner"/> : `Save ${currentType?.label}`}
        </button>
      </div>
    </div>
  );
};

// ─── GLOBAL FAB ───────────────────────────────────────────────────────────────
const GlobalFAB = ({ screen, familyId }) => {
  const [open, setOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState(null);
  const openQuickAdd = (typeId) => { setOpen(false); setQuickAddType(typeId); };
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") { setOpen(false); setQuickAddType(null); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  if (screen === "ai") return null;
  return (
    <>
      {open && <div className="fab-overlay" onClick={()=>setOpen(false)}/>}
      {open && (
        <div className="fab-menu">
          {QUICK_ADD_TYPES.map((t, i) => (
            <div key={t.id} className="fab-item" style={{animationDelay:`${i*0.04}s`}} onClick={()=>openQuickAdd(t.id)}>
              <span className="fab-item-label">{t.label}</span>
              <div className="fab-item-btn" style={{background:`${t.color}18`,borderColor:`${t.color}30`}}>{t.emoji}</div>
            </div>
          ))}
        </div>
      )}
      <button className={`fab ${open?"open":""}`} onClick={()=>setOpen(o=>!o)}>
        <I n="plus" s={22} c="white" w={2.5}/>
      </button>
      {quickAddType && <QuickAddModal onClose={()=>setQuickAddType(null)} familyId={familyId} defaultType={quickAddType}/>}
    </>
  );
};

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
const AuthScreen = ({ onLogin }) => {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name:"", email:"", password:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const prefill = who => {
    const emails = { Mayank: "drmayankgupta.mds@gmail.com", Simmi: "aggarwal.simmi09@gmail.com" };
    const passwords = { Mayank: "Mayank@123", Simmi: "Sim@1234" };
    setForm({ name: who, email: emails[who], password: passwords[who] });
  };
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
    <div style={{flex:1,display:"flex",flexDirection:"column",padding:"60px 24px 40px",background:T.bg,minHeight:"100vh",backgroundImage:`radial-gradient(ellipse 600px 500px at 50% -100px,rgba(125,157,124,0.12) 0%,transparent 65%)`}}>
      <div style={{textAlign:"center",marginBottom:36}}>
        <div style={{fontSize:56,marginBottom:16,animation:"float 3s ease-in-out infinite"}}>🏠</div>
        <div style={{fontSize:30,fontWeight:900,letterSpacing:"-.5px"}}>Family OS</div>
        <div style={{fontSize:14,color:T.muted,marginTop:6}}>Gupta Family · Sector 48, Gurgaon</div>
      </div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,color:T.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Quick Sign In</div>
        <div style={{display:"flex",gap:10}}>
          {[{n:"Mayank",e:"👨‍⚕️"},{n:"Simmi",e:"👩"}].map(m => (
            <div key={m.n} onClick={() => prefill(m.n)} style={{flex:1,padding:"13px",background:form.name===m.n ? T.accentSoft : T.card,border:`1px solid ${form.name===m.n ? "rgba(125,157,124,0.3)" : T.border}`,borderRadius:16,textAlign:"center",cursor:"pointer",transition:"all .2s"}}>
              <div style={{fontSize:28,marginBottom:5}}>{m.e}</div>
              <div style={{fontSize:14,fontWeight:700,color:form.name===m.n ? T.accent : T.text}}>{m.n}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
        {mode==="signup" && <input className="input" placeholder="Your name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>}
        <input className="input" type="email" placeholder="Email" inputMode="email" autoComplete="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} autoCapitalize="none"/>
        <input className="input" type="password" placeholder="Password" autoComplete="current-password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handle()}/>
      </div>
      {error && <div style={{padding:"10px 14px",background:T.redSoft,border:"1px solid rgba(196,96,58,0.2)",borderRadius:12,fontSize:13,color:T.red,marginBottom:12}}>{error}</div>}
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
    const sub = supabase.channel(`rt-${table}-${Math.random()}`)
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

// ─── BELL BUTTON ──────────────────────────────────────────────────────────────
const BellButton = ({ familyId }) => {
  const { rows: notifs } = useTable("notifications", familyId, { order: "created_at", asc: false, limit: 50 });
  const [open, setOpen] = useState(false);
  const unread = notifs.filter(n => !n.read).length;
  return (
    <>
      <div style={{width:38,height:38,borderRadius:12,background:"#FFFFFF",border:"1px solid #E8E4DE",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative"}} onClick={()=>setOpen(true)}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9E9488" strokeWidth="1.8" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        {unread > 0 && <div className="notif-badge">{unread > 9 ? "9+" : unread}</div>}
      </div>
      {open && <NotificationsScreen familyId={familyId} onClose={()=>setOpen(false)}/>}
    </>
  );
};

// ─── INLINE BALANCE WIDGET ────────────────────────────────────────────────────

// ─── COUNTUP HOOK ─────────────────────────────────────────────────────────────
function useCountUp(target, duration = 700) {
  const [val, setVal] = useState(Math.abs(target));
  const prev = useRef(Math.abs(target));
  useEffect(() => {
    const start = prev.current;
    const end = Math.abs(target);
    if (start === end) return;
    const startTime = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(start + (end - start) * ease));
      if (progress < 1) requestAnimationFrame(tick);
      else { prev.current = end; setVal(end); }
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return val;
}

const AnimatedBalance = ({ value }) => {
  const animated = useCountUp(value, 700);
  return (
    <div style={{fontSize:28,fontWeight:900,letterSpacing:"-1px",marginTop:3,color:value>=0?"#6D9B6B":"#C4603A",fontFamily:"'JetBrains Mono',monospace"}}>
      {value<0?"-":""}₹{animated.toLocaleString("en-IN")}
    </div>
  );
};

const InlineBalanceWidget = ({ txns, navigate, pendingTasks }) => {
  const bal = calcBalance(txns);
  return (
    <div style={{padding:"12px 20px 0"}}>
      <div style={{background:"linear-gradient(135deg,rgba(109,155,107,0.12),rgba(139,124,248,0.10))",border:`1px solid rgba(52,211,153,0.22)`,borderRadius:20,padding:"16px 18px",marginBottom:10,cursor:"pointer"}} onClick={()=>navigate("finance")}>
        <div style={{fontSize:12,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Available Balance</div>
        <AnimatedBalance value={bal.available}/>
        <div style={{fontSize:11,color:T.muted,marginTop:3}}>{bal.available>=0?"✅ Saving money this month":"⚠️ Expenses exceed income"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12,paddingTop:12,borderTop:`1px solid ${T.border}`}}>
          {[
            {l:"🏥 Clinic",v:inr(bal.clinicIncome),c:T.green,to:"finance"},
            {l:"👩 Simmi",v:inr(bal.simmiIncome),c:T.blue,to:"finance"},
            {l:"💸 Spent",v:inr(bal.totalExpenses),c:T.red,to:"finance"},
            {l:"✅ Tasks",v:`${pendingTasks.length} left`,c:T.accent,to:"household"},
          ].map((s)=>(
            <div key={s.l} onClick={e=>{e.stopPropagation();navigate(s.to);}} style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"8px 10px",cursor:"pointer"}}>
              <div style={{fontSize:12,color:T.muted,fontWeight:600}}>{s.l}</div>
              <div style={{fontSize:14,fontWeight:700,color:s.c,marginTop:2}}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── ADD INCOME MODAL ─────────────────────────────────────────────────────────
const AddIncomeModal = ({ onClose, familyId }) => {
  const [source, setSource] = useState("Clinic Income");
  const [f, setF] = useState({ amount:"", description:"", date: today() });
  const [loading, setLoading] = useState(false);
  const sources = {
    "Clinic Income": { emoji:"🏥", color:T.green, placeholder:"OPD, Procedures, Consultations" },
    "Simmi Income":  { emoji:"👩", color:T.blue,  placeholder:"Salary, Freelance, Other" },
  };
  const save = async () => {
    if (!f.amount) return;
    setLoading(true);
    const { data: txnData } = await supabase.from("transactions").select("amount").eq("family_id", familyId);
    const bal = calcBalance(txnData || []);
    await supabase.from("transactions").insert([{
      description: f.description || source, amount: Math.abs(Number(f.amount)),
      category: source, added_by: source==="Clinic Income"?"Mayank":"Simmi",
      date: f.date, emoji: sources[source].emoji, family_id: familyId,
    }]);
    notifyIncomeAdded(familyId, { amount: f.amount, category: source, balance: bal.available + Math.abs(Number(f.amount)) });
    setLoading(false); onClose();
  };
  return (
    <Modal title="Add Income" onClose={onClose}>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {Object.entries(sources).map(([key,cfg])=>(
          <div key={key} onClick={()=>setSource(key)} style={{flex:1,height:44,display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"8px",borderRadius:12,border:`1px solid ${source===key?cfg.color+"55":T.border}`,background:source===key?cfg.color+"12":T.card,cursor:"pointer",transition:"all .18s"}}>
            <div style={{fontSize:18}}>{cfg.emoji}</div>
            <div style={{fontSize:12,fontWeight:700,color:source===key?cfg.color:T.muted}}>{key}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <input className="input" type="number" placeholder="Amount (₹)" value={f.amount} onChange={e=>setF(x=>({...x,amount:e.target.value}))} autoFocus/>
        <input className="input" placeholder={sources[source].placeholder} value={f.description} onChange={e=>setF(x=>({...x,description:e.target.value}))}/>
        <input className="input" type="date" value={f.date} onChange={e=>setF(x=>({...x,date:e.target.value}))}/>
        <button className="btn-primary" onClick={save} disabled={loading} style={{background:sources[source].color}}>
          {loading?<div className="spinner"/>:`Add ${source}`}
        </button>
      </div>
    </Modal>
  );
};

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
const HomeScreen = ({ navigate, openModal, familyId, user }) => {
  const { rows: tasks } = useTable("tasks", familyId, { order: "created_at" });
  const { rows: txns } = useTable("transactions", familyId, { order: "date", limit: 500 });
  const { rows: grocery } = useTable("grocery", familyId);
  const { rows: pantry } = useTable("pantry", familyId);
  const { rows: bills } = useTable("bills", familyId, { order: "due_date", asc: true });
  const { rows: goals } = useTable("goals", familyId);
  const pendingTasks = tasks.filter(t => !t.done);
  const lowGrocery = grocery.filter(g => Number(g.quantity) <= Number(g.par_level));
  const lowPantry = pantry.filter(p => Number(p.quantity) <= Number(p.par_level));
  const urgentBills = bills.filter(b => !b.paid && b.is_urgent);

  return (
    <div className="screen">
      <div style={{padding:"calc(44px + env(safe-area-inset-top,0px)) 18px 0"}}>
        <div className="row">
          <div>
            <div style={{fontSize:12,color:T.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:".04em"}}>{new Date().getHours()<12?"Good morning ☀️":new Date().getHours()<17?"Good afternoon 🌤":"Good evening 🌙"}</div>
            <div style={{fontSize:20,fontWeight:900,letterSpacing:"-.4px",marginTop:2}}>Mayank & Simmi</div>
            <div style={{fontSize:12,color:T.dim,marginTop:2}}>📍 Sector 48, Gurgaon</div>
          </div>
          <BellButton familyId={familyId}/>
        </div>
      </div>

      {(urgentBills.length > 0 || lowGrocery.length > 0 || lowPantry.length > 0) && (
        <div style={{padding:"12px 18px 0"}}>
          {urgentBills.length > 0 && (
            <div className="alert-bar" style={{background:T.redSoft,border:"1px solid rgba(196,96,58,0.2)"}}>
              <span style={{fontSize:15}}>🔴</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:T.red}}>{urgentBills.length} Urgent Bill{urgentBills.length>1?"s":""}</div>
                <div style={{fontSize:11.5,color:T.muted}}>{urgentBills.slice(0,2).map(b=>b.name).join(" · ")}</div>
              </div>
              <span onClick={()=>navigate("finance")} style={{fontSize:12,color:T.red,fontWeight:600,cursor:"pointer"}}>Pay →</span>
            </div>
          )}
          {(lowGrocery.length > 0 || lowPantry.length > 0) && (
            <div className="alert-bar" style={{background:T.amberSoft,border:"1px solid rgba(196,136,58,0.2)"}}>
              <span style={{fontSize:15}}>🛒</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:T.amber}}>{lowGrocery.length + lowPantry.length} items need restocking</div>
                <div style={{fontSize:11.5,color:T.muted}}>{[...lowGrocery,...lowPantry].slice(0,3).map(g=>g.name).join(", ")}</div>
              </div>
              <span onClick={()=>navigate("kitchen")} style={{fontSize:12,color:T.amber,fontWeight:600,cursor:"pointer"}}>Kitchen →</span>
            </div>
          )}
        </div>
      )}

      <div className="stagger-1"><InlineBalanceWidget txns={txns} navigate={navigate} pendingTasks={pendingTasks}/></div>

      <div className="quick-actions stagger-2">
        {[
          {emoji:"🏥",label:"Income",color:T.green,action:()=>openModal("income")},
          {emoji:"💸",label:"Expense",color:T.accent,action:()=>openModal("expense")},
          {emoji:"🍽",label:"Kitchen",color:T.teal,action:()=>navigate("kitchen")},
          {emoji:"🤖",label:"Ask AI",color:T.pink,action:()=>navigate("ai")},
        ].map(q=>(
          <div key={q.label} className="quick-action" onClick={q.action}>
            <div className="quick-action-icon" style={{background:`${q.color}16`,border:`1px solid ${q.color}30`}}>{q.emoji}</div>
            <span className="quick-action-label">{q.label}</span>
          </div>
        ))}
      </div>

      <div style={{padding:"16px 18px 0"}} className="stagger-3">
        <div className="row" style={{marginBottom:12}}>
          <span className="sec-title">Pending Tasks</span>
          <span className="sec-link" onClick={()=>navigate("household")}>{pendingTasks.length} total</span>
        </div>
        {pendingTasks.length === 0
          ? <div className="card" style={{padding:"20px",textAlign:"center",color:T.muted,fontSize:14}}>🎉 All tasks done!</div>
          : <div className="card" style={{padding:"2px 14px"}}>
              {pendingTasks.slice(0,4).map(t=>(
                <div key={t.id} className="list-row">
                  <div style={{width:21,height:21,borderRadius:8,border:`2px solid ${t.priority==="high"?T.red:t.priority==="medium"?T.amber:T.green}`,flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:500}}>{t.title}</div>
                    <div style={{fontSize:11.5,color:T.muted}}>{t.assignee==="Mayank"?"👨‍⚕️":"👩"} {t.assignee} · {t.due_date||"No date"}</div>
                  </div>
                  <span className="tag" style={{background:t.priority==="high"?T.redSoft:t.priority==="medium"?T.amberSoft:T.greenSoft,color:t.priority==="high"?T.red:t.priority==="medium"?T.amber:T.green}}>{t.priority}</span>
                </div>
              ))}
            </div>
        }
      </div>

      <div style={{padding:"16px 18px 0"}} className="stagger-4">
        <div className="row" style={{marginBottom:12}}>
          <span className="sec-title">Recent</span>
          <span className="sec-link" onClick={()=>navigate("finance")}>All</span>
        </div>
        {txns.length === 0
          ? <div className="card" style={{padding:"20px",textAlign:"center",color:T.muted,fontSize:14}}>No transactions yet.</div>
          : <div className="card" style={{padding:"2px 14px"}}>
              {txns.slice(0,4).map(tx=>(
                <div key={tx.id} className="list-row">
                  <div style={{width:38,height:38,borderRadius:12,background:Number(tx.amount)>0?T.greenSoft:T.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{tx.emoji||"💸"}</div>
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

      {goals.length > 0 && (
        <div style={{padding:"16px 18px 24px"}}>
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
  const { rows: txns, loading, remove, update: updTx } = useTable("transactions", familyId, { order: "date", limit: 50 });
  const [editTx, setEditTx] = useState(null);
  const { rows: bills } = useTable("bills", familyId, { order: "due_date", asc: true });
  const { rows: budgets } = useTable("budgets", familyId);
  const income = txns.filter(t=>Number(t.amount)>0).reduce((a,t)=>a+Number(t.amount),0);
  const spent = txns.filter(t=>Number(t.amount)<0).reduce((a,t)=>a+Math.abs(Number(t.amount)),0);
  return (
    <div className="screen">
      <div className="ph" style={{paddingTop:"calc(52px + env(safe-area-inset-top, 0px))"}}>
        <div className="row">
          <div><div className="pt">Finance</div><div className="ps">Live data · Supabase ✓</div></div>
          <div style={{padding:"6px 12px",background:T.greenSoft,border:"1px solid rgba(52,211,153,0.22)",borderRadius:100,fontSize:12,color:T.green,fontWeight:600}}>Live ●</div>
        </div>
      </div>
      <div style={{padding:"12px 18px 0"}}>
        <div className="card" style={{padding:18,background:"linear-gradient(135deg,rgba(125,157,124,0.12),rgba(96,165,250,0.06))",borderColor:"rgba(125,157,124,0.2)",marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {[{l:"Income",v:inr(income),c:T.green},{l:"Spent",v:inr(spent),c:T.red},{l:"Net",v:inr(income-spent),c:T.accent}].map(s=>(
              <div key={s.l} style={{textAlign:"center"}}>
                <div style={{fontSize:12,color:T.muted,fontWeight:600,textTransform:"uppercase"}}>{s.l}</div>
                <div style={{fontSize:16,fontWeight:800,color:s.c,marginTop:3}} className="mono">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="scroll-x" style={{padding:"0 18px",marginBottom:12}}>
        {["transactions","gmail","advisor"].map(t=>(
          <div key={t} className={`chip ${tab===t?"on":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
        ))}
      </div>
      <div style={{padding:"0 18px"}}>
        {tab==="transactions" && (
          loading ? <div style={{textAlign:"center",padding:40,color:T.muted}}>Loading...</div>
          : txns.length===0
            ? <div className="empty"><div className="empty-icon">💸</div><div className="empty-text">No transactions yet.<br/><span style={{fontSize:12,color:"rgba(238,236,248,0.4)"}}>Add income or an expense to get started.</span></div></div>
            : <div className="card" style={{padding:"2px 14px"}}>
                {txns.map(tx=>(
                  <div key={tx.id} className="list-row" onClick={()=>setEditTx({...tx})}>
                    <div style={{width:38,height:38,borderRadius:12,background:Number(tx.amount)>0?T.greenSoft:T.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{tx.emoji||"💸"}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:500}}>{tx.description}</div>
                      <div style={{fontSize:11.5,color:T.muted}}>{tx.category} · {tx.date}</div>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <div style={{fontSize:14,fontWeight:700,color:Number(tx.amount)>0?T.green:T.text}} className="mono">
                        {Number(tx.amount)>0?"+":""}{inr(tx.amount)}
                      </div>
                      <div onClick={e=>{e.stopPropagation();remove(tx.id);}} style={{cursor:"pointer",opacity:0.4}}><I n="trash" s={14} c={T.red}/></div>
                    </div>
                  </div>
                ))}
              </div>
        )}
                {/* EDIT TRANSACTION MODAL */}
        {editTx && (
          <Modal title="Edit Transaction" onClose={()=>setEditTx(null)}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input className="input" placeholder="Description" value={editTx.description||""} onChange={e=>setEditTx(x=>({...x,description:e.target.value}))} autoFocus/>
              <input className="input" type="number" placeholder="Amount" value={Math.abs(editTx.amount)||""} onChange={e=>setEditTx(x=>({...x,amount:Number(x.amount)<0?-Math.abs(Number(e.target.value)):Math.abs(Number(e.target.value))}))}/>
              <select className="input" value={editTx.category||""} onChange={e=>setEditTx(x=>({...x,category:e.target.value}))}>
                {["Clinic Income","Simmi Income","Groceries","Utilities","Dining & Food","Transport","Medical","Entertainment","Education","Shopping","Home Loan EMI","Other"].map(c=><option key={c}>{c}</option>)}
              </select>
              <input className="input" type="date" value={editTx.date||""} onChange={e=>setEditTx(x=>({...x,date:e.target.value}))}/>
              <button className="btn-primary" onClick={async()=>{
                await updTx(editTx.id,{description:editTx.description,amount:editTx.amount,category:editTx.category,date:editTx.date});
                setEditTx(null);
              }}>Save Changes</button>
              <button onClick={async()=>{await remove(editTx.id);setEditTx(null);}} style={{width:"100%",padding:"14px",background:"rgba(196,96,58,0.12)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:14,color:"#C4603A",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"Plus Jakarta Sans,sans-serif"}}>
                Delete Transaction
              </button>
            </div>
          </Modal>
        )}
        {tab==="gmail" && <GmailSyncScreen familyId={familyId}/>}
        {tab==="advisor" && <FinanceAdvisorScreen familyId={familyId}/>}
        {tab==="categories" && (() => {
          const catEmoji = {"Groceries":"🛒","Utilities":"⚡","Dining & Food":"🍽️","Transport":"🚗","Medical":"💊","Entertainment":"🎬","Education":"📚","Shopping":"🛍️","Home Loan EMI":"🏠","Other":"💸","Clinic Income":"🏥","Simmi Income":"👩"};
          const cats = {};
          txns.filter(t=>Number(t.amount)<0).forEach(t=>{
            const c = t.category||"Other";
            cats[c] = (cats[c]||0) + Math.abs(Number(t.amount));
          });
          const sorted = Object.entries(cats).sort((a,b)=>b[1]-a[1]);
          const total = sorted.reduce((a,c)=>a+c[1],0);
          return sorted.length===0
            ? <div className="empty"><div className="empty-icon">📊</div><div className="empty-text">No expenses yet.</div></div>
            : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {sorted.map(([cat,amt])=>{
                  const p = total>0?Math.round((amt/total)*100):0;
                  return (
                    <div key={cat} className="card" style={{padding:"14px 16px"}}>
                      <div className="row" style={{marginBottom:9}}>
                        <div style={{display:"flex",gap:10,alignItems:"center"}}>
                          <div style={{width:38,height:38,borderRadius:12,background:T.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{catEmoji[cat]||"💸"}</div>
                          <div>
                            <div style={{fontSize:14,fontWeight:600}}>{cat}</div>
                            <div style={{fontSize:11,color:T.muted}}>{p}% of total spend</div>
                          </div>
                        </div>
                        <div style={{fontSize:15,fontWeight:800,color:T.red}} className="mono">{inr(amt)}</div>
                      </div>
                      <div className="progress">
                        <div className="progress-fill" style={{width:`${p}%`,background:p>30?T.red:p>15?T.amber:T.accent}}/>
                      </div>
                    </div>
                  );
                })}
                <div style={{padding:"12px 16px",background:T.card,borderRadius:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:13,color:T.muted,fontWeight:600}}>Total Spent</span>
                  <span style={{fontSize:16,fontWeight:800,color:T.red}} className="mono">{inr(total)}</span>
                </div>
              </div>;
        })()}
      </div>
    </div>
  );
};

// ─── HOUSEHOLD SCREEN ─────────────────────────────────────────────────────────

const seedHousehold = async (familyId) => {
  const { data: existingTasks } = await supabase.from("tasks").select("id").eq("family_id", familyId).limit(1);
  if (!existingTasks?.length) {
    await supabase.from("tasks").insert([
      { family_id: familyId, title: "Pay electricity bill", assignee: "Mayank", priority: "high", category: "Bills", due_date: today(), done: false },
      { family_id: familyId, title: "Pay society maintenance", assignee: "Mayank", priority: "high", category: "Bills", due_date: today(), done: false },
      { family_id: familyId, title: "Veda school fees", assignee: "Simmi", priority: "high", category: "Education", due_date: today(), done: false },
      { family_id: familyId, title: "Grocery shopping", assignee: "Simmi", priority: "medium", category: "Grocery", due_date: today(), done: false },
      { family_id: familyId, title: "Car wash", assignee: "Mayank", priority: "low", category: "Vehicle", due_date: today(), done: false },
      { family_id: familyId, title: "House cleaning check", assignee: "Simmi", priority: "low", category: "Chores", due_date: today(), done: false },
    ]);
  }
  const { data: existingMaint } = await supabase.from("maintenance").select("id").eq("family_id", familyId).limit(1);
  if (!existingMaint?.length) {
    await supabase.from("maintenance").insert([
      { family_id: familyId, name: "AC Service", emoji: "❄️", last_done: "", next_due: "", notes: "Every 3 months" },
      { family_id: familyId, name: "Car Service", emoji: "🚗", last_done: "", next_due: "", notes: "Every 6 months" },
      { family_id: familyId, name: "Water Purifier Filter", emoji: "💧", last_done: "", next_due: "", notes: "Every 6 months" },
      { family_id: familyId, name: "Inverter Battery Check", emoji: "🔋", last_done: "", next_due: "", notes: "Every 3 months" },
      { family_id: familyId, name: "Geyser Service", emoji: "🚿", last_done: "", next_due: "", notes: "Every year" },
      { family_id: familyId, name: "Pest Control", emoji: "🐛", last_done: "", next_due: "", notes: "Every 6 months" },
    ]);
  }
  const { data: existingDocs } = await supabase.from("documents").select("id").eq("family_id", familyId).limit(1);
  if (!existingDocs?.length) {
    await supabase.from("documents").insert([
      { family_id: familyId, name: "Aadhar Card - Mayank", category: "Identity", emoji: "🪪", date: "" },
      { family_id: familyId, name: "Aadhar Card - Simmi", category: "Identity", emoji: "🪪", date: "" },
      { family_id: familyId, name: "Aadhar Card - Veda", category: "Identity", emoji: "🪪", date: "" },
      { family_id: familyId, name: "PAN Card - Mayank", category: "Identity", emoji: "💳", date: "" },
      { family_id: familyId, name: "PAN Card - Simmi", category: "Identity", emoji: "💳", date: "" },
      { family_id: familyId, name: "Passport - Mayank", category: "Travel", emoji: "📘", date: "" },
      { family_id: familyId, name: "Passport - Simmi", category: "Travel", emoji: "📘", date: "" },
      { family_id: familyId, name: "Car Insurance", category: "Insurance", emoji: "🚗", date: "" },
      { family_id: familyId, name: "Health Insurance", category: "Insurance", emoji: "💊", date: "" },
      { family_id: familyId, name: "Home Loan Documents", category: "Property", emoji: "🏠", date: "" },
    ]);
  }
};
const HouseholdScreen = ({ familyId }) => {
  const [tab, setTab] = useState("chores");
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [reminderForm, setReminderForm] = useState({title:"",category:"Appliance",due_date:"",repeat:"none",notes:"",emoji:"🔔"});
  const [showAddGrocery, setShowAddGrocery] = useState(false);
  const [showAddMaint, setShowAddMaint] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [taskForm, setTaskForm] = useState({title:"",assignee:"Mayank",priority:"medium",category:"General",due_date:""});
  const [grocForm, setGrocForm] = useState({name:"",category:"Vegetables",quantity:"1",unit:"kg",par_level:"1"});
  const [maintForm, setMaintForm] = useState({name:"",last_done:"",next_due:"",notes:""});
  const [docForm, setDocForm] = useState({name:"",category:"Personal",date:"",emoji:"📄"});
  const { rows: tasks, update: updTask, remove: removeTask } = useTable("tasks", familyId, { order: "created_at" });
  const { rows: grocery } = useTable("grocery", familyId, { order: "name", asc: true });
  const { rows: docs } = useTable("documents", familyId);
  const { rows: maint } = useTable("maintenance", familyId);
  const toggleTask = (id, done) => updTask(id, { done, done_at: done ? new Date().toISOString() : null });
  const [seededHH, setSeededHH] = useState(false);
  useEffect(() => {
    if (!seededHH && familyId) { seedHousehold(familyId).then(() => setSeededHH(true)); }
  }, [familyId, seededHH]);
  return (
    <div className="screen">
      <div className="ph" style={{paddingTop:"calc(52px + env(safe-area-inset-top, 0px))"}}>
        <div className="pt">Household</div>
        <div className="ps">{tasks.filter(t=>!t.done).length} tasks pending · {grocery.filter(g=>Number(g.quantity)<=Number(g.par_level)).length} grocery alerts</div>
      </div>
      <div className="scroll-x" style={{padding:"0 18px",marginBottom:12}}>
        {["chores","maintenance","documents","reminders"].map(t=>(
          <div key={t} className={`chip ${tab===t?"on":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
        ))}
      </div>
      <div style={{padding:"0 18px"}}>
        {/* ADD TASK MODAL */}
        {showAddTask && (
          <Modal title="Add Task" onClose={()=>setShowAddTask(false)}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input className="input" placeholder="Task title" autoFocus value={taskForm.title} onChange={e=>setTaskForm(x=>({...x,title:e.target.value}))}/>
              <select className="input" value={taskForm.assignee} onChange={e=>setTaskForm(x=>({...x,assignee:e.target.value}))}>
                <option>Mayank</option><option>Simmi</option>
              </select>
              <select className="input" value={taskForm.priority} onChange={e=>setTaskForm(x=>({...x,priority:e.target.value}))}>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
              <input className="input" type="date" value={taskForm.due_date} onChange={e=>setTaskForm(x=>({...x,due_date:e.target.value}))}/>
              <button className="btn-primary" onClick={async()=>{
                if(!taskForm.title) return;
                await supabase.from("tasks").insert([{family_id:familyId,...taskForm,done:false,created_at:new Date().toISOString()}]);
                setTaskForm({title:"",assignee:"Mayank",priority:"medium",category:"General",due_date:""});
                setShowAddTask(false);
              }}>Add Task</button>
            </div>
          </Modal>
        )}
        {/* ADD GROCERY MODAL */}
        {showAddGrocery && (
          <Modal title="Add Grocery Item" onClose={()=>setShowAddGrocery(false)}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input className="input" placeholder="Item name" autoFocus value={grocForm.name} onChange={e=>setGrocForm(x=>({...x,name:e.target.value}))}/>
              <select className="input" value={grocForm.category} onChange={e=>setGrocForm(x=>({...x,category:e.target.value}))}>
                {["Vegetables","Dairy","Grains","Pulses","Fruits","Snacks","Spices","Oils","Beverages","Cleaning","Other"].map(c=><option key={c}>{c}</option>)}
              </select>
              <div style={{display:"flex",gap:8}}>
                <input className="input" type="number" placeholder="Qty" value={grocForm.quantity} onChange={e=>setGrocForm(x=>({...x,quantity:e.target.value}))} style={{flex:1}}/>
                <select className="input" value={grocForm.unit} onChange={e=>setGrocForm(x=>({...x,unit:e.target.value}))} style={{flex:1}}>
                  {["kg","g","L","ml","pcs","pack","dozen"].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
              <input className="input" type="number" placeholder="Reorder level" value={grocForm.par_level} onChange={e=>setGrocForm(x=>({...x,par_level:e.target.value}))}/>
              <button className="btn-primary" onClick={async()=>{
                if(!grocForm.name) return;
                await supabase.from("grocery").insert([{family_id:familyId,name:grocForm.name,category:grocForm.category,quantity:Number(grocForm.quantity),unit:grocForm.unit,par_level:Number(grocForm.par_level)}]);
                setGrocForm({name:"",category:"Vegetables",quantity:"1",unit:"kg",par_level:"1"});
                setShowAddGrocery(false);
              }}>Add Item</button>
            </div>
          </Modal>
        )}
        {/* ADD MAINTENANCE MODAL */}
        {showAddMaint && (
          <Modal title="Add Maintenance" onClose={()=>setShowAddMaint(false)}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input className="input" placeholder="e.g. Water Filter Change" autoFocus value={maintForm.name} onChange={e=>setMaintForm(x=>({...x,name:e.target.value}))}/>
              <input className="input" type="date" placeholder="Last done" value={maintForm.last_done} onChange={e=>setMaintForm(x=>({...x,last_done:e.target.value}))}/>
              <input className="input" type="date" placeholder="Next due" value={maintForm.next_due} onChange={e=>setMaintForm(x=>({...x,next_due:e.target.value}))}/>
              <input className="input" placeholder="Notes (optional)" value={maintForm.notes} onChange={e=>setMaintForm(x=>({...x,notes:e.target.value}))}/>
              <button className="btn-primary" onClick={async()=>{
                if(!maintForm.name) return;
                await supabase.from("maintenance").insert([{family_id:familyId,...maintForm}]);
                setMaintForm({name:"",last_done:"",next_due:"",notes:""});
                setShowAddMaint(false);
              }}>Add</button>
            </div>
          </Modal>
        )}
        {/* ADD DOCUMENT MODAL */}
        {showAddDoc && (
          <Modal title="Add Document" onClose={()=>setShowAddDoc(false)}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input className="input" placeholder="Document name" autoFocus value={docForm.name} onChange={e=>setDocForm(x=>({...x,name:e.target.value}))}/>
              <select className="input" value={docForm.category} onChange={e=>setDocForm(x=>({...x,category:e.target.value}))}>
                {["Personal","Medical","Financial","Legal","Property","Vehicle","Insurance","Education","Other"].map(c=><option key={c}>{c}</option>)}
              </select>
              <input className="input" type="date" value={docForm.date} onChange={e=>setDocForm(x=>({...x,date:e.target.value}))}/>
              <input className="input" placeholder="Emoji (optional)" value={docForm.emoji} onChange={e=>setDocForm(x=>({...x,emoji:e.target.value}))}/>
              <button className="btn-primary" onClick={async()=>{
                if(!docForm.name) return;
                await supabase.from("documents").insert([{family_id:familyId,...docForm}]);
                setDocForm({name:"",category:"Personal",date:"",emoji:"📄"});
                setShowAddDoc(false);
              }}>Add Document</button>
            </div>
          </Modal>
        )}
        {/* ADD SERVICE REMINDER MODAL */}
        {showAddReminder && (
          <Modal title="Add Service Reminder" onClose={()=>setShowAddReminder(false)}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input className="input" placeholder="e.g. AC Service, Car Service" autoFocus value={reminderForm.title} onChange={e=>setReminderForm(x=>({...x,title:e.target.value}))}/>
              <select className="input" value={reminderForm.category} onChange={e=>setReminderForm(x=>({...x,category:e.target.value}))}>
                {["Appliance","Vehicle","Medical","Subscription","Insurance","Property","Utility","Other"].map(c=><option key={c}>{c}</option>)}
              </select>
              <input className="input" type="date" placeholder="Due date" value={reminderForm.due_date} onChange={e=>setReminderForm(x=>({...x,due_date:e.target.value}))}/>
              <select className="input" value={reminderForm.repeat} onChange={e=>setReminderForm(x=>({...x,repeat:e.target.value}))}>
                <option value="none">No Repeat</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Every 3 Months</option>
                <option value="biannual">Every 6 Months</option>
                <option value="annual">Yearly</option>
              </select>
              <div style={{display:"flex",gap:8}}>
                <input className="input" placeholder="Emoji" value={reminderForm.emoji} onChange={e=>setReminderForm(x=>({...x,emoji:e.target.value}))} style={{flex:1}}/>
                <input className="input" placeholder="Notes" value={reminderForm.notes} onChange={e=>setReminderForm(x=>({...x,notes:e.target.value}))} style={{flex:2}}/>
              </div>
              <button className="btn-primary" onClick={async()=>{
                if(!reminderForm.title || !reminderForm.due_date) return;
                await supabase.from("reminders").insert([{
                  family_id:familyId,
                  content:`${reminderForm.emoji} ${reminderForm.title} — ${reminderForm.category}`,
                  due_date:reminderForm.due_date,
                  done:false,
                  notes:reminderForm.notes,
                  repeat:reminderForm.repeat,
                  category:reminderForm.category,
                }]);
                showToast({title:"Reminder Added!",body:`${reminderForm.title} due ${reminderForm.due_date}`,icon:reminderForm.emoji,color:"#7D9D7C"});
                setReminderForm({title:"",category:"Appliance",due_date:"",repeat:"none",notes:"",emoji:"🔔"});
                setShowAddReminder(false);
              }}>Add Reminder</button>
            </div>
          </Modal>
        )}
        {/* ADD BUTTON */}
        <button className="btn-primary" onClick={()=>{
          if(tab==="chores") setShowAddTask(true);
          else if(tab==="grocery") setShowAddGrocery(true);
          else if(tab==="maintenance") setShowAddMaint(true);
          else if(tab==="documents") setShowAddDoc(true);
          else if(tab==="reminders") setShowAddReminder(true);
        }} style={{width:"100%",height:44,fontSize:14,marginBottom:14}}>
          + Add {tab==="chores"?"Task":tab==="grocery"?"Grocery Item":tab==="maintenance"?"Maintenance":tab==="documents"?"Document":tab==="reminders"?"Service Reminder":"Item"}
        </button>
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
                  <div className="card" style={{padding:"2px 14px"}}>
                    {mine.map(task=>(
                      <div key={task.id} className="list-row" onClick={()=>toggleTask(task.id,!task.done)}>
                        <div style={{width:22,height:22,borderRadius:8,border:`2px solid ${task.done?T.green:task.priority==="high"?T.red:task.priority==="medium"?T.amber:T.green}`,display:"flex",alignItems:"center",justifyContent:"center",background:task.done?T.green:"transparent",flexShrink:0,transition:"all .2s"}}>
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
            {tasks.length===0 && <div className="empty"><div className="empty-icon">✅</div><div className="empty-text">No tasks yet.<br/><span style={{fontSize:12,color:"rgba(238,236,248,0.4)"}}>Tap + to add your first task.</span></div></div>}
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
              ? <div className="empty"><div className="empty-icon">🛒</div><div className="empty-text">No grocery items.<br/><span style={{fontSize:12,color:"rgba(238,236,248,0.4)"}}>Tap + to add items to your shopping list.</span></div></div>
              : <div className="card" style={{padding:"2px 14px"}}>
                  {grocery.map(item=>(
                    <div key={item.id} className="list-row">
                      <div style={{width:8,height:8,borderRadius:"50%",background:Number(item.quantity)<=Number(item.par_level)?T.red:T.green,flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:500}}>{item.name}</div>
                        <div style={{fontSize:11.5,color:T.muted}}>{item.category} · Exp: {item.expiry_date||"—"}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:14,fontWeight:600}}>{item.quantity} {item.unit}</div>
                        {Number(item.quantity)<=Number(item.par_level) && <div style={{fontSize:12,color:T.red,fontWeight:600}}>Restock</div>}
                      </div>
                    </div>
                  ))}
                </div>
            }
          </>
        )}
        {tab==="maintenance" && (
          maint.length===0
            ? <div className="empty"><div className="empty-icon">🔧</div><div className="empty-text">No maintenance schedules yet.<br/><span style={{fontSize:12,color:"rgba(238,236,248,0.4)"}}>Track AC service, car maintenance & more.</span></div></div>
            : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {maint.map(m=>(
                  <div key={m.id} className="card" style={{padding:"15px",borderColor:m.overdue?"rgba(248,113,113,0.3)":T.border}}>
                    <div className="row">
                      <div style={{display:"flex",gap:12,alignItems:"center"}}>
                        <div style={{width:42,height:42,borderRadius:12,background:m.overdue?T.redSoft:T.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{m.emoji||"🔧"}</div>
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
        {tab==="reminders" && (
          <ServiceReminders familyId={familyId}/>
        )}
        {tab==="documents" && (
          docs.length===0
            ? <div className="empty"><div className="empty-icon">📁</div><div className="empty-text">No documents yet.<br/><span style={{fontSize:12,color:"rgba(238,236,248,0.4)"}}>Store Aadhaar, PAN, insurance & more.</span></div></div>
            : <div className="card" style={{padding:"2px 14px"}}>
                {docs.map(doc=>(
                  <div key={doc.id} className="list-row">
                    <div style={{width:38,height:38,borderRadius:12,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{doc.emoji||"📄"}</div>
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
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddHealth, setShowAddHealth] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [goalForm, setGoalForm] = useState({title:"",target_amount:"",saved_amount:"0",emoji:"🎯",color:"#7D9D7C",reminder_date:""});
  const [healthForm, setHealthForm] = useState({member_name:"Mayank",weight:"",blood_pressure:"",blood_sugar:"",medications:"None",notes:"",next_checkup:""});
  const [eventForm, setEventForm] = useState({title:"",event_date:"",type:"General",emoji:"📅",notes:""});
  const { rows: goals } = useTable("goals", familyId);
  const { rows: events } = useTable("events", familyId, { order: "event_date", asc: true });
  const { rows: health } = useTable("health", familyId);
  const [sel, setSel] = useState(new Date().getDate());
  return (
    <div className="screen">
      <div className="ph" style={{paddingTop:"calc(52px + env(safe-area-inset-top, 0px))"}}><div className="pt">Planner</div><div className="ps">Goals · Health · Calendar</div></div>
      <div className="scroll-x" style={{padding:"0 18px",marginBottom:12}}>
        {["goals","calendar","health"].map(t=>(
          <div key={t} className={`chip ${tab===t?"on":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
        ))}
      </div>
      <div style={{padding:"0 18px"}}>

        {/* ADD GOAL MODAL */}
        {showAddGoal && (
          <Modal title="Add Savings Goal" onClose={()=>setShowAddGoal(false)}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input className="input" placeholder="Goal title e.g. Vacation Fund" autoFocus value={goalForm.title} onChange={e=>setGoalForm(x=>({...x,title:e.target.value}))}/>
              <input className="input" type="number" placeholder="Target amount (₹)" value={goalForm.target_amount} onChange={e=>setGoalForm(x=>({...x,target_amount:e.target.value}))}/>
              <input className="input" type="number" placeholder="Already saved (₹)" value={goalForm.saved_amount} onChange={e=>setGoalForm(x=>({...x,saved_amount:e.target.value}))}/>
              <div style={{display:"flex",gap:8}}>
                <input className="input" placeholder="Emoji" value={goalForm.emoji} onChange={e=>setGoalForm(x=>({...x,emoji:e.target.value}))} style={{flex:1}}/>
                <input className="input" type="date" placeholder="Target date" value={goalForm.reminder_date} onChange={e=>setGoalForm(x=>({...x,reminder_date:e.target.value}))} style={{flex:2}}/>
              </div>
              <button className="btn-primary" onClick={async()=>{
                if(!goalForm.title || !goalForm.target_amount) return;
                await supabase.from("goals").insert([{family_id:familyId,title:goalForm.title,target_amount:Number(goalForm.target_amount),saved_amount:Number(goalForm.saved_amount||0),emoji:goalForm.emoji,color:"#7D9D7C",reminder_date:goalForm.reminder_date||null}]);
                setGoalForm({title:"",target_amount:"",saved_amount:"0",emoji:"🎯",color:"#7D9D7C",reminder_date:""});
                setShowAddGoal(false);
              }}>Add Goal</button>
            </div>
          </Modal>
        )}

        {/* ADD HEALTH RECORD MODAL */}
        {showAddHealth && (
          <Modal title="Add Health Record" onClose={()=>setShowAddHealth(false)}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <select className="input" value={healthForm.member_name} onChange={e=>setHealthForm(x=>({...x,member_name:e.target.value}))}>
                <option>Mayank</option><option>Simmi</option><option>Veda</option>
              </select>
              <div style={{display:"flex",gap:8}}>
                <input className="input" placeholder="Weight (kg)" value={healthForm.weight} onChange={e=>setHealthForm(x=>({...x,weight:e.target.value}))} style={{flex:1}}/>
                <input className="input" placeholder="BP (120/80)" value={healthForm.blood_pressure} onChange={e=>setHealthForm(x=>({...x,blood_pressure:e.target.value}))} style={{flex:1}}/>
              </div>
              <input className="input" placeholder="Blood Sugar (mg/dL)" value={healthForm.blood_sugar} onChange={e=>setHealthForm(x=>({...x,blood_sugar:e.target.value}))}/>
              <input className="input" placeholder="Medications (or None)" value={healthForm.medications} onChange={e=>setHealthForm(x=>({...x,medications:e.target.value}))}/>
              <input className="input" placeholder="Notes / symptoms" value={healthForm.notes} onChange={e=>setHealthForm(x=>({...x,notes:e.target.value}))}/>
              <div style={{fontSize:12,fontWeight:700,color:T.accent,marginTop:4}}>Next Checkup Reminder</div>
              <input className="input" type="date" placeholder="Next checkup date" value={healthForm.next_checkup} onChange={e=>setHealthForm(x=>({...x,next_checkup:e.target.value}))}/>
              <button className="btn-primary" onClick={async()=>{
                await supabase.from("health").insert([{family_id:familyId,member_name:healthForm.member_name,weight:healthForm.weight||null,blood_pressure:healthForm.blood_pressure||null,blood_sugar:healthForm.blood_sugar||null,medications:healthForm.medications,notes:healthForm.notes,date:new Date().toISOString().split("T")[0]}]);
                if(healthForm.next_checkup){
                  await supabase.from("reminders").insert([{family_id:familyId,content:`Health checkup for ${healthForm.member_name}`,due_date:healthForm.next_checkup,done:false}]);
                  showToast({title:"Reminder set!",body:`Checkup reminder for ${healthForm.next_checkup}`,icon:"💊",color:"#5B8DB8"});
                }
                setHealthForm({member_name:"Mayank",weight:"",blood_pressure:"",blood_sugar:"",medications:"None",notes:"",next_checkup:""});
                setShowAddHealth(false);
              }}>Save Health Record</button>
            </div>
          </Modal>
        )}

        {/* ADD EVENT MODAL */}
        {showAddEvent && (
          <Modal title="Add Event" onClose={()=>setShowAddEvent(false)}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input className="input" placeholder="Event title" autoFocus value={eventForm.title} onChange={e=>setEventForm(x=>({...x,title:e.target.value}))}/>
              <input className="input" type="date" value={eventForm.event_date} onChange={e=>setEventForm(x=>({...x,event_date:e.target.value}))}/>
              <select className="input" value={eventForm.type} onChange={e=>setEventForm(x=>({...x,type:e.target.value}))}>
                {["General","Birthday","Anniversary","Medical","School","Travel","Festival","Family"].map(c=><option key={c}>{c}</option>)}
              </select>
              <div style={{display:"flex",gap:8}}>
                <input className="input" placeholder="Emoji" value={eventForm.emoji} onChange={e=>setEventForm(x=>({...x,emoji:e.target.value}))} style={{flex:1}}/>
                <input className="input" placeholder="Notes" value={eventForm.notes} onChange={e=>setEventForm(x=>({...x,notes:e.target.value}))} style={{flex:2}}/>
              </div>
              <button className="btn-primary" onClick={async()=>{
                if(!eventForm.title || !eventForm.event_date) return;
                await supabase.from("events").insert([{family_id:familyId,...eventForm}]);
                setEventForm({title:"",event_date:"",type:"General",emoji:"📅",notes:""});
                setShowAddEvent(false);
              }}>Add Event</button>
            </div>
          </Modal>
        )}

        {/* SMART ADD BUTTON */}
        <button className="btn-primary" onClick={()=>{
          if(tab==="goals") setShowAddGoal(true);
          else if(tab==="health") setShowAddHealth(true);
          else if(tab==="calendar") setShowAddEvent(true);
        }} style={{width:"100%",height:44,fontSize:14,marginBottom:14}}>
          + Add {tab==="goals"?"Goal":tab==="health"?"Health Record":"Event"}
        </button>

        {tab==="goals" && (
          goals.length===0
            ? <div className="empty"><div className="empty-icon">🎯</div><div className="empty-text">No goals yet.<br/><span style={{fontSize:12,color:"rgba(238,236,248,0.4)"}}>Set a savings goal to track your progress.</span></div></div>
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
              {[...Array(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay())].map((_,i)=><div key={`g${i}`}/>)}
              {Array.from({length:new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate()},(_,i)=>i+1).map(d=>{
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
              ? <div className="empty"><div className="empty-icon">📅</div><div className="empty-text">No events yet.<br/><span style={{fontSize:12,color:"rgba(238,236,248,0.4)"}}>Add birthdays, anniversaries & appointments.</span></div></div>
              : <div className="card" style={{padding:"2px 14px"}}>
                  {events.map(ev=>(
                    <div key={ev.id} className="list-row">
                      <div style={{width:38,height:38,borderRadius:12,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{ev.emoji||"📅"}</div>
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
            ? <div className="empty"><div className="empty-icon">💊</div><div className="empty-text">No health records yet.<br/><span style={{fontSize:12,color:"rgba(238,236,248,0.4)"}}>Track weight, BP and medications for the family.</span></div></div>
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
                        <div key={m.l} style={{padding:"9px 11px",background:"#FAFAF8",borderRadius:10}}>
                          <div style={{fontSize:12,color:T.muted}}>{m.l}</div>
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

// ─── GROCERY BILL IMPORTER ────────────────────────────────────────────────────
const ITEM_EMOJI_MAP = {
  atta:"🌾",rice:"🍚",dal:"🫘",chana:"🫘",rajma:"🫘",sugar:"🍬",salt:"🧂",
  tea:"🍵",milk:"🥛",paneer:"🧀",curd:"🥛",butter:"🧈",ghee:"🫙",oil:"🫙",
  potato:"🥔",onion:"🧅",tomato:"🍅",capsicum:"🫑",coriander:"🌿",ginger:"🫚",
  garlic:"🧄",turmeric:"🟡",chilli:"🌶️",jeera:"🌿",besan:"🌾",sooji:"🌾",
  poha:"🌾",oats:"🌾",maggi:"🍜",bread:"🍞",default:"📦"
};
const getBillEmoji = (name) => {
  const n = name.toLowerCase();
  for (const [k,v] of Object.entries(ITEM_EMOJI_MAP)) { if (n.includes(k)) return v; }
  return ITEM_EMOJI_MAP.default;
};

const GroceryBillImporter = ({ familyId, pantry, onDone, onClose }) => {
  const [stage, setStage] = useState("upload");
  const [extractedItems, setExtractedItems] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [billTotal, setBillTotal] = useState(0);
  const [billVendor, setBillVendor] = useState("local");
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const UNITS = ["kg","g","L","ml","pcs","pack","dozen","box","bottle"];

  // Indian item name normalizer
  const NORMALIZE_MAP = {
    "aashirvaad atta":"Atta","fortune atta":"Atta","pillsbury atta":"Atta",
    "amul gold milk":"Milk","mother dairy milk":"Milk","toned milk":"Milk","full cream milk":"Milk","amul milk":"Milk",
    "amul butter":"Butter","mother dairy butter":"Butter",
    "amul paneer":"Paneer","mother dairy paneer":"Paneer","fresh paneer":"Paneer",
    "amul ghee":"Ghee","patanjali ghee":"Ghee",
    "red onion":"Onion","white onion":"Onion","yellow onion":"Onion",
    "baby potato":"Potato","desi potato":"Potato",
    "tomato":"Tomato","hybrid tomato":"Tomato",
    "india gate rice":"Rice","kohinoor rice":"Rice","basmati rice":"Rice",
    "tata salt":"Salt","catch salt":"Salt",
    "brooke bond tea":"Tea","tata tea":"Tea","red label tea":"Tea",
    "saffola oil":"Oil","fortune oil":"Oil","sunflower oil":"Oil","mustard oil":"Oil",
    "amul curd":"Curd","mother dairy curd":"Curd","dahi":"Curd",
    "moong dal":"Moong Dal","toor dal":"Toor Dal","chana dal":"Chana Dal",
    "besan":"Besan","gram flour":"Besan",
    "sooji":"Sooji","semolina":"Sooji","rava":"Sooji",
  };

  const normalizeName = (raw) => {
    const lower = raw.toLowerCase().trim();
    for (const [k,v] of Object.entries(NORMALIZE_MAP)) {
      if (lower.includes(k)) return v;
    }
    // Capitalize first letter of each word
    return raw.trim().replace(/\w/g, c => c.toUpperCase());
  };

  const parseBillText = (text) => {
    if (!text.trim()) return;
    setError("");
    let billTotalRef = 0;
    let vendorRef = "local";
    const items = [];

    if (/flipkart/i.test(text)) vendorRef = "flipkart";
    else if (/blinkit|grofers/i.test(text)) vendorRef = "blinkit";
    else if (/instamart|swiggy/i.test(text)) vendorRef = "instamart";
    else if (/zepto/i.test(text)) vendorRef = "zepto";
    else if (/bigbasket/i.test(text)) vendorRef = "bigbasket";
    else if (/amazon/i.test(text)) vendorRef = "amazon";

    const ITEM_NORMALIZER = [
      [/hen.*egg|white.*egg|egg.*white|brown.*egg/i, "Eggs"],
      [/idly.*dosa.*batter|dosa.*idly.*batter|idli.*dosa/i, "Idli Dosa Batter"],
      [/maggi.*pazzta|pazzta|macaroni.*pasta/i, "Maggi Pasta"],
      [/maggi.*noodles|2.minute.*noodles|instant noodles/i, "Maggi Noodles"],
      [/coriander.*seeds|dhaniya.*seeds/i, "Coriander Seeds"],
      [/broken.*wheat|dalia|daliya/i, "Daliya"],
      [/brinjal.*bharta|baingan.*bharta/i, "Brinjal Bharta"],
      [/capsicum.*green|green.*capsicum/i, "Capsicum"],
      [/mushroom.*button|button.*mushroom/i, "Mushroom"],
      [/mint.*leaves|pudina/i, "Mint Leaves"],
      [/coriander.*leaves|dhaniya.*patta/i, "Coriander Leaves"],
      [/carrot.*ooty|ooty.*carrot/i, "Carrot"],
      [/sooji|bombay rava|semolina/i, "Sooji"],
      [/aashirvaad.*atta|fortune.*atta/i, "Atta"],
      [/amul.*milk|mother dairy.*milk|toned.*milk/i, "Milk"],
      [/amul.*butter|mother dairy.*butter/i, "Butter"],
      [/amul.*paneer|mother dairy.*paneer/i, "Paneer"],
      [/amul.*ghee|patanjali.*ghee/i, "Ghee"],
      [/basmati.*rice|india gate.*rice/i, "Basmati Rice"],
    ];

    const BRAND_STRIP = [
      /^delish by flipkart\s*/i, /^flipkart grocery\s*/i,
      /^classic\s+/i, /^rajdhani\s*/i, /^aashirvaad\s*/i,
      / by flipkart grocery$/i, / by flipkart$/i,
    ];

    const cleanName = (raw) => {
      let n = raw.trim();
      for (const p of BRAND_STRIP) n = n.replace(p, "");
      n = n.trim();
      for (const [pat, norm] of ITEM_NORMALIZER) {
        if (pat.test(n)) return norm;
      }
      return n.replace(/\b\w/g, c => c.toUpperCase()).trim();
    };

    const rawLines = text.split("\n").map(l => l.trim());

    // Detect total
    for (const line of rawLines) {
      const tm = line.match(/(?:order total|total amount|amount paid|grand total)[^\d]*[\d,]+/i);
      if (tm) {
        const nums = tm[0].match(/[\d,]+\.?\d*/g);
        if (nums) billTotalRef = parseFloat(nums[nums.length-1].replace(/,/g,""));
      }
    }

    const JUNK = /^(order #|placed on|delivery|dispatch|invoice|address|payment|thank|rated|review|feedback|mrp|saved|discount|coupon|tip|convenience|\+$)/i;
    const PURE_NUM = /^[\d]+x[\d]*$|^[\d]+xs?$|^\+$|^\d+\.\d+$|^\d+$/;
    const PRICE_RE = /^\u20b9\s*([\d,]+\.?\d*)$/;
    const QTY_RE = /^(\d+)\s*x\s*([\d.]+)\s*[-\u2013]?\s*(?:[\d.]+)?\s*(kg|g|l|ltr|ml|pcs?|pack|units?|gm)?/i;

    let i = 0;
    while (i < rawLines.length) {
      const line = rawLines[i];
      if (!line || line.length < 2 || JUNK.test(line) || PURE_NUM.test(line) || PRICE_RE.test(line)) {
        i++; continue;
      }

      // This looks like an item name
      let name = line;
      let qty = 1;
      let unit = "pcs";
      let price = 0;
      let j = i + 1;

      // Skip blanks
      while (j < rawLines.length && (!rawLines[j] || rawLines[j] === "+")) j++;

      // Qty line?
      if (j < rawLines.length) {
        const qm = rawLines[j].match(QTY_RE);
        const simpleN = rawLines[j].match(/^(\d+)$/);
        if (qm) {
          const n = parseInt(qm[1]) || 1;
          const size = parseFloat(qm[2]) || 1;
          const u = (qm[3] || "pcs").toLowerCase();
          if (/^(kg|g|l|ltr|ml|gm)$/i.test(u)) {
            qty = n * size;
            unit = u === "ltr" ? "L" : u === "gm" ? "g" : u;
          } else {
            qty = n;
            unit = "pcs";
          }
          j++;
        } else if (simpleN && parseInt(simpleN[1]) < 100) {
          qty = parseInt(simpleN[1]);
          j++;
        }
      }

      // Skip blanks
      while (j < rawLines.length && (!rawLines[j] || rawLines[j] === "+")) j++;

      // Price line?
      if (j < rawLines.length) {
        const pm = rawLines[j].match(/^\u20b9\s*([\d,]+\.?\d*)/);
        if (pm) {
          price = parseFloat(pm[1].replace(/,/g,""));
          j++;
          // Skip MRP (second price line)
          if (j < rawLines.length && /^\u20b9/.test(rawLines[j])) j++;
        }
      }

      name = cleanName(name);
      if (name.length >= 2 && !/^\d/.test(name) && !JUNK.test(name)) {
        const existing = items.find(it => it.name.toLowerCase() === name.toLowerCase());
        const pantryMatch = pantry.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          existing.quantity += qty;
          existing.lineTotal += price;
        } else {
          items.push({
            id: items.length, name, quantity: qty, unit, selected: true,
            unitPrice: qty > 0 && price > 0 ? Math.round((price / qty) * 100) / 100 : 0,
            lineTotal: price,
            existingQty: pantryMatch ? pantryMatch.quantity : 0,
            existingUnit: pantryMatch ? pantryMatch.unit : unit,
          });
        }
        i = j;
        continue;
      }
      i++;
    }

    if (items.length === 0) {
      setError("No items found. Make sure to paste the full order details text.");
      return;
    }

    const itemsTotal = items.reduce((a, it) => a + (it.lineTotal || 0), 0);
    setBillTotal(billTotalRef > 0 ? billTotalRef : itemsTotal);
    setBillVendor(vendorRef);
    setExtractedItems(items);
    setStage("reviewing");
  };


  const savePricesOnly = async () => {
    setSaving(true);
    const selectedItems = extractedItems.filter(i => i.selected && i.unitPrice > 0);
    const vendorLabels = { blinkit:"Blinkit", instamart:"Instamart", zepto:"Zepto", bigbasket:"BigBasket", amazon:"Amazon Fresh", flipkart:"Flipkart", local:"Local Store" };
    let logged = 0;
    for (const item of selectedItems) {
      await supabase.from("grocery_price_history").insert([{
        item_name: item.name,
        platform: billVendor,
        price: item.unitPrice,
        delivery_fee: 0,
        source: "bill_import",
        logged_at: new Date(billDate).toISOString(),
      }]).then(()=>{ logged++; }).catch(()=>{});
    }
    setSaving(false);
    setStage("prices_done");
    setTimeout(() => onDone(), 2000);
  };

  const updateItem = (id,field,val) => setExtractedItems(prev=>prev.map(it=>it.id===id?{...it,[field]:val}:it));

  const saveToStock = async () => {
    setSaving(true);
    const selectedItems = extractedItems.filter(i => i.selected);
    const vendorLabels = { blinkit:"Blinkit", instamart:"Instamart", zepto:"Zepto", bigbasket:"BigBasket", amazon:"Amazon Fresh", flipkart:"Flipkart", local:"Local Store" };
    const vendorLabel = vendorLabels[billVendor] || "Local Store";
    const finalTotal = billTotal > 0 ? billTotal : selectedItems.reduce((a,i) => a + (i.lineTotal||0), 0);

    for (const item of selectedItems) {
      const existing = pantry.find(p => p.name.toLowerCase() === item.name.toLowerCase());
      if (existing) {
        await supabase.from("pantry").update({ quantity: Number(existing.quantity)+Number(item.quantity), updated_at:new Date().toISOString() }).eq("id", existing.id);
      } else {
        await supabase.from("pantry").insert([{ family_id:familyId, name:item.name, category:"Other", quantity:Number(item.quantity), unit:item.unit, par_level:0, updated_at:new Date().toISOString() }]);
      }
      await supabase.from("inventory_transactions").insert([{ family_id:familyId, item_name:item.name, transaction_type:"stock_in", quantity:Number(item.quantity), unit:item.unit, source_document:"grocery_bill", vendor:billVendor, unit_price:item.unitPrice||0, line_total:item.lineTotal||0 }]);
      if (item.unitPrice > 0) {
        await supabase.from("grocery_price_history").insert([{ item_name:item.name, platform:billVendor, price:item.unitPrice, delivery_fee:0, source:"bill_import", logged_at:new Date().toISOString() }]).then(()=>{}).catch(()=>{});
      }
    }

    if (finalTotal > 0) {
      await supabase.from("transactions").insert([{ family_id:familyId, description:"Grocery Bill — "+vendorLabel, amount:-Math.abs(finalTotal), category:"Groceries", added_by:"Mayank", date:billDate, emoji:"🛒" }]);
    }

    setSaving(false);
    setStage("done");
    setTimeout(() => onDone(), 1800);
  };

  if (stage==="upload") return (
    <div>
      {error && <div style={{padding:"10px 12px",background:T.redSoft,borderRadius:12,color:T.red,fontSize:13,fontWeight:600,marginBottom:12}}>{error}</div>}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:6}}>Paste your grocery bill text</div>
        <div style={{fontSize:12,color:T.muted,marginBottom:10,lineHeight:1.6}}>
          Copy order details from Blinkit, BigBasket, Instamart, DMart app or any grocery bill and paste below.
        </div>
        <textarea
          className="input"
          placeholder={"Example:\nAashirvaad Atta 10kg\nAmul Gold Milk 6 pcs\nMother Dairy Paneer 500g\nOnion 5kg\nTomato 2kg\nGhee 1L"}
          style={{minHeight:160,resize:"vertical",lineHeight:1.6,fontSize:13}}
          value={pasteText}
          onChange={e=>setPasteText(e.target.value)}
        />
      </div>
      <div style={{fontSize:11,color:T.muted,marginBottom:12,padding:"8px 12px",background:T.accentSoft,borderRadius:10,lineHeight:1.6}}>
        💡 <strong>How to copy from Blinkit:</strong> Open order → Order Details → Select All text → Copy → Paste here
      </div>
      <button onClick={()=>parseBillText(pasteText)} disabled={!pasteText.trim()} className="btn-primary">
        🔍 Extract Items
      </button>
    </div>
  );

  if (stage==="extracting") return (
    <div style={{textAlign:"center",padding:"48px 20px"}}>
      <div style={{fontSize:40,marginBottom:16}}>🤖</div>
      <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:6}}>Reading your bill...</div>
      <div style={{fontSize:13,color:T.muted,marginBottom:20}}>AI is extracting and normalizing items</div>
      <div className="spinner" style={{width:32,height:32,margin:"0 auto"}}/>
    </div>
  );

  if (stage==="prices_done") return (
    <div style={{textAlign:"center",padding:"48px 20px"}}>
      <div style={{fontSize:48,marginBottom:12}}>💰</div>
      <div style={{fontSize:17,fontWeight:700,color:T.accent,marginBottom:6}}>Prices Logged!</div>
      <div style={{fontSize:13,color:T.muted,marginBottom:8}}>{extractedItems.filter(i=>i.selected&&i.unitPrice>0).length} item prices saved</div>
      <div style={{fontSize:13,color:T.accent,fontWeight:700,padding:"8px 16px",background:T.accentSoft,borderRadius:10,display:"inline-block"}}>✓ Smart Grocery compare updated</div>
    </div>
  );

  if (stage==="done") return (
    <div style={{textAlign:"center",padding:"48px 20px"}}>
      <div style={{fontSize:48,marginBottom:12}}>✅</div>
      <div style={{fontSize:17,fontWeight:700,color:T.green,marginBottom:6}}>Bill Imported!</div>
      <div style={{fontSize:13,color:T.muted,marginBottom:8}}>{extractedItems.filter(i=>i.selected).length} items added to pantry</div>
      {billTotal > 0 && <div style={{fontSize:13,color:T.green,fontWeight:700,padding:"8px 16px",background:T.greenSoft,borderRadius:10,display:"inline-block"}}>💸 ₹{billTotal.toLocaleString("en-IN")} expense created</div>}
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:T.text}}>Detected Items</div>
          <div style={{fontSize:12,color:T.muted}}>{extractedItems.filter(i=>i.selected).length}/{extractedItems.length} selected</div>
        </div>
        <button onClick={()=>setExtractedItems(prev=>prev.map(i=>({...i,selected:true})))}
          style={{fontSize:11,color:T.accent,fontWeight:700,background:T.accentSoft,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer"}}>Select All</button>
      </div>
      <div style={{maxHeight:"50vh",overflowY:"auto",marginBottom:12}}>
        {extractedItems.map(item=>(
          <div key={item.id} style={{background:"#FFFFFF",borderRadius:14,border:`0.5px solid ${T.border}`,padding:"11px 13px",marginBottom:7,opacity:item.selected?1:0.45,transition:"opacity .15s"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div onClick={()=>updateItem(item.id,"selected",!item.selected)}
                style={{width:22,height:22,borderRadius:6,background:item.selected?T.accent:T.border,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                {item.selected && <span style={{color:"white",fontSize:12,fontWeight:800}}>✓</span>}
              </div>
              <span style={{fontSize:20}}>{getBillEmoji(item.name)}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:T.text}}>{item.name}</div>
                {item.existingQty>0 && <div style={{fontSize:11,color:T.muted}}>Stock: {item.existingQty} {item.existingUnit}</div>}
              </div>
              <div style={{display:"flex",gap:5,alignItems:"center"}}>
                <span style={{fontSize:12,color:T.accent,fontWeight:700}}>+</span>
                <input type="number" value={item.quantity} min={0.1} step={0.1}
                  onChange={e=>updateItem(item.id,"quantity",e.target.value)}
                  style={{width:50,padding:"5px 6px",borderRadius:8,border:`0.5px solid ${T.border}`,fontSize:13,fontWeight:600,color:T.text,background:"#FAFAF8",textAlign:"center"}}/>
                <select value={item.unit} onChange={e=>updateItem(item.id,"unit",e.target.value)}
                  style={{padding:"5px 6px",borderRadius:8,border:`0.5px solid ${T.border}`,fontSize:12,color:T.text,background:"#FAFAF8"}}>
                  {UNITS.map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
              <div onClick={()=>setExtractedItems(prev=>prev.filter(i=>i.id!==item.id))}
                style={{cursor:"pointer",color:T.red,fontSize:14,flexShrink:0}}>✕</div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={()=>setExtractedItems(prev=>[...prev,{id:Date.now(),name:"",quantity:1,unit:"kg",selected:true,existingQty:0}])}
        style={{width:"100%",padding:"9px",background:"transparent",border:`0.5px dashed ${T.border}`,borderRadius:12,color:T.muted,fontSize:13,cursor:"pointer",marginBottom:10}}>
        + Add Missing Item
      </button>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <button onClick={saveToStock} disabled={saving||extractedItems.filter(i=>i.selected).length===0} className="btn-primary">
          {saving?"Saving...":"✅ Update Pantry + Log Prices ("+extractedItems.filter(i=>i.selected).length+" items)"}
        </button>
        <button onClick={savePricesOnly} disabled={saving||extractedItems.filter(i=>i.selected&&i.unitPrice>0).length===0}
          style={{width:"100%",padding:"14px",background:"rgba(139,124,248,0.12)",border:"1px solid rgba(139,124,248,0.3)",borderRadius:14,color:"#8B7CF8",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
          {saving?"Saving...":`💰 Log Prices Only — ${extractedItems.filter(i=>i.selected&&i.unitPrice>0).length} items (no pantry update)`}
        </button>
      </div>
    </div>
  );
};

const AIScreen = ({ familyId }) => {
  const { rows: txns } = useTable("transactions", familyId, { order: "date", limit: 20 });
  const { rows: tasks } = useTable("tasks", familyId, { order: "created_at" });
  const { rows: grocery } = useTable("grocery", familyId);
  const { rows: pantry } = useTable("pantry", familyId);
  const { rows: goals } = useTable("goals", familyId);
  const { rows: bills } = useTable("bills", familyId);
  const [msgs, setMsgs] = useState([{ role:"assistant", text:"Namaste! 🙏 I'm your Family OS AI.\n\nAsk me about spending, tasks, grocery, pantry, bills or goals!\n\n📄 New: Upload a grocery bill to auto-stock your pantry!" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showBillImporter, setShowBillImporter] = useState(false);
  const bottomRef = useRef(null);
  const suggestions = ["Summarise spending","Pending tasks?","Grocery restock?","Goals progress?","Bills due?","Pantry status?"];
const send = useCallback(async (text) => {
  const q = (text || input).trim();
  if (!q || loading) return;
  setInput("");
  setMsgs(m => [...m, { role: "user", text: q }]);
  setLoading(true);
  try {
    const income = txns.filter(t => Number(t.amount) > 0).reduce((a, t) => a + Number(t.amount), 0);
    const spent = txns.filter(t => Number(t.amount) < 0).reduce((a, t) => a + Math.abs(Number(t.amount)), 0);
    const pending = tasks.filter(t => t.done === false);
    const lowStock = grocery.filter(g => Number(g.quantity) <= Number(g.par_level));
    const lowPantry = pantry.filter(p => Number(p.quantity) <= Number(p.par_level));
    const dueBills = bills.filter(b => b.paid === false);
    const systemPrompt = `You are Munshi Jee, the smart AI assistant for the Gupta family's Family OS app. You are warm, helpful, and speak in a friendly Hinglish tone.
FINANCES: Income ₹${income.toLocaleString("en-IN")}, Spent ₹${spent.toLocaleString("en-IN")}, Saved ₹${(income-spent).toLocaleString("en-IN")}
TASKS: ${pending.length} pending - ${pending.slice(0,5).map(t=>`${t.title} (${t.assignee})`).join(", ")}
LOW STOCK: ${[...lowStock,...lowPantry].map(i=>i.name).join(", ")||"All stocked"}
BILLS: ${dueBills.length} unpaid - ${dueBills.slice(0,3).map(b=>`${b.name} ₹${Number(b.amount).toLocaleString("en-IN")}`).join(", ")}
GOALS: ${goals.map(g=>`${g.title} ${Math.round((g.saved_amount/g.target_amount)*100)}%`).join(", ")||"None"}
Keep responses under 150 words. Use ₹ for currency.`;
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.REACT_APP_GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 300,
        messages: [
          { role: "system", content: systemPrompt },
          ...msgs.slice(-6).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
          { role: "user", content: q }
        ],
      }),
    });
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, try again!";
    setMsgs(m => [...m, { role: "assistant", text: reply }]);
  } catch(e) {
    setMsgs(m => [...m, { role: "assistant", text: "Connection issue. Try again." }]);
  }
  setLoading(false);
}, [input, loading, txns, tasks, grocery, pantry, goals, bills, msgs]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);

  return (
    <div className="screen" style={{display:"flex",flexDirection:"column"}}>
      <div style={{padding:"52px 20px 0"}}>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <div style={{width:46,height:46,borderRadius:14,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}} className="float">🤖</div>
          <div>
            <div className="pt" style={{fontSize:22}}>AI Assistant</div>
            <div style={{display:"flex",gap:5,alignItems:"center",marginTop:2}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:T.green}}/>
              <span style={{fontSize:11.5,color:T.green,fontWeight:600}}>Live Supabase data</span>
            </div>
          </div>
        </div>
      </div>
      <div className="scroll-x" style={{padding:"12px 20px 0"}}>
        {suggestions.map(s=>(
          <div key={s} className="chip" onClick={()=>send(s)} style={{fontSize:12}}>{s}</div>
        ))}
      </div>
      <div style={{padding:"8px 20px 0"}}>
        <div onClick={()=>setShowBillImporter(true)}
          style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",background:"#FFFFFF",border:`0.5px solid ${T.border}`,borderRadius:14,cursor:"pointer",boxShadow:"0 1px 4px rgba(60,50,40,0.06)"}}>
          <span style={{fontSize:22}}>📄</span>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:T.text}}>Import Grocery Bill</div>
            <div style={{fontSize:11,color:T.muted}}>Paste Blinkit/BigBasket text → Auto-stock pantry</div>
          </div>
          <span style={{fontSize:12,color:T.accent,fontWeight:700}}>→</span>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px 20px",display:"flex",flexDirection:"column",gap:12,minHeight:0}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"86%",padding:"13px 15px",borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",background:m.role==="user"?T.accent:"#FFFFFF",border:m.role==="user"?"none":`0.5px solid ${T.border}`,fontSize:14,lineHeight:1.65,whiteSpace:"pre-line"}}>
              {m.text}
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex"}}>
            <div style={{padding:"13px 16px",borderRadius:"18px 18px 18px 4px",background:"#FFFFFF",border:`1px solid ${T.border}`,display:"flex",gap:5,alignItems:"center"}}>
              <div className="ai-dot"/><div className="ai-dot"/><div className="ai-dot"/>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div style={{padding:"10px 20px 16px",display:"flex",gap:9}}>
        <input className="input" style={{flex:1}} placeholder="Ask about your family data..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}/>
        <div onClick={()=>send()} style={{width:46,height:46,borderRadius:12,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,boxShadow:`0 4px 16px ${T.accentGlow}`,transition:"all .2s"}}>
          <I n="send" s={17} c="white"/>
        </div>
      </div>

      {showBillImporter && (
        <div className="modal-overlay" onClick={()=>setShowBillImporter(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div>
                <div style={{fontSize:17,fontWeight:800,color:T.text}}>📄 Import Grocery Bill</div>
                <div style={{fontSize:12,color:T.muted,marginTop:2}}>AI will extract and stock your pantry</div>
              </div>
              <div onClick={()=>setShowBillImporter(false)} style={{width:44,height:44,borderRadius:12,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <I n="x" s={15} c={T.muted}/>
              </div>
            </div>
            <GroceryBillImporter
              familyId={familyId}
              pantry={pantry}
              onDone={()=>{ setShowBillImporter(false); setMsgs(m=>[...m,{role:"assistant",text:"✅ Pantry updated from your grocery bill! Stock levels have been refreshed."}]); }}
              onClose={()=>setShowBillImporter(false)}
            />
          </div>
        </div>
      )}
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
      <div className="ph" style={{paddingTop:"calc(52px + env(safe-area-inset-top, 0px))"}}>
        <div style={{display:"flex",gap:15,alignItems:"center"}}>
          <div style={{width:68,height:68,borderRadius:22,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,border:"2px solid rgba(125,157,124,0.3)"}}>
            {name==="Simmi"?"👩":"👨‍⚕️"}
          </div>
          <div>
            <div style={{fontSize:22,fontWeight:900}}>{name}</div>
            <div style={{fontSize:13,color:T.muted}}>{user?.email}</div>
            <div style={{padding:"4px 10px",background:T.greenSoft,border:"1px solid rgba(52,211,153,0.22)",borderRadius:100,fontSize:11,color:T.green,fontWeight:600,marginTop:6,display:"inline-block"}}>✓ Connected to Supabase</div>
          </div>
        </div>
      </div>
      <div style={{padding:"14px 18px 0"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,marginBottom:22}}>
          {[{emoji:"✅",val:tasks.filter(t=>t.done).length,lbl:"Done"},{emoji:"🎯",val:goals.length,lbl:"Goals"},{emoji:"📁",val:docs.length,lbl:"Docs"}].map(s=>(
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
        <button onClick={onSignOut} style={{width:"100%",padding:"14px",background:T.redSoft,border:`1px solid rgba(248,113,113,0.25)`,borderRadius:14,color:T.red,fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
          <I n="logout" s={18} c={T.red}/> Sign Out
        </button>
        <div style={{textAlign:"center",padding:"20px 0",color:T.dim,fontSize:12}}>
          Family OS v2.1 · Kitchen Module Active 🍽<br/>Powered by Claude + Supabase
        </div>
      </div>
    </div>
  );
};

// ─── LEGACY MODALS ────────────────────────────────────────────────────────────
const AddExpenseModal = ({ onClose, familyId }) => {
  const [f, setF] = useState({ description:"", amount:"", category:"Groceries", added_by:"Mayank", emoji:"💸", date: today() });
  const [loading, setLoading] = useState(false);
  const cats = ["Groceries","Utilities","Dining & Food","Transport","Medical","Entertainment","Education","Shopping","Clinic","Subscriptions","HRA","Home Loan","Investments","Housekeeping","House Interiors","Maintenance","Travel","Staff Salary","Veda","Gifts","Loan Back","Axis Bank EMI","HDFC Loan EMI","Other"];
  const emojiMap = {"Groceries":"🛒","Utilities":"⚡","Dining & Food":"🍽️","Transport":"🚗","Medical":"💊","Entertainment":"🎬","Education":"📚","Shopping":"🛍️","Clinic":"🏥","Subscriptions":"📱","HRA":"🏠","Home Loan":"🏦","Investments":"📈","Housekeeping":"🧹","House Interiors":"🛋️","Maintenance":"🔧","Travel":"✈️","Staff Salary":"👷","Veda":"👶","Gifts":"🎁","Loan Back":"💳","Axis Bank EMI":"🏦","HDFC Loan EMI":"🏦","Other":"💸"};
  const save = async () => {
    if (!f.description || !f.amount) return;
    setLoading(true);
    const { data: txnData2 } = await supabase.from("transactions").select("amount").eq("family_id", familyId);
    const bal2 = calcBalance(txnData2 || []);
    await supabase.from("transactions").insert([{ ...f, amount: -Math.abs(Number(f.amount)), family_id: familyId, emoji: emojiMap[f.category]||"💸" }]);
    notifyExpenseAdded(familyId, { amount: f.amount, category: f.category, balance: bal2.available - Math.abs(Number(f.amount)), added_by: f.added_by });
    setLoading(false); onClose();
  };
  return (
    <Modal title="Add Expense" onClose={onClose}>
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        <input className="input" placeholder="Description" value={f.description} onChange={e=>setF(x=>({...x,description:e.target.value}))}/>
        <input className="input" type="number" placeholder="Amount (₹)" value={f.amount} onChange={e=>setF(x=>({...x,amount:e.target.value}))}/>
        <select className="input" value={f.category} onChange={e=>setF(x=>({...x,category:e.target.value}))}>
          {cats.map(c=><option key={c}>{c}</option>)}
        </select>
        <input className="input" type="date" value={f.date} onChange={e=>setF(x=>({...x,date:e.target.value}))}/>
        <div style={{display:"flex",gap:8}}>
          {["Mayank","Simmi"].map(m=>(
            <div key={m} className={`person-btn ${f.added_by===m?"on":""}`} onClick={()=>setF(x=>({...x,added_by:m}))}>
              {m==="Mayank"?"👨‍⚕️":"👩"} {m}
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={save} disabled={loading}>{loading?<div className="spinner"/>:"Save Expense"}</button>
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
    notifyTaskAdded(familyId, { title: f.title });
    setLoading(false); onClose();
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
            <div key={m} className={`person-btn ${f.assignee===m?"on":""}`} onClick={()=>setF(x=>({...x,assignee:m}))}>
              {m==="Mayank"?"👨‍⚕️":"👩"} {m}
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          {["high","medium","low"].map(p=>(
            <div key={p} className="priority-btn" onClick={()=>setF(x=>({...x,priority:p}))}
              style={{border:`1px solid ${f.priority===p?(p==="high"?T.red:p==="medium"?T.amber:T.green):T.border}`,background:f.priority===p?(p==="high"?T.redSoft:p==="medium"?T.amberSoft:T.greenSoft):"transparent",color:f.priority===p?(p==="high"?T.red:p==="medium"?T.amber:T.green):T.muted}}>
              {p}
            </div>
          ))}
        </div>
        <input className="input" type="date" value={f.due_date} onChange={e=>setF(x=>({...x,due_date:e.target.value}))}/>
        <button className="btn-primary" onClick={save} disabled={loading}>{loading?<div className="spinner"/>:"Save Task"}</button>
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
    setLoading(false); onClose();
  };
  return (
    <Modal title="Add Grocery Item" onClose={onClose}>
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        <input className="input" placeholder="Item name" value={f.name} onChange={e=>setF(x=>({...x,name:e.target.value}))}/>
        <select className="input" value={f.category} onChange={e=>setF(x=>({...x,category:e.target.value}))}>
          {["Vegetables","Dairy","Staples","Pantry","Bakery","Beverages","Snacks","Cleaning"].map(c=><option key={c}>{c}</option>)}
        </select>
        <div style={{display:"flex",gap:8}}>
          <input className="input" type="number" placeholder="Qty" value={f.quantity} onChange={e=>setF(x=>({...x,quantity:e.target.value}))} style={{flex:1}}/>
          <select className="input" value={f.unit} onChange={e=>setF(x=>({...x,unit:e.target.value}))} style={{flex:1}}>
            {["kg","g","L","ml","pcs","pack","dozen"].map(u=><option key={u}>{u}</option>)}
          </select>
        </div>
        <input className="input" type="number" placeholder="Reorder level" value={f.par_level} onChange={e=>setF(x=>({...x,par_level:e.target.value}))}/>
        <input className="input" type="date" value={f.expiry_date} onChange={e=>setF(x=>({...x,expiry_date:e.target.value}))}/>
        <button className="btn-primary" onClick={save} disabled={loading}>{loading?<div className="spinner"/>:"Add Item"}</button>
      </div>
    </Modal>
  );
};

// ════════════════════════════════════════════════════════════════════


// ─── MEAL TIME REMINDER ───────────────────────────────────────────────────────
const MealTimeReminder = ({ familyId }) => {
  const [reminder, setReminder] = useState(null);
  const { rows: mealPlan, refresh } = useTable("meal_plan", familyId, { order: "plan_date", asc: true });
  const { rows: recipes } = useTable("recipes", familyId, { order: "name", asc: true });
  useEffect(() => {
    const checkMealTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const min = now.getMinutes();
      const todayStr = now.toISOString().split("T")[0];
      const mealSchedule = [
        {hour:8,meal_type:"breakfast",label:"Breakfast"},
        {hour:13,meal_type:"lunch",label:"Lunch"},
        {hour:17,meal_type:"evening_snack",label:"Evening Snack"},
        {hour:20,meal_type:"dinner",label:"Dinner"},
      ];
      for (const schedule of mealSchedule) {
        if (hour === schedule.hour && min <= 30) {
          const meal = mealPlan.find(m => m.plan_date === todayStr && m.meal_type === schedule.meal_type);
          if (meal && !meal.cooked) {
            const recipe = recipes.find(r => r.id === meal.recipe_id);
            if (recipe) { setReminder({meal,recipe,label:schedule.label}); return; }
          }
        }
      }
      setReminder(null);
    };
    checkMealTime();
    const interval = setInterval(checkMealTime, 60000);
    return () => clearInterval(interval);
  }, [mealPlan, recipes]);
  if (!reminder) return null;
  return (
    <div style={{position:"fixed",bottom:"calc(80px + env(safe-area-inset-bottom,0px))",left:"50%",transform:"translateX(-50%)",width:"calc(100% - 32px)",maxWidth:398,background:"#2D2721",border:"1px solid rgba(139,124,248,0.4)",borderRadius:16,padding:"14px 16px",zIndex:145,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",animation:"slideUp .3s cubic-bezier(.16,1,.3,1)"}}>
      <div style={{display:"flex",gap:12,alignItems:"center"}}>
        <div style={{width:40,height:40,borderRadius:12,background:"rgba(125,157,124,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🍽</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:"#2D2721"}}>{reminder.label} Time!</div>
          <div style={{fontSize:12,color:T.muted,marginTop:2}}>{reminder.recipe.name}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={async()=>{
            await supabase.from("meal_plan").update({cooked:true,cooked_at:new Date().toISOString()}).eq("id",reminder.meal.id);
            showToast({title:"Marked as eaten!",body:reminder.recipe.name,icon:"🍽",color:"#6D9B6B"});
            setReminder(null); refresh();
          }} style={{padding:"8px 12px",background:"rgba(52,211,153,0.15)",border:"1px solid rgba(109,155,107,0.3)",borderRadius:10,color:"#6D9B6B",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Plus Jakarta Sans,sans-serif"}}>
            Ate it
          </button>
          <button onClick={()=>setReminder(null)} style={{padding:"8px 12px",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(196,96,58,0.2)",borderRadius:10,color:"#C4603A",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Plus Jakarta Sans,sans-serif"}}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── VOICE COMMAND ENGINE ─────────────────────────────────────────────────────
const VoiceCommandButton = ({ familyId }) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const recognitionRef = useRef(null);

  const FAMILY_ID = familyId;

  const processCommand = async (text) => {
    setProcessing(true);
    const t = text.toLowerCase().trim();
    let response = "";

    try {
      const today = new Date().toISOString().split("T")[0];

      // ── EXPENSE ──────────────────────────────────────────────
      const expenseMatch = t.match(/(?:spent|spend|kharcha|kharch|expense|add expense)[^0-9]*([0-9]+)[^a-z]*(?:on|for|par|ke liye|mein)?\s*(.+)?/);
      if (expenseMatch) {
        const amount = expenseMatch[1];
        const category = expenseMatch[2] || "General";
        await supabase.from("transactions").insert([{
          family_id: FAMILY_ID,
          description: `${category} expense`,
          amount: -Math.abs(Number(amount)),
          category: "Other",
          added_by: "Voice",
          date: today,
          emoji: "💸",
        }]);
        response = `✅ ₹${amount} expense recorded for ${category}`;
        showToast({title:"💸 Expense Added",body:`₹${amount} on ${category}`,icon:"💸",color:"#C4603A"});
      }

      // ── INCOME ───────────────────────────────────────────────
      else if (t.match(/(?:income|clinic|aamdani|kamai|earned|aaye)/)) {
        const amountMatch = t.match(/([0-9]+)/);
        if (amountMatch) {
          const amount = amountMatch[1];
          const isClinic = t.includes("clinic");
          await supabase.from("transactions").insert([{
            family_id: FAMILY_ID,
            description: isClinic ? "Clinic Income" : "Income",
            amount: Math.abs(Number(amount)),
            category: isClinic ? "Clinic Income" : "Simmi Income",
            added_by: "Voice",
            date: today,
            emoji: isClinic ? "🏥" : "👩",
          }]);
          response = `✅ ₹${amount} income recorded`;
          showToast({title:"💰 Income Added",body:`₹${amount}`,icon:"💰",color:"#6D9B6B"});
        }
      }

      // ── ADD TASK ─────────────────────────────────────────────
      else if (t.match(/(?:add task|create task|remind me|reminder|kaam|yaad dilao|note karo)/)) {
        const taskText = t.replace(/add task|create task|remind me to|reminder|kaam add karo|yaad dilao|note karo/g, "").trim();
        if (taskText) {
          await supabase.from("tasks").insert([{
            family_id: FAMILY_ID,
            title: taskText,
            assignee: "Mayank",
            priority: "medium",
            category: "General",
            due_date: today,
            done: false,
          }]);
          response = `✅ Task added: ${taskText}`;
          showToast({title:"✅ Task Added",body:taskText,icon:"✅",color:"#6D9B6B"});
        }
      }

      // ── ADD TO SHOPPING ──────────────────────────────────────
      else if (t.match(/(?:add|shopping|kharidna|list mein|buy)/)) {
        const item = t.replace(/add|to shopping list|shopping list mein|kharidna hai|buy/g, "").trim();
        if (item && item.length > 1) {
          await supabase.from("shopping_list").insert([{
            family_id: FAMILY_ID,
            item_name: item,
            purchased: false,
            added_at: new Date().toISOString(),
          }]);
          response = `✅ ${item} added to shopping list`;
          showToast({title:"🛒 Added to List",body:item,icon:"🛒",color:"#C4883A"});
        }
      }

      // ── WHAT IS FOR DINNER ───────────────────────────────────
      else if (t.match(/(?:dinner|breakfast|lunch|khaana|khana|meal|kya banega|kya hai)/)) {
        const { data: meals } = await supabase.from("meal_plan").select("*").eq("family_id", FAMILY_ID).eq("plan_date", today);
        if (meals?.length) {
          const mealTexts = [];
          for (const meal of meals) {
            const { data: recipe } = await supabase.from("recipes").select("name").eq("id", meal.recipe_id).single();
            if (recipe) mealTexts.push(`${meal.meal_type}: ${recipe.name}`);
          }
          response = mealTexts.length ? mealTexts.join(" | ") : "No meals planned today";
        } else {
          response = "No meals planned for today";
        }
      }

      // ── PANTRY / LOW STOCK ───────────────────────────────────
      else if (t.match(/(?:running low|pantry|stock|khatam|grocery|restock)/)) {
        const { data: pantryItems } = await supabase.from("pantry").select("*").eq("family_id", FAMILY_ID);
        const low = pantryItems?.filter(p => Number(p.quantity) <= Number(p.par_level)) || [];
        response = low.length ? `🔴 Low: ${low.slice(0,5).map(p=>p.name).join(", ")}` : "✅ Pantry is well stocked!";
      }

      else {
        response = "Sorry, I didn't understand. Try: 'Spent 500 on groceries' or 'Add task call patient'";
      }

    } catch(err) {
      response = "Error processing command. Please try again.";
      console.error("Voice command error:", err);
    }

    setResult(response);
    setProcessing(false);
    setTimeout(() => { setResult(null); setTranscript(""); }, 4000);
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast({title:"Not supported",body:"Use Chrome or Safari for voice commands",icon:"🎤",color:"#C4603A"});
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => { setListening(true); setResult(null); setTranscript(""); };
    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      setListening(false);
      processCommand(text);
    };
    recognition.onerror = () => { setListening(false); setResult("Could not hear you. Please try again."); };
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return (
    <>
      {/* Voice FAB Button */}
      <button
        onClick={listening ? stopListening : startListening}
        style={{
          position:"fixed",
          bottom:"calc(80px + env(safe-area-inset-bottom,0px))",
          left:"max(16px, calc(50vw - 199px))",
          width:54,height:54,borderRadius:17,
          background:listening?"linear-gradient(135deg,#C4603A,#E55)":"linear-gradient(135deg,#4A9B8E,#0D9488)",
          boxShadow:listening?"0 4px 24px rgba(196,96,58,0.3)":"0 4px 24px rgba(125,157,124,0.3)",
          display:"flex",alignItems:"center",justifyContent:"center",
          cursor:"pointer",zIndex:150,border:"none",
          transition:"all .25s cubic-bezier(.16,1,.3,1)",
          animation:listening?"pulse 1s ease-in-out infinite":"none",
        }}>
        <span style={{fontSize:22}}>{listening ? "⏹" : "🎤"}</span>
      </button>

      {/* Transcript / Result popup */}
      {(listening || transcript || result || processing) && (
        <div style={{
          position:"fixed",
          bottom:"calc(148px + env(safe-area-inset-bottom,0px))",
          left:"max(12px, calc(50vw - 210px))",
          width:240,
          background:"#2D2721",border:"1px solid rgba(45,212,191,0.3)",
          borderRadius:16,padding:"14px 16px",
          zIndex:149,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",
          animation:"fabMenuIn .25s cubic-bezier(.16,1,.3,1)",
        }}>
          {listening && (
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{display:"flex",gap:4}}>
                <div className="ai-dot" style={{background:"#4A9B8E"}}/>
                <div className="ai-dot" style={{background:"#4A9B8E"}}/>
                <div className="ai-dot" style={{background:"#4A9B8E"}}/>
              </div>
              <span style={{fontSize:13,color:"#4A9B8E",fontWeight:600}}>Listening...</span>
            </div>
          )}
          {transcript && !processing && !result && (
            <div style={{fontSize:12,color:T.muted}}> "{transcript}"</div>
          )}
          {processing && (
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div className="spinner" style={{width:16,height:16}}/>
              <span style={{fontSize:12,color:T.muted}}>Processing...</span>
            </div>
          )}
          {result && (
            <div style={{fontSize:13,color:"#2D2721",fontWeight:500,lineHeight:1.4}}>{result}</div>
          )}
        </div>
      )}
    </>
  );
};



// ─── SERVICE REMINDERS COMPONENT ─────────────────────────────────────────────
const ServiceReminders = ({ familyId }) => {
  const { rows: reminders, refresh } = useTable("reminders", familyId, { order: "due_date", asc: true });

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const getDaysLeft = (due) => {
    if (!due) return null;
    const diff = Math.ceil((new Date(due) - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getColor = (days) => {
    if (days === null) return T.muted;
    if (days < 0) return T.red;
    if (days <= 3) return T.red;
    if (days <= 7) return T.amber;
    return T.green;
  };

  const getLabel = (days) => {
    if (days === null) return "";
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Due today!";
    if (days === 1) return "Due tomorrow!";
    return `${days}d left`;
  };

  const markDone = async (r) => {
    await supabase.from("reminders").update({ done: true }).eq("id", r.id);
    // If repeating, create next reminder
    if (r.repeat && r.repeat !== "none") {
      const months = r.repeat === "monthly" ? 1 : r.repeat === "quarterly" ? 3 : r.repeat === "biannual" ? 6 : 12;
      const nextDate = new Date(r.due_date);
      nextDate.setMonth(nextDate.getMonth() + months);
      await supabase.from("reminders").insert([{
        family_id: familyId,
        content: r.content,
        due_date: nextDate.toISOString().split("T")[0],
        done: false,
        repeat: r.repeat,
        category: r.category,
        notes: r.notes,
      }]);
      showToast({title:"Next reminder set!",body:`Next due: ${nextDate.toISOString().split("T")[0]}`,icon:"🔔",color:"#7D9D7C"});
    }
    refresh();
  };

  const pending = reminders.filter(r => !r.done);
  const done = reminders.filter(r => r.done);

  if (!pending.length && !done.length) {
    return <div className="empty"><div className="empty-icon">🔔</div><div className="empty-text">No service reminders yet.<br/><span style={{fontSize:12,color:"rgba(238,236,248,0.4)"}}>Add reminders for AC, car, appliance servicing.</span></div></div>;
  }

  return (
    <div>
      {pending.length > 0 && (
        <>
          <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>
            Pending ({pending.length})
          </div>
          <div className="card" style={{padding:"2px 14px",marginBottom:16}}>
            {pending.sort((a,b)=>new Date(a.due_date)-new Date(b.due_date)).map(r => {
              const days = getDaysLeft(r.due_date);
              const color = getColor(days);
              const label = getLabel(days);
              return (
                <div key={r.id} className="list-row">
                  <div style={{width:40,height:40,borderRadius:12,background:`${color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                    {r.content?.split(" ")[0] || "🔔"}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600}}>{r.content?.split("—")[0]?.replace(/^[^\s]+\s/,"").trim() || r.content}</div>
                    <div style={{fontSize:11.5,color:T.muted,marginTop:2}}>
                      {r.category && <span style={{marginRight:6}}>{r.category}</span>}
                      {r.repeat && r.repeat !== "none" && <span style={{color:T.accent}}>🔄 {r.repeat}</span>}
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color,marginTop:3}}>{r.due_date} · {label}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                    <button onClick={()=>markDone(r)} style={{padding:"6px 12px",background:"rgba(109,155,107,0.12)",border:"1px solid rgba(109,155,107,0.3)",borderRadius:10,color:"#6D9B6B",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Plus Jakarta Sans,sans-serif"}}>
                      ✅ Done
                    </button>
                    <button onClick={async()=>{await supabase.from("reminders").delete().eq("id",r.id);refresh();}} style={{padding:"4px 10px",background:"transparent",border:"none",color:T.red,fontSize:11,cursor:"pointer",fontFamily:"Plus Jakarta Sans,sans-serif"}}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {done.length > 0 && (
        <>
          <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>
            Completed ({done.length})
          </div>
          <div className="card" style={{padding:"2px 14px",opacity:0.5}}>
            {done.slice(0,5).map(r => (
              <div key={r.id} className="list-row" style={{cursor:"default"}}>
                <div style={{fontSize:20}}>{r.content?.split(" ")[0] || "✅"}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,textDecoration:"line-through"}}>{r.content?.split("—")[0]?.replace(/^[^\s]+\s/,"").trim() || r.content}</div>
                  <div style={{fontSize:11,color:T.muted}}>{r.due_date}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};


// ─── FINANCE ADVISOR SCREEN ───────────────────────────────────────────────────
const FinanceAdvisorScreen = ({ familyId }) => {
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  useEffect(() => { fetchData(); }, [month, year]);

  const fetchData = async () => {
    setLoading(true);
    const startDate = `${year}-${String(month+1).padStart(2,"0")}-01`;
    const endDate = new Date(year, month+1, 0).toISOString().split("T")[0];
    const { data } = await supabase.from("transactions")
      .select("*").eq("family_id", familyId)
      .gte("date", startDate).lte("date", endDate)
      .order("date", {ascending: false});
    setTxns(data || []);
    setLoading(false);
  };

  const income = txns.filter(t => Number(t.amount) > 0).reduce((a,t) => a + Number(t.amount), 0);
  const expenses = txns.filter(t => Number(t.amount) < 0).reduce((a,t) => a + Math.abs(Number(t.amount)), 0);
  const net = income - expenses;
  const savingsRate = income > 0 ? Math.round((net/income)*100) : 0;

  // Category breakdown
  const catMap = {};
  txns.filter(t => Number(t.amount) < 0).forEach(t => {
    const cat = t.category || "Other";
    catMap[cat] = (catMap[cat] || 0) + Math.abs(Number(t.amount));
  });
  const catBreakdown = Object.entries(catMap).sort((a,b) => b[1]-a[1]);

  // Top merchants
  const merchantMap = {};
  txns.filter(t => Number(t.amount) < 0).forEach(t => {
    const m = t.description || "Other";
    merchantMap[m] = (merchantMap[m] || 0) + Math.abs(Number(t.amount));
  });
  const topMerchants = Object.entries(merchantMap).sort((a,b) => b[1]-a[1]).slice(0,5);

  // AI Insights
  const getInsights = () => {
    const insights = [];
    if (savingsRate < 20) insights.push({icon:"⚠️", text:`Savings rate is only ${savingsRate}%. Aim for at least 20%.`, color:T.red});
    else if (savingsRate >= 40) insights.push({icon:"🌟", text:`Excellent! ${savingsRate}% savings rate this month.`, color:T.green});
    else insights.push({icon:"✅", text:`Good savings rate of ${savingsRate}% this month.`, color:T.green});

    if (catBreakdown[0]) {
      const topCat = catBreakdown[0];
      const pct = Math.round((topCat[1]/expenses)*100);
      if (pct > 40) insights.push({icon:"💡", text:`${topCat[0]} is your biggest expense at ${pct}% (₹${topCat[1].toLocaleString("en-IN")}). Consider if this can be reduced.`, color:T.amber});
    }

    const diningExp = catMap["Dining & Food"] || 0;
    if (diningExp > 5000) insights.push({icon:"🍽️", text:`Dining & Food spending ₹${diningExp.toLocaleString("en-IN")} — cooking at home can save significantly.`, color:T.amber});

    const shoppingExp = catMap["Shopping"] || 0;
    if (shoppingExp > 10000) insights.push({icon:"🛍️", text:`Shopping expense ₹${shoppingExp.toLocaleString("en-IN")} — review if all purchases were necessary.`, color:T.amber});

    if (income === 0) insights.push({icon:"❗", text:"No income recorded this month. Add your salary and clinic income.", color:T.red});

    return insights;
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      // Build HTML content for PDF
      const rows = catBreakdown.map(([cat,amt]) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${cat}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">₹${amt.toLocaleString("en-IN")}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${Math.round((amt/expenses)*100)}%</td></tr>`
      ).join("");

      const txnRows = txns.slice(0,20).map(t =>
        `<tr><td style="padding:6px;border-bottom:1px solid #eee;font-size:12px">${t.date}</td><td style="padding:6px;border-bottom:1px solid #eee;font-size:12px">${t.description||""}</td><td style="padding:6px;border-bottom:1px solid #eee;font-size:12px">${t.category||""}</td><td style="padding:6px;border-bottom:1px solid #eee;text-align:right;font-size:12px;color:${Number(t.amount)>0?"#16a34a":"#dc2626"}">₹${Math.abs(Number(t.amount)).toLocaleString("en-IN")}</td></tr>`
      ).join("");

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><style>
  body{font-family:Arial,sans-serif;margin:30px;color:#1a1a2e;}
  h1{color:#6B7CF8;border-bottom:3px solid #6B7CF8;padding-bottom:10px;}
  h2{color:#4A9B8E;margin-top:24px;}
  .summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin:20px 0;}
  .card{background:#f8f9ff;border-radius:12px;padding:16px;text-align:center;}
  .card-label{font-size:12px;color:#666;font-weight:600;}
  .card-value{font-size:22px;font-weight:800;margin-top:4px;}
  .insight{padding:10px 14px;border-radius:8px;margin-bottom:8px;font-size:13px;}
  table{width:100%;border-collapse:collapse;margin-top:10px;}
  th{background:#6B7CF8;color:white;padding:10px;text-align:left;}
  .footer{margin-top:40px;text-align:center;color:#999;font-size:11px;}
</style></head>
<body>
  <h1>🏠 Family OS — Finance Report</h1>
  <p style="color:#666;margin-top:-10px">Gupta Family · Sector 48, Gurgaon · ${MONTHS[month]} ${year}</p>

  <div class="summary">
    <div class="card"><div class="card-label">Total Income</div><div class="card-value" style="color:#16a34a">₹${income.toLocaleString("en-IN")}</div></div>
    <div class="card"><div class="card-label">Total Expenses</div><div class="card-value" style="color:#dc2626">₹${expenses.toLocaleString("en-IN")}</div></div>
    <div class="card"><div class="card-label">Net Savings</div><div class="card-value" style="color:${net>=0?"#16a34a":"#dc2626"}">₹${Math.abs(net).toLocaleString("en-IN")}</div></div>
  </div>
  <p style="background:#f0fdf4;padding:10px;border-radius:8px;font-weight:600;">Savings Rate: ${savingsRate}% ${savingsRate>=20?"✅ Good!":"⚠️ Below target"}</p>

  <h2>📊 Expenses by Category</h2>
  <table><tr><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">% of Total</th></tr>${rows}</table>

  <h2>📋 Transaction Details (Top 20)</h2>
  <table><tr><th>Date</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr>${txnRows}</table>

  <div class="footer">Generated by Family OS · ${new Date().toLocaleDateString("en-IN")} · Confidential</div>
</body>
</html>`;

      // Open in new window and print
      const win = window.open("", "_blank");
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 500);
    } catch(e) {
      showToast({title:"Error",body:e.message,icon:"❌",color:T.red});
    }
    setGenerating(false);
  };

  return (
    <div className="screen">
      <div style={{padding:"calc(env(safe-area-inset-top,0px) + 52px) 18px 100px"}}>

        {/* Header */}
        <div className="row" style={{marginBottom:16}}>
          <div>
            <div style={{fontSize:22,fontWeight:900}}>📊 Finance Advisor</div>
            <div style={{fontSize:12,color:T.muted,marginTop:2}}>Monthly analysis & PDF report</div>
          </div>
          <button onClick={generatePDF} disabled={generating} style={{padding:"10px 16px",background:"rgba(125,157,124,0.12)",border:"1px solid rgba(139,124,248,0.4)",borderRadius:12,color:T.accent,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"Plus Jakarta Sans,sans-serif"}}>
            {generating ? "⏳" : "📄 PDF"}
          </button>
        </div>

        {/* Month Selector */}
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <select className="input" value={month} onChange={e=>setMonth(Number(e.target.value))} style={{flex:2}}>
            {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
          </select>
          <select className="input" value={year} onChange={e=>setYear(Number(e.target.value))} style={{flex:1}}>
            {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{textAlign:"center",padding:40}}><div className="spinner" style={{width:32,height:32,margin:"0 auto 12px"}}/><div style={{color:T.muted,fontSize:13}}>Loading data...</div></div>
        ) : (
          <>
            {/* Summary Cards */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[
                {label:"Income",value:income,color:T.green,icon:"💰"},
                {label:"Expenses",value:expenses,color:T.red,icon:"💸"},
                {label:"Net Savings",value:net,color:net>=0?T.green:T.red,icon:"🏦"},
                {label:"Savings Rate",value:`${savingsRate}%`,color:savingsRate>=20?T.green:T.amber,icon:"📈",raw:true},
              ].map((c,i)=>(
                <div key={i} className="card" style={{padding:"14px 16px"}}>
                  <div style={{fontSize:11,color:T.muted,fontWeight:700}}>{c.icon} {c.label}</div>
                  <div style={{fontSize:18,fontWeight:800,color:c.color,marginTop:4}}>
                    {c.raw ? c.value : `₹${Math.abs(c.value).toLocaleString("en-IN")}`}
                  </div>
                </div>
              ))}
            </div>

            {/* AI Insights */}
            {getInsights().length > 0 && (
              <>
                <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>💡 Insights</div>
                {getInsights().map((ins,i)=>(
                  <div key={i} style={{padding:"12px 14px",background:`${ins.color}12`,border:`1px solid ${ins.color}30`,borderRadius:12,marginBottom:8,display:"flex",gap:10,alignItems:"flex-start"}}>
                    <span style={{fontSize:18,flexShrink:0}}>{ins.icon}</span>
                    <span style={{fontSize:13,color:T.text,lineHeight:1.5}}>{ins.text}</span>
                  </div>
                ))}
              </>
            )}

            {/* Category Breakdown */}
            {catBreakdown.length > 0 && (
              <>
                <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10,marginTop:16}}>📊 By Category</div>
                <div className="card" style={{padding:"2px 14px",marginBottom:16}}>
                  {catBreakdown.map(([cat,amt],i)=>{
                    const pct = expenses > 0 ? Math.round((amt/expenses)*100) : 0;
                    return (
                      <div key={cat} className="list-row" style={{cursor:"default"}}>
                        <div style={{width:28,height:28,borderRadius:8,background:"rgba(125,157,124,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:T.accent}}>{i+1}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:600}}>{cat}</div>
                          <div style={{height:4,background:"#FAFAF8",borderRadius:2,marginTop:5}}>
                            <div style={{height:4,background:T.accent,borderRadius:2,width:`${pct}%`}}/>
                          </div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.red}}>₹{amt.toLocaleString("en-IN")}</div>
                          <div style={{fontSize:11,color:T.muted}}>{pct}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Top Merchants */}
            {topMerchants.length > 0 && (
              <>
                <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>🏪 Top Merchants</div>
                <div className="card" style={{padding:"2px 14px",marginBottom:16}}>
                  {topMerchants.map(([name,amt])=>(
                    <div key={name} className="list-row" style={{cursor:"default"}}>
                      <div style={{flex:1,fontSize:13}}>{name.slice(0,35)}</div>
                      <div style={{fontSize:13,fontWeight:700,color:T.red}}>₹{amt.toLocaleString("en-IN")}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {txns.length === 0 && (
              <div className="empty"><div className="empty-icon">📊</div><div className="empty-text">No transactions found for {MONTHS[month]} {year}</div></div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── GMAIL SYNC SCREEN ────────────────────────────────────────────────────────
const GmailSyncScreen = ({ familyId }) => {
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [step, setStep] = useState("connect");
  const [syncHistory, setSyncHistory] = useState([]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("gmail_connected") === "true") {
        const at = params.get("gmail_access_token");
        if (at) {
          sessionStorage.setItem("gat", at);
          const rt = params.get("gmail_refresh_token") || "";
          sessionStorage.setItem("grt", rt);
          setConnected(true);
          window.history.replaceState({}, "", "/");
        }
      }
      const saved = sessionStorage.getItem("gat");
      if (saved) setConnected(true);
    } catch(e) {}

    supabase.from("gmail_sync_history").select("*").eq("family_id", familyId)
      .order("synced_at", {ascending: false}).limit(20)
      .then(({data}) => { if(data) setSyncHistory(data); })
      .catch(() => {});
  }, []);

  const connectGmail = () => { window.location.href = "/api/gmail/auth"; };

  const syncEmails = async () => {
    setSyncing(true);
    try {
      const at = sessionStorage.getItem("gat") || "";
      const rt = sessionStorage.getItem("grt") || "";
      const r = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({access_token: at, refresh_token: rt}),
      });
      const data = await r.json();
      if (data.error) { showToast({title:"Error",body:data.error,icon:"❌",color:"#C4603A"}); return; }
      const existingIds = syncHistory.map(h => h.gmail_id);
      const newTxns = (data.transactions || []).filter(t => !existingIds.includes(t.gmail_id));
      setTransactions(newTxns);
      setSelected(new Set(newTxns.map((_, i) => i)));
      setStep("review");
    } catch(err) {
      showToast({title:"Error",body:err.message,icon:"❌",color:"#C4603A"});
    } finally { setSyncing(false); }
  };

  const importSelected = async () => {
    const toImport = transactions.filter((_, i) => selected.has(i));
    for (const tx of toImport) {
      await supabase.from("transactions").insert([{
        family_id: familyId, description: tx.description,
        amount: -Math.abs(tx.amount), category: tx.category,
        emoji: tx.emoji, date: tx.date, added_by: `Gmail (${tx.source})`,
      }]);
      await supabase.from("gmail_sync_history").insert([{
        family_id: familyId, gmail_id: tx.gmail_id,
        description: tx.description, amount: tx.amount,
        category: tx.category, source: tx.source,
        synced_at: new Date().toISOString(),
      }]).catch(()=>{});
    }
    showToast({title:`${toImport.length} imported!`,body:"Check Finance screen",icon:"✅",color:"#6D9B6B"});
    setStep("connect");
    setTransactions([]);
  };

  const toggleSelect = (i) => {
    const s = new Set(selected);
    if (s.has(i)) s.delete(i); else s.add(i);
    setSelected(s);
  };

  return (
    <div style={{paddingBottom:20}}>
      <div style={{fontSize:22,fontWeight:900,marginBottom:4}}>📧 Gmail Sync</div>
        <div style={{fontSize:12,color:T.muted,marginBottom:20}}>
          {connected ? "✅ Gmail connected" : "Import transactions from Gmail"}
        </div>

        {!connected && (
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:50,marginBottom:12}}>📧</div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Connect Gmail</div>
            <div style={{fontSize:13,color:T.muted,marginBottom:20,lineHeight:1.6}}>
              Scan Flipkart, Amazon, Swiggy, Zomato, Zepto orders and bank alerts from this month.
            </div>
            <button className="btn-primary" onClick={connectGmail} style={{width:"100%",height:50}}>
              🔗 Connect Gmail Account
            </button>
          </div>
        )}

        {connected && step === "connect" && (
          <>
            <button className="btn-primary" onClick={syncEmails} disabled={syncing} style={{width:"100%",height:50,marginBottom:16}}>
              {syncing ? "🔄 Scanning..." : "🔍 Scan This Month"}
            </button>
            <button onClick={()=>{try{sessionStorage.removeItem("gat");sessionStorage.removeItem("grt");}catch(e){}setConnected(false);}} style={{width:"100%",padding:"12px",background:"transparent",border:"1px solid rgba(125,157,124,0.08)",borderRadius:14,color:T.muted,fontSize:13,cursor:"pointer",fontFamily:"Plus Jakarta Sans,sans-serif",marginBottom:20}}>
              Disconnect Gmail
            </button>
            {syncHistory.length > 0 && (
              <>
                <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",marginBottom:10}}>Recently Imported</div>
                <div className="card" style={{padding:"2px 14px"}}>
                  {syncHistory.map((h,i)=>(
                    <div key={i} className="list-row" style={{cursor:"default"}}>
                      <div style={{fontSize:18}}>{h.source==="Flipkart"?"🛒":h.source==="Amazon"?"📦":h.source==="Swiggy"?"🍔":"🏦"}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12}}>{h.description?.slice(0,35)}</div>
                        <div style={{fontSize:11,color:T.muted}}>{h.source} · {h.synced_at?.split("T")[0]}</div>
                      </div>
                      <div style={{fontSize:13,fontWeight:700,color:T.red}}>-₹{h.amount}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {step === "review" && (
          <>
            <div style={{padding:"12px 14px",background:"rgba(125,157,124,0.06)",border:"0.5px solid rgba(125,157,124,0.2)",borderRadius:12,marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:700,color:T.accent}}>Found {transactions.length} new transactions</div>
              <div style={{fontSize:12,color:T.muted}}>{selected.size} selected</div>
            </div>
            {transactions.length === 0
              ? <div className="empty"><div className="empty-icon">🔍</div><div className="empty-text">No new transactions found.</div></div>
              : <>
                  <div className="card" style={{padding:"2px 14px",marginBottom:14}}>
                    {transactions.map((tx,i)=>(
                      <div key={i} className="list-row" onClick={()=>toggleSelect(i)} style={{opacity:selected.has(i)?1:0.4}}>
                        <div style={{fontSize:22}}>{tx.emoji}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13}}>{tx.description?.slice(0,35)}</div>
                          <div style={{fontSize:11,color:T.muted}}>{tx.category} · {tx.date}</div>
                        </div>
                        <div style={{fontSize:13,fontWeight:700,color:T.red,marginRight:8}}>-₹{tx.amount}</div>
                        <div style={{width:20,height:20,borderRadius:6,background:selected.has(i)?"#6D9B6B":"#F8F7F4",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {selected.has(i) && <I n="check" s={11} c="white" w={3}/>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="btn-primary" onClick={importSelected} style={{width:"100%",height:50,marginBottom:10}}>
                    ✅ Import {selected.size} Transactions
                  </button>
                  <button onClick={()=>setStep("connect")} style={{width:"100%",padding:"12px",background:"transparent",border:"1px solid rgba(125,157,124,0.08)",borderRadius:14,color:T.muted,fontSize:13,cursor:"pointer",fontFamily:"Plus Jakarta Sans,sans-serif"}}>
                    Cancel
                  </button>
                </>
            }
          </>
        )}
      </div>
  );
};

// ─── ALEXA COMMAND CENTER ─────────────────────────────────────────────────────
const AlexaCommandCenter = ({ onClose }) => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const commands = [
    {cat:"finance",icon:"💰",en:"Add clinic income of 15000 rupees",hi:"Clinic ki income 15000 rupaye add karo",hinglish:"Aaj clinic mein 15000 rupees aaye"},
    {cat:"finance",icon:"💰",en:"Add Simmi income of 50000 rupees",hi:"Simmi ki income 50000 rupaye darj karo",hinglish:"Simmi ki salary 50000 add karo"},
    {cat:"finance",icon:"💸",en:"I spent 500 rupees on groceries",hi:"Maine kirane par 500 rupaye kharch kiye",hinglish:"Maine groceries par 500 rupees spend kiye"},
    {cat:"finance",icon:"💸",en:"Add expense 2000 for transport",hi:"Transport ke liye 2000 rupaye ka kharcha darj karo",hinglish:"Transport par 2000 rupees kharch hue"},
    {cat:"finance",icon:"💸",en:"Spent 800 on fuel",hi:"Petrol par 800 rupaye kharch kiye",hinglish:"Maine aaj 800 rupaye petrol par kharch kiye"},
    {cat:"meals",icon:"🍽",en:"What is for dinner today",hi:"Aaj dinner mein kya hai",hinglish:"Aaj raat kya banega"},
    {cat:"meals",icon:"🍽",en:"What is for breakfast",hi:"Subah naashte mein kya hai",hinglish:"Breakfast mein kya hai aaj"},
    {cat:"meals",icon:"🍽",en:"What is for lunch",hi:"Dopahar ke khaane mein kya hai",hinglish:"Lunch mein kya hai aaj"},
    {cat:"pantry",icon:"📦",en:"What items are running low",hi:"Kya khatam hone wala hai",hinglish:"Is week kya restock karna hai"},
    {cat:"pantry",icon:"📦",en:"Check pantry status",hi:"Pantry ki halat batao",hinglish:"Pantry mein kya kya kam hai"},
    {cat:"tasks",icon:"✅",en:"Add task call the lab tomorrow",hi:"Kal lab ko call karne ka kaam add karo",hinglish:"Kal lab call karna yaad dilana"},
    {cat:"tasks",icon:"✅",en:"Remind me to pay electricity bill",hi:"Bijli ka bill bharne ki yaad dilao",hinglish:"Electricity bill pay karna reminder lagao"},
    {cat:"briefing",icon:"☀️",en:"Daily briefing",hi:"Aaj ki report do",hinglish:"Aaj ka update kya hai"},
    {cat:"briefing",icon:"☀️",en:"Good morning",hi:"Subah ki jaankari do",hinglish:"Morning update do"},
    {cat:"briefing",icon:"☀️",en:"Family update",hi:"Family ki poori update do",hinglish:"Sab kuch batao aaj ka"},
  ];
  const categories = [
    {id:"all",label:"All"},{id:"finance",label:"💰 Finance"},
    {id:"meals",label:"🍽 Meals"},{id:"pantry",label:"📦 Pantry"},
    {id:"tasks",label:"✅ Tasks"},{id:"briefing",label:"☀️ Briefing"},
  ];
  const filtered = commands.filter(c => {
    const matchCat = activeCategory === "all" || c.cat === activeCategory;
    const matchSearch = !search || c.en.toLowerCase().includes(search.toLowerCase()) || c.hinglish.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"85vh",overflowY:"auto",background:"#1E1E30"}}>
        <div className="row" style={{marginBottom:14}}>
          <div>
            <div style={{fontSize:19,fontWeight:800}}>🎤 Munshi Jee Commands</div>
            <div style={{fontSize:12,color:T.muted,marginTop:2}}>Say "Alexa, open munshi jee" first</div>
          </div>
          <div onClick={onClose} style={{width:30,height:30,borderRadius:10,background:"rgba(125,157,124,0.08)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <I n="x" s={15} c={T.muted}/>
          </div>
        </div>
        <div style={{padding:"10px 14px",background:"rgba(125,157,124,0.1)",border:"1px solid rgba(125,157,124,0.3)",borderRadius:12,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:T.accent}}>How to start:</div>
          <div style={{fontSize:13,color:T.text,marginTop:4}}>"Alexa, open munshi jee"</div>
          <div style={{fontSize:11.5,color:T.muted,marginTop:2}}>"Alexa, munshi jee kholo"</div>
        </div>
        <input className="input" placeholder="Search commands..." value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:12,height:44}}/>
        <div className="scroll-x" style={{marginBottom:14}}>
          {categories.map(c=>(
            <div key={c.id} className={"chip "+(activeCategory===c.id?"on":"")} onClick={()=>setActiveCategory(c.id)} style={{fontSize:12}}>{c.label}</div>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map((cmd,i)=>(
            <div key={i} className="card" style={{padding:"14px 16px"}}>
              <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:8}}>{cmd.icon} {cmd.en}</div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <div style={{display:"flex",gap:8}}>
                  <span style={{fontSize:12,fontWeight:700,color:T.accent,minWidth:55}}>HINDI</span>
                  <span style={{fontSize:12,color:T.muted,flex:1}}>{cmd.hi}</span>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <span style={{fontSize:12,fontWeight:700,color:T.teal,minWidth:55}}>HINGLISH</span>
                  <span style={{fontSize:12,color:T.muted,flex:1}}>{cmd.hinglish}</span>
                </div>
              </div>
            </div>
          ))}
          {filtered.length===0 && <div className="empty"><div className="empty-icon">🔍</div><div className="empty-text">No commands found.</div></div>}
        </div>
      </div>
    </div>
  );
};

// ─── KITCHEN MODULE ──────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════

const MEAL_TYPES = ["breakfast", "lunch", "snack", "dinner"];
const MEAL_EMOJI = { breakfast:"🌅", lunch:"☀️", snack:"🍎", dinner:"🌙" };
const PANTRY_CATS = ["Grains","Pulses","Dairy","Vegetables","Fruits","Spices","Oils","Snacks","Beverages","Other"];

// ─── SEED RECIPES DATA ────────────────────────────────────────────────────────
const SEED_RECIPES = [
  { name:"Poha", meal_type:"breakfast", servings:2, prep_time_mins:15, tags:["vegetarian","quick"],
    ingredients:[{name:"Poha",qty:200,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Oil",qty:20,unit:"ml"},{name:"Mustard Seeds",qty:5,unit:"g"},{name:"Green Chilli",qty:2,unit:"pcs"}]},
  { name:"Upma", meal_type:"breakfast", servings:2, prep_time_mins:20, tags:["vegetarian","quick"],
    ingredients:[{name:"Rava",qty:150,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Oil",qty:20,unit:"ml"},{name:"Mustard Seeds",qty:5,unit:"g"},{name:"Cashews",qty:20,unit:"g"}]},
  { name:"Idli Sambar", meal_type:"breakfast", servings:4, prep_time_mins:30, tags:["vegetarian","child-friendly"],
    ingredients:[{name:"Idli Batter",qty:400,unit:"g"},{name:"Toor Dal",qty:100,unit:"g"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Onion",qty:1,unit:"pcs"},{name:"Oil",qty:20,unit:"ml"}]},
  { name:"Aloo Paratha", meal_type:"breakfast", servings:2, prep_time_mins:30, tags:["vegetarian","child-friendly"],
    ingredients:[{name:"Wheat Flour",qty:200,unit:"g"},{name:"Potato",qty:300,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Oil",qty:30,unit:"ml"},{name:"Butter",qty:20,unit:"g"}]},
  { name:"Oats Porridge", meal_type:"breakfast", servings:2, prep_time_mins:10, tags:["vegetarian","quick","healthy"],
    ingredients:[{name:"Oats",qty:150,unit:"g"},{name:"Milk",qty:400,unit:"ml"},{name:"Banana",qty:1,unit:"pcs"},{name:"Honey",qty:15,unit:"ml"}]},
  { name:"Masala Dosa", meal_type:"breakfast", servings:3, prep_time_mins:30, tags:["vegetarian"],
    ingredients:[{name:"Dosa Batter",qty:400,unit:"g"},{name:"Potato",qty:300,unit:"g"},{name:"Onion",qty:2,unit:"pcs"},{name:"Oil",qty:30,unit:"ml"},{name:"Mustard Seeds",qty:5,unit:"g"}]},
  { name:"Mix Dal", meal_type:"lunch", servings:4, prep_time_mins:35, tags:["vegetarian","healthy","protein-rich","everyday"],
    ingredients:[{name:"Toor Dal",qty:75,unit:"g"},{name:"Moong Dal",qty:75,unit:"g"},{name:"Masoor Dal",qty:50,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Ghee",qty:20,unit:"ml"},{name:"Ginger",qty:10,unit:"g"},{name:"Garlic",qty:4,unit:"pcs"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Mix Dal Tadka", meal_type:"dinner", servings:4, prep_time_mins:35, tags:["vegetarian","dhaba-style","protein-rich"],
    ingredients:[{name:"Toor Dal",qty:75,unit:"g"},{name:"Chana Dal",qty:50,unit:"g"},{name:"Urad Dal",qty:25,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Ghee",qty:25,unit:"ml"},{name:"Cumin Seeds",qty:5,unit:"g"},{name:"Red Chilli",qty:2,unit:"pcs"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Panchmel Dal", meal_type:"lunch", servings:4, prep_time_mins:40, tags:["vegetarian","rajasthani","protein-rich"],
    ingredients:[{name:"Toor Dal",qty:50,unit:"g"},{name:"Moong Dal",qty:50,unit:"g"},{name:"Chana Dal",qty:50,unit:"g"},{name:"Urad Dal",qty:25,unit:"g"},{name:"Masoor Dal",qty:25,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Ghee",qty:25,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Rajma Chawal", meal_type:"lunch", servings:4, prep_time_mins:45, tags:["vegetarian","child-friendly"],
    ingredients:[{name:"Rajma",qty:250,unit:"g"},{name:"Rice",qty:300,unit:"g"},{name:"Onion",qty:2,unit:"pcs"},{name:"Tomato",qty:3,unit:"pcs"},{name:"Oil",qty:30,unit:"ml"}]},
  { name:"Dal Tadka with Rice", meal_type:"lunch", servings:4, prep_time_mins:30, tags:["vegetarian","quick"],
    ingredients:[{name:"Toor Dal",qty:200,unit:"g"},{name:"Rice",qty:300,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Ghee",qty:20,unit:"ml"}]},
  { name:"Chole Bhature", meal_type:"lunch", servings:4, prep_time_mins:60, tags:["vegetarian"],
    ingredients:[{name:"Kabuli Chana",qty:250,unit:"g"},{name:"Wheat Flour",qty:200,unit:"g"},{name:"Onion",qty:2,unit:"pcs"},{name:"Tomato",qty:3,unit:"pcs"},{name:"Oil",qty:50,unit:"ml"}]},
  { name:"Paneer Sabzi with Roti", meal_type:"lunch", servings:3, prep_time_mins:30, tags:["vegetarian","child-friendly"],
    ingredients:[{name:"Paneer",qty:200,unit:"g"},{name:"Wheat Flour",qty:200,unit:"g"},{name:"Onion",qty:2,unit:"pcs"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Oil",qty:30,unit:"ml"}]},
  { name:"Fruit Bowl", meal_type:"snack", servings:2, prep_time_mins:5, tags:["vegetarian","child-friendly","healthy"],
    ingredients:[{name:"Banana",qty:2,unit:"pcs"},{name:"Apple",qty:1,unit:"pcs"},{name:"Pomegranate",qty:100,unit:"g"}]},
  { name:"Banana Milkshake", meal_type:"snack", servings:2, prep_time_mins:5, tags:["vegetarian","child-friendly"],
    ingredients:[{name:"Banana",qty:2,unit:"pcs"},{name:"Milk",qty:400,unit:"ml"},{name:"Sugar",qty:20,unit:"g"}]},
  { name:"Namkeen & Biscuits", meal_type:"snack", servings:2, prep_time_mins:2, tags:["vegetarian","quick"],
    ingredients:[{name:"Namkeen",qty:100,unit:"g"},{name:"Biscuits",qty:100,unit:"g"}]},
  { name:"Sprouts Chaat", meal_type:"snack", servings:2, prep_time_mins:10, tags:["vegetarian","healthy"],
    ingredients:[{name:"Moong Sprouts",qty:150,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tomato",qty:1,unit:"pcs"},{name:"Lemon",qty:1,unit:"pcs"}]},
  { name:"Paneer Butter Masala", meal_type:"dinner", servings:4, prep_time_mins:40, tags:["vegetarian","child-friendly"],
    ingredients:[{name:"Paneer",qty:250,unit:"g"},{name:"Tomato",qty:4,unit:"pcs"},{name:"Onion",qty:2,unit:"pcs"},{name:"Butter",qty:30,unit:"g"},{name:"Cream",qty:50,unit:"ml"}]},
  { name:"Dal Makhani", meal_type:"dinner", servings:4, prep_time_mins:60, tags:["vegetarian"],
    ingredients:[{name:"Urad Dal",qty:200,unit:"g"},{name:"Rajma",qty:50,unit:"g"},{name:"Butter",qty:40,unit:"g"},{name:"Cream",qty:50,unit:"ml"},{name:"Tomato",qty:3,unit:"pcs"}]},
  { name:"Sabzi with Roti", meal_type:"dinner", servings:3, prep_time_mins:30, tags:["vegetarian","quick"],
    ingredients:[{name:"Mixed Vegetables",qty:300,unit:"g"},{name:"Wheat Flour",qty:200,unit:"g"},{name:"Oil",qty:30,unit:"ml"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tomato",qty:2,unit:"pcs"}]},
  { name:"Khichdi", meal_type:"dinner", servings:3, prep_time_mins:25, tags:["vegetarian","child-friendly","healthy"],
    ingredients:[{name:"Rice",qty:150,unit:"g"},{name:"Moong Dal",qty:100,unit:"g"},{name:"Ghee",qty:20,unit:"ml"},{name:"Cumin Seeds",qty:5,unit:"g"},{name:"Turmeric",qty:3,unit:"g"}]},
  { name:"Dahi Rice", meal_type:"dinner", servings:2, prep_time_mins:15, tags:["vegetarian","quick","child-friendly"],
    ingredients:[{name:"Rice",qty:200,unit:"g"},{name:"Curd",qty:200,unit:"g"},{name:"Mustard Seeds",qty:5,unit:"g"},{name:"Curry Leaves",qty:5,unit:"g"},{name:"Oil",qty:10,unit:"ml"}]},
  { name:"Aloo Gobi", meal_type:"dinner", servings:4, prep_time_mins:30, tags:["vegetarian"],
    ingredients:[{name:"Potato",qty:300,unit:"g"},{name:"Cauliflower",qty:400,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Oil",qty:30,unit:"ml"}]},
  { name:"Boiled Eggs", meal_type:"breakfast", servings:2, prep_time_mins:10, tags:["non-veg","quick","healthy","high-protein"],
    ingredients:[{name:"Eggs",qty:4,unit:"pcs"},{name:"Salt",qty:5,unit:"g"}]},
  { name:"Omelette", meal_type:"breakfast", servings:2, prep_time_mins:10, tags:["non-veg","quick","high-protein"],
    ingredients:[{name:"Eggs",qty:3,unit:"pcs"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tomato",qty:1,unit:"pcs"},{name:"Oil",qty:10,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Masala Omelette", meal_type:"breakfast", servings:2, prep_time_mins:12, tags:["non-veg","quick","spicy"],
    ingredients:[{name:"Eggs",qty:3,unit:"pcs"},{name:"Onion",qty:1,unit:"pcs"},{name:"Green Chilli",qty:2,unit:"pcs"},{name:"Coriander Leaves",qty:10,unit:"g"},{name:"Oil",qty:10,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Egg Bhurji", meal_type:"breakfast", servings:2, prep_time_mins:15, tags:["non-veg","quick","spicy"],
    ingredients:[{name:"Eggs",qty:3,unit:"pcs"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tomato",qty:1,unit:"pcs"},{name:"Green Chilli",qty:1,unit:"pcs"},{name:"Oil",qty:15,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Egg Curry", meal_type:"lunch", servings:3, prep_time_mins:30, tags:["non-veg","protein-rich"],
    ingredients:[{name:"Eggs",qty:6,unit:"pcs"},{name:"Onion",qty:2,unit:"pcs"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Oil",qty:30,unit:"ml"},{name:"Garam Masala",qty:5,unit:"g"}]},
  { name:"Egg Fried Rice", meal_type:"lunch", servings:3, prep_time_mins:20, tags:["non-veg","quick","child-friendly"],
    ingredients:[{name:"Rice",qty:200,unit:"g"},{name:"Eggs",qty:2,unit:"pcs"},{name:"Onion",qty:1,unit:"pcs"},{name:"Oil",qty:20,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Egg Sandwich", meal_type:"breakfast", servings:2, prep_time_mins:10, tags:["non-veg","quick","child-friendly"],
    ingredients:[{name:"Eggs",qty:2,unit:"pcs"},{name:"Bread",qty:4,unit:"pcs"},{name:"Butter",qty:10,unit:"g"},{name:"Salt",qty:2,unit:"g"}]},
  { name:"Egg Paratha", meal_type:"breakfast", servings:2, prep_time_mins:20, tags:["non-veg","filling","child-friendly"],
    ingredients:[{name:"Eggs",qty:2,unit:"pcs"},{name:"Wheat Flour",qty:150,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Oil",qty:15,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Egg Salad", meal_type:"snack", servings:2, prep_time_mins:10, tags:["non-veg","healthy","quick"],
    ingredients:[{name:"Eggs",qty:3,unit:"pcs"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tomato",qty:1,unit:"pcs"},{name:"Salt",qty:2,unit:"g"}]},
  { name:"Scrambled Eggs", meal_type:"breakfast", servings:2, prep_time_mins:8, tags:["non-veg","quick","child-friendly"],
    ingredients:[{name:"Eggs",qty:3,unit:"pcs"},{name:"Butter",qty:10,unit:"g"},{name:"Milk",qty:30,unit:"ml"},{name:"Salt",qty:2,unit:"g"}]},

  // ── More Indian Breakfast ──────────────────────────────────────────────────
  { name:"Besan Chilla", meal_type:"breakfast", servings:2, prep_time_mins:15, tags:["vegetarian","quick","healthy"],
    ingredients:[{name:"Besan",qty:150,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Green Chilli",qty:1,unit:"pcs"},{name:"Oil",qty:15,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Sabudana Khichdi", meal_type:"breakfast", servings:2, prep_time_mins:20, tags:["vegetarian","fasting"],
    ingredients:[{name:"Sabudana",qty:150,unit:"g"},{name:"Potato",qty:1,unit:"pcs"},{name:"Peanuts",qty:50,unit:"g"},{name:"Oil",qty:15,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Vermicelli Upma", meal_type:"breakfast", servings:2, prep_time_mins:15, tags:["vegetarian","quick","child-friendly"],
    ingredients:[{name:"Vermicelli",qty:150,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Oil",qty:15,unit:"ml"},{name:"Mustard Seeds",qty:5,unit:"g"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Moong Dal Chilla", meal_type:"breakfast", servings:2, prep_time_mins:20, tags:["vegetarian","healthy","high-protein"],
    ingredients:[{name:"Moong Dal",qty:150,unit:"g"},{name:"Ginger",qty:10,unit:"g"},{name:"Green Chilli",qty:1,unit:"pcs"},{name:"Oil",qty:15,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Bread Upma", meal_type:"breakfast", servings:2, prep_time_mins:10, tags:["vegetarian","quick","leftover"],
    ingredients:[{name:"Bread",qty:4,unit:"pcs"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tomato",qty:1,unit:"pcs"},{name:"Oil",qty:15,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Pesarattu", meal_type:"breakfast", servings:3, prep_time_mins:25, tags:["vegetarian","healthy","south-indian"],
    ingredients:[{name:"Moong Dal",qty:200,unit:"g"},{name:"Ginger",qty:10,unit:"g"},{name:"Green Chilli",qty:2,unit:"pcs"},{name:"Oil",qty:20,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},

  // ── More Indian Lunch/Dinner ───────────────────────────────────────────────
  { name:"Matar Paneer", meal_type:"lunch", servings:4, prep_time_mins:35, tags:["vegetarian","child-friendly"],
    ingredients:[{name:"Paneer",qty:200,unit:"g"},{name:"Green Peas",qty:150,unit:"g"},{name:"Tomato",qty:3,unit:"pcs"},{name:"Onion",qty:2,unit:"pcs"},{name:"Oil",qty:30,unit:"ml"}]},
  { name:"Shahi Paneer", meal_type:"dinner", servings:4, prep_time_mins:40, tags:["vegetarian","rich","special"],
    ingredients:[{name:"Paneer",qty:250,unit:"g"},{name:"Cream",qty:50,unit:"ml"},{name:"Cashews",qty:30,unit:"g"},{name:"Onion",qty:2,unit:"pcs"},{name:"Tomato",qty:2,unit:"pcs"}]},
  { name:"Kadai Paneer", meal_type:"dinner", servings:4, prep_time_mins:35, tags:["vegetarian","spicy"],
    ingredients:[{name:"Paneer",qty:250,unit:"g"},{name:"Capsicum",qty:2,unit:"pcs"},{name:"Tomato",qty:3,unit:"pcs"},{name:"Onion",qty:2,unit:"pcs"},{name:"Oil",qty:30,unit:"ml"}]},
  { name:"Palak Paneer", meal_type:"dinner", servings:4, prep_time_mins:35, tags:["vegetarian","healthy"],
    ingredients:[{name:"Paneer",qty:200,unit:"g"},{name:"Spinach",qty:300,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Oil",qty:25,unit:"ml"}]},
  { name:"Aloo Matar", meal_type:"lunch", servings:4, prep_time_mins:25, tags:["vegetarian","quick"],
    ingredients:[{name:"Potato",qty:300,unit:"g"},{name:"Green Peas",qty:150,unit:"g"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Onion",qty:1,unit:"pcs"},{name:"Oil",qty:25,unit:"ml"}]},
  { name:"Baingan Bharta", meal_type:"dinner", servings:3, prep_time_mins:40, tags:["vegetarian","smoky"],
    ingredients:[{name:"Baingan",qty:500,unit:"g"},{name:"Onion",qty:2,unit:"pcs"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Oil",qty:25,unit:"ml"},{name:"Garlic",qty:5,unit:"pcs"}]},
  { name:"Methi Thepla", meal_type:"breakfast", servings:3, prep_time_mins:25, tags:["vegetarian","healthy","gujarati"],
    ingredients:[{name:"Wheat Flour",qty:200,unit:"g"},{name:"Methi Leaves",qty:100,unit:"g"},{name:"Curd",qty:50,unit:"g"},{name:"Oil",qty:20,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Veg Pulao", meal_type:"lunch", servings:4, prep_time_mins:30, tags:["vegetarian","one-pot"],
    ingredients:[{name:"Basmati Rice",qty:300,unit:"g"},{name:"Mixed Vegetables",qty:200,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Ghee",qty:20,unit:"ml"},{name:"Bay Leaf",qty:2,unit:"pcs"}]},
  { name:"Vegetable Biryani", meal_type:"lunch", servings:4, prep_time_mins:60, tags:["vegetarian","special","festive"],
    ingredients:[{name:"Basmati Rice",qty:300,unit:"g"},{name:"Mixed Vegetables",qty:250,unit:"g"},{name:"Onion",qty:2,unit:"pcs"},{name:"Curd",qty:100,unit:"g"},{name:"Ghee",qty:30,unit:"ml"}]},
  { name:"Pav Bhaji", meal_type:"dinner", servings:4, prep_time_mins:40, tags:["vegetarian","street-food","child-friendly"],
    ingredients:[{name:"Potato",qty:400,unit:"g"},{name:"Mixed Vegetables",qty:200,unit:"g"},{name:"Tomato",qty:3,unit:"pcs"},{name:"Butter",qty:40,unit:"g"},{name:"Pav",qty:8,unit:"pcs"}]},
  { name:"Misal Pav", meal_type:"lunch", servings:3, prep_time_mins:35, tags:["vegetarian","spicy","maharashtrian"],
    ingredients:[{name:"Moong Sprouts",qty:200,unit:"g"},{name:"Onion",qty:2,unit:"pcs"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Oil",qty:25,unit:"ml"},{name:"Pav",qty:6,unit:"pcs"}]},
  { name:"Sambar Rice", meal_type:"lunch", servings:4, prep_time_mins:35, tags:["vegetarian","south-indian","healthy"],
    ingredients:[{name:"Rice",qty:300,unit:"g"},{name:"Toor Dal",qty:100,unit:"g"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tamarind",qty:20,unit:"g"}]},
  { name:"Rasam Rice", meal_type:"dinner", servings:3, prep_time_mins:25, tags:["vegetarian","south-indian","comfort"],
    ingredients:[{name:"Rice",qty:200,unit:"g"},{name:"Toor Dal",qty:50,unit:"g"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Tamarind",qty:15,unit:"g"},{name:"Ghee",qty:15,unit:"ml"}]},
  { name:"Lemon Rice", meal_type:"lunch", servings:3, prep_time_mins:20, tags:["vegetarian","south-indian","quick"],
    ingredients:[{name:"Rice",qty:200,unit:"g"},{name:"Lemon",qty:2,unit:"pcs"},{name:"Peanuts",qty:30,unit:"g"},{name:"Mustard Seeds",qty:5,unit:"g"},{name:"Oil",qty:15,unit:"ml"}]},
  { name:"Curd Rice", meal_type:"dinner", servings:3, prep_time_mins:15, tags:["vegetarian","cooling","south-indian","child-friendly"],
    ingredients:[{name:"Rice",qty:200,unit:"g"},{name:"Curd",qty:200,unit:"g"},{name:"Milk",qty:50,unit:"ml"},{name:"Mustard Seeds",qty:5,unit:"g"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Kadhi Pakora", meal_type:"lunch", servings:4, prep_time_mins:40, tags:["vegetarian","comfort","north-indian"],
    ingredients:[{name:"Besan",qty:100,unit:"g"},{name:"Curd",qty:300,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Oil",qty:30,unit:"ml"},{name:"Mustard Seeds",qty:5,unit:"g"}]},
  { name:"Chana Masala", meal_type:"lunch", servings:4, prep_time_mins:40, tags:["vegetarian","protein-rich"],
    ingredients:[{name:"Kabuli Chana",qty:250,unit:"g"},{name:"Onion",qty:2,unit:"pcs"},{name:"Tomato",qty:3,unit:"pcs"},{name:"Oil",qty:30,unit:"ml"},{name:"Garam Masala",qty:5,unit:"g"}]},
  { name:"Matar Mushroom", meal_type:"dinner", servings:3, prep_time_mins:30, tags:["vegetarian"],
    ingredients:[{name:"Mushroom",qty:200,unit:"g"},{name:"Green Peas",qty:100,unit:"g"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Onion",qty:1,unit:"pcs"},{name:"Oil",qty:25,unit:"ml"}]},
  { name:"Veg Kofta Curry", meal_type:"dinner", servings:4, prep_time_mins:50, tags:["vegetarian","rich","special"],
    ingredients:[{name:"Potato",qty:200,unit:"g"},{name:"Paneer",qty:100,unit:"g"},{name:"Besan",qty:50,unit:"g"},{name:"Tomato",qty:3,unit:"pcs"},{name:"Cream",qty:50,unit:"ml"}]},

  // ── Roti / Bread varieties ─────────────────────────────────────────────────
  { name:"Paneer Paratha", meal_type:"breakfast", servings:2, prep_time_mins:25, tags:["vegetarian","filling","punjabi","child-friendly"],
    ingredients:[{name:"Wheat Flour",qty:200,unit:"g"},{name:"Paneer",qty:150,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Green Chilli",qty:1,unit:"pcs"},{name:"Butter",qty:20,unit:"g"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Gobi Paratha", meal_type:"breakfast", servings:2, prep_time_mins:25, tags:["vegetarian","punjabi","child-friendly"],
    ingredients:[{name:"Wheat Flour",qty:200,unit:"g"},{name:"Cauliflower",qty:200,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Green Chilli",qty:1,unit:"pcs"},{name:"Butter",qty:20,unit:"g"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Mooli Paratha", meal_type:"breakfast", servings:2, prep_time_mins:25, tags:["vegetarian","punjabi","winter"],
    ingredients:[{name:"Wheat Flour",qty:200,unit:"g"},{name:"Mooli",qty:200,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Green Chilli",qty:1,unit:"pcs"},{name:"Oil",qty:15,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Dal Paratha", meal_type:"breakfast", servings:2, prep_time_mins:30, tags:["vegetarian","protein-rich","filling"],
    ingredients:[{name:"Wheat Flour",qty:200,unit:"g"},{name:"Toor Dal",qty:100,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Green Chilli",qty:1,unit:"pcs"},{name:"Oil",qty:15,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Onion Paratha", meal_type:"breakfast", servings:2, prep_time_mins:20, tags:["vegetarian","quick","punjabi"],
    ingredients:[{name:"Wheat Flour",qty:200,unit:"g"},{name:"Onion",qty:2,unit:"pcs"},{name:"Green Chilli",qty:1,unit:"pcs"},{name:"Oil",qty:15,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Roti / Chapati", meal_type:"dinner", servings:3, prep_time_mins:20, tags:["vegetarian","everyday","staple","child-friendly"],
    ingredients:[{name:"Wheat Flour",qty:250,unit:"g"},{name:"Water",qty:150,unit:"ml"},{name:"Ghee",qty:15,unit:"ml"},{name:"Salt",qty:2,unit:"g"}]},
  { name:"Phulka", meal_type:"dinner", servings:3, prep_time_mins:20, tags:["vegetarian","healthy","no-oil","everyday"],
    ingredients:[{name:"Wheat Flour",qty:250,unit:"g"},{name:"Water",qty:150,unit:"ml"},{name:"Salt",qty:2,unit:"g"}]},
  { name:"Butter Roti", meal_type:"dinner", servings:3, prep_time_mins:20, tags:["vegetarian","rich","child-friendly"],
    ingredients:[{name:"Wheat Flour",qty:250,unit:"g"},{name:"Butter",qty:30,unit:"g"},{name:"Water",qty:150,unit:"ml"},{name:"Salt",qty:2,unit:"g"}]},
  { name:"Tandoori Roti", meal_type:"dinner", servings:3, prep_time_mins:25, tags:["vegetarian","restaurant-style"],
    ingredients:[{name:"Wheat Flour",qty:200,unit:"g"},{name:"Maida",qty:50,unit:"g"},{name:"Curd",qty:30,unit:"g"},{name:"Butter",qty:20,unit:"g"},{name:"Salt",qty:2,unit:"g"}]},
  { name:"Makki di Roti", meal_type:"dinner", servings:3, prep_time_mins:25, tags:["vegetarian","winter","punjabi","gluten-free"],
    ingredients:[{name:"Makki Atta",qty:250,unit:"g"},{name:"Water",qty:150,unit:"ml"},{name:"Butter",qty:20,unit:"g"},{name:"Salt",qty:2,unit:"g"}]},
  { name:"Bajra Roti", meal_type:"dinner", servings:3, prep_time_mins:20, tags:["vegetarian","healthy","gluten-free","rajasthani"],
    ingredients:[{name:"Bajra Flour",qty:250,unit:"g"},{name:"Water",qty:150,unit:"ml"},{name:"Ghee",qty:15,unit:"ml"},{name:"Salt",qty:2,unit:"g"}]},
  { name:"Missi Roti", meal_type:"breakfast", servings:3, prep_time_mins:20, tags:["vegetarian","healthy","punjabi"],
    ingredients:[{name:"Wheat Flour",qty:150,unit:"g"},{name:"Besan",qty:50,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Oil",qty:15,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Stuffed Paratha", meal_type:"breakfast", servings:2, prep_time_mins:25, tags:["vegetarian","filling","punjabi"],
    ingredients:[{name:"Wheat Flour",qty:200,unit:"g"},{name:"Potato",qty:200,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Butter",qty:20,unit:"g"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Puri Bhaji", meal_type:"breakfast", servings:3, prep_time_mins:30, tags:["vegetarian","festive","child-friendly"],
    ingredients:[{name:"Wheat Flour",qty:200,unit:"g"},{name:"Potato",qty:300,unit:"g"},{name:"Oil",qty:200,unit:"ml"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Salt",qty:3,unit:"g"}]},

  // ── Snacks & Munchies ──────────────────────────────────────────────────────
  { name:"Masala Chai", meal_type:"snack", servings:2, prep_time_mins:8, tags:["vegetarian","quick","beverage"],
    ingredients:[{name:"Tea",qty:10,unit:"g"},{name:"Milk",qty:300,unit:"ml"},{name:"Ginger",qty:5,unit:"g"},{name:"Sugar",qty:20,unit:"g"},{name:"Cardamom",qty:2,unit:"pcs"}]},
  { name:"Cold Coffee", meal_type:"snack", servings:2, prep_time_mins:5, tags:["vegetarian","cold","beverage","child-friendly"],
    ingredients:[{name:"Coffee",qty:10,unit:"g"},{name:"Milk",qty:400,unit:"ml"},{name:"Sugar",qty:30,unit:"g"},{name:"Ice",qty:100,unit:"g"}]},
  { name:"Mango Lassi", meal_type:"snack", servings:2, prep_time_mins:5, tags:["vegetarian","cold","beverage","refreshing"],
    ingredients:[{name:"Mango",qty:200,unit:"g"},{name:"Curd",qty:200,unit:"g"},{name:"Sugar",qty:20,unit:"g"},{name:"Milk",qty:100,unit:"ml"}]},
  { name:"Nimbu Pani", meal_type:"snack", servings:2, prep_time_mins:5, tags:["vegetarian","cold","beverage","summer","quick"],
    ingredients:[{name:"Lemon",qty:2,unit:"pcs"},{name:"Sugar",qty:30,unit:"g"},{name:"Salt",qty:2,unit:"g"},{name:"Mint",qty:5,unit:"g"}]},
  { name:"Chaas (Buttermilk)", meal_type:"snack", servings:2, prep_time_mins:5, tags:["vegetarian","cooling","quick","summer"],
    ingredients:[{name:"Curd",qty:200,unit:"g"},{name:"Jeera",qty:3,unit:"g"},{name:"Salt",qty:2,unit:"g"},{name:"Mint",qty:5,unit:"g"}]},
  { name:"Banana Shake", meal_type:"snack", servings:2, prep_time_mins:5, tags:["vegetarian","child-friendly","quick"],
    ingredients:[{name:"Banana",qty:2,unit:"pcs"},{name:"Milk",qty:400,unit:"ml"},{name:"Sugar",qty:20,unit:"g"}]},
  { name:"Aloo Chaat", meal_type:"snack", servings:2, prep_time_mins:15, tags:["vegetarian","street-food","tangy"],
    ingredients:[{name:"Potato",qty:300,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tomato",qty:1,unit:"pcs"},{name:"Chaat Masala",qty:5,unit:"g"},{name:"Lemon",qty:1,unit:"pcs"}]},
  { name:"Bhel Puri", meal_type:"snack", servings:2, prep_time_mins:10, tags:["vegetarian","street-food","tangy","quick"],
    ingredients:[{name:"Puffed Rice",qty:100,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tomato",qty:1,unit:"pcs"},{name:"Tamarind Chutney",qty:30,unit:"ml"},{name:"Sev",qty:30,unit:"g"}]},
  { name:"Sev Puri", meal_type:"snack", servings:2, prep_time_mins:10, tags:["vegetarian","street-food","mumbai"],
    ingredients:[{name:"Puri",qty:12,unit:"pcs"},{name:"Potato",qty:150,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Sev",qty:40,unit:"g"},{name:"Tamarind Chutney",qty:30,unit:"ml"}]},
  { name:"Dahi Puri", meal_type:"snack", servings:2, prep_time_mins:10, tags:["vegetarian","street-food","chaat"],
    ingredients:[{name:"Puri",qty:12,unit:"pcs"},{name:"Curd",qty:150,unit:"g"},{name:"Potato",qty:100,unit:"g"},{name:"Tamarind Chutney",qty:30,unit:"ml"},{name:"Sev",qty:30,unit:"g"}]},
  { name:"Samosa", meal_type:"snack", servings:4, prep_time_mins:45, tags:["vegetarian","fried","street-food","tea-time"],
    ingredients:[{name:"Maida",qty:200,unit:"g"},{name:"Potato",qty:300,unit:"g"},{name:"Green Peas",qty:50,unit:"g"},{name:"Oil",qty:200,unit:"ml"},{name:"Garam Masala",qty:5,unit:"g"}]},
  { name:"Pakora", meal_type:"snack", servings:3, prep_time_mins:20, tags:["vegetarian","fried","monsoon","tea-time"],
    ingredients:[{name:"Besan",qty:150,unit:"g"},{name:"Onion",qty:2,unit:"pcs"},{name:"Green Chilli",qty:2,unit:"pcs"},{name:"Oil",qty:200,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Bread Pakora", meal_type:"snack", servings:2, prep_time_mins:15, tags:["vegetarian","fried","quick","child-friendly"],
    ingredients:[{name:"Bread",qty:4,unit:"pcs"},{name:"Besan",qty:100,unit:"g"},{name:"Potato",qty:100,unit:"g"},{name:"Oil",qty:150,unit:"ml"},{name:"Salt",qty:3,unit:"g"}]},
  { name:"Dhokla", meal_type:"snack", servings:4, prep_time_mins:30, tags:["vegetarian","steamed","gujarati","healthy"],
    ingredients:[{name:"Besan",qty:200,unit:"g"},{name:"Curd",qty:100,unit:"g"},{name:"Eno",qty:5,unit:"g"},{name:"Mustard Seeds",qty:5,unit:"g"},{name:"Sugar",qty:10,unit:"g"}]},
  { name:"Popcorn", meal_type:"snack", servings:2, prep_time_mins:5, tags:["vegetarian","quick","movie-snack","child-friendly"],
    ingredients:[{name:"Corn Kernels",qty:100,unit:"g"},{name:"Oil",qty:15,unit:"ml"},{name:"Salt",qty:3,unit:"g"},{name:"Butter",qty:10,unit:"g"}]},
  { name:"Nachos with Salsa", meal_type:"snack", servings:2, prep_time_mins:5, tags:["vegetarian","quick","party","munchies"],
    ingredients:[{name:"Nachos",qty:150,unit:"g"},{name:"Tomato",qty:2,unit:"pcs"},{name:"Onion",qty:1,unit:"pcs"},{name:"Lemon",qty:1,unit:"pcs"},{name:"Cheese",qty:30,unit:"g"}]},
  { name:"Chips & Dip", meal_type:"snack", servings:2, prep_time_mins:5, tags:["quick","munchies","party","no-cook"],
    ingredients:[{name:"Potato Chips",qty:100,unit:"g"},{name:"Curd",qty:100,unit:"g"},{name:"Mint",qty:5,unit:"g"},{name:"Salt",qty:2,unit:"g"}]},
  { name:"Maggi Noodles", meal_type:"snack", servings:2, prep_time_mins:8, tags:["quick","child-friendly","comfort","munchies"],
    ingredients:[{name:"Maggi Noodles",qty:2,unit:"pack"},{name:"Butter",qty:10,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tomato",qty:1,unit:"pcs"}]},
  { name:"Masala Maggi", meal_type:"snack", servings:2, prep_time_mins:12, tags:["quick","spicy","child-friendly","munchies"],
    ingredients:[{name:"Maggi Noodles",qty:2,unit:"pack"},{name:"Onion",qty:1,unit:"pcs"},{name:"Tomato",qty:1,unit:"pcs"},{name:"Green Chilli",qty:1,unit:"pcs"},{name:"Butter",qty:10,unit:"g"}]},
  { name:"Upma Poha Mix", meal_type:"snack", servings:2, prep_time_mins:15, tags:["vegetarian","quick","light"],
    ingredients:[{name:"Poha",qty:100,unit:"g"},{name:"Rava",qty:50,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Oil",qty:15,unit:"ml"},{name:"Mustard Seeds",qty:5,unit:"g"}]},
  { name:"Makhana Snack", meal_type:"snack", servings:2, prep_time_mins:8, tags:["vegetarian","healthy","roasted","munchies"],
    ingredients:[{name:"Makhana",qty:100,unit:"g"},{name:"Ghee",qty:10,unit:"ml"},{name:"Salt",qty:2,unit:"g"},{name:"Black Pepper",qty:2,unit:"g"}]},
  { name:"Roasted Chana", meal_type:"snack", servings:2, prep_time_mins:5, tags:["vegetarian","healthy","protein","no-cook"],
    ingredients:[{name:"Roasted Chana",qty:100,unit:"g"},{name:"Lemon",qty:1,unit:"pcs"},{name:"Chaat Masala",qty:3,unit:"g"}]},
  { name:"Fruit Chaat", meal_type:"snack", servings:2, prep_time_mins:8, tags:["vegetarian","healthy","refreshing","no-cook"],
    ingredients:[{name:"Apple",qty:1,unit:"pcs"},{name:"Banana",qty:1,unit:"pcs"},{name:"Pomegranate",qty:100,unit:"g"},{name:"Chaat Masala",qty:3,unit:"g"},{name:"Lemon",qty:1,unit:"pcs"}]},
  { name:"Cold Drink Float", meal_type:"snack", servings:1, prep_time_mins:3, tags:["cold","party","child-friendly","munchies"],
    ingredients:[{name:"Cold Drink",qty:1,unit:"bottle"},{name:"Vanilla Ice Cream",qty:2,unit:"scoop"}]},
  { name:"Shikanji", meal_type:"snack", servings:2, prep_time_mins:5, tags:["vegetarian","cold","summer","refreshing"],
    ingredients:[{name:"Lemon",qty:3,unit:"pcs"},{name:"Sugar",qty:40,unit:"g"},{name:"Black Salt",qty:3,unit:"g"},{name:"Cumin Powder",qty:2,unit:"g"},{name:"Mint",qty:5,unit:"g"}]},
  { name:"Aam Panna", meal_time:"snack", meal_type:"snack", servings:2, prep_time_mins:15, tags:["vegetarian","summer","cooling","raw-mango"],
    ingredients:[{name:"Raw Mango",qty:200,unit:"g"},{name:"Sugar",qty:50,unit:"g"},{name:"Mint",qty:10,unit:"g"},{name:"Black Salt",qty:3,unit:"g"},{name:"Cumin Powder",qty:2,unit:"g"}]},
  { name:"Thandai", meal_type:"snack", servings:2, prep_time_mins:10, tags:["vegetarian","festive","cold","holi"],
    ingredients:[{name:"Milk",qty:400,unit:"ml"},{name:"Almonds",qty:20,unit:"g"},{name:"Sugar",qty:40,unit:"g"},{name:"Cardamom",qty:3,unit:"pcs"},{name:"Rose Water",qty:10,unit:"ml"}]},
  { name:"Veg Chowmein", meal_type:"lunch", servings:3, prep_time_mins:20, tags:["vegetarian","indo-chinese","quick"],
    ingredients:[{name:"Noodles",qty:200,unit:"g"},{name:"Cabbage",qty:100,unit:"g"},{name:"Carrot",qty:1,unit:"pcs"},{name:"Capsicum",qty:1,unit:"pcs"},{name:"Soy Sauce",qty:30,unit:"ml"},{name:"Oil",qty:20,unit:"ml"}]},
  { name:"Veg Noodles", meal_type:"dinner", servings:3, prep_time_mins:20, tags:["vegetarian","indo-chinese","quick"],
    ingredients:[{name:"Noodles",qty:200,unit:"g"},{name:"Onion",qty:1,unit:"pcs"},{name:"Capsicum",qty:1,unit:"pcs"},{name:"Soy Sauce",qty:30,unit:"ml"},{name:"Vinegar",qty:10,unit:"ml"},{name:"Oil",qty:20,unit:"ml"}]},
  { name:"Veg Fried Rice", meal_type:"lunch", servings:3, prep_time_mins:25, tags:["vegetarian","indo-chinese"],
    ingredients:[{name:"Rice",qty:200,unit:"g"},{name:"Carrot",qty:1,unit:"pcs"},{name:"Peas",qty:50,unit:"g"},{name:"Capsicum",qty:1,unit:"pcs"},{name:"Soy Sauce",qty:20,unit:"ml"},{name:"Oil",qty:20,unit:"ml"}]},
  { name:"Momos", meal_type:"snack", servings:4, prep_time_mins:45, tags:["vegetarian","indo-chinese"],
    ingredients:[{name:"Maida",qty:200,unit:"g"},{name:"Cabbage",qty:150,unit:"g"},{name:"Carrot",qty:1,unit:"pcs"},{name:"Onion",qty:1,unit:"pcs"},{name:"Ginger",qty:10,unit:"g"},{name:"Oil",qty:10,unit:"ml"}]},
  { name:"Manchurian", meal_type:"dinner", servings:4, prep_time_mins:35, tags:["vegetarian","indo-chinese"],
    ingredients:[{name:"Cauliflower",qty:400,unit:"g"},{name:"Maida",qty:50,unit:"g"},{name:"Soy Sauce",qty:30,unit:"ml"},{name:"Garlic",qty:4,unit:"pcs"},{name:"Green Chilli",qty:2,unit:"pcs"},{name:"Oil",qty:30,unit:"ml"}]},
];

const seedRecipes = async (familyId) => {
  const { data: existing } = await supabase.from("recipes").select("id,name").eq("family_id", familyId);
  // Check all latest recipes present - if yes skip entirely
  const names = new Set((existing||[]).map(r => r.name));
  const requiredRecipes = ["Boiled Eggs","Maggi Noodles","Roti / Chapati","Paneer Paratha","Mix Dal","Thandai","Panchmel Dal","Sprouts Salad","Turmeric Milk","Mango Shake","Pasta Arrabiata","Hakka Noodles","Medu Vada","Pongal","Mac and Cheese"];
  const allPresent = requiredRecipes.every(n => names.has(n));
  if (allPresent) return;
  // Only seed recipes that don't already exist (no duplicates)
  const existingNames = new Set((existing||[]).map(r => r.name.toLowerCase()));
  for (const r of SEED_RECIPES) {
    // Skip if already exists
    if (existingNames.has(r.name.toLowerCase())) continue;
    const { data: rec } = await supabase.from("recipes").insert([{
      family_id: familyId, name: r.name, meal_type: r.meal_type,
      servings: r.servings, prep_time_mins: r.prep_time_mins, tags: r.tags, instructions: "",
    }]).select().single();
    if (rec?.id) {
      await supabase.from("recipe_ingredients").insert(
        r.ingredients.map(i => ({ recipe_id: rec.id, pantry_item_name: i.name, quantity: i.qty, unit: i.unit }))
      );
    }
  }
};

const markMealCooked = async (familyId, mealPlanRow, recipes, pantryRows) => {
  const recipe = recipes.find(r => r.id === mealPlanRow.recipe_id);
  if (!recipe) return { deducted: [] };
  const { data: ingredients } = await supabase.from("recipe_ingredients").select("*").eq("recipe_id", recipe.id);
  if (!ingredients?.length) return { deducted: [] };
  const ratio = (mealPlanRow.servings_cooked || 3) / (recipe.servings || 3);
  const deducted = [];
  const lowStockItems = [];
  for (const ing of ingredients) {
    const needed = ing.quantity * ratio;
    const pantryItem = pantryRows.find(p => p.name.toLowerCase() === ing.pantry_item_name.toLowerCase());
    if (pantryItem) {
      const newQty = Math.max(0, Number(pantryItem.quantity) - needed);
      await supabase.from("pantry").update({ quantity: newQty, updated_at: new Date().toISOString() }).eq("id", pantryItem.id);
      await supabase.from("consumption_log").insert([{
        family_id: familyId, meal_plan_id: mealPlanRow.id,
        pantry_item_name: ing.pantry_item_name, quantity_used: needed, unit: ing.unit,
        logged_at: new Date().toISOString(),
      }]);
      deducted.push({ name: ing.pantry_item_name, used: needed, unit: ing.unit, remaining: newQty });
      if (newQty <= Number(pantryItem.par_level)) {
        lowStockItems.push({ name: pantryItem.name, qty: newQty, unit: pantryItem.unit, category: pantryItem.category });
      }
    }
  }
  await supabase.from("meal_plan").update({ cooked: true, cooked_at: new Date().toISOString() }).eq("id", mealPlanRow.id);
  for (const item of lowStockItems) {
    const { data: existing } = await supabase.from("shopping_list").select("id").eq("family_id", familyId).eq("item_name", item.name).eq("purchased", false);
    if (!existing?.length) {
      await supabase.from("shopping_list").insert([{
        family_id: familyId, item_name: item.name, quantity_needed: item.qty <= 0 ? 1 : item.qty,
        unit: item.unit, category: item.category, purchased: false,
      }]);
    }
  }
  return { deducted, lowStockItems };
};


// ─── COOK LOG FORM ────────────────────────────────────────────────────────────
const CookLogForm = ({ meal, recipe, familyId, recipes, pantry, onDone, onClose }) => {
  const name_ = (recipe?.name || "").toLowerCase();
  const isDrink = name_.includes("coffee") || name_.includes("tea") || name_.includes("chai") || name_.includes("juice") || name_.includes("shake") || name_.includes("smoothie") || name_.includes("milk") || name_.includes("lassi");
  const unitOptions = isDrink
    ? ["glasses","cups","ml","servings"]
    : recipe?.meal_type === "breakfast"
    ? ["paranthas","idlis","dosas","chillas","portions","pieces","cups","plates"]
    : ["portions","bowls","servings","cups","plates","pieces"];
  const [qty, setQty] = useState(recipe?.servings || 3);
  const [unit, setUnit] = useState(unitOptions[0]);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(1);
  const [guests, setGuests] = useState(0);
  const [leftovers, setLeftovers] = useState(0);

  const inputStyle = {width:"100%",padding:"11px 13px",borderRadius:12,border:`0.5px solid ${T.border}`,background:"#FAFAF8",color:T.text,fontSize:14,fontFamily:"'Plus Jakarta Sans',sans-serif",boxSizing:"border-box",fontWeight:500};
  const labelStyle = {fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5,display:"block"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}>
          <label style={labelStyle}>Quantity Made</label>
          <input type="number" style={inputStyle} value={qty} min={1} onChange={e=>setQty(Number(e.target.value))}/>
        </div>
        <div style={{flex:1}}>
          <label style={labelStyle}>Unit</label>
          <select style={inputStyle} value={unit} onChange={e=>setUnit(e.target.value)}>
            {unitOptions.map(u=><option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div style={{padding:"8px 12px",background:T.greenSoft,borderRadius:10,fontSize:12,color:T.green,fontWeight:600}}>
        📦 Pantry will auto-deduct based on {qty} {unit}
      </div>
      <button onClick={()=>onDone({quantityMade:qty,unitLabel:unit,adults:2,children:1,guests:0,leftovers:0})}
        className="btn-primary">
        ✅ Log Meal
      </button>
    </div>
  );
};

// ─── ENHANCED COOK LOG FORM WITH NUTRITION ───────────────────────────────────
const NutritionCookLog = ({ meal, recipe, familyId, onDone }) => {
  const name_ = (recipe?.name || "").toLowerCase();
  const isDrink = name_.includes("coffee") || name_.includes("tea") || name_.includes("chai") || name_.includes("juice") || name_.includes("shake") || name_.includes("smoothie") || name_.includes("milk") || name_.includes("lassi");
  const unitOptions = isDrink
    ? ["glasses","cups","ml","servings"]
    : recipe?.meal_type === "breakfast"
    ? ["paranthas","idlis","dosas","chillas","portions","pieces","cups","plates"]
    : ["portions","bowls","servings","cups","plates","pieces"];
  const [qty, setQty] = useState(recipe?.servings || 3);
  const [unit, setUnit] = useState(unitOptions[0]);
  const [portions, setPortions] = useState({ Mayank: 1, Simmi: 1, Veda: 1 });
  const [logging, setLogging] = useState(false);

  const handleLog = async () => {
    setLogging(true);
    try {
      let nutrition = { calories: 300, protein: 10, carbs: 40, fat: 8, fiber: 3 };
      try {
        const prompt = `Estimate nutrition per portion for Indian dish "${recipe?.name || "mixed meal"}". Return ONLY JSON no markdown: {"calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0}`;
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + process.env.REACT_APP_GROQ_API_KEY },
          body: JSON.stringify({ model: "llama-3.1-8b-instant", max_tokens: 80, messages: [{ role: "user", content: prompt }] })
        });
        const data = await res.json();
        const text = (data.choices?.[0]?.message?.content || "{}").replace(/```json|```/g,"").trim();
        nutrition = JSON.parse(text);
      } catch(e) { console.log("Using default nutrition"); }
      const today_ = new Date().toISOString().split("T")[0];
      for (const m of MEMBERS) {
        const p = portions[m];
        if (p > 0) {
          await supabase.from("nutrition_logs").insert([{
            family_id: familyId, member: m, meal_type: meal.meal_type, meal_date: today_,
            food_description: recipe?.name || meal.meal_type,
            calories: Math.round((nutrition.calories||0)*p),
            protein: Math.round((nutrition.protein||0)*p*10)/10,
            carbs: Math.round((nutrition.carbs||0)*p*10)/10,
            fat: Math.round((nutrition.fat||0)*p*10)/10,
            fiber: Math.round((nutrition.fiber||0)*p*10)/10,
          }]);
        }
      }
      sendEmail("meal_logged", {
        recipe_name: recipe?.name || meal.meal_type,
        meal_type: meal.meal_type,
        portions_mayank: portions.Mayank,
        portions_simmi: portions.Simmi,
        portions_veda: portions.Veda,
      });
      onDone({ quantityMade: qty, unitLabel: unit, adults: 2, children: 1, guests: 0, leftovers: 0 });
    } catch(e) { console.error(e); }
    setLogging(false);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}>
          <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5}}>Quantity Made</div>
          <input className="input" type="number" value={qty} min={1} onChange={e=>setQty(Number(e.target.value))}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5}}>Unit</div>
          <select className="input" value={unit} onChange={e=>setUnit(e.target.value)}>
            {unitOptions.map(u=><option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div>
        <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>Who Ate How Many?</div>
        {MEMBERS.map(m=>(
          <div key={m} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(255,255,255,0.04)",borderRadius:10,marginBottom:6}}>
            <span style={{fontSize:16}}>{MEMBER_EMOJI[m]}</span>
            <span style={{flex:1,fontSize:14,fontWeight:600}}>{m}</span>
            <div onClick={()=>setPortions(p=>({...p,[m]:Math.max(0,p[m]-0.5)}))} style={{width:28,height:28,borderRadius:8,background:T.card,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,fontWeight:700}}>−</div>
            <span style={{fontSize:16,fontWeight:700,minWidth:24,textAlign:"center"}}>{portions[m]}</span>
            <div onClick={()=>setPortions(p=>({...p,[m]:p[m]+0.5}))} style={{width:28,height:28,borderRadius:8,background:T.card,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,fontWeight:700}}>+</div>
          </div>
        ))}
      </div>
      <div style={{padding:"8px 12px",background:T.greenSoft,borderRadius:10,fontSize:12,color:T.green,fontWeight:600}}>
        📦 Pantry auto-deducts · 🤖 AI estimates nutrition per person
      </div>
      <button onClick={handleLog} disabled={logging} className="btn-primary">
        {logging ? "🤖 Analysing nutrition..." : "✅ Log Meal & Track Nutrition"}
      </button>
    </div>
  );
};



// ─── MEAL PICKER SEARCH ───────────────────────────────────────────────────────
const MEAL_TYPE_EMOJI = {breakfast:"🌅",lunch:"☀️",dinner:"🌙",snack:"🍎",dessert:"🍮"};
const MealPickerSearch = ({ recipes, defaultMealType, onSelect, familyId, selectedRecipeIds = [], onDone }) => {
  const [query, setQuery] = useState("");
  const [recentNames, setRecentNames] = useState([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("cook_logs")
        .select("recipe_name").eq("family_id", familyId)
        .order("cooked_at", {ascending:false}).limit(20);
      if (data) {
        const seen = new Set();
        const names = [];
        data.forEach(d => { if (!seen.has(d.recipe_name)) { seen.add(d.recipe_name); names.push(d.recipe_name); } });
        setRecentNames(names.slice(0,6));
      }
    };
    load();
  }, [familyId]);

  const results = React.useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase()
      .replace(/paratha/g,"parantha").replace(/aata/g,"atta").replace(/gobhi/g,"gobhi");
    return recipes.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.tags||[]).some(t => t.toLowerCase().includes(q)) ||
      r.meal_type.toLowerCase().includes(q)
    ).sort((a,b) => a.name.localeCompare(b.name));
  }, [recipes, query]);

  const recentRecipes = recentNames.map(n => recipes.find(r=>r.name===n)).filter(Boolean);
  const showRecent = !query.trim() && recentRecipes.length > 0;

  return (
    <div>
      <div style={{position:"relative",marginBottom:12}}>
        <input
          className="input"
          placeholder="🔍 Search any recipe — no restrictions..."
          value={query}
          onChange={e=>setQuery(e.target.value)}
          autoFocus
          style={{paddingLeft:14,fontSize:14,background:"#FFFFFF",color:"#2D2721",border:`1px solid ${T.border}`}}
        />
        {query && <span onClick={()=>setQuery("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:13,color:T.muted,fontWeight:700}}>✕</span>}
      </div>

      {showRecent && (
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>⭐ Recently Cooked</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {recentRecipes.map(r => {
              const isSelected = selectedRecipeIds.includes(r.id);
              return (
                <div key={r.id} onClick={()=>onSelect(r)}
                  className="card card-tap" style={{padding:"10px 13px",marginBottom:0,display:"flex",justifyContent:"space-between",alignItems:"center",borderColor:isSelected?T.green:T.border,background:isSelected?"rgba(109,155,107,0.08)":"transparent"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:T.text}}>{r.name}</div>
                    <div style={{fontSize:11,color:T.muted,marginTop:1}}>{MEAL_TYPE_EMOJI[r.meal_type]} {r.meal_type} · ⏱ {r.prep_time_mins}min</div>
                  </div>
                  <span style={{fontSize:13,color:isSelected?T.green:T.accent,fontWeight:700}}>{isSelected?"✓ Added":"+ Add"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!showRecent && query.trim() && (
        <>
          <div style={{fontSize:11,color:T.muted,marginBottom:8}}>{results.length} recipes found</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:"55vh",overflowY:"auto"}}>
            {results.map(r => {
              const isSelected = selectedRecipeIds.includes(r.id);
              return (
                <div key={r.id} onClick={()=>onSelect(r)}
                  className="card card-tap" style={{padding:"11px 13px",marginBottom:0,display:"flex",justifyContent:"space-between",alignItems:"center",borderColor:isSelected?T.green:T.border,background:isSelected?"rgba(109,155,107,0.08)":"transparent"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600,color:T.text}}>{r.name}</div>
                    <div style={{fontSize:11,color:T.muted,marginTop:2}}>{MEAL_TYPE_EMOJI[r.meal_type]} {r.meal_type} · ⏱ {r.prep_time_mins}min · 👥 {r.servings}</div>
                  </div>
                  <span style={{fontSize:13,color:isSelected?T.green:T.accent,fontWeight:700,marginLeft:8,flexShrink:0}}>{isSelected?"✓ Added":"+ Add"}</span>
                </div>
              );
            })}
            {results.length === 0 && (
              <div style={{textAlign:"center",color:T.muted,padding:"20px 0",fontSize:13}}>No recipes found for "{query}"</div>
            )}
          </div>
        </>
      )}

      {!query.trim() && !showRecent && (
        <div style={{textAlign:"center",color:T.muted,padding:"24px 0",fontSize:13}}>
          Start typing to search all 145+ recipes
        </div>
      )}

      {/* Selected items summary + Done button */}
      {selectedRecipeIds.length > 0 && (
        <div style={{position:"sticky",bottom:0,background:T.bg,paddingTop:12,marginTop:8}}>
          <div style={{padding:"12px 16px",background:"rgba(109,155,107,0.12)",border:`1px solid ${T.green}44`,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:T.green}}>✓ {selectedRecipeIds.length} recipe{selectedRecipeIds.length>1?"s":""} added</div>
              <div style={{fontSize:11,color:T.muted,marginTop:2}}>Tap any recipe to remove it</div>
            </div>
            {onDone && (
              <button onClick={onDone}
                style={{padding:"10px 20px",borderRadius:12,border:"none",background:T.green,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
                Done ✓
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── RECIPE SEARCH ────────────────────────────────────────────────────────────
const RecipeSearch = ({ recipes, pantry, familyId, todayStr, mealPlan, onAssign, onViewRecipe }) => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [cuisine, setCuisine] = useState("all");
  const [assignModal, setAssignModal] = useState(null);

  const mealTypes = ["all","breakfast","lunch","dinner","snack","healthy"];

  const CUISINE_MAP = {
    "north-indian": ["rajma","chole","paneer","paratha","roti","chapati","dal","aloo","gobi","kadhi","puri","bhatura","halwa","kheer","lassi","nimbu","shahi","matar","palak","saag","makki","bajra","missi","stuffed","methi","butter","naan","tandoor","tikka","biryani","pulao","khichdi","poha","upma","idli","dosa","rasam","sambar"],
    "south-indian": ["dosa","idli","sambar","rasam","vada","uttapam","pongal","chutney","appam","avial","bisibelebath","puliyodarai","curd rice","lemon rice","rava dosa","medu"],
    "italian": ["pasta","macaroni","spaghetti","arrabiata","aglio","olio","white sauce","red sauce","pink sauce","mac and cheese","bake","pizza","risotto","pesto","carbonara"],
    "indo-chinese": ["hakka","noodles","manchurian","spring roll","schezwan","fried rice","chilli","szechuan"],
    "healthy": ["sprouts","quinoa","oats","soup","detox","turmeric milk","ragi","greek yogurt","cucumber","smoothie","salad","brown rice"],
    "snacks-street": ["chaat","bhel","sev puri","dahi puri","aloo tikki","samosa","pakora","dhokla","vada pav","pav bhaji","misal"],
  };

  const CUISINE_LABELS = [
    { id:"all",          label:"🍽 All",           },
    { id:"north-indian", label:"🫓 North Indian",  },
    { id:"south-indian", label:"🥥 South Indian",  },
    { id:"italian",      label:"🍝 Italian",       },
    { id:"indo-chinese", label:"🥢 Indo-Chinese",  },
    { id:"healthy",      label:"🥗 Healthy",       },
    { id:"snacks-street",label:"🛒 Street Food",   },
  ];

  const matchesCuisine = (r, cid) => {
    if (cid === "all") return true;
    const keywords = CUISINE_MAP[cid] || [];
    const name = r.name.toLowerCase();
    const tags = (r.tags||[]).join(" ").toLowerCase();
    const mealType = (r.meal_type||"").toLowerCase();
    const combined = name + " " + tags + " " + mealType;

    // Direct tag matches first
    if (cid === "north-indian") {
      const northTags = ["north-indian","punjabi","rajasthani","gujarati","mughlai","dhaba-style","street-food"];
      if ((r.tags||[]).some(t => northTags.includes(t))) return true;
    }
    if (cid === "south-indian") {
      const southTags = ["south-indian","kerala","karnataka","tamil","andhra"];
      if ((r.tags||[]).some(t => southTags.includes(t))) return true;
    }
    if (cid === "italian") {
      const italTags = ["italian"];
      if ((r.tags||[]).some(t => italTags.includes(t))) return true;
    }
    if (cid === "indo-chinese") {
      const indoTags = ["indo-chinese"];
      if ((r.tags||[]).some(t => indoTags.includes(t))) return true;
    }
    if (cid === "healthy") {
      const healthTags = ["healthy","weight-loss","high-protein","high-fiber","immunity","detox","anti-inflammatory","diabetic-friendly","iron-rich","calcium-rich","easy-digest","low-calorie"];
      if ((r.tags||[]).some(t => healthTags.includes(t))) return true;
    }
    if (cid === "snacks-street") {
      const streetTags = ["street-food","chaat","mumbai","maharashtrian"];
      if ((r.tags||[]).some(t => streetTags.includes(t))) return true;
    }
    return keywords.some(k => combined.includes(k));
  };

  const results = React.useMemo(() => {
    let list = recipes;
    if (filter !== "all") {
      if (filter === "healthy") {
        const HEALTHY_TAGS = ["healthy","weight-loss","high-protein","high-fiber","immunity","detox","anti-inflammatory","diabetic-friendly","iron-rich","calcium-rich","easy-digest","low-calorie"];
        list = list.filter(r => (r.tags||[]).some(t => HEALTHY_TAGS.includes(t)));
      } else {
        list = list.filter(r => r.meal_type === filter);
      }
    }
    if (cuisine !== "all") list = list.filter(r => matchesCuisine(r, cuisine));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.tags || []).some(t => t.toLowerCase().includes(q)) ||
        r.meal_type.toLowerCase().includes(q)
      );
    }
    return list.sort((a,b) => a.name.localeCompare(b.name));
  }, [recipes, query, filter, cuisine]);

  const alreadyPlanned = (recipeId) => mealPlan.some(m => m.recipe_id === recipeId && m.plan_date === todayStr);

  return (
    <div>
      <div style={{position:"relative",marginBottom:12}}>
        <input
          className="input"
          placeholder="Search recipes... (e.g. paneer, dal, parantha)"
          value={query}
          onChange={e=>setQuery(e.target.value)}
          autoFocus
          style={{paddingLeft:36}}
        />
        <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:15}}>🔍</span>
        {query && (
          <span onClick={()=>setQuery("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:13,color:T.muted}}>✕</span>
        )}
      </div>
      {/* Meal type chips */}
      <div className="scroll-x" style={{marginBottom:8,gap:6,display:"flex"}}>
        {mealTypes.map(m=>(
          <div key={m} className={`chip ${filter===m?"on":""}`} onClick={()=>setFilter(m)} style={{textTransform:"capitalize",fontSize:12}}>{m}</div>
        ))}
      </div>
      {/* Cuisine chips */}
      <div className="scroll-x" style={{marginBottom:12,gap:6,display:"flex"}}>
        {CUISINE_LABELS.map(c=>(
          <div key={c.id} onClick={()=>setCuisine(c.id)}
            style={{display:"inline-flex",alignItems:"center",gap:4,padding:"6px 12px",borderRadius:20,border:`1px solid ${cuisine===c.id?T.accent:T.border}`,background:cuisine===c.id?T.accent:"transparent",color:cuisine===c.id?"#fff":T.muted,fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,transition:"all .15s"}}>
            {c.label}
          </div>
        ))}
      </div>
      <div style={{fontSize:12,color:T.muted,marginBottom:10}}>{results.length} recipe{results.length!==1?"s":""} found</div>
      {results.length === 0
        ? <div className="empty"><div className="empty-icon">🔍</div><div className="empty-text">No recipes found.<br/>Try a different search.</div></div>
        : <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {results.map(r => (
              <div key={r.id} className="card" style={{padding:"12px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{flex:1}} onClick={()=>onViewRecipe(r)}>
                    <div style={{fontSize:14,fontWeight:700}}>{r.name}</div>
                    <div style={{fontSize:11.5,color:T.muted,marginTop:2}}>⏱ {r.prep_time_mins}min · 👥 {r.servings} · <span style={{textTransform:"capitalize"}}>{r.meal_type}</span></div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:5}}>
                      {(r.tags||[]).map(tag=>(
                        <span key={tag} style={{fontSize:12,background:T.accentSoft,color:T.accent,padding:"2px 7px",borderRadius:20,fontWeight:600}}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>onViewRecipe(r)}
                    style={{flex:1,padding:"8px",background:"#FAFAF8",border:"1px solid rgba(125,157,124,0.08)",borderRadius:10,color:T.text,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
                    👁 View
                  </button>
                  {alreadyPlanned(r.id)
                    ? <div style={{flex:1,padding:"8px",background:T.greenSoft,border:"1px solid rgba(109,155,107,0.3)",borderRadius:10,color:T.green,fontSize:12,fontWeight:600,textAlign:"center"}}>✓ In Today</div>
                    : <button onClick={()=>setAssignModal(r)}
                        style={{flex:1,padding:"8px",background:T.accentSoft,border:"1px solid rgba(125,157,124,0.3)",borderRadius:10,color:T.accent,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
                        + Add to Today
                      </button>
                  }
                </div>
              </div>
            ))}
          </div>
      }
      {assignModal && (
        <div className="modal-overlay" onClick={()=>setAssignModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()} style={{maxWidth:340}}>
            <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>Add to Today's Plan</div>
            <div style={{fontSize:13,color:T.muted,marginBottom:16}}>{assignModal.name}</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {["breakfast","lunch","dinner","snack"].map(mt=>{
                const taken = mealPlan.find(m=>m.plan_date===todayStr && m.meal_type===mt);
                return (
                  <button key={mt} onClick={()=>{ onAssign(assignModal.id, todayStr, mt); setAssignModal(null); }}
                    style={{padding:"12px 14px",background:taken?"#FAFAF8":"rgba(125,157,124,0.1)",border:taken?"1px solid rgba(125,157,124,0.08)":"1px solid rgba(139,124,248,0.25)",borderRadius:12,color:taken?T.dim:T.accent,fontSize:14,fontWeight:600,cursor:taken?"default":"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{textTransform:"capitalize"}}>🍽 {mt}</span>
                    {taken && <span style={{fontSize:11,color:T.muted}}>{taken.recipe_name || "Planned"}</span>}
                  </button>
                );
              })}
            </div>
            <button onClick={()=>setAssignModal(null)} style={{marginTop:12,width:"100%",padding:"10px",background:"transparent",border:"1px solid rgba(125,157,124,0.08)",borderRadius:10,color:T.muted,fontSize:13,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── WHAT CAN I COOK ──────────────────────────────────────────────────────────
const WhatCanICook = ({ recipes, pantry, onSelectRecipe, familyId }) => {
  const [filter, setFilter] = useState("all");
  const [cookLogs, setCookLogs] = useState([]);
  const [ingredients, setIngredients] = useState({}); // recipeId -> ingredients[]
  const [loadingIngredients, setLoadingIngredients] = useState(true);

  const loadData = React.useCallback(async () => {
    setLoadingIngredients(true);
    try {
      // Load cook logs
      const start = new Date(); start.setDate(start.getDate()-30);
      const { data: logs } = await supabase.from("cook_logs").select("recipe_name,cooked_at").eq("family_id", familyId).gte("cooked_at", start.toISOString()).order("cooked_at", {ascending:false});
      setCookLogs(logs||[]);
      // Load ALL recipe ingredients - paginate to get past 1000 row limit
      let allIngs = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: ings } = await supabase.from("recipe_ingredients").select("*").range(from, from+pageSize-1);
        if (!ings || ings.length === 0) break;
        allIngs = [...allIngs, ...ings];
        if (ings.length < pageSize) break;
        from += pageSize;
      }
      const map = {};
      allIngs.forEach(ing => {
        if (!map[ing.recipe_id]) map[ing.recipe_id] = [];
        map[ing.recipe_id].push(ing);
      });
      setIngredients(map);
    } catch(e) { console.error(e); }
    setLoadingIngredients(false);
  }, [familyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const cookCount = React.useMemo(() => {
    const map = {};
    cookLogs.forEach(l => { map[l.recipe_name] = (map[l.recipe_name]||0)+1; });
    return map;
  }, [cookLogs]);

  // Calculate pantry match % for each recipe
  const scoredRecipes = React.useMemo(() => {
    return recipes.map(recipe => {
      const ings = ingredients[recipe.id] || [];
      if (ings.length === 0) return { ...recipe, matchPct: 50, haveCount: 0, totalCount: 0, missing: [] };
      let have = 0;
      const missing = [];
      for (const ing of ings) {
        const pantryItem = pantry.find(p => p.name.toLowerCase() === ing.pantry_item_name.toLowerCase());
        if (pantryItem && Number(pantryItem.quantity) >= Number(ing.quantity)) {
          have++;
        } else {
          missing.push(ing.pantry_item_name);
        }
      }
      const matchPct = Math.round((have / ings.length) * 100);
      return { ...recipe, matchPct, haveCount: have, totalCount: ings.length, missing: missing.slice(0,3) };
    });
  }, [recipes, ingredients, pantry]);

  const mealTypes = ["all","healthy","breakfast","lunch","dinner","snack"];
  const HEALTHY_TAGS = ["healthy","weight-loss","high-protein","high-fiber","immunity","detox","anti-inflammatory","diabetic-friendly","iron-rich","calcium-rich","easy-digest","low-calorie","no-cook"];
  const filtered = filter==="all" ? scoredRecipes : filter==="healthy" ? scoredRecipes.filter(r=>(r.tags||[]).some(t=>HEALTHY_TAGS.includes(t))) : scoredRecipes.filter(r=>r.meal_type===filter);

  // Sort: 100% match first, then by match%, then by cook count
  const canCookNow = filtered.filter(r=>r.matchPct===100).sort((a,b)=>(cookCount[b.name]||0)-(cookCount[a.name]||0));
  const almostReady = filtered.filter(r=>r.matchPct>=60&&r.matchPct<100).sort((a,b)=>b.matchPct-a.matchPct);
  const needsShopping = filtered.filter(r=>r.matchPct<60).sort((a,b)=>b.matchPct-a.matchPct);
  const [cookFilter, setCookFilter] = useState(null);
  const visibleReady = cookFilter===null||cookFilter==="ready" ? canCookNow : [];
  const visibleAlmost = cookFilter===null||cookFilter==="almost" ? almostReady : [];
  const visibleShopping = cookFilter===null||cookFilter==="shopping" ? needsShopping : [];

  const MatchBadge = ({pct}) => {
    const bg = pct===100 ? T.greenSoft : pct>=60 ? T.amberSoft : T.redSoft;
    const color = pct===100 ? T.green : pct>=60 ? T.amber : T.red;
    return <div style={{fontSize:11,fontWeight:700,color,background:bg,padding:"3px 8px",borderRadius:20,flexShrink:0}}>{pct===100?"✓ Ready":pct+"%"}</div>;
  };

  const RecipeRow = ({r}) => (
    <div key={r.id} onClick={()=>onSelectRecipe(r)}
      className="card card-tap" style={{padding:"12px 14px",marginBottom:0,display:"flex",justifyContent:"space-between",alignItems:"center",borderColor:r.matchPct===100?T.green:T.border}}>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
          <div style={{fontSize:14,fontWeight:600,color:T.text}}>{r.name}</div>
          {cookCount[r.name] > 0 && <div style={{fontSize:12,color:T.muted}}>({cookCount[r.name]}x)</div>}
        </div>
        <div style={{fontSize:11,color:T.muted}}>⏱ {r.prep_time_mins}min · {r.meal_type}</div>
        {r.missing.length > 0 && <div style={{fontSize:12,color:T.red,marginTop:2}}>Missing: {r.missing.join(", ")}</div>}
      </div>
      <MatchBadge pct={r.matchPct}/>
    </div>
  );

  if (loadingIngredients) return (
    <div style={{textAlign:"center",padding:"40px 20px"}}>
      <div className="spinner" style={{width:28,height:28,margin:"0 auto 12px"}}/>
      <div style={{fontSize:13,color:T.muted}}>Checking your pantry...</div>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".07em"}}>Based on current pantry</div>
        <button onClick={loadData} style={{fontSize:11,fontWeight:700,color:T.accent,background:T.accentSoft,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer"}}>↻ Refresh</button>
      </div>
      <div className="card" style={{padding:"12px 14px",marginBottom:12,display:"flex",gap:12}}>
        <div onClick={()=>setCookFilter(cookFilter==="ready"?null:"ready")} style={{flex:1,textAlign:"center",cursor:"pointer",borderRadius:10,padding:"4px 0",background:cookFilter==="ready"?T.greenSoft:"transparent",transition:"all .18s"}}>
          <div style={{fontSize:22,fontWeight:800,color:T.green}}>{canCookNow.length}</div>
          <div style={{fontSize:11,color:cookFilter==="ready"?T.green:T.muted,fontWeight:600}}>Ready Now</div>
        </div>
        <div style={{width:"0.5px",background:T.border}}/>
        <div onClick={()=>setCookFilter(cookFilter==="almost"?null:"almost")} style={{flex:1,textAlign:"center",cursor:"pointer",borderRadius:10,padding:"4px 0",background:cookFilter==="almost"?T.amberSoft:"transparent",transition:"all .18s"}}>
          <div style={{fontSize:22,fontWeight:800,color:T.amber}}>{almostReady.length}</div>
          <div style={{fontSize:11,color:cookFilter==="almost"?T.amber:T.muted,fontWeight:600}}>Almost Ready</div>
        </div>
        <div style={{width:"0.5px",background:T.border}}/>
        <div onClick={()=>setCookFilter(cookFilter==="shopping"?null:"shopping")} style={{flex:1,textAlign:"center",cursor:"pointer",borderRadius:10,padding:"4px 0",background:cookFilter==="shopping"?"rgba(255,255,255,0.06)":"transparent",transition:"all .18s"}}>
          <div style={{fontSize:22,fontWeight:800,color:T.muted}}>{needsShopping.length}</div>
          <div style={{fontSize:11,color:T.muted,fontWeight:600}}>Need Shopping</div>
        </div>
      </div>

      <div className="scroll-x" style={{marginBottom:12,gap:6,display:"flex"}}>
        {mealTypes.map(m=>(
          <div key={m} className={`chip ${filter===m?"on":""}`} onClick={()=>setFilter(m)} style={{textTransform:"capitalize"}}>{m}</div>
        ))}
      </div>

      {visibleReady.length > 0 && (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:T.green,textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>✅ Cook Right Now ({canCookNow.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>{visibleReady.map(r=><RecipeRow key={r.id} r={r}/>)}</div>
        </div>
      )}

      {visibleAlmost.length > 0 && (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:T.amber,textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>⚡ Almost Ready ({almostReady.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>{visibleAlmost.map(r=><RecipeRow key={r.id} r={r}/>)}</div>
        </div>
      )}

      {visibleShopping.length > 0 && (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>🛒 Need Shopping ({needsShopping.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>{visibleShopping.slice(0,10).map(r=><RecipeRow key={r.id} r={r}/>)}</div>
        </div>
      )}
    </div>
  );
};

// ─── AUTO PLAN BAR ───────────────────────────────────────────────────────────
const AutoPlanBar = ({ familyId, recipes, pantry, refreshMeal, weekDates }) => {
  const [autoPlanning, setAutoPlanning] = useState(false);

  const shuffle = arr => [...arr].sort(() => Math.random()-0.5);

  const autoSchedule = async () => {
    setAutoPlanning(true);
    try {
      const { data: allIngs } = await supabase.from("recipe_ingredients").select("*");
      const ingMap = {};
      (allIngs||[]).forEach(ing => {
        if (!ingMap[ing.recipe_id]) ingMap[ing.recipe_id] = [];
        ingMap[ing.recipe_id].push(ing);
      });

      const scored = recipes.map(r => {
        const ings = ingMap[r.id] || [];
        if (!ings.length) return { ...r, pct:50 };
        const have = ings.filter(ing => {
          const p = pantry.find(p => p.name.toLowerCase()===ing.pantry_item_name.toLowerCase());
          return p && Number(p.quantity) >= Number(ing.quantity);
        }).length;
        return { ...r, pct: Math.round((have/ings.length)*100) };
      }).filter(r => r.pct >= 80);

      const byType = { breakfast:[], lunch:[], dinner:[], snack:[] };
      scored.forEach(r => { if (byType[r.meal_type]) byType[r.meal_type].push(r); });

      const parathas       = shuffle(byType.breakfast.filter(r => /paratha/i.test(r.name)));
      const healthyBreak   = shuffle(byType.breakfast.filter(r => (r.tags||[]).some(t=>['healthy','high-protein'].includes(t)) && !/paratha/i.test(r.name)));
      const otherBreak     = shuffle(byType.breakfast.filter(r => !/paratha/i.test(r.name) && !(r.tags||[]).some(t=>t==='healthy')));
      const allLunch = shuffle(byType.lunch.filter(r => !['roti','chapati','phulka'].some(n => r.name.toLowerCase().includes(n))));
      // Exclude plain rotis as standalone dinner - they are sides not mains
      const ROTI_NAMES = ['roti','chapati','phulka','makki','bajra','butter roti','tandoori roti'];
      const allDinner = shuffle(byType.dinner.filter(r => !ROTI_NAMES.some(n => r.name.toLowerCase().includes(n))));
      const allSnack       = shuffle(byType.snack);

      const days = weekDates.slice(0,5);

      await supabase.from("meal_plan").delete().eq("family_id",familyId).eq("cooked",false).gte("plan_date",days[0]);

      const toInsert = [];
      days.forEach((date,i) => {
        const bPool = i%3===0 ? parathas : i%3===1 ? healthyBreak : otherBreak;
        const b = bPool[i % Math.max(bPool.length,1)];
        const l = allLunch[i % Math.max(allLunch.length,1)];
        const d = allDinner[i % Math.max(allDinner.length,1)];
        const s = allSnack[i % Math.max(allSnack.length,1)];
        if (b) toInsert.push({ family_id:familyId, plan_date:date, meal_type:"breakfast", recipe_id:b.id, cooked:false, servings_cooked:3 });
        if (l) toInsert.push({ family_id:familyId, plan_date:date, meal_type:"lunch",     recipe_id:l.id, cooked:false, servings_cooked:3 });
        if (d) toInsert.push({ family_id:familyId, plan_date:date, meal_type:"dinner",    recipe_id:d.id, cooked:false, servings_cooked:3 });
        if (s) toInsert.push({ family_id:familyId, plan_date:date, meal_type:"snack",     recipe_id:s.id, cooked:false, servings_cooked:3 });
      });

      if (toInsert.length) await supabase.from("meal_plan").insert(toInsert);
      await refreshMeal();
      showToast({ title:"📅 Meal Plan Updated!", body:`5 days planned from your pantry`, icon:"📅", color:"#6D9B6B" });
    } catch(e) {
      console.error(e);
      showToast({ title:"Error", body:"Could not auto-plan meals", icon:"❌", color:"#C4603A" });
    }
    setAutoPlanning(false);
  };

  const clearPlan = async () => {
    await supabase.from("meal_plan").delete().eq("family_id",familyId).eq("cooked",false).gte("plan_date",weekDates[0]);
    await refreshMeal();
    showToast({ title:"🗑 Cleared", body:"Future meals cleared", icon:"🗑", color:T.amber });
  };

  return (
    <div style={{display:"flex",gap:8,marginBottom:10}}>
      <button onClick={autoSchedule} disabled={autoPlanning}
        style={{flex:1,padding:"12px 16px",background:autoPlanning?T.accentSoft:T.accent,border:`1px solid ${T.accent}`,borderRadius:14,color:autoPlanning?T.accent:"#fff",fontSize:14,fontWeight:700,cursor:autoPlanning?"not-allowed":"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        {autoPlanning ? <><div className="spinner" style={{width:16,height:16,borderTopColor:T.accent}}/> Planning...</> : <>🗓 Auto-Plan Next 5 Days</>}
      </button>
      <button onClick={clearPlan}
        style={{padding:"12px 14px",background:T.accentSoft,border:`1px solid ${T.border}`,borderRadius:14,color:T.accent,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",whiteSpace:"nowrap"}}>
        🗑 Clear
      </button>
    </div>
  );
};


// ─── HEALTH ANALYSIS TAB ─────────────────────────────────────────────────────
const HealthAnalysisTab = ({ familyId }) => {
  const [member, setMember] = useState("Mayank");
  const [healthTab, setHealthTab] = useState("today");
  const [logs, setLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState("");
  const [loadingInsight, setLoadingInsight] = useState(false);
  const todayStr = new Date().toISOString().split("T")[0];
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const { data: todayData } = await supabase.from("nutrition_logs").select("*").eq("family_id", familyId).eq("meal_date", todayStr).order("logged_at", { ascending: true });
      const { data: allData } = await supabase.from("nutrition_logs").select("*").eq("family_id", familyId).order("meal_date", { ascending: true });
      setLogs(todayData || []);
      setAllLogs(allData || []);
      setLoading(false);
    };
    fetchLogs();
  }, [familyId, todayStr]);
  const memberLogs = logs.filter(l => l.member === member);
  const totals = memberLogs.reduce((a,l) => ({ calories: a.calories+(l.calories||0), protein: a.protein+(l.protein||0), carbs: a.carbs+(l.carbs||0), fat: a.fat+(l.fat||0), fiber: a.fiber+(l.fiber||0) }), { calories:0,protein:0,carbs:0,fat:0,fiber:0 });
  const targets = NUTRITION_TARGETS[member];

  // Overall stats
  const memberAllLogs = allLogs.filter(l => l.member === member);
  const uniqueDays = [...new Set(memberAllLogs.map(l => l.meal_date))];
  const totalDays = uniqueDays.length || 1;
  const allTotals = memberAllLogs.reduce((a,l) => ({ calories: a.calories+(l.calories||0), protein: a.protein+(l.protein||0), carbs: a.carbs+(l.carbs||0), fat: a.fat+(l.fat||0), fiber: a.fiber+(l.fiber||0) }), { calories:0,protein:0,carbs:0,fat:0,fiber:0 });
  const avgTotals = { calories: Math.round(allTotals.calories/totalDays), protein: Math.round(allTotals.protein/totalDays*10)/10, carbs: Math.round(allTotals.carbs/totalDays*10)/10, fat: Math.round(allTotals.fat/totalDays*10)/10, fiber: Math.round(allTotals.fiber/totalDays*10)/10 };
  const foodFreq = memberAllLogs.reduce((a,l) => { a[l.food_description]=(a[l.food_description]||0)+1; return a; }, {});
  const topFoods = Object.entries(foodFreq).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const firstDate = uniqueDays[0];
  const totalMealsLogged = memberAllLogs.length;
  const getInsight = async () => {
    setLoadingInsight(true);
    try {
      const prompt = `You are Munshi Jee. ${member} ate today: ${memberLogs.map(l=>l.food_description).join(", ")}. Totals: ${totals.calories} cal, ${totals.protein}g protein. Target: ${targets.calories} cal, ${targets.protein}g protein. Give brief friendly health tip in Hinglish. Max 2 sentences.`;
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + process.env.REACT_APP_GROQ_API_KEY },
        body: JSON.stringify({ model: "llama-3.1-8b-instant", max_tokens: 120, messages: [{ role: "user", content: prompt }] })
      });
      const data = await res.json();
      setInsight(data.choices?.[0]?.message?.content || "");
    } catch(e) { setInsight("Could not load insight."); }
    setLoadingInsight(false);
  };
  const NutrBar = ({ label, val, target, color }) => {
    const p = target > 0 ? Math.min(100, Math.round((val/target)*100)) : 0;
    return (
      <div style={{marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:13,fontWeight:600}}>{label}</span>
          <span style={{fontSize:12,color:T.muted}}>{val} / {target}</span>
        </div>
        <div className="progress" style={{height:8}}>
          <div className="progress-fill" style={{width:`${p}%`,background:p>=100?T.green:p>=60?T.amber:color}}/>
        </div>
      </div>
    );
  };
  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {MEMBERS.map(m=>(
          <div key={m} onClick={()=>setMember(m)} style={{flex:1,padding:"8px",borderRadius:12,border:`1px solid ${member===m?T.accent:T.border}`,background:member===m?T.accentSoft:"transparent",textAlign:"center",cursor:"pointer",transition:"all .18s"}}>
            <div style={{fontSize:18}}>{MEMBER_EMOJI[m]}</div>
            <div style={{fontSize:11,fontWeight:600,color:member===m?T.accent:T.muted,marginTop:2}}>{m}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {["today","overall"].map(t=>(
          <div key={t} onClick={()=>setHealthTab(t)} className={`chip ${healthTab===t?"on":""}`} style={{textTransform:"capitalize",flex:1,justifyContent:"center"}}>{t==="today"?"📅 Today":"📊 Overall"}</div>
        ))}
      </div>

      {healthTab==="overall" && (
        memberAllLogs.length===0
        ? <div className="empty"><div className="empty-icon">📊</div><div className="empty-text">No meals logged yet.<br/>Start logging to see overall stats.</div></div>
        : <div>
            <div className="card" style={{padding:"16px",marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:T.muted,marginBottom:12,textTransform:"uppercase",letterSpacing:".06em"}}>All-Time Averages — {member}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                {[
                  {l:"📅 Days Tracked",v:totalDays},
                  {l:"🍽 Meals Logged",v:totalMealsLogged},
                  {l:"🔥 Avg Calories",v:avgTotals.calories+" kcal"},
                  {l:"💪 Avg Protein",v:avgTotals.protein+"g"},
                  {l:"🍚 Avg Carbs",v:avgTotals.carbs+"g"},
                  {l:"🌿 Avg Fiber",v:avgTotals.fiber+"g"},
                ].map(s=>(
                  <div key={s.l} style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontSize:11,color:T.muted,fontWeight:600}}>{s.l}</div>
                    <div style={{fontSize:16,fontWeight:700,color:T.text,marginTop:3}}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:12,color:T.muted,marginBottom:6,fontWeight:600}}>vs Daily Targets</div>
              <NutrBar label="🔥 Calories" val={avgTotals.calories} target={targets.calories} color={T.accent}/>
              <NutrBar label="💪 Protein" val={avgTotals.protein} target={targets.protein} color={T.blue}/>
            </div>
            {topFoods.length>0 && (
              <div className="card" style={{padding:"14px 16px",marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:700,color:T.muted,marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>Most Eaten</div>
                {topFoods.map(([food,count])=>(
                  <div key={food} className="list-row" style={{minHeight:40}}>
                    <div style={{fontSize:14,flex:1,fontWeight:500}}>{food}</div>
                    <div style={{fontSize:13,color:T.accent,fontWeight:700}}>{count}x</div>
                  </div>
                ))}
              </div>
            )}
            {firstDate && <div style={{fontSize:11,color:T.dim,textAlign:"center",marginBottom:12}}>Tracking since {firstDate}</div>}
          </div>
      )}

      {healthTab==="today" && loading ? <div style={{textAlign:"center",padding:40,color:T.muted}}>Loading...</div>
      : healthTab==="today" && memberLogs.length === 0 ? <div className="empty"><div className="empty-icon">🥗</div><div className="empty-text">No meals logged today for {member}.</div></div>
      : healthTab==="today" && <>
        <div className="card" style={{padding:"16px",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:T.muted,marginBottom:12,textTransform:"uppercase",letterSpacing:".06em"}}>Today — {member}</div>
          <NutrBar label="🔥 Calories" val={totals.calories} target={targets.calories} color={T.accent}/>
          <NutrBar label="💪 Protein (g)" val={totals.protein} target={targets.protein} color={T.blue}/>
          <NutrBar label="🍚 Carbs (g)" val={totals.carbs} target={targets.carbs} color={T.amber}/>
          <NutrBar label="🥑 Fat (g)" val={totals.fat} target={targets.fat} color={T.pink}/>
          <NutrBar label="🌿 Fiber (g)" val={totals.fiber} target={targets.fiber} color={T.green}/>
        </div>
        <div className="card" style={{padding:"2px 14px",marginBottom:12}}>
          {memberLogs.map(l=>(
            <div key={l.id} className="list-row">
              <div style={{fontSize:16}}>{l.meal_type==="breakfast"?"🌅":l.meal_type==="lunch"?"☀️":l.meal_type==="snack"?"🍎":"🌙"}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:500}}>{l.food_description}</div>
                <div style={{fontSize:11.5,color:T.muted,textTransform:"capitalize"}}>{l.meal_type}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:13,fontWeight:700,color:T.accent}}>{l.calories} cal</div>
                <div style={{fontSize:11,color:T.muted}}>{l.protein}g protein</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={getInsight} disabled={loadingInsight} className="btn-primary" style={{marginBottom:12}}>
          {loadingInsight ? "🤖 Analysing..." : "🤖 Get Health Insight"}
        </button>
        {insight && <div style={{padding:"14px",background:T.accentSoft,border:`1px solid ${T.accent}33`,borderRadius:14,fontSize:14,lineHeight:1.6,marginBottom:12}}>{insight}</div>}
        <button onClick={async()=>{
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          document.head.appendChild(script);
          await new Promise(r=>script.onload=r);
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();
          const d = new Date().toLocaleDateString("en-IN");
          doc.setFillColor(13,13,28);
          doc.rect(0,0,210,40,"F");
          doc.setTextColor(255,255,255);
          doc.setFontSize(20);
          doc.setFont("helvetica","bold");
          doc.text("Family OS — Health Report",15,18);
          doc.setFontSize(11);
          doc.setFont("helvetica","normal");
          doc.text(`${member} · ${d}`,15,28);
          doc.setTextColor(0,0,0);
          doc.setFontSize(14);
          doc.setFont("helvetica","bold");
          doc.text("Nutrition Summary",15,55);
          doc.setFont("helvetica","normal");
          doc.setFontSize(11);
          const t = targets;
          const rows = [
            ["Calories", totals.calories + " kcal", t.calories + " kcal", Math.round((totals.calories/t.calories)*100)+"%"],
            ["Protein", totals.protein + "g", t.protein + "g", Math.round((totals.protein/t.protein)*100)+"%"],
            ["Carbs", totals.carbs + "g", t.carbs + "g", Math.round((totals.carbs/t.carbs)*100)+"%"],
            ["Fat", totals.fat + "g", t.fat + "g", Math.round((totals.fat/t.fat)*100)+"%"],
            ["Fiber", totals.fiber + "g", t.fiber + "g", Math.round((totals.fiber/t.fiber)*100)+"%"],
          ];
          let y = 65;
          doc.setFillColor(240,240,240);
          doc.rect(15,y-5,180,8,"F");
          doc.setFont("helvetica","bold");
          ["Nutrient","Consumed","Target","Achievement"].forEach((h,i)=>{
            doc.text(h, 15+i*45, y);
          });
          y += 8;
          doc.setFont("helvetica","normal");
          rows.forEach(row=>{
            row.forEach((cell,i)=>doc.text(String(cell),15+i*45,y));
            y+=8;
          });
          y+=10;
          doc.setFont("helvetica","bold");
          doc.setFontSize(14);
          doc.text("Meals Today",15,y);
          y+=8;
          doc.setFont("helvetica","normal");
          doc.setFontSize(11);
          memberLogs.forEach(l=>{
            doc.text(`${l.meal_type.toUpperCase()}: ${l.food_description} — ${l.calories} cal, ${l.protein}g protein`,15,y);
            y+=7;
          });
          if(insight){
            y+=8;
            doc.setFont("helvetica","bold");
            doc.setFontSize(14);
            doc.text("AI Health Insight",15,y);
            y+=8;
            doc.setFont("helvetica","normal");
            doc.setFontSize(10);
            const lines = doc.splitTextToSize(insight,180);
            doc.text(lines,15,y);
          }
          doc.setFontSize(9);
          doc.setTextColor(150,150,150);
          doc.text("Generated by Family OS · Powered by Claude + Groq",15,285);
          doc.save(`health-report-${member}-${d.replace(/\//g,"-")}.pdf`);
        }} style={{width:"100%",padding:"14px",background:"rgba(255,255,255,0.06)",border:`1px solid ${T.border}`,borderRadius:14,color:T.text,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          📄 Download PDF Report
        </button>
      </>}
    </div>
  );
};
// ─── KITCHEN SCREEN ───────────────────────────────────────────────────────────
const KitchenScreen = ({ familyId }) => {
  const [tab, setTab] = useState("today");
  const [seeded, setSeeded] = useState(false);
  const [cooking, setCooking] = useState(null);
  const [addMealModal, setAddMealModal] = useState(null);
  const [showAddPantry, setShowAddPantry] = useState(false);
  const [restocking, setRestocking] = useState(false);
  const [pantrySearch, setPantrySearch] = useState("");
  const [pantryCatFilter, setPantryCatFilter] = useState("All");
  const [pantryStockFilter, setPantryStockFilter] = useState("all");
  const [editPantryItem, setEditPantryItem] = useState(null);
  const [editShopItem, setEditShopItem] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [showAlexaCommands, setShowAlexaCommands] = useState(false);
  const [cookLogModal, setCookLogModal] = useState(null); // {meal, recipe}
  const [editCookLog, setEditCookLog] = useState(null); // {meal, recipe}
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [recipeServings, setRecipeServings] = useState(2);
  const [ef, setEf] = useState({ name:"", category:"Grains", quantity:"", unit:"kg", par_level:"" });
  const [pf, setPf] = useState({ name:"", category:"Grains", quantity:"", unit:"kg", par_level:"" });

  const { rows: pantry, refresh: refreshPantry } = useTable("pantry", familyId, { order: "name", asc: true });
  const { rows: recipes } = useTable("recipes", familyId, { order: "name", asc: true });
  const { rows: mealPlan, refresh: refreshMeal } = useTable("meal_plan", familyId, { order: "plan_date", asc: true });
  const { rows: shopping, update: updShopping, remove: removeShopping, refresh: refreshShopping } = useTable("shopping_list", familyId, { order: "added_at" });

  useEffect(() => {
    if (!seeded && familyId) { seedRecipes(familyId).then(() => setSeeded(true)); }
  }, [familyId, seeded]);

  const todayStr = today();
  const todayMeals = mealPlan.filter(m => m.plan_date === todayStr);
  const lowStock = pantry.filter(p => Number(p.quantity) <= Number(p.par_level));

  const handleMarkCooked = async (meal) => {
    setCooking(meal.id);
    try {
      const { deducted, lowStockItems } = await markMealCooked(familyId, meal, recipes, pantry);
      await refreshPantry();
      await refreshMeal();
      const recipe = recipes.find(r => r.id === meal.recipe_id);
      showToast({
        title: "🍽 Meal Cooked!",
        body: deducted.length
          ? `${deducted.length} ingredients deducted.${lowStockItems?.length ? ` ${lowStockItems.length} added to shopping list.` : ""}`
          : "Marked as cooked! (No pantry items matched)",
        icon:"🍽", color:"#6D9B6B"
      });
      sendEmail("meal_cooked", {
        meal_type: meal.meal_type,
        recipe_name: recipe?.name || "Unknown",
        deducted_count: deducted.length,
        low_stock_count: lowStockItems?.length || 0,
      });
      // Email pantry low alerts
      if (lowStockItems?.length) {
        for (const item of lowStockItems) {
          notifyPantryLow(familyId, { name: item.name, quantity: item.qty, unit: item.unit });
        }
      }
    } catch(e) { console.error(e); }
    setCooking(null);
  };

  const handleUndoCookLog = async (meal) => {
    if (!window.confirm("Undo this meal log? Pantry quantities will be restored.")) return;
    try {
      // Find the cook log for this meal
      const { data: logs } = await supabase.from("cook_logs")
        .select("*").eq("family_id", familyId).eq("recipe_name", recipes.find(r=>r.id===meal.recipe_id)?.name || "")
        .order("cooked_at", {ascending: false}).limit(1);
      if (logs?.length) {
        const log = logs[0];
        // Restore pantry quantities from transactions
        const { data: txns } = await supabase.from("pantry_transactions").select("*").eq("cook_log_id", log.id);
        for (const txn of (txns || [])) {
          const pantryItem = pantry.find(p => p.name.toLowerCase() === txn.pantry_item_name.toLowerCase());
          if (pantryItem) {
            const restoredQty = Number(pantryItem.quantity) + Number(txn.quantity_used);
            await supabase.from("pantry").update({ quantity: restoredQty, updated_at: new Date().toISOString() }).eq("id", pantryItem.id);
          }
        }
        // Delete transactions and cook log
        await supabase.from("pantry_transactions").delete().eq("cook_log_id", log.id);
        await supabase.from("cook_logs").delete().eq("id", log.id);
      }
      // Mark meal as uncooked
      await supabase.from("meal_plan").update({ cooked: false, cooked_at: null }).eq("id", meal.id);
      await refreshPantry();
      await refreshMeal();
      showToast({ title: "↩ Meal Unlogged", body: "Pantry quantities restored.", icon: "↩", color: T.amber });
    } catch(e) { console.error(e); }
  };

  const assignRecipe = async (recipeId, date, mealType) => {
    // Check if this recipe is already added for this slot
    const alreadyAdded = mealPlan.find(m => m.plan_date === date && m.meal_type === mealType && m.recipe_id === recipeId);
    if (alreadyAdded) {
      // Remove it (toggle off)
      await supabase.from("meal_plan").delete().eq("id", alreadyAdded.id);
    } else {
      // Add new recipe to this slot (multiple allowed)
      await supabase.from("meal_plan").insert([{
        family_id: familyId, plan_date: date, meal_type: mealType,
        recipe_id: recipeId, cooked: false, servings_cooked: 3,
      }]);
    }
    await refreshMeal();
  };

  const removeRecipeFromSlot = async (mealPlanId) => {
    await supabase.from("meal_plan").delete().eq("id", mealPlanId);
    await refreshMeal();
  };

  const savePantryItem = async () => {
    if (!pf.name || !pf.quantity) return;
    await supabase.from("pantry").insert([{
      family_id: familyId, name: pf.name, category: pf.category,
      quantity: Number(pf.quantity), unit: pf.unit, par_level: Number(pf.par_level) || 0,
      updated_at: new Date().toISOString(),
    }]);
    await refreshPantry();
    setPf({ name:"", category:"Grains", quantity:"", unit:"kg", par_level:"" });
    setShowAddPantry(false);
  };

  const getWeekDates = () => {
    const d = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(d); dd.setDate(d.getDate() + i);
      return dd.toISOString().split("T")[0];
    });
  };
  const weekDates = getWeekDates();

  return (
    <div className="screen">
      <div style={{padding:"calc(44px + env(safe-area-inset-top,0px)) 18px 0"}}>
        <div className="row">
          <div>
            <div style={{fontSize:22,fontWeight:900,letterSpacing:"-.4px"}}>🍽 Kitchen</div>
            <div style={{fontSize:12,color:T.muted,marginTop:2}}>
              {lowStock.length > 0
                ? <span style={{color:T.amber}}>⚠️ {lowStock.length} items low · </span>
                : <span style={{color:T.green}}>✅ Stock OK · </span>}
              {recipes.length} recipes
            </div>
          </div>
        </div>
        <div onClick={()=>setShowAlexaCommands(true)} style={{padding:"8px 12px",background:"rgba(125,157,124,0.12)",border:"1px solid rgba(125,157,124,0.3)",borderRadius:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:15}}>🎤</span>
          <span style={{fontSize:11,fontWeight:700,color:T.accent}}>Commands</span>
        </div>
      </div>
      {showAlexaCommands && <AlexaCommandCenter onClose={()=>setShowAlexaCommands(false)}/>}

      <div style={{padding:"10px 18px 4px",display:"flex",flexDirection:"column",gap:8}}>
        <div style={{display:"flex",gap:8}}>
          {[
            {id:"today", label:"📅 Today"},
            {id:"week",  label:"🗓 Week"},
            {id:"recipes",label:"🥘 Recipes"},
          ].map(t => (
            <div key={t.id} className={`chip ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}>{t.label}</div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          {[
            {id:"suggest",label:"💡 Can Cook"},
            {id:"pantry", label:"🧺 Pantry"},
            {id:"shop",   label:"🛒 Shop"},
            {id:"health", label:"❤️ Health"},
          ].map(t => (
            <div key={t.id} className={`chip ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}>{t.label}</div>
          ))}
        </div>
      </div>

      <div style={{padding:"0 18px"}}>

        {/* TODAY */}
        {tab==="today" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {MEAL_TYPES.map(mealType => {
              const slotMeals = todayMeals.filter(m => m.meal_type === mealType);
              const meal = slotMeals[0]; // for backward compat with cook button
              const recipe = meal ? recipes.find(r => r.id === meal.recipe_id) : null;
              return (
                <div key={mealType} className="card" style={{padding:"14px 16px",borderColor:slotMeals.some(m=>m.cooked)?T.green:T.border,cursor:'pointer'}}>
                  <div className="row" style={{marginBottom:slotMeals.length>0?10:0}}>
                    <div style={{display:"flex",gap:10,alignItems:"center",flex:1,minWidth:0}}>
                      <span style={{fontSize:22}}>{MEAL_EMOJI[mealType]}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,textTransform:"capitalize",color:T.muted}}>{mealType} {slotMeals.length>1?`(${slotMeals.length} items)`:""}</div>
                        <div style={{fontSize:15,fontWeight:600,color:slotMeals.length>0?T.text:T.dim}}>
                          {slotMeals.length===0 && "Not planned"}
                          {slotMeals.length===1 && (recipes.find(r=>r.id===slotMeals[0].recipe_id)?.name||"Unknown")}
                          {slotMeals.length>1 && slotMeals.map(m=>recipes.find(r=>r.id===m.recipe_id)?.name).filter(Boolean).join(" + ")}
                        </div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      {meal && !meal.cooked && (
                        <button onClick={()=>setCookLogModal({meal, recipe: recipes.find(r=>r.id===meal.recipe_id)})} disabled={cooking===meal.id}
                          style={{padding:"8px 14px",background:T.greenSoft,border:`1px solid rgba(109,155,107,0.3)`,borderRadius:10,color:T.green,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",display:"flex",alignItems:"center",gap:5}}>
                          {cooking===meal.id ? <div className="spinner" style={{width:14,height:14}}/> : "🍽 Log Meal"}
                        </button>
                      )}
                      {meal?.cooked && (
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <span style={{fontSize:12,color:T.green,fontWeight:700}}>✓ Done</span>
                          <button onClick={()=>setEditCookLog({meal, recipe: recipes.find(r=>r.id===meal.recipe_id)})}
                            style={{padding:"5px 10px",background:T.accentSoft,border:`1px solid ${T.border}`,borderRadius:8,color:T.accent,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
                            ✏️ Edit
                          </button>
                          <button onClick={()=>handleUndoCookLog(meal)}
                            style={{padding:"5px 10px",background:T.redSoft,border:`1px solid rgba(196,96,58,0.2)`,borderRadius:8,color:T.red,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
                            ↩ Undo
                          </button>
                        </div>
                      )}
                      <div onClick={()=>setAddMealModal({date:todayStr,meal_type:mealType})}
                        style={{width:32,height:32,borderRadius:10,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                        <I n="edit" s={14} c={T.accent}/>
                      </div>
                      {meal && !meal.cooked && (
                        <div onClick={()=>removeRecipeFromSlot(meal.id)}
                          style={{width:32,height:32,borderRadius:10,background:T.redSoft,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                          <I n="trash" s={14} c={T.red}/>
                        </div>
                      )}
                    </div>
                  </div>
                  {recipe && (
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <span className="tag" style={{background:T.accentSoft,color:T.accent}}>⏱ {recipe.prep_time_mins}min</span>
                      <span className="tag" style={{background:T.accentSoft,color:T.accent}}>👥 {recipe.servings}</span>
                      {(recipe.tags||[]).slice(0,2).map(tag=>(
                        <span key={tag} className="tag" style={{background:"#FAFAF8",color:T.muted}}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* WEEK */}
        {tab==="week" && (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>

            {/* Auto Plan Button */}
            <AutoPlanBar familyId={familyId} recipes={recipes} pantry={pantry} refreshMeal={refreshMeal} weekDates={weekDates}/>

            {weekDates.map(date => {
              const dayMeals = mealPlan.filter(m => m.plan_date === date);
              const d = new Date(date);
              const dayName = d.toLocaleDateString("en-IN",{weekday:"short"});
              const dayNum = d.getDate();
              const isToday = date === todayStr;
              return (
                <div key={date} className="card" style={{padding:"12px 14px",borderColor:isToday?T.accent:T.border}}>
                  <div className="row" style={{marginBottom:8}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <div style={{width:36,height:36,borderRadius:10,background:isToday?T.accent:T.accentSoft,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:9,fontWeight:700,color:isToday?"white":T.muted,textTransform:"uppercase"}}>{dayName}</span>
                        <span style={{fontSize:14,fontWeight:800,color:isToday?"white":T.text}}>{dayNum}</span>
                      </div>
                      {isToday && <span style={{fontSize:13,fontWeight:700,color:T.accent}}>Today</span>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                      <span style={{fontSize:12,fontWeight:700,color:dayMeals.filter(m=>m.cooked).length===MEAL_TYPES.length?T.green:T.muted}}>
                        {dayMeals.filter(m=>m.cooked).length}/{MEAL_TYPES.length} cooked
                      </span>
                      <div style={{display:"flex",gap:3}}>
                        {MEAL_TYPES.map(mt=>{
                          const m = dayMeals.find(x=>x.meal_type===mt);
                          return <div key={mt} style={{width:8,height:8,borderRadius:"50%",background:m?.cooked?T.green:m?T.accent:T.border}}/>;
                        })}
                      </div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                    {MEAL_TYPES.map(mt => {
                      const m = dayMeals.find(x => x.meal_type === mt);
                      const rec = m ? recipes.find(r => r.id === m.recipe_id) : null;
                      return (
                        <div key={mt} onClick={()=>setAddMealModal({date,meal_type:mt})}
                          style={{padding:"7px 9px",borderRadius:10,cursor:"pointer",background:m?.cooked?T.greenSoft:rec?T.accentSoft:"rgba(125,157,124,0.04)",border:`0.5px solid ${m?.cooked?T.green:rec?T.accent:T.border}`,transition:"all .15s"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div style={{fontSize:12,color:T.muted,fontWeight:700,textTransform:"capitalize"}}>{MEAL_EMOJI[mt]} {mt}</div>
                            {m?.cooked && <span style={{fontSize:9,color:T.green,fontWeight:800}}>✓</span>}
                            {m && !m.cooked && <span style={{fontSize:9,color:T.dim}}>○</span>}
                          </div>
                          <div style={{fontSize:11.5,fontWeight:600,color:rec?T.text:T.dim,marginTop:2,lineHeight:1.3}}>{rec ? rec.name : "+ Add"}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* RECIPES */}
        {tab==="recipes" && (
          <RecipeSearch
            recipes={recipes}
            pantry={pantry}
            familyId={familyId}
            todayStr={todayStr}
            mealPlan={mealPlan}
            onAssign={assignRecipe}
            onViewRecipe={async(r)=>{ setSelectedRecipe(r); setRecipeServings(r.servings||2); const {data} = await supabase.from("recipe_ingredients").select("*").eq("recipe_id",r.id); setRecipeIngredients(data||[]); }}
          />
        )}

        {/* PANTRY */}
        {/* SEARCH */}
        {tab==="search" && (
          <RecipeSearch
            recipes={recipes}
            pantry={pantry}
            familyId={familyId}
            todayStr={todayStr}
            mealPlan={mealPlan}
            onAssign={assignRecipe}
            onViewRecipe={(r) => {
              setSelectedRecipe(r);
              setTab("recipes");
              supabase.from("recipe_ingredients").select("*").eq("recipe_id", r.id).then(({data}) => setRecipeIngredients(data||[]));
            }}
          />
        )}
        {/* CAN COOK */}
        {tab==="suggest" && (
          <WhatCanICook
            recipes={recipes}
            pantry={pantry}
            familyId={familyId}
            onSelectRecipe={(r) => {
              setSelectedRecipe(r);
              setTab("recipes");
              supabase.from("recipe_ingredients").select("*").eq("recipe_id", r.id).then(({data}) => setRecipeIngredients(data||[]));
            }}
          />
        )}
        {tab==="pantry" && (
          <>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <button onClick={()=>setShowAddPantry(true)} className="btn-primary" style={{flex:1,height:44,fontSize:14,color:"#fff",fontWeight:700}}>+ Add Item</button>
            </div>

            {/* Search */}
            <div style={{position:"relative",marginBottom:10}}>
              <input className="input" placeholder="🔍 Search pantry... (Rice, Milk, Paneer)" value={pantrySearch} onChange={e=>setPantrySearch(e.target.value)} style={{paddingLeft:14}}/>
              {pantrySearch && <span onClick={()=>setPantrySearch("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:13,color:T.muted}}>✕</span>}
            </div>

            {/* Stock filter buttons */}
            {(()=>{
              const outCount = pantry.filter(p=>Number(p.quantity)<=0).length;
              const lowCount = pantry.filter(p=>Number(p.quantity)>0&&Number(p.quantity)<=Number(p.par_level)).length;
              const expCount = pantry.filter(p=>{ if(!p.expiry_date) return false; return Math.ceil((new Date(p.expiry_date)-new Date())/86400000)<=7; }).length;
              return (
                <div className="scroll-x" style={{marginBottom:10,gap:6}}>
                  {[
                    {id:"all",   label:"All",            count:pantry.length},
                    {id:"low",   label:"⚠️ Low Stock",   count:lowCount},
                    {id:"out",   label:"🔴 Out of Stock", count:outCount},
                    {id:"expiring",label:"⏰ Expiring",  count:expCount},
                  ].map(f=>(
                    <div key={f.id} onClick={()=>setPantryStockFilter(f.id)}
                      style={{display:"inline-flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:20,border:`1px solid ${pantryStockFilter===f.id?T.accent:T.border}`,background:pantryStockFilter===f.id?T.accentSoft:"transparent",color:pantryStockFilter===f.id?T.accent:T.muted,fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                      {f.label}
                      <span style={{background:pantryStockFilter===f.id?T.accent:"rgba(255,255,255,0.1)",color:pantryStockFilter===f.id?"#fff":T.muted,borderRadius:20,padding:"0 6px",fontSize:12,fontWeight:700}}>{f.count}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Category filter chips */}
            <div className="scroll-x" style={{marginBottom:12,gap:6}}>
              {["All","Grains","Pulses","Dairy","Vegetables","Fruits","Oils","Spices","Beverages","Snacks","Frozen","Child","Household","Personal","Other"].map(cat=>(
                <div key={cat} onClick={()=>setPantryCatFilter(cat)}
                  style={{display:"inline-flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:20,border:`1px solid ${pantryCatFilter===cat?T.accent:T.border}`,background:pantryCatFilter===cat?T.accent:"transparent",color:pantryCatFilter===cat?"#fff":T.muted,fontSize:12,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                  {{"All":"📦","Grains":"🌾","Pulses":"🫘","Dairy":"🥛","Vegetables":"🥦","Fruits":"🍎","Oils":"🫙","Spices":"🌶️","Beverages":"☕","Snacks":"🍞","Frozen":"🧊","Child":"👶","Household":"🧹","Personal":"🧴","Other":"🗂️"}[cat]} {cat}
                </div>
              ))}
            </div>

            {/* Low stock alert */}
            {lowStock.length > 0 && pantryStockFilter==="all" && pantryCatFilter==="All" && !pantrySearch && (
              <div style={{padding:"10px 14px",background:T.amberSoft,border:"1px solid rgba(251,191,36,0.22)",borderRadius:12,marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700,color:T.amber}}>🛒 {lowStock.length} item{lowStock.length>1?"s":""} running low</div>
                <div style={{fontSize:11.5,color:T.muted,marginTop:2,lineHeight:1.5}}>{lowStock.slice(0,8).map(i=>i.name).join(", ")}{lowStock.length>8?` +${lowStock.length-8} more`:""}</div>
              </div>
            )}

            {/* Results count */}
            {(()=>{
              const filtered = pantry.filter(p=>{
                const matchSearch = !pantrySearch || p.name.toLowerCase().includes(pantrySearch.toLowerCase()) || (p.category||"").toLowerCase().includes(pantrySearch.toLowerCase());
                const matchCat = pantryCatFilter==="All" || (p.category||"").toLowerCase()===pantryCatFilter.toLowerCase();
                const matchStock = pantryStockFilter==="all" ? true
                  : pantryStockFilter==="low"  ? (Number(p.quantity)>0 && Number(p.quantity)<=Number(p.par_level))
                  : pantryStockFilter==="out"  ? Number(p.quantity)<=0
                  : pantryStockFilter==="expiring" ? (p.expiry_date && Math.ceil((new Date(p.expiry_date)-new Date())/86400000)<=7)
                  : true;
                return matchSearch && matchCat && matchStock;
              });
              return <div style={{fontSize:11,color:T.muted,fontWeight:600,marginBottom:8}}>Showing {filtered.length} of {pantry.length} items {(pantrySearch||pantryCatFilter!=="All"||pantryStockFilter!=="all") && <span onClick={()=>{setPantrySearch("");setPantryCatFilter("All");setPantryStockFilter("all");}} style={{marginLeft:6,color:T.red,cursor:"pointer",fontWeight:700}}>✕ Clear</span>}</div>;
            })()}

            {pantry.length === 0
              ? <div className="empty"><div className="empty-icon">🧺</div><div className="empty-text">Pantry is empty.<br/>Add items to start tracking.</div></div>
              : <div className="card" style={{padding:"2px 14px"}}>
                  {pantry.filter(p=>{
                    const matchSearch = !pantrySearch || p.name.toLowerCase().includes(pantrySearch.toLowerCase()) || (p.category||"").toLowerCase().includes(pantrySearch.toLowerCase());
                    const matchCat = pantryCatFilter==="All" || (p.category||"").toLowerCase()===pantryCatFilter.toLowerCase();
                    const matchStock = pantryStockFilter==="all" ? true
                      : pantryStockFilter==="low"  ? (Number(p.quantity)>0 && Number(p.quantity)<=Number(p.par_level))
                      : pantryStockFilter==="out"  ? Number(p.quantity)<=0
                      : pantryStockFilter==="expiring" ? (p.expiry_date && Math.ceil((new Date(p.expiry_date)-new Date())/86400000)<=7)
                      : true;
                    return matchSearch && matchCat && matchStock;
                  }).map(item => {
                    const isLow = Number(item.quantity) <= Number(item.par_level);
                    const pct_ = item.par_level > 0 ? Math.min(100, Math.round((item.quantity / (item.par_level * 3)) * 100)) : 100;
                    return (
                      <div key={item.id} className="list-row" onClick={()=>{setEf({name:item.name,category:item.category,quantity:String(item.quantity),unit:item.unit,par_level:String(item.par_level)});setEditPantryItem(item);}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:isLow?T.red:T.green,flexShrink:0}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:500}}>{item.name}</div>
                          <div style={{fontSize:11.5,color:T.muted}}>{item.category}</div>
                          <div className="progress" style={{marginTop:5,height:3}}>
                            <div className="progress-fill" style={{width:`${pct_}%`,background:isLow?T.red:pct_<50?T.amber:T.green}}/>
                          </div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{textAlign:"right",minWidth:60}}>
                            <div style={{fontSize:14,fontWeight:700,color:isLow?T.red:T.text}}>{item.quantity} {item.unit}</div>
                            {(()=>{ const d=calcDaysRemaining(item.quantity,item.unit,item.name); return d!==null ? <div style={{fontSize:12,color:d<=3?"#C4603A":d<=7?"#C4883A":"#6D9B6B",fontWeight:600}}>{d}d left</div> : null; })()}
                            {isLow && <div style={{fontSize:12,color:T.red,fontWeight:600}}>Restock!</div>}
                          </div>
                          <div style={{opacity:0.4}}><I n="edit" s={14} c={T.accent}/></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
          </>
        )}

        {/* SHOP */}
        {tab==="health" && <HealthAnalysisTab familyId={familyId}/>}
        {tab==="shop" && (
          <>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <button onClick={()=>setEditShopItem({isNew:true,item_name:"",quantity_needed:"",unit:"kg",category:"Vegetables"})} className="btn-primary" style={{flex:1,height:44,fontSize:14}}>+ Add Item</button>
              <button onClick={async()=>{
                setRestocking(true);
                const lowItems = pantry.filter(p=>Number(p.quantity)<=Number(p.par_level));
                const emptyItems = pantry.filter(p=>Number(p.quantity)===0);
                let added = 0;
                for (const item of [...new Set([...emptyItems,...lowItems])]) {
                  const exists = shopping.find(s=>s.item_name.toLowerCase()===item.name.toLowerCase()&&!s.purchased);
                  if (!exists) {
                    await supabase.from("shopping_list").insert([{
                      family_id:familyId, item_name:item.name,
                      quantity_needed: item.par_level>0 ? item.par_level : 1,
                      unit:item.unit, category:item.category||"Other", purchased:false,
                      added_at:new Date().toISOString()
                    }]);
                    added++;
                  }
                }
                await refreshShopping();
                setRestocking(false);
                showToast({title:"🛒 Restock Updated",body:`${added} low/empty items added to list.`,icon:"🛒",color:T.amber});
              }} disabled={restocking}
                style={{height:44,padding:"0 14px",background:T.amberSoft,border:`0.5px solid ${T.amber}44`,borderRadius:14,color:T.amber,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",whiteSpace:"nowrap"}}>
                {restocking ? "..." : "↻ Restock"}
              </button>
            </div>
            {pantry.filter(p=>Number(p.quantity)<=Number(p.par_level)).length > 0 && (
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:T.amber,textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>
                  ⚠️ Low / Finished ({pantry.filter(p=>Number(p.quantity)<=Number(p.par_level)).length})
                </div>
                <div className="card" style={{padding:"2px 14px",borderColor:`${T.amber}44`}}>
                  {pantry.filter(p=>Number(p.quantity)<=Number(p.par_level)).sort((a,b)=>Number(a.quantity)-Number(b.quantity)).map(item=>(
                    <div key={item.id} className="list-row">
                      <div style={{width:8,height:8,borderRadius:"50%",background:Number(item.quantity)===0?T.red:T.amber,flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:T.text}}>{item.name}</div>
                        <div style={{fontSize:11,color:T.muted}}>{Number(item.quantity)===0?"Empty":item.quantity+" "+item.unit+" remaining"}</div>
                      </div>
                      <button onClick={async()=>{
                        const exists = shopping.find(s=>s.item_name.toLowerCase()===item.name.toLowerCase()&&!s.purchased);
                        if (!exists) {
                          await supabase.from("shopping_list").insert([{family_id:familyId,item_name:item.name,quantity_needed:item.par_level>0?item.par_level:1,unit:item.unit,category:item.category||"Other",purchased:false,added_at:new Date().toISOString()}]);
                          await refreshShopping();
                          showToast({title:"✓ Added",body:`${item.name} added to list`,icon:"🛒",color:T.green});
                        }
                      }} style={{fontSize:11,fontWeight:700,color:T.accent,background:T.accentSoft,border:"none",borderRadius:8,padding:"4px 10px",cursor:"pointer"}}>
                        {shopping.find(s=>s.item_name.toLowerCase()===item.name.toLowerCase()&&!s.purchased)?"✓ Listed":"+ Add"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {shopping.filter(s=>!s.purchased).length === 0
              ? <div className="empty"><div className="empty-icon">🛒</div><div className="empty-text">Shopping list is empty!<br/>Mark meals as cooked to auto-populate.</div></div>
              : <>
                  <div style={{fontSize:13,fontWeight:700,color:T.muted,marginBottom:8}}>TO BUY ({shopping.filter(s=>!s.purchased).length})</div>
                  <div className="card" style={{padding:"2px 14px",marginBottom:14}}>
                    {shopping.filter(s=>!s.purchased).map(item=>(
                      <div key={item.id} className="list-row">
                        <div onClick={()=>updShopping(item.id,{purchased:true})}
                          style={{width:22,height:22,borderRadius:8,border:`2px solid ${T.green}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:500}}>{item.item_name}</div>
                          <div style={{fontSize:11.5,color:T.muted}}>{item.category}{item.quantity_needed ? ` · ${item.quantity_needed} ${item.unit}` : ""}</div>
                        </div>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <div onClick={(e)=>{e.stopPropagation();setEditShopItem({...item,isNew:false});}} style={{opacity:0.4,cursor:"pointer"}}><I n="edit" s={14} c={T.accent}/></div>
                          <div onClick={()=>removeShopping(item.id)} style={{cursor:"pointer",opacity:0.35}}><I n="trash" s={14} c={T.red}/></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {shopping.filter(s=>s.purchased).length > 0 && (
                    <>
                      <div style={{fontSize:13,fontWeight:700,color:T.muted,marginBottom:8}}>DONE ({shopping.filter(s=>s.purchased).length})</div>
                      <div className="card" style={{padding:"2px 14px",opacity:0.55}}>
                        {shopping.filter(s=>s.purchased).map(item=>(
                          <div key={item.id} className="list-row">
                            <div style={{width:22,height:22,borderRadius:8,background:T.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              <I n="check" s={12} c="white" w={2.5}/>
                            </div>
                            <div style={{flex:1,textDecoration:"line-through"}}>
                              <div style={{fontSize:14}}>{item.item_name}</div>
                            </div>
                            <div onClick={()=>removeShopping(item.id)} style={{cursor:"pointer",opacity:0.35}}><I n="trash" s={14} c={T.red}/></div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
            }
          </>
        )}
      </div>

      {/* SHOP EDIT MODAL */}{editShopItem && (<Modal title={editShopItem.isNew ? "Add Item" : "Edit Item"} onClose={()=>setEditShopItem(null)}><div style={{display:"flex",flexDirection:"column",gap:10}}><input className="input" placeholder="Item name" autoFocus defaultValue={editShopItem.item_name} onChange={e=>setEditShopItem(x=>({...x,item_name:e.target.value}))}/><div style={{display:"flex",gap:8}}><input className="input" type="number" placeholder="Qty" defaultValue={editShopItem.quantity_needed} onChange={e=>setEditShopItem(x=>({...x,quantity_needed:e.target.value}))} style={{flex:1}}/><select className="input" defaultValue={editShopItem.unit||"kg"} onChange={e=>setEditShopItem(x=>({...x,unit:e.target.value}))} style={{flex:1}}>{["kg","g","L","ml","pcs","pack","dozen"].map(u=><option key={u}>{u}</option>)}</select></div><select className="input" defaultValue={editShopItem.category||"Vegetables"} onChange={e=>setEditShopItem(x=>({...x,category:e.target.value}))}>{["Vegetables","Dairy","Grains","Pulses","Fruits","Snacks","Spices","Oils","Beverages","Other"].map(c=><option key={c}>{c}</option>)}</select><button className="btn-primary" onClick={async()=>{if(!editShopItem.item_name) return;if(editShopItem.isNew){await supabase.from("shopping_list").insert([{family_id:familyId,item_name:editShopItem.item_name,quantity_needed:Number(editShopItem.quantity_needed)||null,unit:editShopItem.unit||"kg",category:editShopItem.category||"Other",purchased:false,added_at:new Date().toISOString()}]);}else{await supabase.from("shopping_list").update({item_name:editShopItem.item_name,quantity_needed:Number(editShopItem.quantity_needed)||null,unit:editShopItem.unit,category:editShopItem.category}).eq("id",editShopItem.id);}setEditShopItem(null);}}>{editShopItem.isNew?"Add to List":"Save Changes"}</button>{!editShopItem.isNew&&(<button onClick={async()=>{await supabase.from("shopping_list").delete().eq("id",editShopItem.id);setEditShopItem(null);}} style={{width:"100%",padding:"14px",background:"rgba(196,96,58,0.12)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:14,color:"#C4603A",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"Plus Jakarta Sans,sans-serif"}}>Delete Item</button>)}</div></Modal>)}
            {/* RECIPE DETAIL MODAL */}
      {selectedRecipe && (
        <div className="modal-bg" onClick={()=>setSelectedRecipe(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"85vh",overflowY:"auto",background:"#1E1E30"}}>
                {/* Header */}
            <div className="row" style={{marginBottom:12}}>
              <div style={{flex:1}}>
                <div style={{fontSize:20,fontWeight:800,color:T.text}}>{selectedRecipe.name}</div>
                <div style={{fontSize:12,color:T.muted,marginTop:3}}>
                  {MEAL_EMOJI[selectedRecipe.meal_type]} {selectedRecipe.meal_type} · ⏱ {selectedRecipe.prep_time_mins}min
                </div>
              </div>
              <div onClick={()=>setSelectedRecipe(null)} style={{width:32,height:32,borderRadius:10,background:"rgba(125,157,124,0.08)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                <I n="x" s={15} c={T.muted}/>
              </div>
            </div>
            {/* Tags */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {(selectedRecipe.tags||[]).map(tag=>(
                <span key={tag} className="tag" style={{background:T.accentSoft,color:T.accent,fontSize:11}}>{tag}</span>
              ))}
            </div>
            {/* Serving scaler */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:T.accentSoft,borderRadius:14,marginBottom:16,border:`1px solid ${T.accent}33`}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:T.accent}}>👥 Servings</div>
                <div style={{fontSize:11,color:T.muted,marginTop:2}}>Quantities auto-scale</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div onClick={()=>setRecipeServings(s=>Math.max(1,s-1))} style={{width:34,height:34,borderRadius:10,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,color:"#fff",fontWeight:700,userSelect:"none"}}>−</div>
                <div style={{fontSize:22,fontWeight:900,color:T.accent,minWidth:24,textAlign:"center"}}>{recipeServings}</div>
                <div onClick={()=>setRecipeServings(s=>Math.min(20,s+1))} style={{width:34,height:34,borderRadius:10,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,color:"#fff",fontWeight:700,userSelect:"none"}}>+</div>
              </div>
            </div>
            {/* Stats row */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
              {[
                {l:"Base servings", v:selectedRecipe.servings||2},
                {l:"Your servings", v:recipeServings},
                {l:"Scale factor", v:`×${(recipeServings/(selectedRecipe.servings||2)).toFixed(1)}`},
              ].map(s=>(
                <div key={s.l} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"8px",textAlign:"center"}}>
                  <div style={{fontSize:15,fontWeight:800,color:T.text}}>{s.v}</div>
                  <div style={{fontSize:12,color:T.muted,marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>
            {/* Ingredients */}
            <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>
              Ingredients for {recipeServings} serving{recipeServings!==1?"s":""}
            </div>
            {recipeIngredients.length === 0
              ? <div style={{fontSize:13,color:T.muted,padding:"10px 0"}}>Loading ingredients...</div>
              : <div className="card" style={{padding:"2px 14px",marginBottom:14}}>
                  {recipeIngredients.map((ing,i) => {
                    const scale = recipeServings / (selectedRecipe.servings || 2);
                    const scaledQty = Math.round(Number(ing.quantity) * scale * 10) / 10;
                    const pantryItem = pantry.find(p=>p.name.toLowerCase()===ing.pantry_item_name.toLowerCase());
                    const hasEnough = pantryItem && Number(pantryItem.quantity) >= scaledQty;
                    const statusIcon = hasEnough ? "✅" : pantryItem ? "⚠️" : "❌";
                    const statusColor = hasEnough ? T.green : pantryItem ? T.amber : T.red;
                    return (
                      <div key={i} className="list-row" style={{cursor:"default"}}>
                        <span style={{fontSize:18,flexShrink:0}}>{statusIcon}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:600,color:T.text}}>{ing.pantry_item_name}</div>
                          <div style={{fontSize:11.5,color:T.muted,marginTop:1}}>
                            Need: <strong style={{color:T.text}}>{scaledQty} {ing.unit}</strong>
                            {scale !== 1 && <span style={{color:T.dim}}> (base: {ing.quantity} {ing.unit})</span>}
                          </div>
                        </div>
                        <div style={{textAlign:"right",minWidth:80}}>
                          <div style={{fontSize:13,fontWeight:700,color:statusColor}}>
                            {pantryItem ? `${pantryItem.quantity} ${pantryItem.unit}` : "Not in pantry"}
                          </div>
                          {pantryItem && !hasEnough && (
                            <div style={{fontSize:12,color:T.amber,fontWeight:600,marginTop:2}}>
                              Need {Math.max(0, scaledQty - Number(pantryItem.quantity)).toFixed(1)} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
            {/* Need to buy */}
            {(()=>{
              const scale = recipeServings / (selectedRecipe.servings || 2);
              const missing = recipeIngredients.filter(ing => {
                const pantryItem = pantry.find(p=>p.name.toLowerCase()===ing.pantry_item_name.toLowerCase());
                return !pantryItem || Number(pantryItem.quantity) < Number(ing.quantity) * scale;
              });
              if (!missing.length) return (
                <div style={{padding:"12px 14px",background:T.greenSoft,border:`1px solid ${T.green}33`,borderRadius:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:T.green}}>✅ You have everything!</div>
                  <div style={{fontSize:12,color:T.muted,marginTop:3}}>All ingredients available in pantry for {recipeServings} servings.</div>
                </div>
              );
              return (
                <div style={{padding:"12px 14px",background:T.amberSoft,border:"1px solid rgba(251,191,36,0.22)",borderRadius:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:T.amber}}>🛒 Need to buy ({missing.length} items):</div>
                  <div style={{fontSize:12,color:T.muted,marginTop:6,lineHeight:1.8}}>
                    {missing.map((ing,i) => {
                      const scale2 = recipeServings / (selectedRecipe.servings || 2);
                      const scaledQty = Math.round(Number(ing.quantity) * scale2 * 10) / 10;
                      const pantryItem = pantry.find(p=>p.name.toLowerCase()===ing.pantry_item_name.toLowerCase());
                      const shortfall = pantryItem ? Math.max(0, scaledQty - Number(pantryItem.quantity)).toFixed(1) : scaledQty;
                      return (
                        <span key={i} style={{display:"inline-flex",alignItems:"center",gap:4,marginRight:8,marginBottom:4,padding:"3px 10px",borderRadius:20,background:"rgba(251,191,36,0.15)",color:T.amber,fontWeight:600,fontSize:12}}>
                          {ing.pantry_item_name} · {shortfall} {ing.unit}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {/* ASSIGN RECIPE MODAL */}
      {addMealModal && (
        <div className="modal-overlay" onClick={()=>setAddMealModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()} style={{maxHeight:"92vh",height:"92vh",overflowY:"auto",borderRadius:"24px 24px 0 0",paddingBottom:40}}>
                <div className="row" style={{marginBottom:14}}>
              <span style={{fontSize:18,fontWeight:700,color:T.text}}>
                {MEAL_EMOJI[addMealModal.meal_type]} {addMealModal.meal_type.charAt(0).toUpperCase()+addMealModal.meal_type.slice(1)} — Add Items
              </span>
              <div onClick={()=>setAddMealModal(null)} style={{width:44,height:44,borderRadius:12,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <I n="x" s={15} c={T.muted}/>
              </div>
            </div>
            <MealPickerSearch
              recipes={recipes}
              defaultMealType={addMealModal.meal_type}
              familyId={familyId}
              onSelect={(r) => { assignRecipe(r.id, addMealModal.date, addMealModal.meal_type); }}
              selectedRecipeIds={(mealPlan.filter(m=>m.plan_date===addMealModal.date&&m.meal_type===addMealModal.meal_type)).map(m=>m.recipe_id)}
              onDone={()=>setAddMealModal(null)}
            />
          </div>
        </div>
      )}

      
      {/* EDIT PANTRY MODAL */}
      {editPantryItem && (
        <Modal title="Edit Pantry Item" onClose={()=>setEditPantryItem(null)}>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <input className="input" placeholder="Item name" value={ef.name} onChange={e=>setEf(x=>({...x,name:e.target.value}))} autoFocus/>
            <select className="input" value={ef.category} onChange={e=>setEf(x=>({...x,category:e.target.value}))}>
              {PANTRY_CATS.map(c=><option key={c}>{c}</option>)}
            </select>
            <div style={{display:"flex",gap:8}}>
              <input className="input" type="number" placeholder="Qty" value={ef.quantity} onChange={e=>setEf(x=>({...x,quantity:e.target.value}))} style={{flex:1}}/>
              <select className="input" value={ef.unit} onChange={e=>setEf(x=>({...x,unit:e.target.value}))} style={{flex:1}}>
                {["kg","g","L","ml","pcs","pack","dozen"].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <input className="input" type="number" placeholder="Reorder level" value={ef.par_level} onChange={e=>setEf(x=>({...x,par_level:e.target.value}))}/>
            <button className="btn-primary" onClick={async()=>{
              if(!ef.name||!ef.quantity) return;
              await supabase.from("pantry").update({name:ef.name,category:ef.category,quantity:Number(ef.quantity),unit:ef.unit,par_level:Number(ef.par_level)||0,updated_at:new Date().toISOString()}).eq("id",editPantryItem.id);
              await refreshPantry();
              setEditPantryItem(null);
            }}>Save Changes</button>
            <button onClick={async()=>{
              await supabase.from("pantry").delete().eq("id",editPantryItem.id);
              await refreshPantry();
              setEditPantryItem(null);
            }} style={{width:"100%",padding:"14px",background:"rgba(196,96,58,0.12)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:14,color:"#C4603A",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
              🗑 Delete Item
            </button>
          </div>
        </Modal>
      )}

      {/* ADD PANTRY MODAL */}
      {showAddPantry && (
        <Modal title="Add Pantry Item" onClose={()=>setShowAddPantry(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <input className="input" placeholder="Item name (e.g. Basmati Rice)" value={pf.name} onChange={e=>setPf(x=>({...x,name:e.target.value}))} autoFocus/>
            <select className="input" value={pf.category} onChange={e=>setPf(x=>({...x,category:e.target.value}))}>
              {PANTRY_CATS.map(c=><option key={c}>{c}</option>)}
            </select>
            <div style={{display:"flex",gap:8}}>
              <input className="input" type="number" placeholder="Qty" value={pf.quantity} onChange={e=>setPf(x=>({...x,quantity:e.target.value}))} style={{flex:1}}/>
              <select className="input" value={pf.unit} onChange={e=>setPf(x=>({...x,unit:e.target.value}))} style={{flex:1}}>
                {["kg","g","L","ml","pcs","pack","dozen"].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <input className="input" type="number" placeholder="Reorder level (alert when below this)" value={pf.par_level} onChange={e=>setPf(x=>({...x,par_level:e.target.value}))}/>
            <button className="btn-primary" onClick={savePantryItem}>Save Item</button>
          </div>
        </Modal>
      )}

      {/* EDIT COOK LOG MODAL */}
      {editCookLog && (
        <div className="modal-overlay" onClick={()=>setEditCookLog(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()} style={{maxWidth:380}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div>
                <div style={{fontSize:17,fontWeight:800}}>✏️ Edit Meal Log</div>
                <div style={{fontSize:13,color:T.muted,marginTop:2}}>{editCookLog.recipe?.name || "Unknown Recipe"}</div>
              </div>
              <div onClick={()=>setEditCookLog(null)} style={{width:44,height:44,borderRadius:12,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <I n="x" s={15} c={T.muted}/>
              </div>
            </div>
            <CookLogForm
              meal={editCookLog.meal}
              recipe={editCookLog.recipe}
              familyId={familyId}
              recipes={recipes}
              pantry={pantry}
              onDone={async (logData) => {
                setEditCookLog(null);
                try {
                  // Find existing cook log
                  const { data: logs } = await supabase.from("cook_logs")
                    .select("*").eq("family_id", familyId)
                    .eq("recipe_name", editCookLog.recipe?.name || "")
                    .order("cooked_at", {ascending:false}).limit(1);
                  if (logs?.length) {
                    const log = logs[0];
                    // Restore pantry from old transactions
                    const { data: txns } = await supabase.from("pantry_transactions").select("*").eq("cook_log_id", log.id);
                    for (const txn of (txns||[])) {
                      const item = pantry.find(p=>p.name.toLowerCase()===txn.pantry_item_name.toLowerCase());
                      if (item) {
                        await supabase.from("pantry").update({ quantity: Number(item.quantity)+Number(txn.quantity_used), updated_at: new Date().toISOString() }).eq("id", item.id);
                      }
                    }
                    await supabase.from("pantry_transactions").delete().eq("cook_log_id", log.id);
                    await supabase.from("cook_logs").delete().eq("id", log.id);
                  }
                  // Re-log with new values
                  const ratio = logData.quantityMade / (editCookLog.recipe?.servings || 3);
                  const { data: ingredients } = await supabase.from("recipe_ingredients").select("*").eq("recipe_id", editCookLog.meal.recipe_id);
                  const deducted = [];
                  for (const ing of (ingredients||[])) {
                    const needed = Number(ing.quantity) * ratio;
                    const item = pantry.find(p=>p.name.toLowerCase()===ing.pantry_item_name.toLowerCase());
                    if (item) {
                      const newQty = Math.max(0, Number(item.quantity)-needed);
                      await supabase.from("pantry").update({ quantity: newQty, updated_at: new Date().toISOString() }).eq("id", item.id);
                      deducted.push({ name: ing.pantry_item_name, used: needed, unit: ing.unit });
                    }
                  }
                  const { data: newLog } = await supabase.from("cook_logs").insert([{
                    family_id: familyId, recipe_id: editCookLog.meal.recipe_id,
                    recipe_name: editCookLog.recipe?.name || "Unknown",
                    quantity_made: logData.quantityMade, unit_label: logData.unitLabel,
                    people_served_adults: logData.adults, people_served_children: logData.children,
                    people_served_guests: logData.guests, leftovers: logData.leftovers,
                    cooked_at: new Date().toISOString(),
                  }]).select().single();
                  for (const d of deducted) {
                    await supabase.from("pantry_transactions").insert([{
                      family_id: familyId, pantry_item_name: d.name, quantity_used: d.used,
                      unit: d.unit, recipe_name: editCookLog.recipe?.name || "Unknown",
                      cook_log_id: newLog?.id || null, transaction_date: new Date().toISOString().split("T")[0],
                    }]);
                  }
                  await refreshPantry();
                  showToast({ title: "✏️ Meal Updated", body: `Logged ${logData.quantityMade} ${logData.unitLabel}. Pantry recalculated.`, icon: "✏️", color: T.accent });
                } catch(e) { console.error(e); }
              }}
              onClose={()=>setEditCookLog(null)}
            />
          </div>
        </div>
      )}

      {/* COOK LOG MODAL */}
      {cookLogModal && (
        <div className="modal-overlay" onClick={()=>setCookLogModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()} style={{maxWidth:380}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div>
                <div style={{fontSize:17,fontWeight:800}}>🍽 Log Meal</div>
                <div style={{fontSize:13,color:T.muted,marginTop:2}}>{cookLogModal.recipe?.name || "Unknown Recipe"}</div>
              </div>
              <div onClick={()=>setCookLogModal(null)} style={{width:30,height:30,borderRadius:10,background:"rgba(125,157,124,0.08)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <I n="x" s={15} c={T.muted}/>
              </div>
            </div>
            <NutritionCookLog meal={cookLogModal.meal} recipe={cookLogModal.recipe} familyId={familyId} onDone={async (logData) => { setCooking(cookLogModal.meal.id); setCookLogModal(null); try { const ratio = logData.quantityMade / (cookLogModal.recipe?.servings || 3); const { data: ingredients } = await supabase.from("recipe_ingredients").select("*").eq("recipe_id", cookLogModal.meal.recipe_id); const deducted = []; const lowStockItems = []; for (const ing of (ingredients || [])) { const needed = Number(ing.quantity) * ratio; const pantryItem = pantry.find(p => p.name.toLowerCase() === ing.pantry_item_name.toLowerCase()); if (pantryItem) { const newQty = Math.max(0, Number(pantryItem.quantity) - needed); await supabase.from("pantry").update({ quantity: newQty, updated_at: new Date().toISOString() }).eq("id", pantryItem.id); deducted.push({ name: ing.pantry_item_name, used: needed, unit: ing.unit, remaining: newQty }); if (newQty <= Number(pantryItem.par_level)) { lowStockItems.push({ name: pantryItem.name, qty: newQty, unit: pantryItem.unit, category: pantryItem.category }); } } } const { data: cookLog } = await supabase.from("cook_logs").insert([{ family_id: familyId, recipe_id: cookLogModal.meal.recipe_id, recipe_name: cookLogModal.recipe?.name || "Unknown", quantity_made: logData.quantityMade, unit_label: logData.unitLabel, people_served_adults: logData.adults, people_served_children: logData.children, people_served_guests: logData.guests, leftovers: logData.leftovers, cooked_at: new Date().toISOString() }]).select().single(); for (const d of deducted) { await supabase.from("pantry_transactions").insert([{ family_id: familyId, pantry_item_name: d.name, quantity_used: d.used, unit: d.unit, recipe_name: cookLogModal.recipe?.name || "Unknown", cook_log_id: cookLog?.id || null, transaction_date: new Date().toISOString().split("T")[0] }]); } await supabase.from("meal_plan").update({ cooked: true, cooked_at: new Date().toISOString() }).eq("id", cookLogModal.meal.id); for (const item of lowStockItems) { const { data: ex } = await supabase.from("shopping_list").select("id").eq("family_id", familyId).eq("item_name", item.name).eq("purchased", false); if (!ex?.length) { await supabase.from("shopping_list").insert([{ family_id: familyId, item_name: item.name, quantity_needed: item.qty <= 0 ? 1 : item.qty, unit: item.unit, category: item.category, purchased: false }]); } notifyPantryLow(familyId, { name: item.name, quantity: item.qty, unit: item.unit }); } await refreshPantry(); await refreshMeal(); showToast({ title: "🍽 Meal Logged!", body: logData.quantityMade + " " + logData.unitLabel + " cooked. " + deducted.length + " ingredients deducted.", icon: "🍽", color: "#6D9B6B" }); } catch(e) { console.error(e); } setCooking(null); }} onClose={()=>setCookLogModal(null)}/>
          </div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════
// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
const Nav = ({ active, go }) => (
  <nav className="bottom-nav">
    {[
      {id:"home",    icon:"home",    lbl:"Home"},
      {id:"finance", icon:"finance", lbl:"Wallet"},
      {id:"household",icon:"house",  lbl:"House"},
      {id:"kitchen", icon:"kitchen", lbl:"Kitchen"},
      {id:"grocery", icon:"kitchen", lbl:"Grocery"},
      {id:"planner", icon:"plan",    lbl:"Plan"},
      {id:"ai",      icon:"ai",      lbl:"AI"},
      {id:"profile", icon:"profile", lbl:"Me"},
    ].map(it=>(
      <div key={it.id} className={`nav-btn ${active===it.id?"on":""}`} onClick={()=>{ go(it.id); setTimeout(()=>{ const el=document.querySelector('.screen'); if(el) el.scrollTop=0; window.scrollTo(0,0); },50); }}>
        <I n={it.icon} s={19} c={active===it.id?T.accent:T.muted}/>
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
  const FAMILY_ID = "gupta-family-001";

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setUser(session?.user??null);
      setAuthLoading(false);
    });
    // Refresh when app becomes visible again
    const onVisible = () => { if(document.visibilityState==="visible") { window.dispatchEvent(new Event("familyos-refresh")); } };
    document.addEventListener("visibilitychange", onVisible);

    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,session)=>{ setUser(session?.user??null); });
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
    home:      <HomeScreen navigate={setScreen} openModal={setModal} familyId={FAMILY_ID} user={user}/>,
    finance:   <FinanceScreen familyId={FAMILY_ID}/>,
    household: <HouseholdScreen familyId={FAMILY_ID}/>,
    kitchen:   <KitchenScreen familyId={FAMILY_ID}/>,
    planner:   <PlannerScreen familyId={FAMILY_ID}/>,
    ai:        <AIScreen familyId={FAMILY_ID}/>,
    profile:   <ProfileScreen user={user} onSignOut={signOut} familyId={FAMILY_ID}/>,
    grocery:   <SmartGrocery familyId={FAMILY_ID}/>,
  };

  return (
    <div className="root">
      <Styles/>
      {screens[screen]||screens.home}
      <Nav active={screen} go={setScreen}/>
      <ToastRenderer/>
      <MealTimeReminder familyId={FAMILY_ID}/>
      <VoiceCommandButton familyId={FAMILY_ID}/>
      <GlobalFAB screen={screen} familyId={FAMILY_ID}/>
      {modal==="income"  && <AddIncomeModal  onClose={()=>setModal(null)} familyId={FAMILY_ID}/>}
      {modal==="expense" && <AddExpenseModal onClose={()=>setModal(null)} familyId={FAMILY_ID}/>}
      {modal==="task"    && <AddTaskModal    onClose={()=>setModal(null)} familyId={FAMILY_ID}/>}
      {modal==="grocery" && <AddGroceryModal onClose={()=>setModal(null)} familyId={FAMILY_ID}/>}
    </div>
  );
}
