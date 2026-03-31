const https = require('https');

function get(options) {
  return new Promise((resolve, reject) => {
    const req = https.get(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const ticker = (req.query.ticker || '').replace(/[^A-Z0-9.\-]/g, '').toUpperCase();
  const range  = ['1mo','3mo','6mo','1y','2y'].includes(req.query.range) ? req.query.range : '6mo';
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  try {
    const r = await get({
      hostname: 'query2.finance.yahoo.com',
      path: `/v8/finance/chart/${ticker}?interval=1d&range=${range}`,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com/',
      }
    });

    const d = JSON.parse(r.body);
    const result = d.chart.result[0];
    const timestamps = result.timestamp;
    const q = result.indicators.quote[0];

    const candles = timestamps.map((t, i) => ({
      time: t,
      open:   q.open[i],
      high:   q.high[i],
      low:    q.low[i],
      close:  q.close[i],
      volume: q.volume[i] || 0,
    })).filter(c => c.open != null && c.close != null);

    res.json({ ticker, candles });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
