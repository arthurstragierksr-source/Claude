const { yahooGet } = require('./_session');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const ticker = (req.query.ticker || '').replace(/[^A-Z0-9.\-]/g, '').toUpperCase();
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  try {
    const r = await yahooGet(
      'query1.finance.yahoo.com',
      `/v8/finance/chart/${ticker}?interval=1d&range=2d`
    );
    if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${r.body.slice(0, 100)}`);

    const d = JSON.parse(r.body);
    const m = d.chart.result[0].meta;
    const price  = m.regularMarketPrice;
    const prev   = m.chartPreviousClose ?? m.previousClose;
    const change = price - prev;

    res.json({ ticker, price, prev, change, pct: (change / prev) * 100 });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
