// Vercel serverless function: live (about 15 minutes delayed) quotes from Finnhub's free tier.
// Needs one environment variable in Vercel: FINNHUB_API_KEY. Without it the site simply stays static.
module.exports = async (req, res) => {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) { res.status(503).json({ error: 'not_configured' }); return; }
  const syms = String(req.query.symbols || '').split(',').map(x => x.trim().toUpperCase()).filter(x => /^[A-Z.\-]{1,6}$/.test(x)).slice(0, 60);
  if (!syms.length) { res.status(400).json({ error: 'bad_input' }); return; }
  const quotes = {};
  await Promise.all(syms.map(async sym => {
    try {
      const r = await fetch('https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(sym) + '&token=' + key);
      if (!r.ok) return;
      const j = await r.json();
      if (j && j.c > 0) quotes[sym] = { c: j.c, pc: j.pc, o: j.o, h: j.h, l: j.l, t: j.t };
    } catch (e) {}
  }));
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json({ quotes, at: Date.now() });
};
