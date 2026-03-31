const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function daysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const ticker = (req.query.ticker || '').replace(/[^A-Z0-9.\-]/g, '').toUpperCase();
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  try {
    // Fetch last 10 trading days — enough to always have prev close
    const url = `https://stooq.com/q/d/l/?s=${ticker.toLowerCase()}.us&d1=${daysAgo(14)}&i=d`;
    const r = await get(url);
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);

    const lines = r.body.trim().split('\n').filter(l => l && !l.startsWith('Date'));
    if (lines.length < 2) throw new Error('Not enough data');

    const parse = line => {
      const [date, open, high, low, close, volume] = line.split(',');
      return { date, open: +open, high: +high, low: +low, close: +close, volume: +volume };
    };

    const current  = parse(lines[lines.length - 1]);
    const previous = parse(lines[lines.length - 2]);
    const change   = current.close - previous.close;

    res.json({
      ticker,
      price:  current.close,
      prev:   previous.close,
      change,
      pct:    (change / previous.close) * 100,
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
