const https = require('https');

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function startDate(range) {
  const days = { '1mo': 35, '3mo': 95, '6mo': 185, '1y': 370, '2y': 740 };
  const d = new Date(Date.now() - (days[range] || 185) * 86400000);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function parseCSV(csv) {
  return csv.trim().split('\n')
    .filter(l => l && !l.startsWith('Date'))
    .map(line => {
      const [date, open, high, low, close, volume] = line.split(',');
      return { time: date.trim(), open: +open, high: +high, low: +low, close: +close, volume: +volume || 0 };
    })
    .filter(c => c.time && !isNaN(c.close) && c.close > 0);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const ticker = (req.query.ticker || '').replace(/[^A-Z0-9.\-]/g, '').toUpperCase();
  const range  = ['1mo','3mo','6mo','1y','2y'].includes(req.query.range) ? req.query.range : '6mo';
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  const key = `${ticker}:${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return res.json(hit.data);

  try {
    const url = `https://stooq.com/q/d/l/?s=${ticker.toLowerCase()}.us&d1=${startDate(range)}&i=d`;
    const r = await get(url);
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);

    const candles = parseCSV(r.body);
    if (!candles.length) throw new Error('No data — check ticker symbol');

    const payload = { ticker, candles };
    cache.set(key, { ts: Date.now(), data: payload });
    res.json(payload);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
