export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { access_token, refresh_token } = req.body;
  if (!access_token) return res.status(400).json({ error: "No access token" });

  const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
  const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

  // Refresh token if needed
  let token = access_token;
  const refreshIfNeeded = async () => {
    if (!refresh_token) return;
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        refresh_token, grant_type: "refresh_token",
      }),
    });
    const data = await r.json();
    if (data.access_token) token = data.access_token;
  };

  const gmailFetch = async (url) => {
    let r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 401) { await refreshIfNeeded(); r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }); }
    return r.json();
  };

  try {
    // Get start of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const afterDate = Math.floor(startOfMonth.getTime() / 1000);

    // Search for Flipkart, Amazon, Swiggy, Zomato, Zepto, bank alerts
    const queries = [
      `from:flipkart.com after:${afterDate}`,
      `from:amazon.in after:${afterDate}`,
      `from:swiggy.com after:${afterDate}`,
      `from:zomato.com after:${afterDate}`,
      `from:zepto after:${afterDate}`,
      `"debited" OR "credited" bank after:${afterDate}`,
      `"Order Confirmed" after:${afterDate}`,
    ];

    const allMessageIds = new Set();
    for (const q of queries) {
      const data = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50`);
      if (data.messages) data.messages.forEach(m => allMessageIds.add(m.id));
    }

    // Fetch each message
    const transactions = [];
    for (const id of Array.from(allMessageIds).slice(0, 100)) {
      try {
        const msg = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`);
        const parsed = parseEmail(msg);
        if (parsed) transactions.push({ ...parsed, gmail_id: id });
      } catch(e) { continue; }
    }

    return res.status(200).json({ transactions, token });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}

function parseEmail(msg) {
  const headers = msg.payload?.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
  
  const from = getHeader("from");
  const subject = getHeader("subject");
  const date = getHeader("date");
  const snippet = msg.snippet || "";

  // Get email body
  let body = "";
  const extractBody = (parts) => {
    if (!parts) return;
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        body += Buffer.from(part.body.data, "base64").toString("utf-8");
      }
      if (part.parts) extractBody(part.parts);
    }
  };
  if (msg.payload?.body?.data) {
    body = Buffer.from(msg.payload.body.data, "base64").toString("utf-8");
  }
  extractBody(msg.payload?.parts);
  const fullText = (subject + " " + snippet + " " + body).toLowerCase();

  // Extract amount
  const amountPatterns = [
    /(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
    /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:rs\.?|inr|rupees)/gi,
    /(?:total|amount|paid|debited|order total)[:\s]+(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
  ];
  
  let amount = null;
  for (const pattern of amountPatterns) {
    const match = pattern.exec(fullText);
    if (match) {
      amount = parseFloat(match[1].replace(/,/g, ""));
      break;
    }
  }
  
  if (!amount || amount <= 0 || amount > 500000) return null;

  // Classify source and category
  let source = "Unknown";
  let category = "Shopping";
  let emoji = "🛍️";
  let description = subject;

  if (from.includes("flipkart")) {
    source = "Flipkart";
    category = classifyFlipkart(fullText);
    emoji = "🛒";
    description = `Flipkart: ${subject.replace(/flipkart/gi,"").trim()}`;
  } else if (from.includes("amazon")) {
    source = "Amazon";
    category = classifyAmazon(fullText);
    emoji = "📦";
    description = `Amazon: ${subject.replace(/amazon/gi,"").trim()}`;
  } else if (from.includes("swiggy")) {
    source = "Swiggy";
    category = "Dining & Food";
    emoji = "🍔";
    description = `Swiggy Order`;
  } else if (from.includes("zomato")) {
    source = "Zomato";
    category = "Dining & Food";
    emoji = "🍕";
    description = `Zomato Order`;
  } else if (from.includes("zepto")) {
    source = "Zepto";
    category = "Groceries";
    emoji = "🛒";
    description = `Zepto Order`;
  } else if (fullText.includes("debited") || fullText.includes("credited")) {
    source = "Bank";
    category = "Other";
    emoji = "🏦";
    description = subject;
  } else {
    return null;
  }

  // Parse date
  let txDate = new Date(date);
  if (isNaN(txDate)) txDate = new Date();
  const dateStr = txDate.toISOString().split("T")[0];

  return { source, description, amount, category, emoji, date: dateStr, raw_subject: subject, raw_from: from };
}

function classifyFlipkart(text) {
  if (text.includes("grocery") || text.includes("food") || text.includes("supermart")) return "Groceries";
  if (text.includes("medicine") || text.includes("health") || text.includes("pharma")) return "Medical";
  if (text.includes("baby") || text.includes("kid") || text.includes("child") || text.includes("toy")) return "Veda";
  if (text.includes("furniture") || text.includes("home") || text.includes("kitchen") || text.includes("decor")) return "House Interiors";
  if (text.includes("electronic") || text.includes("mobile") || text.includes("laptop")) return "Shopping";
  if (text.includes("cloth") || text.includes("fashion") || text.includes("shirt") || text.includes("shoe")) return "Shopping";
  return "Shopping";
}

function classifyAmazon(text) {
  if (text.includes("grocery") || text.includes("fresh") || text.includes("pantry")) return "Groceries";
  if (text.includes("medicine") || text.includes("health") || text.includes("pharmacy")) return "Medical";
  if (text.includes("baby") || text.includes("kid") || text.includes("toy")) return "Veda";
  if (text.includes("home") || text.includes("kitchen") || text.includes("furniture")) return "House Interiors";
  return "Shopping";
}
