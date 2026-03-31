module.exports = async (req, res) => {
  const ticker = (req.query.ticker || '').toUpperCase();
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) throw new Error('Yahoo Finance returned ' + response.status);
    const data = await response.json();
    const meta = data.chart.result[0].meta;
    const price = meta.regularMarketPrice;
    const prev  = meta.chartPreviousClose || meta.previousClose;
    const change = price - prev;
    const changePct = (change / prev) * 100;
    res.json({ ticker, price, change, changePct, prev });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
