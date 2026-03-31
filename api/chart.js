const https = require('https');

// Simple in-memory cache (per serverless instance)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function get(hostname, path) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname,
      path,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://finance.yahoo.com/',
        'Origin': 'https://finance.yahoo.com',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchWithRetry(ticker, range, attempt = 0) {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  const host = hosts[attempt % 2];
  const path = `/v8/finance/chart/${ticker}?interval=1d&range=${range}`;

  const res = await get(host, path);

  if (res.status === 429 && attempt < 4) {
    await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
    return fetchWithRetry(ticker, range, attempt + 1);
  }

  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  return JSON.parse(res.body);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const ticker = (req.query.ticker || '').replace(/[^A-Z0-9.\-]/g, '').toUpperCase();
  const range  = ['1mo','3mo','6mo','1y','2y'].includes(req.query.range) ? req.query.range : '6mo';
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  const cacheKey = `${ticker}:${range}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    const d = await fetchWithRetry(ticker, range);
    const result = d.chart.result[0];
    const timestamps = result.timestamp;
    const q = result.indicators.quote[0];

    const candles = timestamps.map((t, i) => ({
      time:   t,
      open:   q.open[i],
      high:   q.high[i],
      low:    q.low[i],
      close:  q.close[i],
      volume: q.volume[i] || 0,
    })).filter(c => c.open != null && c.close != null);

    const payload = { ticker, candles };
    cache.set(cacheKey, { ts: Date.now(), data: payload });
    res.json(payload);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
