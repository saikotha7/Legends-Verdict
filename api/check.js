// Vercel serverless function: relays "Check any stock" prompts to Claude.
// Needs two environment variables in Vercel: ANTHROPIC_API_KEY and SITE_PASSCODE.
const hits = new Map();
const DAILY_LIMIT = 150; // requests per visitor per day (one check uses about 3)

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method' }); return; }
  const key = process.env.ANTHROPIC_API_KEY, code = process.env.SITE_PASSCODE;
  if (!key || !code) { res.status(503).json({ error: 'not_configured' }); return; }
  if ((req.headers['x-access-code'] || '') !== code) { res.status(401).json({ error: 'bad_code' }); return; }
  const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
  const k = ip + new Date().toISOString().slice(0, 10);
  const n = (hits.get(k) || 0) + 1; hits.set(k, n);
  if (hits.size > 500) hits.clear();
  if (n > DAILY_LIMIT) { res.status(429).json({ error: 'rate_limited' }); return; }
  const input = req.body && req.body.input;
  if (typeof input !== 'string' || !input || input.length > 12000) { res.status(400).json({ error: 'bad_input' }); return; }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 2500, messages: [{ role: 'user', content: input }] })
    });
    if (!r.ok) { res.status(r.status === 429 ? 429 : 502).json({ error: 'upstream' }); return; }
    const j = await r.json();
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    res.status(200).json({ text });
  } catch (e) { res.status(502).json({ error: 'upstream' }); }
};
