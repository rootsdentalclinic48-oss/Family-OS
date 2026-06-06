export default async function handler(req, res) {
  const { code, error } = req.query;
  if (error) return res.redirect(`/?gmail_error=${error}`);
  if (!code) return res.status(400).json({ error: "No code received" });

  const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
  const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
  const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI, grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) return res.redirect(`/?gmail_error=${tokens.error}`);

    // Store tokens in URL params (app will save to Supabase)
    const params = new URLSearchParams({
      gmail_access_token: tokens.access_token,
      gmail_refresh_token: tokens.refresh_token || "",
      gmail_connected: "true",
    });
    res.redirect(`/?${params.toString()}`);
  } catch(err) {
    res.redirect(`/?gmail_error=token_exchange_failed`);
  }
}
