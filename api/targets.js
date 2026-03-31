const https = require('https');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const ticker = (req.query.ticker || '').replace(/[^A-Z0-9.\-]/g, '').toUpperCase();
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  const options = {
    hostname: 'query2.finance.yahoo.com',
    path: `/v10/finance/quoteSummary/${ticker}?modules=financialData`,
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
  };

  https.get(options, yRes => {
    let raw = '';
    yRes.on('data', c => raw += c);
    yRes.on('end', () => {
      try {
        const d = JSON.parse(raw);
        const fd = d?.quoteSummary?.result?.[0]?.financialData;
        if (!fd) return res.json({ low: null, mean: null, high: null });
        res.json({
          low:  fd.targetLowPrice?.raw  ?? null,
          mean: fd.targetMeanPrice?.raw ?? null,
          high: fd.targetHighPrice?.raw ?? null,
        });
      } catch (e) {
        res.status(502).json({ error: e.message });
      }
    });
  }).on('error', e => res.status(502).json({ error: e.message }));
};
