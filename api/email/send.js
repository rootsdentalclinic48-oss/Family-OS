// api/email/send.js
// Gmail SMTP via nodemailer — no domain needed

import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;

const RECIPIENTS = {
  Mayank: "drmayankgupta.mds@gmail.com",
  Simmi:  "aggarwal.simmi09@gmail.com",
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: GMAIL_USER, pass: GMAIL_PASS },
});

const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#080810;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:24px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:32px;">🏠</div>
      <div style="font-size:20px;font-weight:800;color:#EEECf8;">Family OS</div>
      <div style="font-size:12px;color:rgba(238,236,248,0.4);margin-top:4px;">Gupta Family · Sector 48, Gurgaon</div>
    </div>
    ${content}
    <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.07);">
      <div style="font-size:11px;color:rgba(238,236,248,0.25);">Family OS · Powered by Claude + Supabase</div>
    </div>
  </div>
</body>
</html>`;

const card = (color, icon, title, rows) => `
<div style="background:#13131F;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px;border-left:3px solid ${color};">
  <div style="margin-bottom:16px;">
    <span style="font-size:24px;">${icon}</span>
    <span style="font-size:17px;font-weight:700;color:#EEECf8;margin-left:8px;">${title}</span>
  </div>
  <table style="width:100%;border-collapse:collapse;">
    ${rows.map(([label, value, vc]) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:rgba(238,236,248,0.5);">${label}</td>
      <td style="padding:6px 0;font-size:13px;font-weight:600;color:${vc||'#EEECf8'};text-align:right;">${value}</td>
    </tr>`).join('')}
  </table>
</div>`;

const templates = {
  income: (d) => ({
    subject: `💰 ${d.category} Added — ₹${d.amount} | Family OS`,
    html: baseTemplate(card('#34D399','💰',`${d.category} Added`,[
      ['Category', d.category, '#34D399'],
      ['Amount', `₹${d.amount}`, '#34D399'],
      ['New Balance', `₹${d.balance}`, '#60A5FA'],
      ['Date', d.date, 'rgba(238,236,248,0.6)'],
    ]))
  }),
  expense: (d) => ({
    subject: `💸 Expense — ${d.category} ₹${d.amount} | Family OS`,
    html: baseTemplate(card('#F87171','💸','Expense Recorded',[
      ['Category', d.category, 'rgba(238,236,248,0.8)'],
      ['Amount', `₹${d.amount}`, '#F87171'],
      ['Added by', d.added_by, 'rgba(238,236,248,0.6)'],
      ['Balance', `₹${d.balance}`, '#34D399'],
    ]))
  }),
  task: (d) => ({
    subject: `✅ New Task: ${d.title} | Family OS`,
    html: baseTemplate(card('#34D399','✅','New Task Created',[
      ['Task', d.title, '#EEECf8'],
      ['Assigned to', d.assignee, '#8B7CF8'],
      ['Priority', d.priority, d.priority==='high'?'#F87171':d.priority==='medium'?'#FBBF24':'#34D399'],
      ['Due', d.due_date||'No date', 'rgba(238,236,248,0.6)'],
    ]))
  }),
  reminder: (d) => ({
    subject: `⏰ Reminder: ${d.content} | Family OS`,
    html: baseTemplate(card('#F472B6','⏰','Reminder Set',[
      ['Reminder', d.content, '#EEECf8'],
      ['Due', d.due_date||'Today', '#FBBF24'],
    ]))
  }),
  event: (d) => ({
    subject: `📅 Event: ${d.title} | Family OS`,
    html: baseTemplate(card('#60A5FA','📅','Event Scheduled',[
      ['Event', d.title, '#EEECf8'],
      ['Date', d.event_date, '#60A5FA'],
      ['Type', d.type, 'rgba(238,236,248,0.6)'],
    ]))
  }),
  pantry_low: (d) => ({
    subject: `📦 ${d.name} running low | Family OS`,
    html: baseTemplate(card('#FBBF24','📦','Pantry Alert',[
      ['Item', d.name, '#EEECf8'],
      ['Remaining', `${d.quantity} ${d.unit}`, '#F87171'],
      ['Action', 'Added to shopping list', '#34D399'],
    ]))
  }),
  meal_cooked: (d) => ({
    subject: `🍽 ${d.recipe_name} cooked | Family OS`,
    html: baseTemplate(card('#2DD4BF','🍽','Meal Marked as Eaten',[
      ['Meal', d.meal_type, 'rgba(238,236,248,0.6)'],
      ['Recipe', d.recipe_name, '#EEECf8'],
      ['Ingredients used', `${d.deducted_count} items`, '#2DD4BF'],
      ['Low stock alerts', `${d.low_stock_count} items`, d.low_stock_count>0?'#FBBF24':'#34D399'],
    ]))
  }),
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { event_type, data, recipients } = req.body;
  if (!event_type || !data) return res.status(400).json({ error: "Missing event_type or data" });

  const template = templates[event_type];
  if (!template) return res.status(400).json({ error: `Unknown event_type: ${event_type}` });

  const { subject, html } = template(data);

  const toList = recipients === "Mayank"
    ? [RECIPIENTS.Mayank]
    : recipients === "Simmi"
    ? [RECIPIENTS.Simmi]
    : [RECIPIENTS.Mayank, RECIPIENTS.Simmi];

  const results = [];
  for (const to of toList) {
    try {
      await transporter.sendMail({ from: `Family OS <${GMAIL_USER}>`, to, subject, html });
      results.push({ to, status: "sent" });
    } catch(err) {
      results.push({ to, status: "failed", error: err.message });
    }
  }

  return res.status(200).json({
    status: results.every(r => r.status === "sent") ? "sent" : "failed",
    results,
  });
}
