const https = require('https');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const ticker = (req.query.ticker || '').replace(/[^A-Z0-9.\-]/g, '').toUpperCase();
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  const options = {
    hostname: 'query2.finance.yahoo.com',
    path: `/v8/finance/chart/${ticker}?interval=1d&range=1d`,
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
  };

  https.get(options, yRes => {
    let raw = '';
    yRes.on('data', c => raw += c);
    yRes.on('end', () => {
      try {
        const d = JSON.parse(raw);
        const m = d.chart.result[0].meta;
        const price  = m.regularMarketPrice;
        const prev   = m.chartPreviousClose ?? m.previousClose;
        const change = price - prev;
        res.json({ ticker, price, change, pct: (change / prev) * 100 });
      } catch (e) {
        res.status(502).json({ error: e.message, raw: raw.slice(0, 200) });
      }
    });
  }).on('error', e => res.status(502).json({ error: e.message }));
};
