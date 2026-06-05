// api/email/send.js
// Vercel serverless function — Resend email service
// Credentials never exposed to browser

const FROM = "Family OS <onboarding@resend.dev>";

const FAMILY = {
  Mayank: "drmayankgupta.mds@gmail.com",
  Simmi:  "aggarwal.simmi09@gmail.com",
};

// ─── HTML EMAIL TEMPLATES ─────────────────────────────────────────────────────

const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Family OS</title>
</head>
<body style="margin:0;padding:0;background:#080810;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:24px 16px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:32px;margin-bottom:8px;">🏠</div>
      <div style="font-size:20px;font-weight:800;color:#EEECf8;letter-spacing:-0.5px;">Family OS</div>
      <div style="font-size:12px;color:rgba(238,236,248,0.4);margin-top:4px;">Gupta Family · Sector 48, Gurgaon</div>
    </div>
    <!-- Content -->
    ${content}
    <!-- Footer -->
    <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.07);">
      <div style="font-size:11px;color:rgba(238,236,248,0.25);">Family OS · Powered by Claude + Supabase</div>
    </div>
  </div>
</body>
</html>
`;

const card = (color, icon, title, rows, note) => `
<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px;margin-bottom:12px;border-left:3px solid ${color};">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
    <span style="font-size:24px;">${icon}</span>
    <span style="font-size:17px;font-weight:700;color:#EEECf8;">${title}</span>
  </div>
  <table style="width:100%;border-collapse:collapse;">
    ${rows.map(([label, value, valueColor]) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:rgba(238,236,248,0.5);width:45%;">${label}</td>
      <td style="padding:6px 0;font-size:13px;font-weight:600;color:${valueColor || '#EEECf8'};text-align:right;">${value}</td>
    </tr>`).join('')}
  </table>
  ${note ? `<div style="margin-top:12px;padding:10px 12px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:12px;color:rgba(238,236,248,0.4);">${note}</div>` : ''}
</div>
`;

const templates = {

  income: ({ category, amount, balance, date }) => ({
    subject: `💰 ${category} Added — ₹${amount} | Family OS`,
    html: baseTemplate(card(
      '#34D399',
      category === 'Clinic Income' ? '🏥' : '👩',
      `${category} Added`,
      [
        ['Category',    category,       '#34D399'],
        ['Amount',      `₹${amount}`,   '#34D399'],
        ['New Balance', `₹${balance}`,  '#60A5FA'],
        ['Date',        date,           'rgba(238,236,248,0.6)'],
      ],
      '✅ Income recorded successfully in Family OS'
    ))
  }),

  expense: ({ category, amount, balance, added_by }) => ({
    subject: `💸 Expense — ${category} ₹${amount} | Family OS`,
    html: baseTemplate(card(
      '#F87171',
      '💸',
      'Expense Recorded',
      [
        ['Category',    category,        'rgba(238,236,248,0.8)'],
        ['Amount',      `₹${amount}`,    '#F87171'],
        ['Added by',    added_by,        'rgba(238,236,248,0.6)'],
        ['Balance',     `₹${balance}`,   balance < 0 ? '#F87171' : '#34D399'],
      ],
      null
    ))
  }),

  task: ({ title, assignee, priority, due_date }) => ({
    subject: `✅ New Task: ${title} | Family OS`,
    html: baseTemplate(card(
      '#34D399',
      '✅',
      'New Task Created',
      [
        ['Task',       title,      '#EEECf8'],
        ['Assigned to', assignee,  '#8B7CF8'],
        ['Priority',   priority,   priority === 'high' ? '#F87171' : priority === 'medium' ? '#FBBF24' : '#34D399'],
        ['Due',        due_date || 'No date', 'rgba(238,236,248,0.6)'],
      ],
      null
    ))
  }),

  reminder: ({ content, due_date }) => ({
    subject: `⏰ Reminder: ${content} | Family OS`,
    html: baseTemplate(card(
      '#F472B6',
      '⏰',
      'Reminder Set',
      [
        ['Reminder', content,              '#EEECf8'],
        ['Due',      due_date || 'Today',  '#FBBF24'],
      ],
      null
    ))
  }),

  grocery_alert: ({ name, quantity, unit }) => ({
    subject: `🛒 ${name} running low | Family OS`,
    html: baseTemplate(card(
      '#FBBF24',
      '🛒',
      'Grocery Alert',
      [
        ['Item',      name,                    '#EEECf8'],
        ['Remaining', `${quantity} ${unit}`,   '#FBBF24'],
        ['Status',    'Added to shopping list','#34D399'],
      ],
      '🛒 Please restock soon'
    ))
  }),

  pantry_low: ({ name, quantity, unit }) => ({
    subject: `📦 ${name} running low | Family OS`,
    html: baseTemplate(card(
      '#FBBF24',
      '📦',
      'Pantry Alert',
      [
        ['Item',      name,                  '#EEECf8'],
        ['Remaining', `${quantity} ${unit}`, '#F87171'],
        ['Action',    'Added to shop list',  '#34D399'],
      ],
      '⚠️ Running low — add to your next shopping trip'
    ))
  }),

  meal_cooked: ({ meal_type, recipe_name, deducted_count, low_stock_count }) => ({
    subject: `🍽 ${recipe_name} cooked | Family OS`,
    html: baseTemplate(card(
      '#2DD4BF',
      '🍽',
      'Meal Marked as Eaten',
      [
        ['Meal',               meal_type,                      'rgba(238,236,248,0.6)'],
        ['Recipe',             recipe_name,                    '#EEECf8'],
        ['Ingredients used',   `${deducted_count} items`,      '#2DD4BF'],
        ['Low stock alerts',   `${low_stock_count} items`,     low_stock_count > 0 ? '#FBBF24' : '#34D399'],
      ],
      deducted_count > 0 ? '✅ Pantry quantities updated automatically' : 'ℹ️ No pantry items matched — add items to Pantry tab'
    ))
  }),

  event: ({ title, event_date, type }) => ({
    subject: `📅 Event: ${title} | Family OS`,
    html: baseTemplate(card(
      '#60A5FA',
      '📅',
      'Event Scheduled',
      [
        ['Event', title,       '#EEECf8'],
        ['Date',  event_date,  '#60A5FA'],
        ['Type',  type,        'rgba(238,236,248,0.6)'],
      ],
      null
    ))
  }),

  daily_summary: ({ date, balance, pending_tasks, low_stock, todays_meals }) => ({
    subject: `☀️ Family OS Daily Summary — ${date}`,
    html: baseTemplate(`
      <div style="background:linear-gradient(135deg,rgba(52,211,153,0.12),rgba(139,124,248,0.08));border:1px solid rgba(52,211,153,0.2);border-radius:16px;padding:20px;margin-bottom:12px;">
        <div style="font-size:16px;font-weight:700;color:#EEECf8;margin-bottom:16px;">☀️ Good Morning! Here's your family summary</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:rgba(238,236,248,0.5);">💰 Balance</td>
            <td style="padding:8px 0;font-size:15px;font-weight:800;color:#34D399;text-align:right;font-family:monospace;">₹${balance}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:rgba(238,236,248,0.5);">✅ Pending Tasks</td>
            <td style="padding:8px 0;font-size:14px;font-weight:600;color:#8B7CF8;text-align:right;">${pending_tasks}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:rgba(238,236,248,0.5);">🛒 Low Stock Items</td>
            <td style="padding:8px 0;font-size:14px;font-weight:600;color:${low_stock > 0 ? '#FBBF24' : '#34D399'};text-align:right;">${low_stock}</td>
          </tr>
        </table>
      </div>
      ${todays_meals?.length ? `
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:16px;">
        <div style="font-size:14px;font-weight:700;color:#EEECf8;margin-bottom:12px;">🍽 Today's Meals</div>
        ${todays_meals.map(m => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="font-size:12px;color:rgba(238,236,248,0.4);text-transform:capitalize;">${m.meal_type}</span>
          <span style="font-size:12px;color:#EEECf8;font-weight:500;">${m.recipe}</span>
        </div>`).join('')}
      </div>` : ''}
    `)
  }),
};

// ─── IS QUIET HOURS ───────────────────────────────────────────────────────────
const isQuietHours = () => {
  const now = new Date();
  // IST = UTC + 5:30
  const istHour = (now.getUTCHours() + 5) % 24;
  const istMin  = (now.getUTCMinutes() + 30) % 60;
  const current = istHour * 60 + istMin;
  const quietStart = 22 * 60; // 10 PM
  const quietEnd   = 8  * 60; // 8 AM
  return current >= quietStart || current < quietEnd;
};

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { event_type, data, recipients } = req.body;

  if (!event_type || !data) {
    return res.status(400).json({ error: "Missing event_type or data" });
  }

  // Quiet hours check (10 PM - 8 AM IST) — skip for urgent alerts
  const urgentTypes = ['pantry_low', 'grocery_alert'];
  if (isQuietHours() && !urgentTypes.includes(event_type)) {
    return res.status(200).json({ status: "quiet_hours", message: "Email suppressed — quiet hours" });
  }

  const template = templates[event_type];
  if (!template) {
    return res.status(400).json({ error: `Unknown event_type: ${event_type}` });
  }

  const { subject, html } = template(data);

  // Determine recipients
  const toList = recipients === "Mayank"
    ? [FAMILY.Mayank]
    : recipients === "Simmi"
    ? [FAMILY.Simmi]
    : [FAMILY.Mayank, FAMILY.Simmi]; // default: both

  const results = [];

  for (const to of toList) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM, to, subject, html }),
      });

      const result = await response.json();

      results.push({
        to,
        status: response.ok ? "sent" : "failed",
        id: result.id || null,
        error: result.message || null,
      });
    } catch (err) {
      results.push({ to, status: "failed", error: err.message });
    }
  }

  const allSent = results.every(r => r.status === "sent");
  return res.status(200).json({
    status: allSent ? "sent" : "partial",
    results,
  });
}
