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
    color: "#34D399", type: "income",
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
    icon: "💸", color: "#F87171", type: "expense",
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
  const n = { title: "✅ New Task Added", body: title, icon: "✅", color: "#34D399", type: "task" };
  showToast(n); saveNotif(familyId, n);
  sendEmail("task", { title, assignee: assignee || "Unassigned", priority: priority || "medium", due_date });
};
const notifyEventAdded = (familyId, { title, date, type }) => {
  const n = {
    title: "📅 Event Scheduled",
    body: `${title}${date ? " on " + date : ""}`,
    icon: "📅", color: "#60A5FA", type: "event",
  };
  showToast(n); saveNotif(familyId, n);
  sendEmail("event", { title, event_date: date, type: type || "personal" });
};
const notifyGroceryAdded = (familyId, { name }) => {
  const n = { title: "🛒 Shopping Item Added", body: `${name} added to shopping list.`, icon: "🛒", color: "#FBBF24", type: "grocery" };
  showToast(n); saveNotif(familyId, n);
};
const notifyNoteAdded = (familyId) => {
  const n = { title: "📝 Note Saved", body: "Note saved successfully.", icon: "📝", color: "#60A5FA", type: "note" };
  showToast(n); saveNotif(familyId, n);
};
const notifyReminderAdded = (familyId, { content, due_date }) => {
  const n = { title: "⏰ Reminder Set", body: content, icon: "⏰", color: "#F472B6", type: "reminder" };
  showToast(n); saveNotif(familyId, n);
  sendEmail("reminder", { content, due_date: due_date || "Today" });
};
const notifyGoalAdded = (familyId, { title }) => {
  const n = { title: "🎯 Goal Created", body: title, icon: "🎯", color: "#A78BFA", type: "goal" };
  showToast(n); saveNotif(familyId, n);
};
const notifyPantryLow = (familyId, { name, quantity, unit }) => {
  const n = { title: "📦 Pantry Low", body: `${name}: ${quantity} ${unit} remaining`, icon: "📦", color: "#FBBF24", type: "pantry" };
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
          <div style={{ fontSize: 16, color: "rgba(238,236,248,0.25)", marginLeft: 4 }}>×</div>
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
        <div className="modal-handle"/>
        <div className="row" style={{ marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 700 }}>Notifications</span>
            {unread.length > 0 && (
              <span style={{ marginLeft: 8, background: "rgba(139,124,248,0.15)", color: "#8B7CF8", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100 }}>
                {unread.length} unread
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {unread.length > 0 && (
              <span onClick={markAll} style={{ fontSize: 12, color: "#8B7CF8", fontWeight: 600, cursor: "pointer" }}>Mark all read</span>
            )}
            <div onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(238,236,248,0.42)" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </div>
          </div>
        </div>
        {notifs.length === 0 ? (
          <div className="empty"><div className="empty-icon">🔔</div><div className="empty-text">No notifications yet</div></div>
        ) : (
          <div className="card" style={{ padding: "0 0" }}>
            {notifs.map(n => (
              <div key={n.id} className={`notif-item ${!n.read ? "unread" : ""}`} onClick={() => !n.read && markRead(n.id)}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: (n.color || "#8B7CF8") + "18", border: `1px solid ${n.color || "#8B7CF8"}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{n.icon || "🔔"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: n.read ? "rgba(238,236,248,0.6)" : "#EEECf8" }}>{n.title}</div>
                  <div style={{ fontSize: 11.5, color: "rgba(238,236,248,0.4)", marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>
                  <div style={{ fontSize: 10.5, color: "rgba(238,236,248,0.25)", marginTop: 3 }}>{timeAgo(n.created_at)}</div>
                </div>
                <div onClick={e => { e.stopPropagation(); removeNotif(n.id); }} style={{ opacity: 0.3, cursor: "pointer", padding: "4px", flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
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
  { id:"goal",     emoji:"🎯", label:"Goal",      color:"#A78BFA", table:"goals" },
];

// ─── STYLES ───────────────────────────────────────────────────────────────────
const Styles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html{-webkit-tap-highlight-color:transparent;-webkit-text-size-adjust:100%;touch-action:manipulation;}
    body{font-family:'Outfit',sans-serif;background:${T.bg};color:${T.text};min-height:100vh;overscroll-behavior:none;-webkit-font-smoothing:antialiased;}
    ::-webkit-scrollbar{display:none;}
    *{scrollbar-width:none;}
    .root{display:flex;flex-direction:column;min-height:100vh;min-height:100dvh;max-width:430px;margin:0 auto;background:${T.bg};background-image:radial-gradient(ellipse 600px 400px at 20% -100px,rgba(139,124,248,0.08) 0%,transparent 60%),radial-gradient(ellipse 300px 300px at 85% 30%,rgba(96,165,250,0.04) 0%,transparent 55%);position:relative;}
    .screen{flex:1;padding-bottom:calc(72px + env(safe-area-inset-bottom, 16px));overflow-y:auto;-webkit-overflow-scrolling:touch;animation:fadeUp .25s cubic-bezier(.16,1,.3,1);}
    @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
    .card{background:${T.card};border:1px solid ${T.border};border-radius:18px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);transition:all .18s;}
    .card-tap{cursor:pointer;}
    .card-tap:active{transform:scale(0.982);background:${T.cardHover};}
    .btn{border:none;cursor:pointer;font-family:'Outfit',sans-serif;transition:all .18s;display:inline-flex;align-items:center;justify-content:center;gap:8px;}
    .btn-primary{background:${T.accent};color:#fff;border-radius:14px;padding:0 22px;height:52px;font-size:15px;font-weight:700;box-shadow:0 4px 20px ${T.accentGlow};border:none;cursor:pointer;font-family:'Outfit',sans-serif;transition:all .18s;width:100%;-webkit-tap-highlight-color:transparent;touch-action:manipulation;min-height:52px;}
    .btn-primary:active{transform:scale(0.97);opacity:0.9;}
    .btn-primary:disabled{opacity:0.45;cursor:not-allowed;}
    .input{width:100%;background:rgba(255,255,255,0.058);border:1px solid ${T.border};border-radius:14px;padding:0 16px;height:52px;color:${T.text};font-family:'Outfit',sans-serif;font-size:16px;outline:none;transition:all .18s;-webkit-appearance:none;appearance:none;}
    .input:focus{border-color:${T.accent};background:rgba(139,124,248,0.06);}
    .input::placeholder{color:${T.dim};}
    textarea.input{height:auto;padding:14px 16px;resize:none;line-height:1.5;}
    select.input{appearance:none;-webkit-appearance:none;}
    .bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;padding:8px 2px calc(8px + env(safe-area-inset-bottom, 0px));background:rgba(8,8,16,0.92);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);border-top:1px solid ${T.border};display:flex;justify-content:space-around;align-items:center;z-index:100;}
    .nav-btn{display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;padding:6px 8px;border-radius:12px;transition:all .18s;flex:1;min-height:44px;justify-content:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
    .nav-btn.on{background:rgba(139,124,248,0.12);}
    .nav-btn:active{transform:scale(0.88);}
    .nav-lbl{font-size:9px;font-weight:600;letter-spacing:.01em;margin-top:1px;}
    .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:200;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn .2s ease;}
    @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
    .modal{width:100%;max-width:430px;background:#0D0D1C;border:1px solid ${T.border};border-bottom:none;border-radius:24px 24px 0 0;padding:20px 20px calc(32px + env(safe-area-inset-bottom, 0px));animation:slideUp .3s cubic-bezier(.16,1,.3,1);max-height:92dvh;overflow-y:auto;}
    @keyframes slideUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
    .modal-handle{width:40px;height:4px;background:rgba(255,255,255,0.14);border-radius:2px;margin:0 auto 18px;}
    .ph{padding:calc(52px + env(safe-area-inset-top, 0px)) 18px 0;}
    .pt{font-size:22px;font-weight:800;letter-spacing:-.3px;}
    .ps{font-size:12.5px;color:${T.muted};margin-top:3px;}
    .row{display:flex;justify-content:space-between;align-items:center;}
    .sec-title{font-size:14px;font-weight:700;}
    .sec-link{font-size:12.5px;color:${T.accent};font-weight:600;cursor:pointer;padding:4px 0;min-height:44px;display:flex;align-items:center;}
    .chip{display:inline-flex;align-items:center;gap:5px;padding:8px 14px;border-radius:100px;background:rgba(255,255,255,0.058);border:1px solid ${T.border};font-size:13px;font-weight:500;cursor:pointer;transition:all .18s;white-space:nowrap;min-height:36px;-webkit-tap-highlight-color:transparent;}
    .chip.on{background:rgba(139,124,248,0.16);border-color:rgba(139,124,248,0.4);color:${T.accent};}
    .chip:active{transform:scale(0.94);}
    .scroll-x{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
    .scroll-x::-webkit-scrollbar{display:none;}
    .list-row{display:flex;align-items:center;gap:13px;padding:14px 0;border-bottom:1px solid ${T.border};cursor:pointer;transition:opacity .15s;min-height:56px;}
    .list-row:last-child{border-bottom:none;}
    .list-row:active{opacity:.6;}
    .progress{height:5px;background:rgba(255,255,255,0.07);border-radius:100px;overflow:hidden;}
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
    .spinner{width:20px;height:20px;border:2px solid rgba(255,255,255,0.2);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;}
    .empty{text-align:center;padding:48px 20px;color:${T.muted};}
    .empty-icon{font-size:40px;margin-bottom:12px;}
    .empty-text{font-size:14px;line-height:1.5;}
    .alert-bar{padding:12px 15px;border-radius:14px;display:flex;gap:10px;align-items:center;margin-bottom:8px;}
    .fade-up{animation:fadeUp .4s cubic-bezier(.16,1,.3,1) both;}
    .fab{position:fixed;bottom:calc(80px + env(safe-area-inset-bottom, 0px));right:max(16px, calc(50vw - 199px));width:54px;height:54px;border-radius:17px;background:linear-gradient(135deg,${T.accent},#6D5CE8);box-shadow:0 4px 24px ${T.accentGlow},0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:150;transition:all .25s cubic-bezier(.16,1,.3,1);border:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
    .fab:active{transform:scale(0.91);}
    .fab.open{transform:rotate(45deg);background:linear-gradient(135deg,#F87171,#E55);}
    .fab-menu{position:fixed;bottom:calc(148px + env(safe-area-inset-bottom, 0px));right:max(12px, calc(50vw - 210px));z-index:149;display:flex;flex-direction:column;gap:10px;align-items:flex-end;animation:fabMenuIn .25s cubic-bezier(.16,1,.3,1);}
    @keyframes fabMenuIn{from{opacity:0;transform:translateY(16px) scale(0.94);}to{opacity:1;transform:translateY(0) scale(1);}}
    .fab-item{display:flex;align-items:center;gap:10px;cursor:pointer;animation:fabItemIn .22s cubic-bezier(.16,1,.3,1) both;}
    @keyframes fabItemIn{from{opacity:0;transform:translateX(10px);}to{opacity:1;transform:translateX(0);}}
    .fab-item-btn{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:21px;border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);transition:transform .15s;-webkit-tap-highlight-color:transparent;}
    .fab-item-btn:active{transform:scale(0.88);}
    .fab-item-label{background:rgba(12,12,22,0.94);border:1px solid ${T.border};border-radius:10px;padding:6px 12px;font-size:12.5px;font-weight:600;color:${T.text};backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);white-space:nowrap;}
    .fab-overlay{position:fixed;inset:0;z-index:148;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);animation:fadeIn .2s ease;}
    .type-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;}
    .type-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;border-radius:14px;cursor:pointer;transition:all .18s;border:1px solid transparent;min-height:68px;justify-content:center;-webkit-tap-highlight-color:transparent;}
    .type-btn.active{border-color:rgba(139,124,248,0.35);background:rgba(139,124,248,0.1);}
    .type-btn:active{transform:scale(0.93);}
    .toast-container{position:fixed;top:calc(16px + env(safe-area-inset-top, 0px));left:50%;transform:translateX(-50%);z-index:500;display:flex;flex-direction:column;gap:8px;width:calc(100% - 28px);max-width:402px;pointer-events:none;}
    .toast{background:#13131F;border:1px solid rgba(255,255,255,0.11);border-radius:16px;padding:12px 14px;display:flex;gap:11px;align-items:flex-start;pointer-events:all;box-shadow:0 8px 32px rgba(0,0,0,0.55),0 2px 8px rgba(0,0,0,0.3);animation:toastIn .3s cubic-bezier(.16,1,.3,1);}
    @keyframes toastIn{from{opacity:0;transform:translateY(-14px) scale(0.96);}to{opacity:1;transform:translateY(0) scale(1);}}
    .toast.out{animation:toastOut .28s cubic-bezier(.4,0,1,1) forwards;}
    @keyframes toastOut{to{opacity:0;transform:translateY(-10px) scale(0.96);}}
    .toast-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;}
    .toast-title{font-size:13px;font-weight:700;color:#EEECf8;line-height:1.3;}
    .toast-body{font-size:11.5px;color:rgba(238,236,248,0.5);margin-top:2px;line-height:1.4;}
    .notif-badge{position:absolute;top:-5px;right:-5px;background:#F87171;color:white;border-radius:100px;font-size:9px;font-weight:800;min-width:17px;height:17px;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #080810;}
    .notif-item{display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.055);cursor:pointer;transition:background .15s;position:relative;min-height:60px;align-items:center;}
    .notif-item:last-child{border-bottom:none;}
    .notif-item:active{background:rgba(255,255,255,0.03);}
    .notif-item.unread::before{content:'';position:absolute;left:5px;top:50%;transform:translateY(-50%);width:5px;height:5px;border-radius:50%;background:#8B7CF8;}
    .person-sel{display:flex;gap:8px;}
    .person-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border-radius:13px;border:1px solid ${T.border};background:transparent;cursor:pointer;transition:all .18s;font-size:14px;font-weight:600;color:${T.muted};-webkit-tap-highlight-color:transparent;}
    .person-btn.on{border-color:rgba(139,124,248,0.35);background:rgba(139,124,248,0.1);color:${T.accent};}
    .person-btn:active{transform:scale(0.96);}
    .priority-sel{display:flex;gap:8px;}
    .priority-btn{flex:1;height:44px;border-radius:12px;border:1px solid ${T.border};background:transparent;cursor:pointer;transition:all .18s;font-size:12px;font-weight:700;text-transform:capitalize;-webkit-tap-highlight-color:transparent;}
    .priority-btn:active{transform:scale(0.95);}
    .sec-header{display:flex;justify-content:space-between;align-items:center;padding:0 18px;margin-bottom:10px;}
    .icon-btn{width:40px;height:40px;border-radius:12px;background:${T.card};border:1px solid ${T.border};display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;-webkit-tap-highlight-color:transparent;touch-action:manipulation;flex-shrink:0;}
    .icon-btn:active{transform:scale(0.9);}
    .balance-card{margin:12px 18px 0;background:linear-gradient(135deg,rgba(52,211,153,0.1),rgba(139,124,248,0.08));border:1px solid rgba(52,211,153,0.2);border-radius:20px;padding:18px;cursor:pointer;transition:all .18s;}
    .balance-card:active{transform:scale(0.985);}
    .quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px 18px 0;}
    .quick-action{display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
    .quick-action-icon{width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:22px;transition:all .18s;}
    .quick-action-icon:active{transform:scale(0.88);}
    .quick-action-label{font-size:10.5px;font-weight:600;color:${T.muted};}
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
  const expenseCats = ["Groceries","Utilities","Dining & Food","Transport","Medical","Entertainment","Education","Shopping","Home Loan EMI","Other"];
  const emojiMap = {"Groceries":"🛒","Utilities":"⚡","Dining & Food":"🍽️","Transport":"🚗","Medical":"💊","Entertainment":"🎬","Education":"📚","Shopping":"🛍️","Home Loan EMI":"🏠","Other":"💸"};

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
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"90vh",overflowY:"auto"}}>
        <div className="modal-handle"/>
        <div className="row" style={{marginBottom:14}}>
          <span style={{fontSize:19,fontWeight:700}}>Quick Add</span>
          <div onClick={onClose} style={{width:30,height:30,borderRadius:9,background:"rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <I n="x" s={15} c={T.muted}/>
          </div>
        </div>
        <div className="type-grid">
          {QUICK_ADD_TYPES.map((t,i)=>(
            <div key={t.id} className={`type-btn ${type===t.id?"active":""}`} onClick={()=>setType(t.id)}>
              <div style={{width:38,height:38,borderRadius:12,background:type===t.id?`${t.color}22`:"rgba(255,255,255,0.05)",border:`1px solid ${type===t.id?t.color+"44":T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,transition:"all .18s"}}>{t.emoji}</div>
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
                <div key={m} onClick={()=>set("added_by",m)} style={{flex:1,padding:"9px",borderRadius:12,border:`1px solid ${f.added_by===m?"rgba(139,124,248,0.3)":T.border}`,background:f.added_by===m?T.accentSoft:"transparent",textAlign:"center",cursor:"pointer",fontSize:13,fontWeight:600,color:f.added_by===m?T.accent:T.muted,transition:"all .2s"}}>
                  {m==="Mayank"?"👨‍⚕️":"👩"} {m}
                </div>
              ))}
            </div>
          </>}
          {type==="task" && <>
            <input className="input" placeholder="What needs to be done?" value={f.title} onChange={e=>set("title",e.target.value)} autoFocus/>
            <div style={{display:"flex",gap:8}}>
              {["Mayank","Simmi"].map(m=>(
                <div key={m} onClick={()=>set("assignee",m)} style={{flex:1,padding:"9px",borderRadius:12,border:`1px solid ${f.assignee===m?"rgba(139,124,248,0.3)":T.border}`,background:f.assignee===m?T.accentSoft:"transparent",textAlign:"center",cursor:"pointer",fontSize:13,fontWeight:600,color:f.assignee===m?T.accent:T.muted,transition:"all .2s"}}>
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
                <div key={m} onClick={()=>set("added_by",m)} style={{flex:1,padding:"9px",borderRadius:12,border:`1px solid ${f.added_by===m?"rgba(139,124,248,0.3)":T.border}`,background:f.added_by===m?T.accentSoft:"transparent",textAlign:"center",cursor:"pointer",fontSize:13,fontWeight:600,color:f.added_by===m?T.accent:T.muted,transition:"all .2s"}}>
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
        <button className="btn-primary" onClick={save} disabled={loading||saved} style={{marginTop:14,background:saved?"rgba(52,211,153,0.3)":undefined,borderColor:saved?T.green:undefined}}>
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
    setForm({ name: who, email: emails[who], password: "Mayank@123" });
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
    <div style={{flex:1,display:"flex",flexDirection:"column",padding:"60px 24px 40px",background:T.bg,minHeight:"100vh",backgroundImage:`radial-gradient(ellipse 600px 500px at 50% -100px,rgba(139,124,248,0.12) 0%,transparent 65%)`}}>
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
        <input className="input" type="email" placeholder="Email" inputMode="email" autoComplete="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} autoCapitalize="none"/>
        <input className="input" type="password" placeholder="Password" autoComplete="current-password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handle()}/>
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
      <div style={{width:38,height:38,borderRadius:11,background:"rgba(255,255,255,0.042)",border:"1px solid rgba(255,255,255,0.075)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative"}} onClick={()=>setOpen(true)}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(238,236,248,0.42)" strokeWidth="1.8" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        {unread > 0 && <div className="notif-badge">{unread > 9 ? "9+" : unread}</div>}
      </div>
      {open && <NotificationsScreen familyId={familyId} onClose={()=>setOpen(false)}/>}
    </>
  );
};

// ─── INLINE BALANCE WIDGET ────────────────────────────────────────────────────
const InlineBalanceWidget = ({ txns, navigate, pendingTasks }) => {
  const bal = calcBalance(txns);
  return (
    <div style={{padding:"12px 20px 0"}}>
      <div style={{background:"linear-gradient(135deg,rgba(52,211,153,0.12),rgba(139,124,248,0.10))",border:`1px solid rgba(52,211,153,0.22)`,borderRadius:20,padding:"16px 18px",marginBottom:10,cursor:"pointer"}} onClick={()=>navigate("finance")}>
        <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Available Balance</div>
        <div style={{fontSize:28,fontWeight:900,letterSpacing:"-1px",marginTop:3,color:bal.available>=0?T.green:T.red,fontFamily:"'JetBrains Mono',monospace"}}>
          {bal.available<0?"-":""}₹{Math.abs(bal.available).toLocaleString("en-IN")}
        </div>
        <div style={{fontSize:11,color:T.muted,marginTop:3}}>{bal.available>=0?"✅ Saving money this month":"⚠️ Expenses exceed income"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12,paddingTop:12,borderTop:`1px solid ${T.border}`}}>
          {[
            {l:"🏥 Clinic",v:inr(bal.clinicIncome),c:T.green},
            {l:"👩 Simmi",v:inr(bal.simmiIncome),c:T.blue},
            {l:"💸 Spent",v:inr(bal.totalExpenses),c:T.red},
            {l:"✅ Tasks",v:`${pendingTasks.length} left`,c:T.accent},
          ].map((s)=>(
            <div key={s.l} style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"8px 10px"}}>
              <div style={{fontSize:10,color:T.muted,fontWeight:600}}>{s.l}</div>
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
    const allTxns = await supabase.from("transactions").select("amount").eq("family_id", familyId);
    const bal = calcBalance(allTxns.data || []);
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
          <div key={key} onClick={()=>setSource(key)} style={{flex:1,minHeight:72,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:5,padding:"12px 8px",borderRadius:16,border:`1px solid ${source===key?cfg.color+"55":T.border}`,background:source===key?cfg.color+"12":T.card,cursor:"pointer",transition:"all .18s"}}>
            <div style={{fontSize:24}}>{cfg.emoji}</div>
            <div style={{fontSize:11.5,fontWeight:700,color:source===key?cfg.color:T.muted,textAlign:"center",lineHeight:1.2}}>{key}</div>
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
  const { rows: txns } = useTable("transactions", familyId, { order: "date", limit: 10 });
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
            <div style={{fontSize:12,color:T.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:".04em"}}>Good morning ☀️</div>
            <div style={{fontSize:20,fontWeight:900,letterSpacing:"-.4px",marginTop:2}}>Mayank & Simmi</div>
            <div style={{fontSize:12,color:T.dim,marginTop:2}}>📍 Sector 48, Gurgaon</div>
          </div>
          <BellButton familyId={familyId}/>
        </div>
      </div>

      {(urgentBills.length > 0 || lowGrocery.length > 0 || lowPantry.length > 0) && (
        <div style={{padding:"12px 18px 0"}}>
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
          {(lowGrocery.length > 0 || lowPantry.length > 0) && (
            <div className="alert-bar" style={{background:T.amberSoft,border:"1px solid rgba(251,191,36,0.2)"}}>
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

      <InlineBalanceWidget txns={txns} navigate={navigate} pendingTasks={pendingTasks}/>

      <div className="quick-actions">
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

      <div style={{padding:"16px 18px 0"}}>
        <div className="row" style={{marginBottom:12}}>
          <span className="sec-title">Pending Tasks</span>
          <span className="sec-link" onClick={()=>navigate("household")}>{pendingTasks.length} total</span>
        </div>
        {pendingTasks.length === 0
          ? <div className="card" style={{padding:"20px",textAlign:"center",color:T.muted,fontSize:14}}>🎉 All tasks done!</div>
          : <div className="card" style={{padding:"2px 14px"}}>
              {pendingTasks.slice(0,4).map(t=>(
                <div key={t.id} className="list-row">
                  <div style={{width:21,height:21,borderRadius:7,border:`2px solid ${t.priority==="high"?T.red:t.priority==="medium"?T.amber:T.green}`,flexShrink:0}}/>
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

      <div style={{padding:"16px 18px 0"}}>
        <div className="row" style={{marginBottom:12}}>
          <span className="sec-title">Recent</span>
          <span className="sec-link" onClick={()=>navigate("finance")}>All</span>
        </div>
        {txns.length === 0
          ? <div className="card" style={{padding:"20px",textAlign:"center",color:T.muted,fontSize:14}}>No transactions yet.</div>
          : <div className="card" style={{padding:"2px 14px"}}>
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
  const { rows: txns, loading, remove } = useTable("transactions", familyId, { order: "date", limit: 50 });
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
        <div className="card" style={{padding:18,background:"linear-gradient(135deg,rgba(139,124,248,0.12),rgba(96,165,250,0.06))",borderColor:"rgba(139,124,248,0.2)",marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {[{l:"Income",v:inr(income),c:T.green},{l:"Spent",v:inr(spent),c:T.red},{l:"Net",v:inr(income-spent),c:T.accent}].map(s=>(
              <div key={s.l} style={{textAlign:"center"}}>
                <div style={{fontSize:10,color:T.muted,fontWeight:600,textTransform:"uppercase"}}>{s.l}</div>
                <div style={{fontSize:16,fontWeight:800,color:s.c,marginTop:3}} className="mono">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="scroll-x" style={{padding:"0 18px",marginBottom:12}}>
        {["transactions","bills","budgets"].map(t=>(
          <div key={t} className={`chip ${tab===t?"on":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
        ))}
      </div>
      <div style={{padding:"0 18px"}}>
        {tab==="transactions" && (
          loading ? <div style={{textAlign:"center",padding:40,color:T.muted}}>Loading...</div>
          : txns.length===0
            ? <div className="empty"><div className="empty-icon">💸</div><div className="empty-text">No transactions yet.</div></div>
            : <div className="card" style={{padding:"2px 14px"}}>
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
            : <div className="card" style={{padding:"2px 14px"}}>
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
            ? <div className="empty"><div className="empty-icon">📊</div><div className="empty-text">No budgets set yet.</div></div>
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
  const { rows: grocery } = useTable("grocery", familyId, { order: "name", asc: true });
  const { rows: docs } = useTable("documents", familyId);
  const { rows: maint } = useTable("maintenance", familyId);
  const toggleTask = (id, done) => updTask(id, { done, done_at: done ? new Date().toISOString() : null });
  return (
    <div className="screen">
      <div className="ph" style={{paddingTop:"calc(52px + env(safe-area-inset-top, 0px))"}}>
        <div className="pt">Household</div>
        <div className="ps">{tasks.filter(t=>!t.done).length} tasks pending · {grocery.filter(g=>Number(g.quantity)<=Number(g.par_level)).length} grocery alerts</div>
      </div>
      <div className="scroll-x" style={{padding:"0 18px",marginBottom:12}}>
        {["chores","grocery","maintenance","documents"].map(t=>(
          <div key={t} className={`chip ${tab===t?"on":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
        ))}
      </div>
      <div style={{padding:"0 18px"}}>
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
            {tasks.length===0 && <div className="empty"><div className="empty-icon">✅</div><div className="empty-text">No tasks yet.</div></div>}
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
              ? <div className="empty"><div className="empty-icon">🛒</div><div className="empty-text">No grocery items.</div></div>
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
            ? <div className="empty"><div className="empty-icon">📁</div><div className="empty-text">No documents yet.</div></div>
            : <div className="card" style={{padding:"2px 14px"}}>
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
        {tab==="goals" && (
          goals.length===0
            ? <div className="empty"><div className="empty-icon">🎯</div><div className="empty-text">No goals yet.</div></div>
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
              : <div className="card" style={{padding:"2px 14px"}}>
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
            ? <div className="empty"><div className="empty-icon">💊</div><div className="empty-text">No health records yet.</div></div>
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
  const { rows: pantry } = useTable("pantry", familyId);
  const { rows: goals } = useTable("goals", familyId);
  const { rows: bills } = useTable("bills", familyId);
  const [msgs, setMsgs] = useState([{ role:"assistant", text:"Namaste! 🙏 I'm your Family OS AI.\n\nAsk me about spending, tasks, grocery, pantry, bills or goals!" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const suggestions = ["Summarise spending","Pending tasks?","Grocery restock?","Goals progress?","Bills due?","Pantry status?"];

  const send = useCallback(async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput("");
    setMsgs(m=>[...m,{role:"user",text:q}]);
    setLoading(true);
    try {
      const ql=q.toLowerCase();
      const income=txns.filter(t=>Number(t.amount)>0).reduce((a,t)=>a+Number(t.amount),0);
      const spent=txns.filter(t=>Number(t.amount)<0).reduce((a,t)=>a+Math.abs(Number(t.amount)),0);
      const pending=tasks.filter(t=>t.done===false);
      const lowStock=grocery.filter(g=>Number(g.quantity)<=Number(g.par_level));
      const lowPantryItems=pantry.filter(p=>Number(p.quantity)<=Number(p.par_level));
      const dueBills=bills.filter(b=>b.paid===false);
      let ans="";
      if(ql.includes("hi")||ql.includes("hello")||ql.includes("namaste")){
        ans="Namaste Mayank and Simmi! 🙏\n\nSaved: ₹"+(income-spent).toLocaleString("en-IN")+" | Tasks: "+pending.length+" | Restock: "+lowStock.length+" | Bills: "+dueBills.length;
      } else if(ql.includes("spend")||ql.includes("expense")||ql.includes("money")||ql.includes("financ")){
        ans="💰 This month:\n\nIncome: ₹"+income.toLocaleString("en-IN")+"\nSpent: ₹"+spent.toLocaleString("en-IN")+"\nSaved: ₹"+(income-spent).toLocaleString("en-IN");
      } else if(ql.includes("task")||ql.includes("pending")||ql.includes("todo")){
        ans=pending.length===0?"🎉 All tasks done!":"📋 "+pending.length+" pending:\n\n"+pending.slice(0,5).map(t=>"• "+t.title+" ("+t.assignee+")").join("\n");
      } else if(ql.includes("grocery")||ql.includes("restock")||ql.includes("shopping")){
        ans=lowStock.length===0?"🛒 All groceries stocked!":"🛒 Restock needed:\n\n"+lowStock.map(g=>"• "+g.name+" ("+g.quantity+" "+g.unit+")").join("\n");
      } else if(ql.includes("pantry")){
        ans=lowPantryItems.length===0?"🧺 Pantry fully stocked!":"🧺 Low pantry items:\n\n"+lowPantryItems.map(p=>"• "+p.name+" ("+p.quantity+" "+p.unit+")").join("\n");
      } else if(ql.includes("bill")||ql.includes("pay")||ql.includes("due")){
        ans=dueBills.length===0?"✅ No pending bills!":"📋 Unpaid bills:\n\n"+dueBills.map(b=>"• "+b.name+": ₹"+Number(b.amount).toLocaleString("en-IN")+" due "+b.due_date).join("\n");
      } else if(ql.includes("goal")){
        ans=goals.length===0?"🎯 No goals yet!":"🎯 Goals:\n\n"+goals.map(g=>"• "+g.title+": "+Math.round((g.saved_amount/g.target_amount)*100)+"%").join("\n");
      } else {
        ans="I can help with:\n\n💰 Spending & finances\n✅ Tasks\n🛒 Grocery\n🧺 Pantry\n📋 Bills\n🎯 Goals\n\nJust ask!";
      }
      setMsgs(m=>[...m,{role:"assistant",text:ans}]);
    } catch(e) {
      setMsgs(m=>[...m,{role:"assistant",text:"Something went wrong. Try again."}]);
    }
    setLoading(false);
  },[input,loading,txns,tasks,grocery,pantry,goals,bills]);

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
        <input className="input" style={{flex:1}} placeholder="Ask about your family data..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}/>
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
      <div className="ph" style={{paddingTop:"calc(52px + env(safe-area-inset-top, 0px))"}}>
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
        <button onClick={onSignOut} style={{width:"100%",padding:"14px",background:T.redSoft,border:`1px solid rgba(248,113,113,0.25)`,borderRadius:14,color:T.red,fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"'Outfit',sans-serif"}}>
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
  const cats = ["Groceries","Utilities","Dining & Food","Transport","Medical","Entertainment","Education","Shopping","Home Loan EMI","Other"];
  const emojiMap = {"Groceries":"🛒","Utilities":"⚡","Dining & Food":"🍽️","Transport":"🚗","Medical":"💊","Entertainment":"🎬","Education":"📚","Shopping":"🛍️","Home Loan EMI":"🏠","Other":"💸"};
  const save = async () => {
    if (!f.description || !f.amount) return;
    setLoading(true);
    const allTxns2 = await supabase.from("transactions").select("amount").eq("family_id", familyId);
    const bal2 = calcBalance(allTxns2.data || []);
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
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"90vh",overflowY:"auto"}}>
        <div className="modal-handle"/>
        <div className="row" style={{marginBottom:14}}>
          <div>
            <div style={{fontSize:19,fontWeight:800}}>🎤 Munshi Jee Commands</div>
            <div style={{fontSize:12,color:T.muted,marginTop:2}}>Say "Alexa, open munshi jee" first</div>
          </div>
          <div onClick={onClose} style={{width:30,height:30,borderRadius:9,background:"rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <I n="x" s={15} c={T.muted}/>
          </div>
        </div>
        <div style={{padding:"10px 14px",background:"rgba(139,124,248,0.1)",border:"1px solid rgba(139,124,248,0.3)",borderRadius:12,marginBottom:14}}>
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
                  <span style={{fontSize:10,fontWeight:700,color:T.accent,minWidth:55}}>HINDI</span>
                  <span style={{fontSize:12,color:T.muted,flex:1}}>{cmd.hi}</span>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <span style={{fontSize:10,fontWeight:700,color:T.teal,minWidth:55}}>HINGLISH</span>
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
];

const seedRecipes = async (familyId) => {
  const { data: existing } = await supabase.from("recipes").select("id").eq("family_id", familyId).limit(1);
  if (existing?.length) return;
  for (const r of SEED_RECIPES) {
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
  const ratio = (mealPlanRow.servings_cooked || 2) / (recipe.servings || 2);
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

// ─── KITCHEN SCREEN ───────────────────────────────────────────────────────────
const KitchenScreen = ({ familyId }) => {
  const [tab, setTab] = useState("today");
  const [seeded, setSeeded] = useState(false);
  const [cooking, setCooking] = useState(null);
  const [addMealModal, setAddMealModal] = useState(null);
  const [showAddPantry, setShowAddPantry] = useState(false);
  const [editPantryItem, setEditPantryItem] = useState(null);
  const [editShopItem, setEditShopItem] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [showAlexaCommands, setShowAlexaCommands] = useState(false);
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [ef, setEf] = useState({ name:"", category:"Grains", quantity:"", unit:"kg", par_level:"" });
  const [pf, setPf] = useState({ name:"", category:"Grains", quantity:"", unit:"kg", par_level:"" });

  const { rows: pantry, refresh: refreshPantry } = useTable("pantry", familyId, { order: "name", asc: true });
  const { rows: recipes } = useTable("recipes", familyId, { order: "name", asc: true });
  const { rows: mealPlan, refresh: refreshMeal } = useTable("meal_plan", familyId, { order: "plan_date", asc: true });
  const { rows: shopping, update: updShopping, remove: removeShopping } = useTable("shopping_list", familyId, { order: "added_at" });

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
        icon:"🍽", color:"#34D399"
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

  const assignRecipe = async (recipeId, date, mealType) => {
    // Remove existing meal for this slot first
    const existing = mealPlan.find(m => m.plan_date === date && m.meal_type === mealType);
    if (existing) await supabase.from("meal_plan").delete().eq("id", existing.id);
    await supabase.from("meal_plan").insert([{
      family_id: familyId, plan_date: date, meal_type: mealType,
      recipe_id: recipeId, cooked: false, servings_cooked: 2,
    }]);
    await refreshMeal();
    setAddMealModal(null);
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
        <div onClick={()=>setShowAlexaCommands(true)} style={{padding:"8px 12px",background:"rgba(139,124,248,0.12)",border:"1px solid rgba(139,124,248,0.3)",borderRadius:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:15}}>🎤</span>
          <span style={{fontSize:11,fontWeight:700,color:T.accent}}>Commands</span>
        </div>
      </div>
      {showAlexaCommands && <AlexaCommandCenter onClose={()=>setShowAlexaCommands(false)}/>}

      <div className="scroll-x" style={{padding:"10px 18px",marginBottom:4}}>
        {[
          {id:"today", label:"📅 Today"},
          {id:"week",  label:"🗓 Week"},
          {id:"recipes",label:"🥘 Recipes"},
          {id:"pantry", label:"🧺 Pantry"},
          {id:"shop",   label:"🛒 Shop"},
        ].map(t => (
          <div key={t.id} className={`chip ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}>{t.label}</div>
        ))}
      </div>

      <div style={{padding:"0 18px"}}>

        {/* TODAY */}
        {tab==="today" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {MEAL_TYPES.map(mealType => {
              const meal = todayMeals.find(m => m.meal_type === mealType);
              const recipe = meal ? recipes.find(r => r.id === meal.recipe_id) : null;
              return (
                <div key={mealType} className="card" style={{padding:"14px 16px",borderColor:meal?.cooked?"rgba(52,211,153,0.3)":T.border}}>
                  <div className="row" style={{marginBottom:recipe?10:0}}>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <span style={{fontSize:22}}>{MEAL_EMOJI[mealType]}</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,textTransform:"capitalize",color:T.muted}}>{mealType}</div>
                        <div style={{fontSize:15,fontWeight:600,color:recipe?T.text:T.dim}}>{recipe ? recipe.name : "Not planned"}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      {meal && !meal.cooked && (
                        <button onClick={()=>handleMarkCooked(meal)} disabled={cooking===meal.id}
                          style={{padding:"8px 14px",background:T.greenSoft,border:`1px solid rgba(52,211,153,0.3)`,borderRadius:10,color:T.green,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif",display:"flex",alignItems:"center",gap:5}}>
                          {cooking===meal.id ? <div className="spinner" style={{width:14,height:14}}/> : "✅ Cooked"}
                        </button>
                      )}
                      {meal?.cooked && <span style={{fontSize:12,color:T.green,fontWeight:700}}>✓ Done</span>}
                      <div onClick={()=>setAddMealModal({date:todayStr,meal_type:mealType})}
                        style={{width:32,height:32,borderRadius:9,background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                        <I n="edit" s={14} c={T.accent}/>
                      </div>
                    </div>
                  </div>
                  {recipe && (
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <span className="tag" style={{background:T.accentSoft,color:T.accent}}>⏱ {recipe.prep_time_mins}min</span>
                      <span className="tag" style={{background:T.accentSoft,color:T.accent}}>👥 {recipe.servings}</span>
                      {(recipe.tags||[]).slice(0,2).map(tag=>(
                        <span key={tag} className="tag" style={{background:"rgba(255,255,255,0.06)",color:T.muted}}>{tag}</span>
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
            {weekDates.map(date => {
              const dayMeals = mealPlan.filter(m => m.plan_date === date);
              const d = new Date(date);
              const dayName = d.toLocaleDateString("en-IN",{weekday:"short"});
              const dayNum = d.getDate();
              const isToday = date === todayStr;
              return (
                <div key={date} className="card" style={{padding:"12px 14px",borderColor:isToday?"rgba(139,124,248,0.3)":T.border}}>
                  <div className="row" style={{marginBottom:8}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <div style={{width:36,height:36,borderRadius:10,background:isToday?T.accent:"rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:9,fontWeight:700,color:isToday?"white":T.muted,textTransform:"uppercase"}}>{dayName}</span>
                        <span style={{fontSize:14,fontWeight:800,color:isToday?"white":T.text}}>{dayNum}</span>
                      </div>
                      {isToday && <span style={{fontSize:13,fontWeight:700,color:T.accent}}>Today</span>}
                    </div>
                    <span style={{fontSize:11,color:T.dim}}>{dayMeals.filter(m=>m.cooked).length}/{MEAL_TYPES.length} cooked</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                    {MEAL_TYPES.map(mt => {
                      const m = dayMeals.find(x => x.meal_type === mt);
                      const rec = m ? recipes.find(r => r.id === m.recipe_id) : null;
                      return (
                        <div key={mt} onClick={()=>setAddMealModal({date,meal_type:mt})}
                          style={{padding:"7px 9px",borderRadius:9,cursor:"pointer",background:m?.cooked?"rgba(52,211,153,0.08)":rec?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.02)",border:`1px solid ${m?.cooked?"rgba(52,211,153,0.2)":"rgba(255,255,255,0.07)"}`,transition:"all .15s"}}>
                          <div style={{fontSize:10,color:T.dim,fontWeight:600,textTransform:"capitalize"}}>{MEAL_EMOJI[mt]} {mt}</div>
                          <div style={{fontSize:11.5,fontWeight:500,color:rec?T.text:T.dim,marginTop:2}}>{rec ? rec.name : "+ Add"}</div>
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
          <>
            {recipes.length === 0
              ? <div className="empty"><div className="empty-icon">🥘</div><div className="empty-text">Loading recipes...</div></div>
              : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {recipes.map(r => (
                    <div key={r.id} className="card card-tap" style={{padding:"14px 16px"}} onClick={async()=>{ setSelectedRecipe(r); const {data} = await supabase.from("recipe_ingredients").select("*").eq("recipe_id",r.id); setRecipeIngredients(data||[]); }}>
                      <div style={{fontSize:15,fontWeight:700}}>{r.name}</div>
                      <div style={{fontSize:12,color:T.muted,marginTop:3}}>
                        {MEAL_EMOJI[r.meal_type]} {r.meal_type} · ⏱ {r.prep_time_mins}min · 👥 {r.servings}
                      </div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6}}>
                        {(r.tags||[]).map(tag=>(
                          <span key={tag} className="tag" style={{background:"rgba(255,255,255,0.06)",color:T.muted,fontSize:10}}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
            }
          </>
        )}

        {/* PANTRY */}
        {tab==="pantry" && (
          <>
            <button onClick={()=>setShowAddPantry(true)} className="btn-primary" style={{marginBottom:14,height:44,fontSize:14}}>
              + Add Pantry Item
            </button>
            {lowStock.length > 0 && (
              <div style={{padding:"10px 14px",background:T.amberSoft,border:"1px solid rgba(251,191,36,0.22)",borderRadius:12,marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700,color:T.amber}}>🛒 {lowStock.length} item{lowStock.length>1?"s":""} running low</div>
                <div style={{fontSize:11.5,color:T.muted,marginTop:2}}>{lowStock.map(i=>i.name).join(", ")}</div>
              </div>
            )}
            {pantry.length === 0
              ? <div className="empty"><div className="empty-icon">🧺</div><div className="empty-text">Pantry is empty.<br/>Add items to start tracking.</div></div>
              : <div className="card" style={{padding:"2px 14px"}}>
                  {pantry.map(item => {
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
                            {isLow && <div style={{fontSize:10,color:T.red,fontWeight:600}}>Restock!</div>}
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
        {tab==="shop" && (
          <>
            <button onClick={()=>setEditShopItem({isNew:true,item_name:"",quantity_needed:"",unit:"kg",category:"Vegetables"})} className="btn-primary" style={{marginBottom:14,height:44,fontSize:14}}>+ Add Item</button>
            {shopping.filter(s=>!s.purchased).length === 0
              ? <div className="empty"><div className="empty-icon">🛒</div><div className="empty-text">Shopping list is empty!<br/>Mark meals as cooked to auto-populate.</div></div>
              : <>
                  <div style={{fontSize:13,fontWeight:700,color:T.muted,marginBottom:8}}>TO BUY ({shopping.filter(s=>!s.purchased).length})</div>
                  <div className="card" style={{padding:"2px 14px",marginBottom:14}}>
                    {shopping.filter(s=>!s.purchased).map(item=>(
                      <div key={item.id} className="list-row">
                        <div onClick={()=>updShopping(item.id,{purchased:true})}
                          style={{width:22,height:22,borderRadius:7,border:`2px solid ${T.green}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}/>
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
                            <div style={{width:22,height:22,borderRadius:7,background:T.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
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

      {/* SHOP EDIT MODAL */}{editShopItem && (<Modal title={editShopItem.isNew ? "Add Item" : "Edit Item"} onClose={()=>setEditShopItem(null)}><div style={{display:"flex",flexDirection:"column",gap:10}}><input className="input" placeholder="Item name" autoFocus defaultValue={editShopItem.item_name} onChange={e=>setEditShopItem(x=>({...x,item_name:e.target.value}))}/><div style={{display:"flex",gap:8}}><input className="input" type="number" placeholder="Qty" defaultValue={editShopItem.quantity_needed} onChange={e=>setEditShopItem(x=>({...x,quantity_needed:e.target.value}))} style={{flex:1}}/><select className="input" defaultValue={editShopItem.unit||"kg"} onChange={e=>setEditShopItem(x=>({...x,unit:e.target.value}))} style={{flex:1}}>{["kg","g","L","ml","pcs","pack","dozen"].map(u=><option key={u}>{u}</option>)}</select></div><select className="input" defaultValue={editShopItem.category||"Vegetables"} onChange={e=>setEditShopItem(x=>({...x,category:e.target.value}))}>{["Vegetables","Dairy","Grains","Pulses","Fruits","Snacks","Spices","Oils","Beverages","Other"].map(c=><option key={c}>{c}</option>)}</select><button className="btn-primary" onClick={async()=>{if(!editShopItem.item_name) return;if(editShopItem.isNew){await supabase.from("shopping_list").insert([{family_id:familyId,item_name:editShopItem.item_name,quantity_needed:Number(editShopItem.quantity_needed)||null,unit:editShopItem.unit||"kg",category:editShopItem.category||"Other",purchased:false,added_at:new Date().toISOString()}]);}else{await supabase.from("shopping_list").update({item_name:editShopItem.item_name,quantity_needed:Number(editShopItem.quantity_needed)||null,unit:editShopItem.unit,category:editShopItem.category}).eq("id",editShopItem.id);}setEditShopItem(null);}}>{editShopItem.isNew?"Add to List":"Save Changes"}</button>{!editShopItem.isNew&&(<button onClick={async()=>{await supabase.from("shopping_list").delete().eq("id",editShopItem.id);setEditShopItem(null);}} style={{width:"100%",padding:"14px",background:"rgba(248,113,113,0.12)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:14,color:"#F87171",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"Outfit,sans-serif"}}>Delete Item</button>)}</div></Modal>)}
            {/* RECIPE DETAIL MODAL */}
      {selectedRecipe && (
        <div className="modal-bg" onClick={()=>setSelectedRecipe(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"85vh",overflowY:"auto"}}>
            <div className="modal-handle"/>
            <div className="row" style={{marginBottom:16}}>
              <div style={{flex:1}}>
                <div style={{fontSize:19,fontWeight:800}}>{selectedRecipe.name}</div>
                <div style={{fontSize:12,color:T.muted,marginTop:3}}>
                  {MEAL_EMOJI[selectedRecipe.meal_type]} {selectedRecipe.meal_type} · ⏱ {selectedRecipe.prep_time_mins}min · 👥 {selectedRecipe.servings} servings
                </div>
              </div>
              <div onClick={()=>setSelectedRecipe(null)} style={{width:30,height:30,borderRadius:9,background:"rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                <I n="x" s={15} c={T.muted}/>
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
              {(selectedRecipe.tags||[]).map(tag=>(
                <span key={tag} className="tag" style={{background:T.accentSoft,color:T.accent,fontSize:11}}>{tag}</span>
              ))}
            </div>
            <div style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Ingredients</div>
            {recipeIngredients.length === 0
              ? <div style={{fontSize:13,color:T.muted,padding:"10px 0"}}>Loading ingredients...</div>
              : <div className="card" style={{padding:"2px 14px",marginBottom:16}}>
                  {recipeIngredients.map((ing,i) => {
                    const pantryItem = pantry.find(p=>p.name.toLowerCase()===ing.pantry_item_name.toLowerCase());
                    const hasEnough = pantryItem && Number(pantryItem.quantity) >= Number(ing.quantity);
                    return (
                      <div key={i} className="list-row" style={{cursor:"default"}}>
                        <span style={{fontSize:16}}>{hasEnough ? "✅" : pantryItem ? "⚠️" : "❌"}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:500}}>{ing.pantry_item_name}</div>
                          <div style={{fontSize:11.5,color:T.muted}}>Need: {ing.quantity} {ing.unit}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:12,color:hasEnough?T.green:pantryItem?T.amber:T.red,fontWeight:600}}>
                            {pantryItem ? pantryItem.quantity+" "+pantryItem.unit : "Not in pantry"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
            {recipeIngredients.filter(ing=>!pantry.find(p=>p.name.toLowerCase()===ing.pantry_item_name.toLowerCase())).length > 0 && (
              <div style={{padding:"12px 14px",background:T.amberSoft,border:"1px solid rgba(251,191,36,0.22)",borderRadius:12}}>
                <div style={{fontSize:13,fontWeight:700,color:T.amber}}>🛒 Need to buy:</div>
                <div style={{fontSize:12,color:T.muted,marginTop:4}}>
                  {recipeIngredients.filter(ing=>!pantry.find(p=>p.name.toLowerCase()===ing.pantry_item_name.toLowerCase())).map(i=>i.pantry_item_name).join(", ")}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ASSIGN RECIPE MODAL */}
      {addMealModal && (
        <div className="modal-bg" onClick={()=>setAddMealModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"80vh",overflowY:"auto"}}>
            <div className="modal-handle"/>
            <div className="row" style={{marginBottom:14}}>
              <span style={{fontSize:18,fontWeight:700}}>
                {MEAL_EMOJI[addMealModal.meal_type]} {addMealModal.meal_type.charAt(0).toUpperCase()+addMealModal.meal_type.slice(1)}
              </span>
              <div onClick={()=>setAddMealModal(null)} style={{width:30,height:30,borderRadius:9,background:"rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <I n="x" s={15} c={T.muted}/>
              </div>
            </div>
            <div style={{fontSize:12,color:T.muted,marginBottom:12}}>{addMealModal.date}</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {recipes.filter(r => r.meal_type === addMealModal.meal_type).map(r => (
                <div key={r.id} onClick={()=>assignRecipe(r.id, addMealModal.date, addMealModal.meal_type)}
                  className="card card-tap" style={{padding:"12px 14px"}}>
                  <div style={{fontSize:15,fontWeight:600}}>{r.name}</div>
                  <div style={{fontSize:11.5,color:T.muted,marginTop:3}}>⏱ {r.prep_time_mins}min · 👥 {r.servings}</div>
                </div>
              ))}
              {recipes.filter(r=>r.meal_type===addMealModal.meal_type).length===0 && (
                <div style={{textAlign:"center",color:T.muted,padding:"20px 0",fontSize:14}}>No recipes for this meal type yet.</div>
              )}
            </div>
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
            }} style={{width:"100%",padding:"14px",background:"rgba(248,113,113,0.12)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:14,color:"#F87171",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
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
      {id:"planner", icon:"plan",    lbl:"Plan"},
      {id:"ai",      icon:"ai",      lbl:"AI"},
      {id:"profile", icon:"profile", lbl:"You"},
    ].map(it=>(
      <div key={it.id} className={`nav-btn ${active===it.id?"on":""}`} onClick={()=>go(it.id)}>
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
  };

  return (
    <div className="root">
      <Styles/>
      {screens[screen]||screens.home}
      <Nav active={screen} go={setScreen}/>
      <ToastRenderer/>
      <GlobalFAB screen={screen} familyId={FAMILY_ID}/>
      {modal==="income"  && <AddIncomeModal  onClose={()=>setModal(null)} familyId={FAMILY_ID}/>}
      {modal==="expense" && <AddExpenseModal onClose={()=>setModal(null)} familyId={FAMILY_ID}/>}
      {modal==="task"    && <AddTaskModal    onClose={()=>setModal(null)} familyId={FAMILY_ID}/>}
      {modal==="grocery" && <AddGroceryModal onClose={()=>setModal(null)} familyId={FAMILY_ID}/>}
    </div>
  );
}
